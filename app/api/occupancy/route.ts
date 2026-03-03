export const runtime = 'edge'

import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/occupancy
 * V6: Get occupancy breakdown
 * - Total occupancy
 * - Residents count
 * - Accompanying guests count
 * - Visitor passes count (active in facility)
 */
export async function GET(request: NextRequest) {
  try {
    const adminClient = createAdminClient()
    
    // V10.8.17: Require property_id from query parameter
    const { searchParams } = new URL(request.url)
    const propertyId = searchParams.get('property_id')
    
    if (!propertyId) {
      return NextResponse.json(
        { error: 'property_id is required' },
        { status: 400 }
      )
    }

    // Count residents currently INSIDE
    const { count: residentsCount } = await adminClient
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId)
      .eq('current_location', 'INSIDE')
      .eq('role', 'resident')
      .eq('is_active', true)

    // Sum active_guests for all residents INSIDE
    const { data: residentsWithGuests } = await adminClient
      .from('profiles')
      .select('active_guests')
      .eq('property_id', propertyId)
      .eq('current_location', 'INSIDE')
      .eq('role', 'resident')
      .eq('is_active', true)

    const accompanyingGuests = residentsWithGuests?.reduce((sum, r) => sum + (r.active_guests || 0), 0) || 0

    // V8.6 Fix #1: Count visitor passes currently INSIDE (not just used today)
    const { count: visitorPassesCount } = await adminClient
      .from('visitor_passes')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId)
      .eq('is_inside', true)

    const totalOccupancy = (residentsCount || 0) + accompanyingGuests + (visitorPassesCount || 0)

    return NextResponse.json({
      total: totalOccupancy,
      residents: residentsCount || 0,
      accompanying_guests: accompanyingGuests,
      visitor_passes: visitorPassesCount || 0
    }, { status: 200 })
  } catch (error) {
    console.error('Error fetching occupancy:', error)
    return NextResponse.json(
      { error: 'Failed to fetch occupancy', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
