import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/log-status-change
 * V7.8 Feature #3: Log pool status changes (OPEN/CLOSED) to activity log
 * 
 * Request body:
 * - new_status: 'OPENED' | 'CLOSED'
 * - source: 'Scanner' | 'Manager Dashboard'
 * - reason: string (closure reason, empty for opening)
 * 
 * Creates a system log entry in access_logs table with:
 * - qr_code: 'STATUS_CHANGE'
 * - user_id: null (system action)
 * - denial_reason: Status change message with source
 */
export async function POST(request: NextRequest) {
  try {
    const adminClient = createAdminClient()
    const propertyId = process.env.NEXT_PUBLIC_DEFAULT_PROPERTY_ID || '00000000-0000-0000-0000-000000000001'
    
    const { new_status, source, reason } = await request.json()

    if (!new_status || !source) {
      return NextResponse.json(
        { error: 'Missing required fields: new_status, source' },
        { status: 400 }
      )
    }

    // Get client info
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Create log message with source attribution
    let logMessage = `🛡️ Pool ${new_status} - Status changed from ${source}`
    if (reason) {
      logMessage += ` (Reason: ${reason})`
    }

    // Create system log entry
    const logEntry = {
      user_id: null, // System action, not tied to a specific user
      property_id: propertyId,
      qr_code: 'STATUS_CHANGE', // V7.8: Special identifier for status changes
      scan_type: 'ENTRY', // Required field, will be displayed with Shield icon
      result: 'GRANTED',
      denial_reason: logMessage, // Contains the status change details
      location_before: null,
      location_after: null,
      guest_count: 0,
      ip_address: ip,
      user_agent: userAgent
    }

    const { error: logError } = await adminClient
      .from('access_logs')
      .insert(logEntry)

    if (logError) {
      console.error('Error logging status change:', logError)
      return NextResponse.json(
        { error: 'Failed to log status change', details: logError.message },
        { status: 500 }
      )
    }

    console.log(`✓ Status change logged: Pool ${new_status} from ${source}`)
    
    return NextResponse.json({
      success: true,
      message: `Status change logged: Pool ${new_status}`
    }, { status: 200 })

  } catch (error) {
    console.error('Error in POST /api/log-status-change:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
