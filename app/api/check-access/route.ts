import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import type { AccessCheckResult } from '@/lib/types/database'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { qr_code, scan_type } = body

    if (!qr_code || !scan_type) {
      return NextResponse.json(
        { error: 'Missing required fields: qr_code, scan_type' },
        { status: 400 }
      )
    }

    if (!['ENTRY', 'EXIT'].includes(scan_type)) {
      return NextResponse.json(
        { error: 'Invalid scan_type. Must be ENTRY or EXIT' },
        { status: 400 }
      )
    }

    // Call the Supabase function to check access
    const { data, error } = await supabase.rpc('check_user_access', {
      p_qr_code: qr_code,
      p_scan_type: scan_type,
    })

    if (error) {
      console.error('Error checking access:', error)
      return NextResponse.json(
        { error: 'Failed to check access', details: error.message },
        { status: 500 }
      )
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { 
          can_access: false, 
          denial_reason: 'Invalid QR Code',
          user_name: null,
          user_id: null,
          current_location: null
        },
        { status: 200 }
      )
    }

    const result: AccessCheckResult = data[0]

    // If access is granted, update the user's location
    if (result.can_access && result.user_id) {
      const newLocation = scan_type === 'ENTRY' ? 'INSIDE' : 'OUTSIDE'
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          current_location: newLocation,
          last_scan_at: new Date().toISOString()
        })
        .eq('id', result.user_id)

      if (updateError) {
        console.error('Error updating location:', updateError)
      }

      // Log the access attempt
      const { data: profile } = await supabase
        .from('profiles')
        .select('property_id')
        .eq('id', result.user_id)
        .single()

      await supabase.from('access_logs').insert({
        user_id: result.user_id,
        property_id: profile?.property_id || process.env.NEXT_PUBLIC_DEFAULT_PROPERTY_ID,
        qr_code: qr_code,
        scan_type: scan_type,
        result: 'GRANTED',
        location_before: result.current_location,
        location_after: newLocation,
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        user_agent: request.headers.get('user-agent'),
      })
    } else if (result.user_id) {
      // Log denied access
      const { data: profile } = await supabase
        .from('profiles')
        .select('property_id')
        .eq('id', result.user_id)
        .single()

      await supabase.from('access_logs').insert({
        user_id: result.user_id,
        property_id: profile?.property_id || process.env.NEXT_PUBLIC_DEFAULT_PROPERTY_ID,
        qr_code: qr_code,
        scan_type: scan_type,
        result: 'DENIED',
        denial_reason: result.denial_reason,
        location_before: result.current_location,
        location_after: result.current_location,
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        user_agent: request.headers.get('user-agent'),
      })
    }

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    console.error('Unexpected error in check-access:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
