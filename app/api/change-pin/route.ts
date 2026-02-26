export const runtime = 'edge'

import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/change-pin
 * V4: Allow residents to change their PIN
 * Requires resident ID, current PIN, and new PIN
 */
export async function POST(request: NextRequest) {
  try {
    const adminClient = createAdminClient()
    const body = await request.json()
    const { resident_id, current_pin, new_pin } = body

    if (!resident_id || !current_pin || !new_pin) {
      return NextResponse.json(
        { error: 'Resident ID, current PIN, and new PIN are required' },
        { status: 400 }
      )
    }

    // Validate new PIN format (4 digits)
    if (!/^\d{4}$/.test(new_pin)) {
      return NextResponse.json(
        { error: 'New PIN must be exactly 4 digits' },
        { status: 400 }
      )
    }

    // Verify current PIN
    const { data: resident, error: findError } = await adminClient
      .from('profiles')
      .select('id, access_pin')
      .eq('id', resident_id)
      .eq('access_pin', current_pin)
      .single()

    if (findError || !resident) {
      return NextResponse.json(
        { error: 'Current PIN is incorrect' },
        { status: 401 }
      )
    }

    // Update to new PIN
    const { error: updateError } = await adminClient
      .from('profiles')
      .update({ access_pin: new_pin })
      .eq('id', resident_id)

    if (updateError) {
      console.error('Error updating PIN:', updateError)
      return NextResponse.json(
        { error: 'Failed to update PIN' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: 'PIN updated successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Unexpected error in POST /api/change-pin:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
