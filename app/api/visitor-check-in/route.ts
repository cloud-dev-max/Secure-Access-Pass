import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/visitor-check-in
 * V10.0: Secure backend API for visitor pass validation and check-in
 * CRUCIAL: Public UI must call this API to avoid Supabase RLS blocks
 */
export async function POST(request: NextRequest) {
  try {
    const adminClient = createAdminClient()
    const body = await request.json()
    const { qr_code } = body

    if (!qr_code) {
      return NextResponse.json(
        { error: 'QR code is required' },
        { status: 400 }
      )
    }

    console.log('[V10.0] Visitor check-in request for QR:', qr_code)

    // Query visitor_passes table
    const { data: visitorPass, error } = await adminClient
      .from('visitor_passes')
      .select('*')
      .eq('qr_code', qr_code)
      .single()

    if (error || !visitorPass) {
      console.error('[V10.0] Visitor pass not found:', error)
      return NextResponse.json(
        { error: 'Invalid visitor pass' },
        { status: 404 }
      )
    }

    // Check if pass has never been used (used_at is NULL)
    if (!visitorPass.used_at) {
      // First time use - update used_at and status
      const { error: updateError } = await adminClient
        .from('visitor_passes')
        .update({
          used_at: new Date().toISOString(),
          status: 'used'
        })
        .eq('qr_code', qr_code)

      if (updateError) {
        console.error('[V10.0] Error updating visitor pass:', updateError)
        return NextResponse.json(
          { error: 'Failed to update visitor pass' },
          { status: 500 }
        )
      }

      console.log('[V10.0] Visitor pass activated (first use):', qr_code)

      return NextResponse.json({
        success: true,
        message: 'Visitor pass activated successfully',
        pass: {
          id: visitorPass.id,
          property_id: visitorPass.property_id,
          qr_code: visitorPass.qr_code,
          status: 'used',
          valid_date: visitorPass.valid_date,
          guest_count: visitorPass.guest_count || 0
        }
      }, { status: 200 })
    }

    // Pass has been used before - validate it's for the same day
    const usedDate = new Date(visitorPass.used_at)
    const today = new Date()
    
    // Compare calendar dates (ignore time)
    const isSameDay = usedDate.getFullYear() === today.getFullYear() &&
                      usedDate.getMonth() === today.getMonth() &&
                      usedDate.getDate() === today.getDate()

    if (!isSameDay) {
      console.warn('[V10.0] Visitor pass used on different day:', qr_code)
      return NextResponse.json(
        { 
          error: 'This visitor pass was used on a different day',
          used_date: usedDate.toISOString()
        },
        { status: 403 }
      )
    }

    // Valid re-entry for same day
    console.log('[V10.0] Valid re-entry for visitor pass:', qr_code)

    return NextResponse.json({
      success: true,
      message: 'Valid re-entry',
      pass: {
        id: visitorPass.id,
        property_id: visitorPass.property_id,
        qr_code: visitorPass.qr_code,
        status: visitorPass.status,
        valid_date: visitorPass.valid_date,
        guest_count: visitorPass.guest_count || 0
      }
    }, { status: 200 })

  } catch (error) {
    console.error('[V10.0] Unexpected error in visitor check-in:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
