import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    const { user_id, rule_id, status } = body

    if (!user_id || !rule_id || typeof status !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing required fields: user_id, rule_id, status' },
        { status: 400 }
      )
    }

    // Check if the status exists
    const { data: existing } = await supabase
      .from('user_rule_status')
      .select('id')
      .eq('user_id', user_id)
      .eq('rule_id', rule_id)
      .single()

    if (existing) {
      // Update existing status
      const { data, error } = await supabase
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

      return NextResponse.json(data, { status: 200 })
    } else {
      // Create new status
      const { data, error } = await supabase
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

      return NextResponse.json(data, { status: 201 })
    }
  } catch (error) {
    console.error('Unexpected error in toggle-rule:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
