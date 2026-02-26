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
    const { resident_id, active_guests } = body

    if (!resident_id || active_guests === undefined) {
      return NextResponse.json(
        { error: 'resident_id and active_guests are required' },
        { status: 400 }
      )
    }

    console.log('[V10.2] Updating resident active_guests:', { resident_id, active_guests })

    // Update profiles table
    const { data, error } = await adminClient
      .from('profiles')
      .update({ active_guests })
      .eq('id', resident_id)
      .select()
      .single()

    if (error) {
      console.error('[V10.2] Error updating active_guests:', error)
      return NextResponse.json(
        { error: 'Failed to update active_guests' },
        { status: 500 }
      )
    }

    console.log('[V10.2] Active guests updated successfully:', data.active_guests)

    return NextResponse.json({
      success: true,
      active_guests: data.active_guests
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
