import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import type { AccessCheckResult } from '@/lib/types/database'

/**
 * POST /api/check-access
 * Smart scanner logic with global rules enforcement
 * 
 * Priority order:
 * 1. Maintenance Mode check
 * 2. Operating Hours check
 * 3. Max Capacity check
 * 4. Guest Pass validation
 * 5. Resident access check
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    const propertyId = process.env.NEXT_PUBLIC_DEFAULT_PROPERTY_ID || '00000000-0000-0000-0000-000000000001'
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

    console.log(`\n=== Access Check Started ===`)
    console.log(`QR Code: ${qr_code}`)
    console.log(`Scan Type: ${scan_type}`)

    // ========================================================================
    // STEP 1: Fetch Facility Settings
    // ========================================================================
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('operating_hours_start, operating_hours_end, max_capacity, is_maintenance_mode, maintenance_reason')
      .eq('id', propertyId)
      .single()

    if (propertyError || !property) {
      console.error('Failed to fetch property settings:', propertyError)
      return NextResponse.json(
        { error: 'Failed to fetch facility settings' },
        { status: 500 }
      )
    }

    // ========================================================================
    // STEP 2: GLOBAL RULE - Maintenance Mode Check (ENTRY only)
    // ========================================================================
    if (scan_type === 'ENTRY' && property.is_maintenance_mode) {
      console.log('❌ DENIED: Facility in maintenance mode')
      
      const denialReason = property.maintenance_reason || 'Facility is currently closed for maintenance'
      
      return NextResponse.json({
        can_access: false,
        denial_reason: denialReason,
        user_name: null,
        user_id: null,
        current_location: null,
      }, { status: 200 })
    }

    // ========================================================================
    // STEP 3: GLOBAL RULE - Operating Hours Check (ENTRY only)
    // ========================================================================
    if (scan_type === 'ENTRY') {
      const now = new Date()
      const currentTime = now.toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      })

      const startTime = property.operating_hours_start
      const endTime = property.operating_hours_end

      const isWithinHours = currentTime >= startTime && currentTime <= endTime

      if (!isWithinHours) {
        console.log(`❌ DENIED: Outside operating hours (${startTime} - ${endTime})`)
        
        return NextResponse.json({
          can_access: false,
          denial_reason: `Pool is closed. Operating hours: ${startTime} - ${endTime}`,
          user_name: null,
          user_id: null,
          current_location: null,
        }, { status: 200 })
      }
      
      console.log(`✓ Within operating hours`)
    }

    // ========================================================================
    // STEP 4: GLOBAL RULE - Max Capacity Check (ENTRY only)
    // ========================================================================
    if (scan_type === 'ENTRY') {
      const { count: occupancy, error: countError } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('property_id', propertyId)
        .eq('current_location', 'INSIDE')
        .eq('is_active', true)

      if (countError) {
        console.error('Failed to count occupancy:', countError)
      } else {
        console.log(`Current occupancy: ${occupancy} / ${property.max_capacity}`)
        
        if (occupancy !== null && occupancy >= property.max_capacity) {
          console.log('❌ DENIED: Facility at max capacity')
          
          return NextResponse.json({
            can_access: false,
            denial_reason: `Facility is at maximum capacity (${property.max_capacity} people)`,
            user_name: null,
            user_id: null,
            current_location: null,
          }, { status: 200 })
        }
        
        console.log(`✓ Capacity OK`)
      }
    }

    // ========================================================================
    // STEP 5: Check if QR Code is a Guest Pass
    // ========================================================================
    const { data: guestPass, error: guestError } = await supabase
      .from('guest_passes')
      .select(`
        *,
        purchaser:purchased_by(name, unit)
      `)
      .eq('qr_code', qr_code)
      .single()

    if (guestPass && !guestError) {
      console.log('Guest pass detected:', guestPass.id)

      // Check if guest pass is valid
      const now = new Date()
      const expiresAt = new Date(guestPass.expires_at)

      if (guestPass.status === 'used') {
        console.log('❌ DENIED: Guest pass already used')
        
        return NextResponse.json({
          can_access: false,
          denial_reason: 'This guest pass has already been used (one-time entry)',
          user_name: guestPass.guest_name || 'Guest',
          user_id: null,
          current_location: null,
        }, { status: 200 })
      }

      if (guestPass.status === 'expired' || now > expiresAt) {
        console.log('❌ DENIED: Guest pass expired')
        
        return NextResponse.json({
          can_access: false,
          denial_reason: 'This guest pass has expired',
          user_name: guestPass.guest_name || 'Guest',
          user_id: null,
          current_location: null,
        }, { status: 200 })
      }

      if (guestPass.status === 'cancelled') {
        console.log('❌ DENIED: Guest pass cancelled')
        
        return NextResponse.json({
          can_access: false,
          denial_reason: 'This guest pass has been cancelled',
          user_name: guestPass.guest_name || 'Guest',
          user_id: null,
          current_location: null,
        }, { status: 200 })
      }

      // Guest pass is valid - Grant access and mark as used
      if (scan_type === 'ENTRY') {
        console.log('✅ GRANTED: Valid guest pass')

        // Mark guest pass as used
        await supabase
          .from('guest_passes')
          .update({ 
            status: 'used',
            used_at: now.toISOString(),
          })
          .eq('id', guestPass.id)

        // Log the access
        await supabase.from('access_logs').insert({
          user_id: guestPass.purchased_by, // Log who purchased it
          property_id: propertyId,
          qr_code: qr_code,
          scan_type: 'ENTRY',
          result: 'GRANTED',
          location_before: 'OUTSIDE',
          location_after: 'INSIDE',
          ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
          user_agent: request.headers.get('user-agent'),
        })

        return NextResponse.json({
          can_access: true,
          denial_reason: null,
          user_name: guestPass.guest_name || 'Guest',
          user_id: null,
          current_location: 'OUTSIDE',
        }, { status: 200 })
      } else {
        // EXIT for guest pass (unusual but allowed)
        return NextResponse.json({
          can_access: true,
          denial_reason: null,
          user_name: guestPass.guest_name || 'Guest',
          user_id: null,
          current_location: 'INSIDE',
        }, { status: 200 })
      }
    }

    // ========================================================================
    // STEP 6: Regular Resident Access Check (existing logic)
    // ========================================================================
    console.log('Checking resident access via check_user_access function')

    const { data, error } = await supabase.rpc('check_user_access', {
      p_qr_code: qr_code,
      p_scan_type: scan_type,
    })

    if (error) {
      console.error('Error checking resident access:', error)
      return NextResponse.json(
        { error: 'Failed to check access', details: error.message },
        { status: 500 }
      )
    }

    if (!data || data.length === 0) {
      console.log('❌ DENIED: Invalid QR code')
      
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
    console.log('Resident check result:', result)

    // If access is granted, update the user's location
    if (result.can_access && result.user_id) {
      const newLocation = scan_type === 'ENTRY' ? 'INSIDE' : 'OUTSIDE'
      
      console.log(`✅ GRANTED: Updating location to ${newLocation}`)

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
        property_id: profile?.property_id || propertyId,
        qr_code: qr_code,
        scan_type: scan_type,
        result: 'GRANTED',
        location_before: result.current_location,
        location_after: newLocation,
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        user_agent: request.headers.get('user-agent'),
      })
    } else if (result.user_id) {
      console.log(`❌ DENIED: ${result.denial_reason}`)
      
      // Log denied access
      const { data: profile } = await supabase
        .from('profiles')
        .select('property_id')
        .eq('id', result.user_id)
        .single()

      await supabase.from('access_logs').insert({
        user_id: result.user_id,
        property_id: profile?.property_id || propertyId,
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

    console.log('=== Access Check Complete ===\n')
    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    console.error('Unexpected error in check-access:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
