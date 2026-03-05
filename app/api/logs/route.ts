export const runtime = 'edge'

import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/logs
 * V8.3 Fix #3: Full historical activity log with pagination and date filter
 * V9.1 Fix #3: Added date range filtering support (startDate, endDate)
 * 
 * Query params:
 * - page: number (default 1)
 * - limit: number (default 50, max 100)
 * - date: string (YYYY-MM-DD format, optional - filters logs for specific day)
 * - startDate: string (YYYY-MM-DD format, optional - start of date range)
 * - endDate: string (YYYY-MM-DD format, optional - end of date range)
 * 
 * Returns:
 * - logs: array of access_logs with user profile data
 * - total: total count
 * - page: current page
 * - totalPages: total pages
 * 
 * FIXED: Changed full_name to name and unit_number to unit to match profiles table schema
 */
export async function GET(request: NextRequest) {
  try {
    const adminClient = createAdminClient()
    const { searchParams } = new URL(request.url)
    
    // V10.8.12: Support property_id query param for multi-tenancy
    const propertyId = searchParams.get('property_id') || process.env.NEXT_PUBLIC_DEFAULT_PROPERTY_ID || '00000000-0000-0000-0000-000000000001'
    
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = (page - 1) * limit
    
    // V9.1 Fix #3: Support both single date and date range
    const dateFilter = searchParams.get('date') // Legacy: single day filter
    const startDate = searchParams.get('startDate') // V9.1: range start
    const endDate = searchParams.get('endDate') // V9.1: range end
    
    console.log('[V10.8.34] Admin client with visitor_passes table for activity logs:', propertyId)

    // V10.8.32: Admin client bypasses RLS, fetch access_logs and guest_passes separately, merge in JS
    
    // Step 1: Fetch access_logs
    let accessLogsQuery = adminClient
      .from('access_logs')
      .select('*, profile:user_id(id, name, unit)')
      .eq('property_id', propertyId)
    
    // V10.8.37: Fix timezone shift with EST offset
    if (dateFilter) {
      const startOfDay = new Date(`${dateFilter}T00:00:00-04:00`).toISOString()
      const endOfDay = new Date(`${dateFilter}T23:59:59.999-04:00`).toISOString()
      accessLogsQuery = accessLogsQuery.gte('scanned_at', startOfDay).lte('scanned_at', endOfDay)
    } else {
      if (startDate) accessLogsQuery = accessLogsQuery.gte('scanned_at', new Date(`${startDate}T00:00:00-04:00`).toISOString())
      if (endDate) accessLogsQuery = accessLogsQuery.lte('scanned_at', new Date(`${endDate}T23:59:59.999-04:00`).toISOString())
    }
    
    const { data: accessLogs, error: accessError } = await accessLogsQuery
      .order('scanned_at', { ascending: false })

    if (accessError) {
      console.error('[V10.8.32] Error fetching access_logs:', accessError)
      return NextResponse.json(
        { error: accessError.message || accessError.toString(), details: JSON.stringify(accessError) },
        { status: 500 }
      )
    }

    // Step 2: Fetch recent guest_passes as virtual purchase logs
    let purchaseLogsQuery = adminClient
      .from('visitor_passes')
      .select('id, created_at, guest_count, amount_paid, price_paid, purchased_by, qr_code')
      .eq('property_id', propertyId)
    
    // V10.8.37: Fix timezone shift with EST offset
    if (dateFilter) {
      const startOfDay = new Date(`${dateFilter}T00:00:00-04:00`).toISOString()
      const endOfDay = new Date(`${dateFilter}T23:59:59.999-04:00`).toISOString()
      purchaseLogsQuery = purchaseLogsQuery.gte('created_at', startOfDay).lte('created_at', endOfDay)
    } else {
      if (startDate) purchaseLogsQuery = purchaseLogsQuery.gte('created_at', new Date(`${startDate}T00:00:00-04:00`).toISOString())
      if (endDate) purchaseLogsQuery = purchaseLogsQuery.lte('created_at', new Date(`${endDate}T23:59:59.999-04:00`).toISOString())
    }
    
    const { data: guestPasses, error: passesError } = await purchaseLogsQuery
      .order('created_at', { ascending: false })

    if (passesError) {
      console.error('[V10.8.32] Error fetching guest_passes:', passesError)
      // Continue without purchase logs if this fails
    }

    // Step 3: Fetch profiles for purchased_by mapping
    const residentIds = [...new Set((guestPasses || []).map(p => p.purchased_by).filter(Boolean))]
    const { data: profiles } = await adminClient
      .from('profiles')
      .select('id, name, unit')
      .in('id', residentIds.length > 0 ? residentIds : ['00000000-0000-0000-0000-000000000000'])

    const profileMap = new Map()
    ;(profiles || []).forEach(profile => {
      profileMap.set(profile.id, profile)
    })

    // Step 4: Map guest_passes to log-like objects
    const virtualPurchaseLogs = (guestPasses || []).map(pass => {
      const profile = pass.purchased_by ? profileMap.get(pass.purchased_by) : null
      const amount = pass.amount_paid || pass.price_paid || 0
      return {
        id: `purchase_${pass.id}`,
        property_id: propertyId,
        user_id: pass.purchased_by,
        qr_code: pass.qr_code,
        scan_type: 'PURCHASE',
        result: 'SUCCESS',
        denial_reason: `Pass Purchased - $${amount.toFixed(2)}`,
        guest_count: pass.guest_count || 0,
        scanned_at: pass.created_at,
        profile: profile ? { id: profile.id, name: profile.name, unit: profile.unit } : null,
        _isPurchase: true // Flag for UI
      }
    })

    // Step 5: Merge and sort by timestamp
    const allLogs = [...(accessLogs || []), ...virtualPurchaseLogs].sort((a, b) => {
      const timeA = new Date(a.scanned_at).getTime()
      const timeB = new Date(b.scanned_at).getTime()
      return timeB - timeA // Descending
    })

    // Step 6: Apply pagination
    const total = allLogs.length
    const paginatedLogs = allLogs.slice(offset, offset + limit)
    const totalPages = Math.ceil(total / limit)

    console.log(`[V10.8.32] Merged ${accessLogs?.length || 0} access logs + ${virtualPurchaseLogs.length} purchase logs = ${total} total`)

    return NextResponse.json({
      logs: paginatedLogs,
      total,
      page,
      limit,
      totalPages
    })

  } catch (error) {
    console.error('[V10.8.32] Error in GET /api/logs:', error)
    // V10.8.32: Return exact error for debugging
    return NextResponse.json(
      { error: error instanceof Error ? error.message : (error?.toString() || 'Internal server error'), details: JSON.stringify(error) },
      { status: 500 }
    )
  }
}
