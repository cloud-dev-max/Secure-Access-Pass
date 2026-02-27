export const runtime = 'edge'

import { createAdminClient, ensurePropertyExists } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/rules?property_id=xxx
 * V10.8: Fetch all access rules, filtered by property
 */
export async function GET(request: NextRequest) {
  try {
    const adminClient = createAdminClient()
    const { searchParams } = new URL(request.url)
    const propertyId = searchParams.get('property_id') || process.env.NEXT_PUBLIC_DEFAULT_PROPERTY_ID || '00000000-0000-0000-0000-000000000001'
    
    console.log('[V10.8] Fetching rules for property:', propertyId)
    
    const { data, error } = await adminClient
      .from('access_rules')
      .select('*')
      .eq('property_id', propertyId)
      .order('created_at')

    if (error) {
      console.error('Error fetching rules:', error)
      return NextResponse.json(
        { error: 'Failed to fetch rules', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(data || [], { status: 200 })
  } catch (error) {
    console.error('Unexpected error in GET /api/rules:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/rules
 * Create a new access rule with auto-property creation and resident initialization
 */
export async function POST(request: NextRequest) {
  try {
    const adminClient = createAdminClient()
    const body = await request.json()
    
    const { rule_name, property_id } = body

    // Validate required field
    if (!rule_name) {
      return NextResponse.json(
        { error: 'Missing required field: rule_name' },
        { status: 400 }
      )
    }

    // Ensure property exists (creates it if missing)
    const finalPropertyId = property_id || await ensurePropertyExists()

    // Insert rule using admin client (bypasses RLS)
    const { data: rule, error: insertError } = await adminClient
      .from('access_rules')
      .insert({
        rule_name: rule_name.trim(),
        description: null, // Removed per requirements
        property_id: finalPropertyId,
        is_active: true,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating rule:', insertError)
      
      // Check for duplicate rule name
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: `Rule "${rule_name}" already exists for this property` },
          { status: 409 }
        )
      }
      
      return NextResponse.json(
        { error: 'Failed to create rule', details: insertError.message },
        { status: 500 }
      )
    }

    // Auto-create user_rule_status entries for all existing residents
    const { data: residents } = await adminClient
      .from('profiles')
      .select('id')
      .eq('property_id', finalPropertyId)
      .eq('role', 'resident')
      .eq('is_active', true)

    if (residents && residents.length > 0) {
      const ruleStatuses = residents.map(resident => ({
        user_id: resident.id,
        rule_id: rule.id,
        status: true, // Default to passing
      }))

      const { error: statusError } = await adminClient
        .from('user_rule_status')
        .insert(ruleStatuses)

      if (statusError) {
        console.error('Warning: Failed to create rule statuses for residents:', statusError)
        // Don't fail the whole operation, just log the warning
      }
    }

    return NextResponse.json(rule, { status: 201 })
  } catch (error) {
    console.error('Unexpected error in POST /api/rules:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/rules
 * V7.5 Issue #7: Soft delete a rule (set is_active to false)
 */
export async function DELETE(request: NextRequest) {
  try {
    const adminClient = createAdminClient()
    const body = await request.json()
    const ruleId = body.id

    if (!ruleId) {
      return NextResponse.json(
        { error: 'Missing rule ID' },
        { status: 400 }
      )
    }

    const { error } = await adminClient
      .from('access_rules')
      .update({ is_active: false })
      .eq('id', ruleId)

    if (error) {
      console.error('Error deleting rule:', error)
      return NextResponse.json(
        { error: 'Failed to delete rule', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: 'Rule deactivated successfully' }, { status: 200 })
  } catch (error) {
    console.error('Unexpected error in DELETE /api/rules:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
