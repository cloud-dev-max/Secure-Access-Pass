export const runtime = 'edge'

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
    // V10.8.23: Accept property_id from query parameter for correct property context
    const { searchParams } = new URL(request.url)
    const propertyId = searchParams.get('property_id')
    
    if (!propertyId) {
      return NextResponse.json(
        { error: 'property_id is required' },
        { status: 400 }
      )
    }
    
    console.log('[V10.8.23] Facility status query for property:', propertyId)

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

    // V8.6 Fix #1: Count visitor passes currently INSIDE (not just used today)
    const { count: visitorPassesCount, error: visitorError } = await adminClient
      .from('visitor_passes')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId)
      .eq('is_inside', true)

    if (visitorError) {
      console.error('Error counting visitor passes:', visitorError)
    }

    // V7.3: Total occupancy = residents + their guests + visitor passes
    const occupancy = (residentsCount || 0) + accompanyingGuests + (visitorPassesCount || 0)
    
    console.log(`[V7.3] Total Occupancy: ${occupancy} = Residents: ${residentsCount} + Guests: ${accompanyingGuests} + Visitors: ${visitorPassesCount}`)

    // V10.8.21: Timezone-independent time comparison using minutes since midnight
    const now = new Date()
    
    // Get current local time in minutes since midnight
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    
    // Parse database time strings (HH:MM:SS) into minutes since midnight
    const parseTimeToMinutes = (timeStr: string): number => {
      const [hours, minutes] = timeStr.split(':').map(Number)
      return hours * 60 + minutes
    }
    
    const startMinutes = parseTimeToMinutes(property.operating_hours_start)
    const endMinutes = parseTimeToMinutes(property.operating_hours_end)
    
    // Check if current time falls within operating hours
    const isWithinHours = currentMinutes >= startMinutes && currentMinutes <= endMinutes
    const isOpen = !property.is_maintenance_mode && isWithinHours
    
    console.log('[V10.8.21] Open/closed check:', {
      currentMinutes,
      startMinutes,
      endMinutes,
      isWithinHours,
      is_maintenance_mode: property.is_maintenance_mode,
      isOpen
    })

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
