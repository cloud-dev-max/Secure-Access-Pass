import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('access_rules')
      .select('*')
      .order('created_at')

    if (error) {
      console.error('Error fetching rules:', error)
      return NextResponse.json(
        { error: 'Failed to fetch rules', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(data, { status: 200 })
  } catch (error) {
    console.error('Unexpected error in rules:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    const { rule_name, description, property_id } = body

    if (!rule_name) {
      return NextResponse.json(
        { error: 'Missing required field: rule_name' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('access_rules')
      .insert({
        rule_name,
        description,
        property_id: property_id || process.env.NEXT_PUBLIC_DEFAULT_PROPERTY_ID,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating rule:', error)
      return NextResponse.json(
        { error: 'Failed to create rule', details: error.message },
        { status: 500 }
      )
    }

    // Create default statuses for all residents
    const { data: residents } = await supabase
      .from('profiles')
      .select('id')
      .eq('property_id', data.property_id)
      .eq('role', 'resident')

    if (residents && residents.length > 0) {
      const ruleStatuses = residents.map(resident => ({
        user_id: resident.id,
        rule_id: data.id,
        status: true, // Default to passing
      }))

      await supabase.from('user_rule_status').insert(ruleStatuses)
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Unexpected error creating rule:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
