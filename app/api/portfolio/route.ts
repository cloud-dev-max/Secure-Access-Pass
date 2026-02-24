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
        // Fetch current occupancy (residents + guests + visitors currently inside)
        const { data: occupancyData, error: occupancyError } = await adminClient
          .from('access_logs')
          .select('qr_code, is_inside')
          .eq('property_id', property.id)
          .eq('is_inside', true)

        const currentOccupancy = occupancyData?.length || 0

        // Fetch active residents count
        const { count: activeResidentsCount, error: residentsError } = await adminClient
          .from('residents')
          .select('id', { count: 'exact', head: true })
          .eq('property_id', property.id)
          .eq('status', 'active')

        // Fetch today's revenue
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const todayISO = today.toISOString()

        const { data: revenueData, error: revenueError } = await adminClient
          .from('guest_passes')
          .select('price')
          .eq('property_id', property.id)
          .gte('created_at', todayISO)

        const todaysRevenue = revenueData?.reduce((sum, pass) => sum + (pass.price || 0), 0) || 0

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
