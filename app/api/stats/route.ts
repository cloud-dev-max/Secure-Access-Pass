export const runtime = 'edge'

import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/stats?property_id=xxx
 * V10.8: Fetch dashboard statistics, filtered by property
 * Uses Admin Client (Service Role) to bypass RLS
 */
export async function GET(request: NextRequest) {
  try {
    const adminClient = createAdminClient()
    const { searchParams } = new URL(request.url)
    // V10.8: Support multi-tenancy via property_id query parameter
    const propertyId = searchParams.get('property_id') || process.env.NEXT_PUBLIC_DEFAULT_PROPERTY_ID || '00000000-0000-0000-0000-000000000001'
    
    console.log('[V10.8] Fetching stats for property:', propertyId)
    
    // Initialize default stats (graceful fallback)
    let totalResidents = 0
    let currentOccupancy = 0
    let activeRules = 0
    let recentActivity: any[] = []

    // Get total residents count
    try {
      const { count, error: residentsError } = await adminClient
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'resident')
        .eq('is_active', true)
        .eq('property_id', propertyId)

      if (residentsError) {
        console.error('Error fetching residents count:', residentsError)
      } else {
        totalResidents = count || 0
      }
    } catch (error) {
      console.error('Exception fetching residents count:', error)
    }

    // V7.1: Get current occupancy (residents + their guests currently INSIDE)
    try {
      const { count, error: occupancyError } = await adminClient
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'resident')
        .eq('is_active', true)
        .eq('current_location', 'INSIDE')
        .eq('property_id', propertyId)

      if (occupancyError) {
        console.error('Error fetching occupancy:', occupancyError)
      } else {
        const residentsInside = count || 0
        
        // V7.1: Also sum up active_guests for residents inside
        const { data: residentsWithGuests } = await adminClient
          .from('profiles')
          .select('active_guests')
          .eq('role', 'resident')
          .eq('is_active', true)
          .eq('current_location', 'INSIDE')
          .eq('property_id', propertyId)
        
        const totalGuests = residentsWithGuests?.reduce((sum, r) => sum + (r.active_guests || 0), 0) || 0
        
        // V8.6 Fix #1: Also count visitor passes currently inside
        const { count: visitorsInside } = await adminClient
          .from('visitor_passes')
          .select('id', { count: 'exact', head: true })
          .eq('property_id', propertyId)
          .eq('is_inside', true)
        
        currentOccupancy = residentsInside + totalGuests + (visitorsInside || 0)
      }
    } catch (error) {
      console.error('Exception fetching occupancy:', error)
    }

    // Get active rules count
    try {
      const { count, error: rulesError } = await adminClient
        .from('access_rules')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .eq('property_id', propertyId)

      if (rulesError) {
        console.error('Error fetching rules count:', rulesError)
      } else {
        activeRules = count || 0
      }
    } catch (error) {
      console.error('Exception fetching rules count:', error)
    }

    // V8.3 Fix #2: Get recent activity (last 10 access logs)
    // IMPORTANT: Use LEFT JOIN to include system events (broadcasts, status changes) with null user_id
    try {
      const { data, error: activityError } = await adminClient
        .from('access_logs')
        .select(`
          id,
          user_id,
          property_id,
          qr_code,
          scan_type,
          result,
          denial_reason,
          guest_count,
          location_before,
          location_after,
          scanned_at,
          profiles(name, unit)
        `)
        .eq('property_id', propertyId)
        .order('scanned_at', { ascending: false })
        .limit(10)

      if (activityError) {
        console.error('Error fetching recent activity:', activityError)
        // If access_logs table doesn't exist or has issues, just use empty array
        recentActivity = []
      } else {
        // V8.3 Fix #2: Transform data - handle null profiles for system events
        recentActivity = (data || []).map(log => ({
          id: log.id,
          user_id: log.user_id,
          property_id: log.property_id,
          qr_code: log.qr_code,
          scan_type: log.scan_type,
          result: log.result,
          denial_reason: log.denial_reason,
          guest_count: log.guest_count || 0,
          location_before: log.location_before,
          location_after: log.location_after,
          scanned_at: log.scanned_at,
          user: log.profiles ? {
            name: log.profiles.name,
            unit: log.profiles.unit,
          } : null, // null for system events (broadcasts, status changes)
        }))
      }
    } catch (error) {
      console.error('Exception fetching recent activity:', error)
      // If access_logs table doesn't exist, gracefully return empty array
      recentActivity = []
    }

    // Always return success with whatever data we could fetch
    return NextResponse.json({
      totalResidents,
      currentOccupancy,
      activeRules,
      recentActivity,
    }, { status: 200 })

  } catch (error) {
    console.error('Critical error in stats API:', error)
    
    // Even on critical error, return default stats instead of failing
    return NextResponse.json({
      totalResidents: 0,
      currentOccupancy: 0,
      activeRules: 0,
      recentActivity: [],
      error: 'Failed to fetch some statistics',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 200 }) // Return 200 so dashboard doesn't crash
  }
}
