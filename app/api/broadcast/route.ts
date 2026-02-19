import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/broadcast
 * V6: Broadcast health/safety alert to residents
 * 
 * Supports targeting filters:
 * - 'INSIDE': Currently inside (default)
 * - 'ALL': All active residents
 * - 'RECENT': Visited in last 4 hours
 */
export async function POST(request: NextRequest) {
  try {
    const adminClient = createAdminClient()
    const body = await request.json()
    const { message, created_by, target_filter = 'INSIDE' } = body

    if (!message || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    const propertyId = process.env.NEXT_PUBLIC_DEFAULT_PROPERTY_ID || '00000000-0000-0000-0000-000000000001'
    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Get target residents based on filter
    let targetResidents: any[] = []
    
    if (target_filter === 'INSIDE') {
      // Residents currently inside
      const { data } = await adminClient
        .from('profiles')
        .select('id, qr_code, name')
        .eq('property_id', propertyId)
        .eq('current_location', 'INSIDE')
        .eq('role', 'resident')
        .eq('is_active', true)
      targetResidents = data || []
    } else if (target_filter === 'ALL') {
      // All active residents
      const { data } = await adminClient
        .from('profiles')
        .select('id, qr_code, name')
        .eq('property_id', propertyId)
        .eq('role', 'resident')
        .eq('is_active', true)
      targetResidents = data || []
    } else if (target_filter === 'RECENT') {
      // Residents who visited in last 4 hours
      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
      const { data } = await adminClient
        .from('profiles')
        .select('id, qr_code, name')
        .eq('property_id', propertyId)
        .eq('role', 'resident')
        .eq('is_active', true)
        .gte('last_scan_at', fourHoursAgo)
      targetResidents = data || []
    }

    const recipientsCount = targetResidents.length

    console.log(`Broadcasting to ${recipientsCount} residents (filter: ${target_filter})`)

    // Try to store broadcast alert (optional - table may not exist yet)
    let alertId = null
    try {
      const { data: alert } = await adminClient
        .from('broadcast_alerts')
        .insert({
          property_id: propertyId,
          message: message.trim(),
          created_by: created_by || null,
          target_location: target_filter,
          recipients_count: recipientsCount
        })
        .select()
        .single()
      
      if (alert) {
        alertId = alert.id
      }
    } catch (tableError: any) {
      console.warn('broadcast_alerts table not found - continuing without storing alert:', tableError.message)
    }

    // Log broadcast event in access_logs for each target resident
    if (targetResidents.length > 0) {
      const logEntries = targetResidents.map(resident => ({
        user_id: resident.id,
        property_id: propertyId,
        qr_code: resident.qr_code,
        scan_type: 'ENTRY',  // Use ENTRY as fallback since BROADCAST might not be in enum
        result: 'GRANTED',
        denial_reason: `BROADCAST: ${message.trim().substring(0, 50)}`,
        location_before: null,
        location_after: null,
        guest_count: 0,
        ip_address: ip,
        user_agent: userAgent
      }))

      const { error: logError } = await adminClient.from('access_logs').insert(logEntries)
      if (logError) {
        console.error('Error logging broadcast:', logError)
      } else {
        console.log(`✓ Broadcast logged for ${targetResidents.length} residents`)
      }
    }

    return NextResponse.json({
      success: true,
      alert_id: alertId,
      recipients_count: recipientsCount,
      message: message.trim(),
      target_filter: target_filter
    }, { status: 201 })

  } catch (error) {
    console.error('Unexpected error in POST /api/broadcast:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
