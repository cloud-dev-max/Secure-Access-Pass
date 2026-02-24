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
    const propertyId = process.env.NEXT_PUBLIC_DEFAULT_PROPERTY_ID || '00000000-0000-0000-0000-000000000001'
    
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = (page - 1) * limit
    
    // V9.1 Fix #3: Support both single date and date range
    const dateFilter = searchParams.get('date') // Legacy: single day filter
    const startDate = searchParams.get('startDate') // V9.1: range start
    const endDate = searchParams.get('endDate') // V9.1: range end

    // V8.3 Fix #3 + V9.1 Fix #3: Build query with optional date filters
    let countQuery = adminClient
      .from('access_logs')
      .select('*', { count: 'exact', head: true })
      .eq('property_id', propertyId)
    
    // V9.1 Fix #3: Apply date range filters
    if (dateFilter) {
      // Legacy: single day filter (00:00:00 to 23:59:59)
      const startOfDay = `${dateFilter}T00:00:00.000Z`
      const endOfDay = `${dateFilter}T23:59:59.999Z`
      countQuery = countQuery.gte('scanned_at', startOfDay).lte('scanned_at', endOfDay)
    } else {
      // V9.1: date range filter
      if (startDate) {
        const startOfDay = `${startDate}T00:00:00.000Z`
        countQuery = countQuery.gte('scanned_at', startOfDay)
      }
      if (endDate) {
        const endOfDay = `${endDate}T23:59:59.999Z`
        countQuery = countQuery.lte('scanned_at', endOfDay)
      }
    }

    const { count } = await countQuery

    // V8.2 Fix #2: Get paginated logs with correct column names (name, unit)
    let logsQuery = adminClient
      .from('access_logs')
      .select(`
        *,
        profile:user_id(
          id,
          name,
          unit
        )
      `)
      .eq('property_id', propertyId)
    
    // V9.1 Fix #3: Apply date filters
    if (dateFilter) {
      // Legacy: single day filter
      const startOfDay = `${dateFilter}T00:00:00.000Z`
      const endOfDay = `${dateFilter}T23:59:59.999Z`
      logsQuery = logsQuery.gte('scanned_at', startOfDay).lte('scanned_at', endOfDay)
    } else {
      // V9.1: date range filter
      if (startDate) {
        const startOfDay = `${startDate}T00:00:00.000Z`
        logsQuery = logsQuery.gte('scanned_at', startOfDay)
      }
      if (endDate) {
        const endOfDay = `${endDate}T23:59:59.999Z`
        logsQuery = logsQuery.lte('scanned_at', endOfDay)
      }
    }
    
    const { data: logs, error } = await logsQuery
      .order('scanned_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching logs:', error)
      return NextResponse.json(
        { error: 'Failed to fetch logs', details: error.message },
        { status: 500 }
      )
    }

    const totalPages = Math.ceil((count || 0) / limit)

    return NextResponse.json({
      logs: logs || [],
      total: count || 0,
      page,
      limit,
      totalPages
    })

  } catch (error) {
    console.error('Error in GET /api/logs:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
