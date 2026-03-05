export const runtime = 'edge'

import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/activity-logs
 * V8.1 Requirement #3: Full historical activity log
 * V9.1 Fix #3: Added date range filtering support
 * Returns paginated access logs for complete audit trail
 * 
 * Query params:
 * - page: number (default 1)
 * - limit: number (default 50)
 * - startDate: string (YYYY-MM-DD format, optional)
 * - endDate: string (YYYY-MM-DD format, optional)
 */
export async function GET(request: NextRequest) {
  try {
    const adminClient = createAdminClient()
    
    // Get pagination parameters from query
    const { searchParams } = new URL(request.url)
    // V10.8.19: Make property_id optional to support global Portfolio export
    // If property_id is provided, filter by it. If null, return all logs (global export)
    const propertyId = searchParams.get('property_id')
    
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit
    
    console.log('[V10.8.19] Activity logs query:', { propertyId: propertyId || 'ALL', page, limit })
    
    // V9.1 Fix #3: Get date range filters
    const startDate = searchParams.get('startDate') // YYYY-MM-DD
    const endDate = searchParams.get('endDate') // YYYY-MM-DD

    // V10.8.42: Step 1 - Fetch access_logs
    let accessLogsQuery = adminClient
      .from('access_logs')
      .select(`
        *,
        user:user_id(id, name, unit, role),
        property:property_id(id, name, property_name)
      `)
    
    if (propertyId) {
      accessLogsQuery = accessLogsQuery.eq('property_id', propertyId)
    }
    
    if (startDate) {
      const startOfDay = new Date(`${startDate}T00:00:00-04:00`).toISOString()
      accessLogsQuery = accessLogsQuery.gte('scanned_at', startOfDay)
    }
    if (endDate) {
      const endOfDay = new Date(`${endDate}T23:59:59.999-04:00`).toISOString()
      accessLogsQuery = accessLogsQuery.lte('scanned_at', endOfDay)
    }

    const { data: accessLogs, error: accessError } = await accessLogsQuery
      .order('scanned_at', { ascending: false })

    if (accessError) {
      console.error('Error fetching access logs:', accessError)
      throw accessError
    }

    // V10.8.42: Step 2 - Fetch visitor_passes (purchases)
    let purchaseLogsQuery = adminClient
      .from('visitor_passes')
      .select('id, created_at, guest_count, amount_paid, price_paid, purchased_by, qr_code')
    
    if (propertyId) {
      purchaseLogsQuery = purchaseLogsQuery.eq('property_id', propertyId)
    }
    
    if (startDate) {
      purchaseLogsQuery = purchaseLogsQuery.gte('created_at', new Date(`${startDate}T00:00:00-04:00`).toISOString())
    }
    if (endDate) {
      purchaseLogsQuery = purchaseLogsQuery.lte('created_at', new Date(`${endDate}T23:59:59.999-04:00`).toISOString())
    }

    const { data: guestPasses, error: passesError } = await purchaseLogsQuery
      .order('created_at', { ascending: false })

    if (passesError) {
      console.error('Error fetching visitor_passes:', passesError)
      // Continue without purchase logs if this fails
    }

    // V10.8.42: Step 3 - Fetch profiles for purchased_by mapping
    const residentIds = [...new Set((guestPasses || []).map(p => p.purchased_by).filter(Boolean))]
    const { data: profiles } = await adminClient
      .from('profiles')
      .select('id, name, unit')
      .in('id', residentIds.length > 0 ? residentIds : ['00000000-0000-0000-0000-000000000000'])

    const profileMap = new Map()
    ;(profiles || []).forEach(profile => {
      profileMap.set(profile.id, profile)
    })

    // V10.8.42: Step 4 - Map guest_passes to log-like objects
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
        user: profile ? { id: profile.id, name: profile.name, unit: profile.unit } : null,
        _isPurchase: true
      }
    })

    // V10.8.42: Step 5 - Merge and sort by timestamp
    const allLogs = [...(accessLogs || []), ...virtualPurchaseLogs].sort((a, b) => {
      const timeA = new Date(a.scanned_at).getTime()
      const timeB = new Date(b.scanned_at).getTime()
      return timeB - timeA // Descending
    })

    // V10.8.42: Step 6 - Apply pagination AFTER merge
    const totalCount = allLogs.length
    const paginatedLogs = allLogs.slice(offset, offset + limit)
    const totalPages = Math.ceil(totalCount / limit)

    console.log(`[V10.8.42] Merged ${accessLogs?.length || 0} access logs + ${virtualPurchaseLogs.length} purchase logs = ${totalCount} total`)

    return NextResponse.json({
      success: true,
      logs: paginatedLogs,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    }, { status: 200 })

  } catch (error) {
    console.error('Error in GET /api/activity-logs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch activity logs', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
