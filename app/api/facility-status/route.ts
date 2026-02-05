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

    // Get current occupancy (count of residents currently INSIDE)
    const { count: occupancy, error: countError } = await adminClient
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId)
      .eq('current_location', 'INSIDE')
      .eq('is_active', true)
      .eq('role', 'resident')

    if (countError) {
      console.error('Error counting occupancy:', countError)
      return NextResponse.json(
        { error: 'Failed to count occupancy' },
        { status: 500 }
      )
    }

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
