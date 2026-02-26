export const runtime = 'edge'

import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/visitor-passes/update-location
 * V10.1 Fix #4: Update visitor pass is_inside state
 * CRUCIAL: Uses admin client to bypass RLS for public check-in page
 */
export async function POST(request: NextRequest) {
  try {
    const adminClient = createAdminClient()
    const body = await request.json()
    const { qr_code, is_inside } = body

    if (!qr_code || is_inside === undefined) {
      return NextResponse.json(
        { error: 'QR code and is_inside are required' },
        { status: 400 }
      )
    }

    console.log('[V10.1] Updating visitor location:', { qr_code, is_inside })

    // Update visitor_passes table
    const { data, error } = await adminClient
      .from('visitor_passes')
      .update({ is_inside })
      .eq('qr_code', qr_code)
      .select()
      .single()

    if (error) {
      console.error('[V10.1] Error updating visitor location:', error)
      return NextResponse.json(
        { error: 'Failed to update location' },
        { status: 500 }
      )
    }

    console.log('[V10.1] Visitor location updated successfully')

    return NextResponse.json({
      success: true,
      pass: data
    }, { status: 200 })

  } catch (error) {
    console.error('[V10.1] Unexpected error updating visitor location:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
