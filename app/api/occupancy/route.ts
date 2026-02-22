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
    
    // Get property ID from environment or query
    const propertyId = process.env.NEXT_PUBLIC_DEFAULT_PROPERTY_ID || '00000000-0000-0000-0000-000000000001'

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

    // Count active visitor passes that have been used (INSIDE) today
    // Note: We don't track visitor pass location, so we estimate based on today's usage
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    
    const { count: visitorPassesCount } = await adminClient
      .from('visitor_passes')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId)
      .eq('status', 'used')
      .gte('used_at', todayStart.toISOString())

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
