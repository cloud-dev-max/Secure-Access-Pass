export const runtime = 'edge'

import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * PATCH /api/toggle-rule
 * Toggle a user's status for a specific access rule
 * Uses Admin Client to bypass RLS
 */
export async function PATCH(request: NextRequest) {
  try {
    const adminClient = createAdminClient()
    const body = await request.json()
    
    const { user_id, rule_id, status } = body

    if (!user_id || !rule_id || typeof status !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing required fields: user_id, rule_id, status' },
        { status: 400 }
      )
    }

    console.log(`Toggle rule: user=${user_id}, rule=${rule_id}, status=${status}`)

    // Check if the status exists
    const { data: existing, error: checkError } = await adminClient
      .from('user_rule_status')
      .select('id')
      .eq('user_id', user_id)
      .eq('rule_id', rule_id)
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 = not found, which is OK
      console.error('Error checking existing status:', checkError)
      return NextResponse.json(
        { error: 'Failed to check rule status', details: checkError.message },
        { status: 500 }
      )
    }

    if (existing) {
      // Update existing status
      console.log('Updating existing status:', existing.id)
      const { data, error } = await adminClient
        .from('user_rule_status')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) {
        console.error('Error updating rule status:', error)
        return NextResponse.json(
          { error: 'Failed to update rule status', details: error.message },
          { status: 500 }
        )
      }

      console.log('Successfully updated status:', data)
      return NextResponse.json(data, { status: 200 })
    } else {
      // Create new status
      console.log('Creating new status entry')
      const { data, error } = await adminClient
        .from('user_rule_status')
        .insert({ user_id, rule_id, status })
        .select()
        .single()

      if (error) {
        console.error('Error creating rule status:', error)
        return NextResponse.json(
          { error: 'Failed to create rule status', details: error.message },
          { status: 500 }
        )
      }

      console.log('Successfully created status:', data)
      return NextResponse.json(data, { status: 201 })
    }
  } catch (error) {
    console.error('Unexpected error in toggle-rule:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
