export const runtime = 'edge'

import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/settings?property_id=xxx
 * V10.8.14: Single-table architecture - Fetch from properties table only
 * All facility settings are columns in properties table (no separate facility_settings table)
 * Uses Admin Client to bypass RLS
 */
export async function GET(request: NextRequest) {
  try {
    const adminClient = createAdminClient()
    const { searchParams } = new URL(request.url)
    const propertyId = searchParams.get('property_id') || process.env.NEXT_PUBLIC_DEFAULT_PROPERTY_ID || '00000000-0000-0000-0000-000000000001'

    console.log('[V10.8.14] Fetching settings for property:', propertyId)

    // V10.8.14: Single query to properties table
    const { data, error } = await adminClient
      .from('properties')
      .select('id, name, property_name, operating_hours_start, operating_hours_end, max_capacity, guest_pass_price, max_guests_per_resident, max_visitor_passes, is_maintenance_mode, maintenance_reason, stripe_account_id, stripe_connected')
      .eq('id', propertyId)
      .single()

    if (error) {
      console.error('[V10.8.14] Error fetching settings:', error)
      return NextResponse.json(
        { error: 'Failed to fetch settings', details: error.message },
        { status: 500 }
      )
    }

    if (!data) {
      // V10.8.19: Include all fields in defaults response
      console.log('[V10.8.14] Property not found, returning defaults')
      return NextResponse.json({
        operating_hours_start: '06:00:00',
        operating_hours_end: '22:00:00',
        max_capacity: 50,
        guest_pass_price: 5.00,
        max_guests_per_resident: 3, // V4
        max_visitor_passes: 100, // V7.2
        is_maintenance_mode: false,
        maintenance_reason: null,
        stripe_connected: false, // V10.8.19: Include in defaults
        stripe_account_id: null, // V10.8.19: Include in defaults
      }, { status: 200 })
    }

    console.log('[V10.8.14] Settings fetched successfully:', data.name)
    return NextResponse.json(data, { status: 200 })
  } catch (error) {
    console.error('[V10.8.14] Unexpected error in GET /api/settings:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/settings
 * V10.8.14: Single-table architecture - UPDATE properties table only
 * All facility settings are columns in properties table (no separate facility_settings table)
 * Uses Admin Client to bypass RLS
 */
export async function PATCH(request: NextRequest) {
  try {
    const adminClient = createAdminClient()
    const body = await request.json()
    const propertyId = body.property_id || process.env.NEXT_PUBLIC_DEFAULT_PROPERTY_ID || '00000000-0000-0000-0000-000000000001'

    const {
      property_name, // V5
      operating_hours_start,
      operating_hours_end,
      max_capacity,
      guest_pass_price,
      max_guests_per_resident, // V5
      max_visitor_passes, // V7.2
      is_maintenance_mode,
      maintenance_reason,
      stripe_account_id, // V10.6
      stripe_connected, // V10.6
    } = body

    console.log('[V10.8.14] Updating settings for property:', propertyId)
    console.log('[V10.8.14] Update payload:', body)

    // Build update object with only provided fields
    const updates: any = {}

    // V10.8.14: Sync BOTH name and property_name columns simultaneously (prevent desync)
    if (property_name !== undefined) {
      updates.property_name = property_name
      updates.name = property_name // Keep both columns in sync
    }
    if (operating_hours_start !== undefined) updates.operating_hours_start = operating_hours_start
    if (operating_hours_end !== undefined) updates.operating_hours_end = operating_hours_end
    if (max_capacity !== undefined) updates.max_capacity = max_capacity
    if (guest_pass_price !== undefined) updates.guest_pass_price = guest_pass_price
    if (max_guests_per_resident !== undefined) updates.max_guests_per_resident = max_guests_per_resident // V5
    if (max_visitor_passes !== undefined) updates.max_visitor_passes = max_visitor_passes // V7.2
    if (is_maintenance_mode !== undefined) updates.is_maintenance_mode = is_maintenance_mode
    if (maintenance_reason !== undefined) updates.maintenance_reason = maintenance_reason
    if (stripe_account_id !== undefined) updates.stripe_account_id = stripe_account_id // V10.6
    if (stripe_connected !== undefined) updates.stripe_connected = stripe_connected // V10.6

    // V10.8.14: Single UPDATE query on properties table
    const { data, error } = await adminClient
      .from('properties')
      .update(updates)
      .eq('id', propertyId)
      .select()
      .single()

    if (error) {
      console.error('[V10.8.14] Error updating property settings:', error)
      return NextResponse.json(
        { error: 'Failed to update settings', details: error.message },
        { status: 500 }
      )
    }

    console.log('[V10.8.14] Settings updated successfully:', data.name)
    return NextResponse.json(data, { status: 200 })
  } catch (error) {
    console.error('[V10.8.14] Unexpected error in PATCH /api/settings:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
