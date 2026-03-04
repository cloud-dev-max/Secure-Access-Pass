export const runtime = 'edge'

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
        // V10.8.6 Fix: Fetch current occupancy per property (residents currently INSIDE)
        const { count: residentsInside, error: occupancyError } = await adminClient
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('property_id', property.id)
          .eq('role', 'resident')
          .eq('is_active', true)
          .eq('current_location', 'INSIDE')

        const residentsInsideCount = residentsInside || 0
        
        // V10.8.6 Fix: Sum up active_guests for residents inside this property
        const { data: residentsWithGuests } = await adminClient
          .from('profiles')
          .select('active_guests')
          .eq('property_id', property.id)
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

        // V10.8.6 Fix: Fetch active residents count PER PROPERTY
        const { count: activeResidentsCount, error: residentsError } = await adminClient
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('property_id', property.id)
          .eq('role', 'resident')
          .eq('is_active', true)

        // V10.8.27: Get all visitor passes with actual amounts paid (fix lazy math)
        const { data: allPasses, error: revenueError } = await adminClient
          .from('visitor_passes')
          .select('id, created_at, amount_paid, price_paid')
          .eq('property_id', property.id)

        // V10.8.27: Calculate today's revenue by summing actual amounts paid
        let todaysRevenue = 0
        if (allPasses && allPasses.length > 0) {
          const passPrice = property.guest_pass_price || 5.00
          const today = new Date()
          const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
          
          // Sum actual amounts paid for passes created today
          allPasses.forEach(pass => {
            const passDate = new Date(pass.created_at)
            const passDateStr = `${passDate.getFullYear()}-${String(passDate.getMonth() + 1).padStart(2, '0')}-${String(passDate.getDate()).padStart(2, '0')}`
            if (passDateStr === todayStr) {
              // V10.8.27: Use actual amount paid instead of multiplying by current price
              const actualAmount = pass.amount_paid || pass.price_paid || passPrice
              todaysRevenue += actualAmount
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
