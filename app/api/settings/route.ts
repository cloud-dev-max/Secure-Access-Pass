import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/settings
 * Fetch facility settings for a property
 */
export async function GET(request: NextRequest) {
  try {
    const adminClient = createAdminClient()
    const propertyId = process.env.NEXT_PUBLIC_DEFAULT_PROPERTY_ID || '00000000-0000-0000-0000-000000000001'

    const { data, error } = await adminClient
      .from('properties')
      .select('operating_hours_start, operating_hours_end, max_capacity, guest_pass_price, is_maintenance_mode, maintenance_reason')
      .eq('id', propertyId)
      .single()

    if (error) {
      console.error('Error fetching settings:', error)
      return NextResponse.json(
        { error: 'Failed to fetch settings', details: error.message },
        { status: 500 }
      )
    }

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
      is_maintenance_mode,
      maintenance_reason,
    } = body

    // Build update object with only provided fields
    const updates: any = {}
    if (operating_hours_start !== undefined) updates.operating_hours_start = operating_hours_start
    if (operating_hours_end !== undefined) updates.operating_hours_end = operating_hours_end
    if (max_capacity !== undefined) updates.max_capacity = max_capacity
    if (guest_pass_price !== undefined) updates.guest_pass_price = guest_pass_price
    if (is_maintenance_mode !== undefined) updates.is_maintenance_mode = is_maintenance_mode
    if (maintenance_reason !== undefined) updates.maintenance_reason = maintenance_reason

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      )
    }

    console.log('Updating settings:', updates)

    const { data, error } = await adminClient
      .from('properties')
      .update(updates)
      .eq('id', propertyId)
      .select()
      .single()

    if (error) {
      console.error('Error updating settings:', error)
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
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
