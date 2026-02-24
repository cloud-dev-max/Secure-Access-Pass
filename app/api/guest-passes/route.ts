import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'

/**
 * GET /api/guest-passes?resident_id=xxx
 * Fetch all guest passes for a resident
 */
export async function GET(request: NextRequest) {
  try {
    const adminClient = createAdminClient()
    const { searchParams } = new URL(request.url)
    const residentId = searchParams.get('resident_id')

    if (!residentId) {
      return NextResponse.json(
        { error: 'resident_id query parameter is required' },
        { status: 400 }
      )
    }

    const { data, error } = await adminClient
      .from('visitor_passes')
      .select('*')
      .eq('purchased_by', residentId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching guest passes:', error)
      return NextResponse.json(
        { error: 'Failed to fetch guest passes', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(data || [], { status: 200 })
  } catch (error) {
    console.error('Unexpected error in GET /api/guest-passes:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/guest-passes
 * Create a new guest pass (purchased by a resident)
 */
export async function POST(request: NextRequest) {
  try {
    const adminClient = createAdminClient()
    const propertyId = process.env.NEXT_PUBLIC_DEFAULT_PROPERTY_ID || '00000000-0000-0000-0000-000000000001'
    const body = await request.json()

    const {
      purchased_by,
      guest_name,
      guest_email,
      guest_phone,
      notes,
    } = body

    if (!purchased_by) {
      return NextResponse.json(
        { error: 'purchased_by (resident ID) is required' },
        { status: 400 }
      )
    }

    // Fetch current guest pass price from settings
    const { data: property, error: propertyError } = await adminClient
      .from('properties')
      .select('guest_pass_price')
      .eq('id', propertyId)
      .single()

    if (propertyError) {
      console.error('Error fetching property settings:', propertyError)
      return NextResponse.json(
        { error: 'Failed to fetch guest pass price' },
        { status: 500 }
      )
    }

    // Generate unique QR code for guest pass
    const qrCode = `GUEST-${Date.now()}-${uuidv4().substring(0, 8).toUpperCase()}`

    // V7.7 Fix #5: Visitor pass expires at 11:59 PM on purchase day (unlimited entries)
    const expiresAt = new Date()
    expiresAt.setHours(23, 59, 59, 999) // Set to 11:59:59 PM today

    console.log('Creating visitor pass:', { purchased_by, qrCode, expiresAt: expiresAt.toISOString(), validUntil: '11:59 PM today' })

    // V7.6 Fix #1: Remove is_paid field (PGRST204) - column doesn't exist yet
    const { data, error } = await adminClient
      .from('visitor_passes')
      .insert({
        property_id: propertyId,
        purchased_by,
        guest_name: guest_name || null,
        guest_email: guest_email || null,
        guest_phone: guest_phone || null,
        qr_code: qrCode,
        price_paid: property.guest_pass_price,
        status: 'active',
        // is_paid removed - payment integration pending
        expires_at: expiresAt.toISOString(),
        notes: notes || null,
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        user_agent: request.headers.get('user-agent'),
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating guest pass:', error)
      return NextResponse.json(
        { error: 'Failed to create guest pass', details: error.message },
        { status: 500 }
      )
    }

    console.log('Guest pass created successfully:', data.id)
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Unexpected error in POST /api/guest-passes:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/guest-passes
 * V8.4 Fix #1: Force exit visitor pass (update is_inside status)
 */
export async function PATCH(request: NextRequest) {
  try {
    const adminClient = createAdminClient()
    const body = await request.json()
    const { id, is_inside } = body

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      )
    }

    // Update visitor pass is_inside status
    const { data, error } = await adminClient
      .from('visitor_passes')
      .update({ is_inside })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating visitor pass:', error)
      return NextResponse.json(
        { error: 'Failed to update visitor pass', details: error.message },
        { status: 500 }
      )
    }

    console.log(`✓ Visitor pass ${id} force exit: is_inside=${is_inside}`)
    return NextResponse.json(data, { status: 200 })
  } catch (error) {
    console.error('Unexpected error in PATCH /api/guest-passes:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
