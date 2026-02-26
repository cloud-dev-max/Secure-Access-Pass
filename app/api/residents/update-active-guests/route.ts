import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/residents/update-active-guests
 * V10.2 Fix #2: Update resident active_guests count for check-in/out math
 * CRUCIAL: Uses admin client to ensure updates work from public check-in page
 */
export async function POST(request: NextRequest) {
  try {
    const adminClient = createAdminClient()
    const body = await request.json()
    const { resident_id, active_guests, current_location } = body

    if (!resident_id || active_guests === undefined) {
      return NextResponse.json(
        { error: 'resident_id and active_guests are required' },
        { status: 400 }
      )
    }

    console.log('[V10.3] Updating resident state:', { resident_id, active_guests, current_location })

    // V10.3 Fix #4: Update both active_guests and optionally current_location
    const updateData: any = { active_guests }
    if (current_location) {
      updateData.current_location = current_location
    }

    // Update profiles table
    const { data, error } = await adminClient
      .from('profiles')
      .update(updateData)
      .eq('id', resident_id)
      .select()
      .single()

    if (error) {
      console.error('[V10.3] Error updating resident state:', error)
      return NextResponse.json(
        { error: 'Failed to update resident state' },
        { status: 500 }
      )
    }

    console.log('[V10.3] Resident state updated successfully:', { 
      active_guests: data.active_guests, 
      current_location: data.current_location 
    })

    return NextResponse.json({
      success: true,
      active_guests: data.active_guests,
      current_location: data.current_location
    }, { status: 200 })

  } catch (error) {
    console.error('[V10.2] Unexpected error updating active_guests:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
