import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/settings
 * Fetch facility settings for a property
 * Uses Admin Client to bypass RLS
 */
export async function GET(request: NextRequest) {
  try {
    const adminClient = createAdminClient()
    const propertyId = process.env.NEXT_PUBLIC_DEFAULT_PROPERTY_ID || '00000000-0000-0000-0000-000000000001'

    console.log('Fetching settings for property:', propertyId)

    const { data, error } = await adminClient
      .from('properties')
      .select('id, name, operating_hours_start, operating_hours_end, max_capacity, guest_pass_price, max_guests_per_resident, is_maintenance_mode, maintenance_reason')
      .eq('id', propertyId)
      .single()

    if (error) {
      console.error('Error fetching settings:', error)
      return NextResponse.json(
        { error: 'Failed to fetch settings', details: error.message },
        { status: 500 }
      )
    }

    if (!data) {
      // If property doesn't exist, return defaults
      console.log('Property not found, returning defaults')
      return NextResponse.json({
        operating_hours_start: '06:00:00',
        operating_hours_end: '22:00:00',
        max_capacity: 50,
        guest_pass_price: 5.00,
        max_guests_per_resident: 3, // V4
        is_maintenance_mode: false,
        maintenance_reason: null,
      }, { status: 200 })
    }

    console.log('Settings fetched successfully')
    return NextResponse.json(data, { status: 200 })
  } catch (error) {
    console.error('Unexpected error in GET /api/settings:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/settings
 * Update facility settings for a property
 * Uses UPSERT to handle missing property gracefully
 * Uses Admin Client to bypass RLS
 */
export async function PATCH(request: NextRequest) {
  try {
    const adminClient = createAdminClient()
    const propertyId = process.env.NEXT_PUBLIC_DEFAULT_PROPERTY_ID || '00000000-0000-0000-0000-000000000001'
    const body = await request.json()

    const {
      operating_hours_start,
      operating_hours_end,
      max_capacity,
      guest_pass_price,
      max_guests_per_resident, // V4
      is_maintenance_mode,
      maintenance_reason,
    } = body

    console.log('Updating settings for property:', propertyId)
    console.log('Update payload:', body)

    // Build upsert object with only provided fields
    const updates: any = {
      id: propertyId, // Required for upsert
    }

    if (operating_hours_start !== undefined) updates.operating_hours_start = operating_hours_start
    if (operating_hours_end !== undefined) updates.operating_hours_end = operating_hours_end
    if (max_capacity !== undefined) updates.max_capacity = max_capacity
    if (guest_pass_price !== undefined) updates.guest_pass_price = guest_pass_price
    if (max_guests_per_resident !== undefined) updates.max_guests_per_resident = max_guests_per_resident // V4
    if (is_maintenance_mode !== undefined) updates.is_maintenance_mode = is_maintenance_mode
    if (maintenance_reason !== undefined) updates.maintenance_reason = maintenance_reason

    // If property doesn't have required fields, add defaults
    updates.name = 'Default Property'
    updates.address = '123 Main Street'
    updates.city = 'Default City'
    updates.state = 'CA'
    updates.zip_code = '00000'

    console.log('Performing upsert with updates:', updates)

    // Use UPSERT to update if exists, insert if not
    const { data, error } = await adminClient
      .from('properties')
      .upsert(updates, { 
        onConflict: 'id',
        ignoreDuplicates: false 
      })
      .select()
      .single()

    if (error) {
      console.error('Error upserting settings:', error)
      return NextResponse.json(
        { error: 'Failed to update settings', details: error.message },
        { status: 500 }
      )
    }

    console.log('Settings updated successfully:', data)
    return NextResponse.json(data, { status: 200 })
  } catch (error) {
    console.error('Unexpected error in PATCH /api/settings:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
