import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/logs
 * V8.2 Fix #2: Full historical activity log with pagination
 * 
 * Query params:
 * - page: number (default 1)
 * - limit: number (default 50, max 100)
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

    // Get total count
    const { count } = await adminClient
      .from('access_logs')
      .select('*', { count: 'exact', head: true })
      .eq('property_id', propertyId)

    // V8.2 Fix #2: Get paginated logs with correct column names (name, unit)
    const { data: logs, error } = await adminClient
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
