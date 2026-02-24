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
    const propertyId = process.env.NEXT_PUBLIC_DEFAULT_PROPERTY_ID || '00000000-0000-0000-0000-000000000001'
    
    // Get pagination parameters from query
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit
    
    // V9.1 Fix #3: Get date range filters
    const startDate = searchParams.get('startDate') // YYYY-MM-DD
    const endDate = searchParams.get('endDate') // YYYY-MM-DD

    // Build count query with date filters
    let countQuery = adminClient
      .from('access_logs')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId)
    
    // V9.1 Fix #3: Apply date range filters
    if (startDate) {
      const startOfDay = `${startDate}T00:00:00.000Z`
      countQuery = countQuery.gte('scanned_at', startOfDay)
    }
    if (endDate) {
      const endOfDay = `${endDate}T23:59:59.999Z`
      countQuery = countQuery.lte('scanned_at', endOfDay)
    }

    const { count: totalCount } = await countQuery

    // Build logs query with date filters
    let logsQuery = adminClient
      .from('access_logs')
      .select(`
        *,
        user:user_id(id, name, unit, role)
      `)
      .eq('property_id', propertyId)
    
    // V9.1 Fix #3: Apply date range filters
    if (startDate) {
      const startOfDay = `${startDate}T00:00:00.000Z`
      logsQuery = logsQuery.gte('scanned_at', startOfDay)
    }
    if (endDate) {
      const endOfDay = `${endDate}T23:59:59.999Z`
      logsQuery = logsQuery.lte('scanned_at', endOfDay)
    }

    const { data: logs, error } = await logsQuery
      .order('scanned_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching activity logs:', error)
      throw error
    }

    const totalPages = Math.ceil((totalCount || 0) / limit)

    return NextResponse.json({
      success: true,
      logs: logs || [],
      pagination: {
        page,
        limit,
        totalCount: totalCount || 0,
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
