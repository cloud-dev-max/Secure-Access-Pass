import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/broadcast
 * V6: Broadcast health/safety alert to all residents currently INSIDE
 */
export async function POST(request: NextRequest) {
  try {
    const adminClient = createAdminClient()
    const body = await request.json()
    const { message, created_by } = body

    if (!message || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    const propertyId = process.env.NEXT_PUBLIC_DEFAULT_PROPERTY_ID || '00000000-0000-0000-0000-000000000001'

    // Count residents currently INSIDE (recipients of alert)
    const { count: recipientsCount } = await adminClient
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId)
      .eq('current_location', 'INSIDE')
      .eq('role', 'resident')
      .eq('is_active', true)

    // Create broadcast alert record
    const { data: alert, error: alertError } = await adminClient
      .from('broadcast_alerts')
      .insert({
        property_id: propertyId,
        message: message.trim(),
        created_by: created_by || null,
        target_location: 'INSIDE',
        recipients_count: recipientsCount || 0
      })
      .select()
      .single()

    if (alertError) {
      console.error('Error creating broadcast alert:', alertError)
      return NextResponse.json(
        { error: 'Failed to create alert', details: alertError.message },
        { status: 500 }
      )
    }

    // Log broadcast event in access_logs for each resident INSIDE
    const { data: insideResidents } = await adminClient
      .from('profiles')
      .select('id, qr_code')
      .eq('property_id', propertyId)
      .eq('current_location', 'INSIDE')
      .eq('role', 'resident')
      .eq('is_active', true)

    if (insideResidents && insideResidents.length > 0) {
      const ip = request.headers.get('x-forwarded-for') || 'unknown'
      const userAgent = request.headers.get('user-agent') || 'unknown'

      const logEntries = insideResidents.map(resident => ({
        user_id: resident.id,
        property_id: propertyId,
        qr_code: resident.qr_code,
        scan_type: 'BROADCAST',
        result: 'GRANTED',
        denial_reason: null,
        location_before: 'INSIDE',
        location_after: 'INSIDE',
        guest_count: 0,
        event_type: 'BROADCAST',
        ip_address: ip,
        user_agent: userAgent
      }))

      await adminClient.from('access_logs').insert(logEntries)
      console.log(`✓ Broadcast alert sent to ${insideResidents.length} residents`)
    }

    return NextResponse.json({
      success: true,
      alert_id: alert.id,
      recipients_count: recipientsCount || 0,
      message: message.trim()
    }, { status: 201 })
  } catch (error) {
    console.error('Unexpected error in POST /api/broadcast:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/broadcast
 * Get recent broadcast alerts
 */
export async function GET(request: NextRequest) {
  try {
    const adminClient = createAdminClient()
    const propertyId = process.env.NEXT_PUBLIC_DEFAULT_PROPERTY_ID || '00000000-0000-0000-0000-000000000001'

    const { data: alerts, error } = await adminClient
      .from('broadcast_alerts')
      .select('*')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Error fetching broadcast alerts:', error)
      return NextResponse.json(
        { error: 'Failed to fetch alerts', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(alerts || [], { status: 200 })
  } catch (error) {
    console.error('Unexpected error in GET /api/broadcast:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
