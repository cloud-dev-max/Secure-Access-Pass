import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/activity-logs
 * V8.1 Requirement #3: Full historical activity log
 * Returns paginated access logs for complete audit trail
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

    // Get total count
    const { count: totalCount } = await adminClient
      .from('access_logs')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId)

    // Fetch paginated logs with user details
    const { data: logs, error } = await adminClient
      .from('access_logs')
      .select(`
        *,
        user:user_id(id, name, unit, role)
      `)
      .eq('property_id', propertyId)
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
