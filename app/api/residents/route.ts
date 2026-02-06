import { createAdminClient, ensurePropertyExists } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/residents
 * Fetch all residents with their rule statuses
 */
export async function GET() {
  try {
    const adminClient = createAdminClient()
    
    const { data, error } = await adminClient
      .from('profiles')
      .select(`
        *,
        rule_statuses:user_rule_status(
          *,
          rule:access_rules(*)
        )
      `)
      .eq('role', 'resident')
      .order('name')

    if (error) {
      console.error('Error fetching residents:', error)
      return NextResponse.json(
        { error: 'Failed to fetch residents', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(data || [], { status: 200 })
  } catch (error) {
    console.error('Unexpected error in GET /api/residents:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/residents
 * Create a new resident with auto-property creation and rule initialization
 */
export async function POST(request: NextRequest) {
  try {
    const adminClient = createAdminClient()
    const body = await request.json()
    
    const { name, email, unit, phone, property_id } = body

    // Validate required fields
    if (!name || !email || !unit) {
      return NextResponse.json(
        { error: 'Missing required fields: name, email, unit' },
        { status: 400 }
      )
    }

    // Ensure property exists (creates it if missing)
    const finalPropertyId = property_id || await ensurePropertyExists()

    // Generate unique QR code
    const qr_code = `SAP-${Date.now()}-${Math.random().toString(36).substring(7)}`
    
    // V4: Generate random 4-digit PIN
    const access_pin = Math.floor(1000 + Math.random() * 9000).toString()

    // Insert resident using admin client (bypasses RLS)
    const { data: resident, error: insertError } = await adminClient
      .from('profiles')
      .insert({
        name,
        email,
        unit,
        phone: phone || null,
        qr_code,
        access_pin,
        property_id: finalPropertyId,
        role: 'resident',
        is_active: true,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating resident:', insertError)
      return NextResponse.json(
        { error: 'Failed to create resident', details: insertError.message },
        { status: 500 }
      )
    }

    // Auto-create user_rule_status entries for all active rules
    const { data: activeRules } = await adminClient
      .from('access_rules')
      .select('id')
      .eq('property_id', finalPropertyId)
      .eq('is_active', true)

    if (activeRules && activeRules.length > 0) {
      const ruleStatuses = activeRules.map(rule => ({
        user_id: resident.id,
        rule_id: rule.id,
        status: true, // Default to passing all rules
      }))

      const { error: statusError } = await adminClient
        .from('user_rule_status')
        .insert(ruleStatuses)

      if (statusError) {
        console.error('Warning: Failed to create rule statuses:', statusError)
        // Don't fail the whole operation, just log the warning
      }
    }

    return NextResponse.json(resident, { status: 201 })
  } catch (error) {
    console.error('Unexpected error in POST /api/residents:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/residents/bulk
 * Bulk create residents from CSV data
 */
export async function PUT(request: NextRequest) {
  try {
    const adminClient = createAdminClient()
    const body = await request.json()
    
    const { residents } = body

    if (!Array.isArray(residents) || residents.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: residents must be a non-empty array' },
        { status: 400 }
      )
    }

    // Ensure property exists
    const propertyId = await ensurePropertyExists()

    // Get all active rules for this property
    const { data: activeRules } = await adminClient
      .from('access_rules')
      .select('id')
      .eq('property_id', propertyId)
      .eq('is_active', true)

    const results = {
      success: [] as any[],
      failed: [] as any[],
    }

    // Process each resident
    for (const residentData of residents) {
      try {
        const { name, email, unit, phone } = residentData

        if (!name || !email || !unit) {
          results.failed.push({
            data: residentData,
            error: 'Missing required fields',
          })
          continue
        }

        // Generate unique QR code
        const qr_code = `SAP-${Date.now()}-${Math.random().toString(36).substring(7)}`

        // Insert resident
        const { data: resident, error: insertError } = await adminClient
          .from('profiles')
          .insert({
            name,
            email,
            unit,
            phone: phone || null,
            qr_code,
            property_id: propertyId,
            role: 'resident',
            is_active: true,
          })
          .select()
          .single()

        if (insertError) {
          results.failed.push({
            data: residentData,
            error: insertError.message,
          })
          continue
        }

        // Create rule statuses
        if (activeRules && activeRules.length > 0) {
          const ruleStatuses = activeRules.map(rule => ({
            user_id: resident.id,
            rule_id: rule.id,
            status: true,
          }))

          await adminClient.from('user_rule_status').insert(ruleStatuses)
        }

        results.success.push(resident)
      } catch (error) {
        results.failed.push({
          data: residentData,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return NextResponse.json(
      {
        message: `Bulk import completed: ${results.success.length} succeeded, ${results.failed.length} failed`,
        results,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Unexpected error in bulk resident import:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/residents
 * Update resident information (PIN, location, etc.)
 * V4: Used for PIN regeneration and force checkout
 */
export async function PATCH(request: NextRequest) {
  try {
    const adminClient = createAdminClient()
    const body = await request.json()
    
    const { id, access_pin, current_location } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Resident ID is required' },
        { status: 400 }
      )
    }

    // Build update object with only provided fields
    const updates: any = {}
    if (access_pin !== undefined) updates.access_pin = access_pin
    if (current_location !== undefined) updates.current_location = current_location

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      )
    }

    // V5: Get current location before update for logging
    const { data: resident } = await adminClient
      .from('profiles')
      .select('id, property_id, qr_code, current_location, name')
      .eq('id', id)
      .single()

    // Update resident
    const { data, error } = await adminClient
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating resident:', error)
      return NextResponse.json(
        { error: 'Failed to update resident', details: error.message },
        { status: 500 }
      )
    }

    // V5: Log FORCE_EXIT event if location changed from INSIDE to OUTSIDE
    if (resident && current_location === 'OUTSIDE' && resident.current_location === 'INSIDE') {
      console.log(`📝 Logging FORCE_EXIT for ${resident.name}`)
      const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
      const userAgent = request.headers.get('user-agent') || 'unknown'
      
      await adminClient
        .from('access_logs')
        .insert({
          user_id: resident.id,
          property_id: resident.property_id,
          qr_code: resident.qr_code,
          scan_type: 'FORCE_EXIT',
          result: 'GRANTED',
          denial_reason: null,
          location_before: 'INSIDE',
          location_after: 'OUTSIDE',
          ip_address: ip,
          user_agent: userAgent
        })
    }

    return NextResponse.json(data, { status: 200 })
  } catch (error) {
    console.error('Unexpected error in PATCH /api/residents:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
