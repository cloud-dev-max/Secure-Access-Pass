import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/clear-occupancy
 * V8.7 Feature #3: Clear all occupants (residents and visitors)
 * Sets all residents to OUTSIDE and all visitor passes to is_inside=false
 */
export async function POST(request: NextRequest) {
  try {
    const adminClient = createAdminClient()
    const propertyId = process.env.NEXT_PUBLIC_DEFAULT_PROPERTY_ID || '00000000-0000-0000-0000-000000000001'

    // Update all residents to OUTSIDE and reset active_guests
    const { error: residentsError } = await adminClient
      .from('profiles')
      .update({ 
        current_location: 'OUTSIDE',
        active_guests: 0
      })
      .eq('property_id', propertyId)
      .eq('role', 'resident')

    if (residentsError) {
      console.error('Error clearing residents:', residentsError)
      return NextResponse.json(
        { error: 'Failed to clear residents', details: residentsError.message },
        { status: 500 }
      )
    }

    // Update all visitor passes to is_inside=false
    const { error: visitorsError } = await adminClient
      .from('visitor_passes')
      .update({ is_inside: false })
      .eq('property_id', propertyId)
      .eq('is_inside', true)

    if (visitorsError) {
      console.error('Error clearing visitors:', visitorsError)
      return NextResponse.json(
        { error: 'Failed to clear visitors', details: visitorsError.message },
        { status: 500 }
      )
    }

    console.log('✓ All occupants cleared (residents and visitors)')
    return NextResponse.json({ 
      success: true,
      message: 'All occupants cleared successfully'
    }, { status: 200 })

  } catch (error) {
    console.error('Unexpected error in POST /api/clear-occupancy:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
