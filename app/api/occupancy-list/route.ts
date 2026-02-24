import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/occupancy-list
 * V8.0 Requirement #1 & #6: Unified occupancy list
 * Returns both residents AND visitor passes currently inside
 * This ensures synchronization across dashboard and scanner
 */
export async function GET(request: NextRequest) {
  try {
    const adminClient = createAdminClient()
    const propertyId = process.env.NEXT_PUBLIC_DEFAULT_PROPERTY_ID || '00000000-0000-0000-0000-000000000001'

    // Get residents currently inside
    const { data: residents, error: residentsError } = await adminClient
      .from('profiles')
      .select('id, name, unit, active_guests, current_location')
      .eq('property_id', propertyId)
      .eq('current_location', 'INSIDE')
      .eq('role', 'resident')
      .eq('is_active', true)
      .order('name')

    if (residentsError) {
      console.error('Error fetching residents:', residentsError)
      throw residentsError
    }

    // V8.7 Fix #2: Get ALL visitor passes currently inside (no date filter)
    // This prevents "phantom visitors" who forget to scan out
    const { data: visitors, error: visitorsError } = await adminClient
      .from('visitor_passes')
      .select(`
        id,
        guest_name,
        is_inside,
        expires_at,
        status,
        purchased_by,
        purchaser:purchased_by(name, unit)
      `)
      .eq('property_id', propertyId)
      .eq('is_inside', true)

    if (visitorsError) {
      console.error('Error fetching visitors:', visitorsError)
      throw visitorsError
    }

    // Combine into unified list
    const occupants = [
      ...(residents || []).map(r => ({
        type: 'resident',
        id: r.id,
        name: r.name,
        unit: r.unit,
        active_guests: r.active_guests || 0,
        total_people: 1 + (r.active_guests || 0)
      })),
      ...(visitors || []).map(v => ({
        type: 'visitor',
        id: v.id,
        name: v.guest_name || 'Visitor',
        unit: 'Visitor Pass',
        purchaser_name: v.purchaser?.name || 'Unknown',
        purchaser_unit: v.purchaser?.unit || 'N/A',
        active_guests: 0,
        total_people: 1
      }))
    ]

    // Calculate totals
    const residentCount = residents?.length || 0
    const visitorCount = visitors?.length || 0
    const guestCount = (residents || []).reduce((sum, r) => sum + (r.active_guests || 0), 0)
    const totalOccupancy = residentCount + guestCount + visitorCount

    return NextResponse.json({
      success: true,
      occupants,
      totals: {
        residents: residentCount,
        accompanying_guests: guestCount,
        visitor_passes: visitorCount,
        total: totalOccupancy
      }
    }, { status: 200 })

  } catch (error) {
    console.error('Error in GET /api/occupancy-list:', error)
    return NextResponse.json(
      { error: 'Failed to fetch occupancy list', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
