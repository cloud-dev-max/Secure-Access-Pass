export const runtime = 'edge'

import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/stripe/connect
 * V10.6: Initiate Stripe Connect onboarding
 * In Demo Mode: Simulates Stripe Connect account creation
 * In Production: Would redirect to Stripe Connect Standard onboarding
 */
export async function POST(request: NextRequest) {
  try {
    const adminClient = createAdminClient()
    const propertyId = process.env.NEXT_PUBLIC_DEFAULT_PROPERTY_ID || '00000000-0000-0000-0000-000000000001'
    
    // Demo Mode: Generate simulated Stripe account ID
    const demoAccountId = `acct_demo_${Date.now()}`
    
    console.log('[V10.6] Simulating Stripe Connect for property:', propertyId)
    
    // Update property with demo Stripe account
    const { data, error } = await adminClient
      .from('properties')
      .update({
        stripe_account_id: demoAccountId,
        stripe_connected: true,
      })
      .eq('id', propertyId)
      .select()
      .single()
    
    if (error) {
      console.error('Error updating Stripe connection:', error)
      return NextResponse.json(
        { error: 'Failed to connect Stripe account', details: error.message },
        { status: 500 }
      )
    }
    
    console.log('[V10.6] Stripe Connect successful:', data)
    
    return NextResponse.json({
      success: true,
      account_id: demoAccountId,
      connected: true,
      mode: 'demo',
      message: 'Demo Stripe account connected successfully',
    }, { status: 200 })
  } catch (error) {
    console.error('Unexpected error in POST /api/stripe/connect:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/stripe/connect
 * V10.6: Disconnect Stripe Connect account
 */
export async function DELETE(request: NextRequest) {
  try {
    const adminClient = createAdminClient()
    const propertyId = process.env.NEXT_PUBLIC_DEFAULT_PROPERTY_ID || '00000000-0000-0000-0000-000000000001'
    
    console.log('[V10.6] Disconnecting Stripe for property:', propertyId)
    
    const { data, error } = await adminClient
      .from('properties')
      .update({
        stripe_account_id: null,
        stripe_connected: false,
      })
      .eq('id', propertyId)
      .select()
      .single()
    
    if (error) {
      console.error('Error disconnecting Stripe:', error)
      return NextResponse.json(
        { error: 'Failed to disconnect Stripe account', details: error.message },
        { status: 500 }
      )
    }
    
    console.log('[V10.6] Stripe disconnected successfully')
    
    return NextResponse.json({
      success: true,
      connected: false,
      message: 'Stripe account disconnected',
    }, { status: 200 })
  } catch (error) {
    console.error('Unexpected error in DELETE /api/stripe/connect:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
