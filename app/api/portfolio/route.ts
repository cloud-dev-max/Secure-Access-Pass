import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/portfolio
 * Fetch aggregated data for all properties in the portfolio
 * Returns: global KPIs + per-property stats
 * V9.0 Enterprise Portfolio Edition
 */
export async function GET(request: NextRequest) {
  try {
    const adminClient = createAdminClient()

    // Fetch all properties
    const { data: properties, error: propertiesError } = await adminClient
      .from('properties')
      .select('id, property_name, is_maintenance_mode, max_capacity, guest_pass_price')
      .order('property_name', { ascending: true })

    if (propertiesError) {
      console.error('Error fetching properties:', propertiesError)
      return NextResponse.json(
        { error: 'Failed to fetch properties', details: propertiesError.message },
        { status: 500 }
      )
    }

    if (!properties || properties.length === 0) {
      return NextResponse.json({
        globalKPIs: {
          totalOccupancy: 0,
          totalTodaysRevenue: 0,
          totalActiveResidents: 0,
          totalProperties: 0
        },
        properties: []
      }, { status: 200 })
    }

    // For each property, fetch occupancy and revenue data
    const propertyStats = await Promise.all(
      properties.map(async (property) => {
        // V9.1 Fix #1: Fetch current occupancy using profiles table (residents currently INSIDE)
        const { count: residentsInside, error: occupancyError } = await adminClient
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'resident')
          .eq('is_active', true)
          .eq('current_location', 'INSIDE')

        const residentsInsideCount = residentsInside || 0
        
        // V9.1 Fix #1: Sum up active_guests for residents inside
        const { data: residentsWithGuests } = await adminClient
          .from('profiles')
          .select('active_guests')
          .eq('role', 'resident')
          .eq('is_active', true)
          .eq('current_location', 'INSIDE')
        
        const totalGuests = residentsWithGuests?.reduce((sum, r) => sum + (r.active_guests || 0), 0) || 0
        
        // V9.1 Fix #1: Count visitor passes currently inside
        const { count: visitorsInside } = await adminClient
          .from('visitor_passes')
          .select('id', { count: 'exact', head: true })
          .eq('property_id', property.id)
          .eq('is_inside', true)

        const currentOccupancy = residentsInsideCount + totalGuests + (visitorsInside || 0)

        // V9.1 Fix #1: Fetch active residents count (total, not just inside)
        const { count: activeResidentsCount, error: residentsError } = await adminClient
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'resident')
          .eq('is_active', true)

        // V9.4 Fix #3: Copy EXACT logic from /api/revenue - use local date string matching
        // Get TODAY's date string (local timezone)
        const today = new Date()
        const getTodayDateString = () => {
          const year = today.getFullYear()
          const month = String(today.getMonth() + 1).padStart(2, '0')
          const day = String(today.getDate()).padStart(2, '0')
          return `${year}-${month}-${day}`
        }
        const todayStr = getTodayDateString()

        // Fetch ALL passes for this property
        const { data: allPasses, error: revenueError } = await adminClient
          .from('guest_passes')
          .select('price, created_at')
          .eq('property_id', property.id)

        // Filter to today's passes using local date string (EXACT logic from /api/revenue lines 58-71)
        let todaysRevenue = 0
        if (allPasses) {
          allPasses.forEach(pass => {
            // Convert created_at to local date string
            const passDate = new Date(pass.created_at)
            const year = passDate.getFullYear()
            const month = String(passDate.getMonth() + 1).padStart(2, '0')
            const day = String(passDate.getDate()).padStart(2, '0')
            const date = `${year}-${month}-${day}`
            
            // If pass was created today, add to revenue
            if (date === todayStr) {
              todaysRevenue += (pass.price || 0)
            }
          })
        }

        return {
          id: property.id,
          name: property.property_name || 'Unnamed Property',
          status: property.is_maintenance_mode ? 'Closed' : 'Open',
          currentOccupancy,
          maxCapacity: property.max_capacity || 50,
          occupancyRatio: property.max_capacity ? (currentOccupancy / property.max_capacity * 100).toFixed(0) : '0',
          todaysRevenue,
          activeResidents: activeResidentsCount || 0,
          guestPassPrice: property.guest_pass_price || 5.00
        }
      })
    )

    // Calculate global KPIs
    const globalKPIs = {
      totalOccupancy: propertyStats.reduce((sum, prop) => sum + prop.currentOccupancy, 0),
      totalTodaysRevenue: propertyStats.reduce((sum, prop) => sum + prop.todaysRevenue, 0),
      totalActiveResidents: propertyStats.reduce((sum, prop) => sum + prop.activeResidents, 0),
      totalProperties: properties.length
    }

    return NextResponse.json({
      globalKPIs,
      properties: propertyStats
    }, { status: 200 })

  } catch (error) {
    console.error('Unexpected error in GET /api/portfolio:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
