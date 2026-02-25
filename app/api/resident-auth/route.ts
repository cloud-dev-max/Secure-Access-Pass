import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/resident-auth
 * V4: Secure PIN-based authentication for residents
 * Requires both email and 4-digit PIN
 */
export async function POST(request: NextRequest) {
  try {
    const adminClient = createAdminClient()
    const body = await request.json()
    const { email, pin } = body

    if (!email || !pin) {
      return NextResponse.json(
        { error: 'Email and PIN are required' },
        { status: 400 }
      )
    }

    console.log('[V7.4] Looking up resident with email:', email)

    // V7.4 Issue #9: Use ilike for case-insensitive email matching
    // V9.11 Fix #3: Include property data for dynamic pass design (correct join)
    // Find resident by email and PIN
    const { data: profile, error } = await adminClient
      .from('profiles')
      .select('*, property:properties!property_id(id, name)')
      .ilike('email', email.trim())
      .eq('access_pin', pin.trim())
      .eq('role', 'resident')
      .eq('is_active', true)
      .single()

    if (error || !profile) {
      console.log('[V7.3] Login failed for email:', email, 'Error:', error?.message)
      console.log('[V7.3] Query used: email =', email.toLowerCase().trim(), ', pin =', pin.trim())
      return NextResponse.json(
        { 
          error: 'Invalid credentials',
          message: 'Invalid email or PIN. Please check your credentials and try again.'
        },
        { status: 401 }
      )
    }

    console.log('Resident authenticated:', profile.name)

    // Return resident profile (client will store in localStorage)
    // V9.11 Fix #3: Include property name for pass design
    const property = profile.property as any
    console.log('Property data for resident:', property) // Debug log
    return NextResponse.json({
      id: profile.id,
      name: profile.name,
      email: profile.email,
      unit: profile.unit,
      phone: profile.phone,
      qr_code: profile.qr_code,
      current_location: profile.current_location,
      property_name: property?.name || property?.property_name || 'Access Pass'
    }, { status: 200 })
  } catch (error) {
    console.error('Unexpected error in POST /api/resident-auth:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
