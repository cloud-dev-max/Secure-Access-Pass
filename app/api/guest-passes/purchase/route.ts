import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/guest-passes/purchase
 * Purchase a visitor pass (V6: renamed from guest pass)
 * Uses Admin Client to bypass RLS for multi-property support
 * 
 * CRITICAL: Requires SUPABASE_SERVICE_ROLE_KEY for proper operation
 */
export async function POST(request: NextRequest) {
  try {
    const adminClient = createAdminClient()
    const body = await request.json()

    const {
      resident_id,
      guest_name,
      guest_email,
      guest_phone,
      property_id
    } = body

    console.log('=== Purchase Visitor Pass ===')
    console.log('Resident:', resident_id)
    console.log('Property:', property_id)
    console.log('Guest:', guest_name, guest_email, guest_phone)

    // Validate required fields
    if (!resident_id) {
      return NextResponse.json(
        { error: 'resident_id is required' },
        { status: 400 }
      )
    }

    // V6: Require name, email, phone for visitor passes
    if (!guest_name || !guest_email || !guest_phone) {
      return NextResponse.json(
        { error: 'Visitor pass requires Name, Email, and Phone' },
        { status: 400 }
      )
    }

    // Get property settings to validate guest limit
    const propertyIdToUse = property_id || process.env.NEXT_PUBLIC_DEFAULT_PROPERTY_ID || '00000000-0000-0000-0000-000000000001'
    
    const { data: property, error: propertyError } = await adminClient
      .from('properties')
      .select('max_guests_per_resident, guest_pass_price')
      .eq('id', propertyIdToUse)
      .single()

    if (propertyError) {
      console.error('Error fetching property:', propertyError)
      return NextResponse.json(
        { error: 'Failed to fetch property settings' },
        { status: 500 }
      )
    }

    // Check current active visitor passes for this resident
    const { data: activePasses, error: activePassesError } = await adminClient
      .from('guest_passes')
      .select('id')
      .eq('purchased_by', resident_id)
      .eq('property_id', propertyIdToUse)
      .eq('status', 'active')

    if (activePassesError) {
      console.error('Error checking active passes:', activePassesError)
      return NextResponse.json(
        { error: 'Failed to check active passes' },
        { status: 500 }
      )
    }

    // Get resident's personal guest limit (V6)
    const { data: resident, error: residentError } = await adminClient
      .from('profiles')
      .select('personal_guest_limit')
      .eq('id', resident_id)
      .single()

    if (residentError) {
      console.error('Error fetching resident:', residentError)
    }

    // Use personal limit if set, otherwise use property default
    const effectiveLimit = resident?.personal_guest_limit ?? property.max_guests_per_resident ?? 3
    const currentActiveCount = activePasses?.length || 0

    if (currentActiveCount >= effectiveLimit) {
      return NextResponse.json(
        { 
          error: `Visitor pass limit reached. You can have up to ${effectiveLimit} active passes.`,
          current: currentActiveCount,
          limit: effectiveLimit
        },
        { status: 400 }
      )
    }

    // Generate unique QR code for visitor pass
    // V6: Format VISITOR-{timestamp}-{uuid-short}
    const timestamp = Date.now()
    const uuid = crypto.randomUUID().split('-')[0]
    const qrCode = `VISITOR-${timestamp}-${uuid}`

    // V6: Visitor passes expire in 24 hours
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24)

    // Create the visitor pass
    const { data: newPass, error: createError } = await adminClient
      .from('guest_passes')
      .insert({
        qr_code: qrCode,
        purchased_by: resident_id,
        property_id: propertyIdToUse,
        guest_name,
        guest_email,
        guest_phone,
        status: 'active',
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating visitor pass:', createError)
      return NextResponse.json(
        { error: 'Failed to create visitor pass', details: createError.message },
        { status: 500 }
      )
    }

    console.log('✓ Visitor pass created:', newPass.id)
    return NextResponse.json(newPass, { status: 201 })

  } catch (error) {
    console.error('Unexpected error in POST /api/guest-passes/purchase:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
