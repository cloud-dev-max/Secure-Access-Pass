import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import type { FacilityStatus } from '@/lib/types/database'

/**
 * GET /api/facility-status
 * Get real-time facility status including open/closed, occupancy, and maintenance mode
 */
export async function GET(request: NextRequest) {
  try {
    const adminClient = createAdminClient()
    const propertyId = process.env.NEXT_PUBLIC_DEFAULT_PROPERTY_ID || '00000000-0000-0000-0000-000000000001'

    // Fetch property settings
    const { data: property, error: propertyError } = await adminClient
      .from('properties')
      .select('operating_hours_start, operating_hours_end, max_capacity, is_maintenance_mode, maintenance_reason')
      .eq('id', propertyId)
      .single()

    if (propertyError) {
      console.error('Error fetching property:', propertyError)
      return NextResponse.json(
        { error: 'Failed to fetch property settings' },
        { status: 500 }
      )
    }

    // V7.3 Bug Fix #3: Get total occupancy including guests (not just residents)
    // Use the same logic as /api/occupancy for consistency
    
    // Count residents currently INSIDE
    const { count: residentsCount, error: residentsError } = await adminClient
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId)
      .eq('current_location', 'INSIDE')
      .eq('is_active', true)
      .eq('role', 'resident')

    if (residentsError) {
      console.error('Error counting residents:', residentsError)
      return NextResponse.json(
        { error: 'Failed to count occupancy' },
        { status: 500 }
      )
    }

    // Sum active_guests from residents who are INSIDE
    const { data: residentsWithGuests, error: guestsError } = await adminClient
      .from('profiles')
      .select('active_guests')
      .eq('property_id', propertyId)
      .eq('current_location', 'INSIDE')
      .eq('is_active', true)
      .eq('role', 'resident')

    if (guestsError) {
      console.error('Error fetching guests:', guestsError)
    }

    const accompanyingGuests = residentsWithGuests?.reduce(
      (sum, r) => sum + (r.active_guests || 0),
      0
    ) || 0

    // Count visitor passes used today
    const today = new Date().toISOString().split('T')[0]
    const { count: visitorPassesCount, error: visitorError } = await adminClient
      .from('guest_passes')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId)
      .eq('status', 'used')
      .gte('used_at', today)

    if (visitorError) {
      console.error('Error counting visitor passes:', visitorError)
    }

    // V7.3: Total occupancy = residents + their guests + visitor passes
    const occupancy = (residentsCount || 0) + accompanyingGuests + (visitorPassesCount || 0)
    
    console.log(`[V7.3] Total Occupancy: ${occupancy} = Residents: ${residentsCount} + Guests: ${accompanyingGuests} + Visitors: ${visitorPassesCount}`)

    // Check if facility is open based on operating hours
    const now = new Date()
    const currentTime = now.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    })

    const startTime = property.operating_hours_start
    const endTime = property.operating_hours_end

    // Simple time comparison (works for same-day hours)
    const isWithinHours = currentTime >= startTime && currentTime <= endTime
    const isOpen = !property.is_maintenance_mode && isWithinHours

    const status: FacilityStatus = {
      is_open: isOpen,
      current_occupancy: occupancy || 0,
      max_capacity: property.max_capacity,
      operating_hours: {
        start: property.operating_hours_start,
        end: property.operating_hours_end,
      },
      is_maintenance_mode: property.is_maintenance_mode,
      maintenance_reason: property.maintenance_reason,
    }

    return NextResponse.json(status, { status: 200 })
  } catch (error) {
    console.error('Unexpected error in GET /api/facility-status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
