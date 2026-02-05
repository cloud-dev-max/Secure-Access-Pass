import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/resident-auth
 * Simple email-based authentication for residents
 * Looks up resident by email and returns their profile
 */
export async function POST(request: NextRequest) {
  try {
    const adminClient = createAdminClient()
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    console.log('Looking up resident with email:', email)

    // Find resident by email
    const { data: profile, error } = await adminClient
      .from('profiles')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .eq('role', 'resident')
      .eq('is_active', true)
      .single()

    if (error || !profile) {
      console.log('Resident not found:', email)
      return NextResponse.json(
        { 
          error: 'Resident not found',
          message: 'No active resident account found with this email address.'
        },
        { status: 404 }
      )
    }

    console.log('Resident found:', profile.name)

    // Return resident profile (client will store ID in localStorage)
    return NextResponse.json({
      id: profile.id,
      name: profile.name,
      email: profile.email,
      unit: profile.unit,
      phone: profile.phone,
      qr_code: profile.qr_code,
      current_location: profile.current_location,
    }, { status: 200 })
  } catch (error) {
    console.error('Unexpected error in POST /api/resident-auth:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
