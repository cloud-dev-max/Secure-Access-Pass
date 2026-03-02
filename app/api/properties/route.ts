export const runtime = 'edge'

import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/properties?id=xxx
 * V5: Fetch all properties for multi-property switcher
 * V10.8.11: Support fetching single property by id
 * Uses admin client to bypass RLS
 */
export async function GET(request: NextRequest) {
  try {
    const adminClient = createAdminClient()
    const { searchParams } = new URL(request.url)
    const propertyId = searchParams.get('id')
    
    // V10.8.11: If id provided, fetch single property
    if (propertyId) {
      const { data, error } = await adminClient
        .from('properties')
        .select('id, name, property_name, owner_id')
        .eq('id', propertyId)
        .single()

      if (error) {
        console.error('Error fetching property:', error)
        return NextResponse.json(
          { error: 'Failed to fetch property', details: error.message },
          { status: 500 }
        )
      }

      return NextResponse.json(data || {}, { status: 200 })
    }
    
    // V5: Fetch all properties (future: filter by owner_id)
    const { data, error } = await adminClient
      .from('properties')
      .select('id, name, property_name, owner_id')
      .order('property_name')

    if (error) {
      console.error('Error fetching properties:', error)
      return NextResponse.json(
        { error: 'Failed to fetch properties', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(data || [], { status: 200 })
  } catch (error) {
    console.error('Unexpected error in GET /api/properties:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/properties
 * V10.8.11: Create a new property
 */
export async function POST(request: NextRequest) {
  try {
    const adminClient = createAdminClient()
    const body = await request.json()
    
    const { name, max_capacity } = body
    
    if (!name || !max_capacity) {
      return NextResponse.json(
        { error: 'Missing required fields: name, max_capacity' },
        { status: 400 }
      )
    }
    
    // Create property with defaults
    const { data, error } = await adminClient
      .from('properties')
      .insert({
        name: name.trim(),
        property_name: name.trim(),
        max_capacity: parseInt(max_capacity),
        address: '123 Main Street',
        city: 'Default City',
        state: 'CA',
        zip_code: '00000',
        operating_hours_start: '06:00:00',
        operating_hours_end: '22:00:00',
        guest_pass_price: 5.00,
        max_guests_per_resident: 3,
        max_visitor_passes: 100,
        is_maintenance_mode: false,
      })
      .select()
      .single()
    
    if (error) {
      console.error('Error creating property:', error)
      return NextResponse.json(
        { error: 'Failed to create property', details: error.message },
        { status: 500 }
      )
    }
    
    console.log('[V10.8.11] Created property:', data.name)
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Unexpected error in POST /api/properties:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
