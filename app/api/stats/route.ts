import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

/**
 * GET /api/stats
 * Fetch dashboard statistics: total residents, occupancy, recent activity
 */
export async function GET() {
  try {
    const adminClient = createAdminClient()
    
    // Get total residents count
    const { count: totalResidents } = await adminClient
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'resident')
      .eq('is_active', true)

    // Get current occupancy (residents currently INSIDE)
    const { count: currentOccupancy } = await adminClient
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'resident')
      .eq('is_active', true)
      .eq('current_location', 'INSIDE')

    // Get recent activity (last 10 access logs)
    const { data: recentActivity } = await adminClient
      .from('access_logs')
      .select(`
        *,
        user:profiles(name, unit)
      `)
      .order('scanned_at', { ascending: false })
      .limit(10)

    // Get active rules count
    const { count: activeRules } = await adminClient
      .from('access_rules')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)

    return NextResponse.json({
      totalResidents: totalResidents || 0,
      currentOccupancy: currentOccupancy || 0,
      activeRules: activeRules || 0,
      recentActivity: recentActivity || [],
    }, { status: 200 })
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch statistics', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
