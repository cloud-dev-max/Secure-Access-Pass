export const runtime = 'edge'

import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

/**
 * GET /api/properties
 * V5: Fetch all properties for multi-property switcher
 * Uses admin client to bypass RLS
 */
export async function GET() {
  try {
    const adminClient = createAdminClient()
    
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
