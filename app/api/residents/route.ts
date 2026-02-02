import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase
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

    return NextResponse.json(data, { status: 200 })
  } catch (error) {
    console.error('Unexpected error in residents:', error)
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
    
    const { name, email, unit, phone, property_id } = body

    if (!name || !email || !unit) {
      return NextResponse.json(
        { error: 'Missing required fields: name, email, unit' },
        { status: 400 }
      )
    }

    // Generate unique QR code
    const qr_code = `SAP-${Date.now()}-${Math.random().toString(36).substring(7)}`

    const { data, error } = await supabase
      .from('profiles')
      .insert({
        name,
        email,
        unit,
        phone,
        qr_code,
        property_id: property_id || process.env.NEXT_PUBLIC_DEFAULT_PROPERTY_ID,
        role: 'resident',
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating resident:', error)
      return NextResponse.json(
        { error: 'Failed to create resident', details: error.message },
        { status: 500 }
      )
    }

    // Create default rule statuses for all active rules
    const { data: rules } = await supabase
      .from('access_rules')
      .select('id')
      .eq('property_id', data.property_id)
      .eq('is_active', true)

    if (rules && rules.length > 0) {
      const ruleStatuses = rules.map(rule => ({
        user_id: data.id,
        rule_id: rule.id,
        status: true, // Default to passing all rules
      }))

      await supabase.from('user_rule_status').insert(ruleStatuses)
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Unexpected error creating resident:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
