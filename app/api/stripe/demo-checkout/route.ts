export const runtime = 'edge'

import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/stripe/demo-checkout
 * V10.6: Demo Mode checkout for guest pass purchases
 * Simulates Stripe payment processing with test cards
 */
export async function POST(request: NextRequest) {
  try {
    const adminClient = createAdminClient()
    const body = await request.json()
    
    const {
      card_number,
      card_exp_month,
      card_exp_year,
      card_cvc,
      amount,
      property_id,
      guest_count = 1,
      resident_id,
    } = body
    
    console.log('[V10.6] Demo checkout initiated:', { amount, guest_count, property_id, resident_id })
    
    // V10.6.1: Validate resident_id (purchased_by) is provided
    if (!resident_id) {
      return NextResponse.json({
        success: false,
        error: 'Resident ID is required',
        mode: 'demo',
      }, { status: 400 })
    }
    
    // Validate Stripe test card numbers
    const validTestCards = [
      '4242424242424242', // Visa
      '4000056655665556', // Visa (debit)
      '5555555555554444', // Mastercard
      '2223003122003222', // Mastercard (2-series)
      '5200828282828210', // Mastercard (debit)
      '378282246310005',  // American Express
      '6011111111111117', // Discover
      '3056930009020004', // Diners Club
      '3566002020360505', // JCB
    ]
    
    const cleanCardNumber = card_number.replace(/\s/g, '')
    
    // Simulate card validation
    if (!validTestCards.includes(cleanCardNumber)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid test card. Use 4242 4242 4242 4242 or other Stripe test cards.',
        mode: 'demo',
      }, { status: 400 })
    }
    
    // Simulate card expiry validation
    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().getMonth() + 1
    
    if (parseInt(card_exp_year) < currentYear || 
        (parseInt(card_exp_year) === currentYear && parseInt(card_exp_month) < currentMonth)) {
      return NextResponse.json({
        success: false,
        error: 'Card has expired',
        mode: 'demo',
      }, { status: 400 })
    }
    
    // Simulate CVC validation
    if (!card_cvc || card_cvc.length < 3) {
      return NextResponse.json({
        success: false,
        error: 'Invalid CVC',
        mode: 'demo',
      }, { status: 400 })
    }
    
    // Simulate payment processing delay
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    // Generate demo payment intent ID
    const paymentIntentId = `pi_demo_${Date.now()}_${Math.random().toString(36).substring(7)}`
    
    // V10.6.1: Create visitor pass in database with strict schema compliance
    const validDate = new Date().toISOString().split('T')[0]
    const qrCode = `DEMO-${Date.now()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`
    
    // Build insert object matching exact schema from database
    const insertData = {
      // Required NOT NULL columns
      property_id: property_id || process.env.NEXT_PUBLIC_DEFAULT_PROPERTY_ID,
      purchased_by: resident_id, // V10.6.1: CRITICAL FIX - Map resident_id to purchased_by
      qr_code: qrCode,
      price_paid: amount, // V10.6.1: Use price_paid (NOT amount_paid)
      status: 'active',
      
      // Optional columns
      guest_count: guest_count || 1,
      valid_date: validDate,
      payment_intent_id: paymentIntentId,
      amount_paid: amount, // Additional tracking field
      is_demo: true,
      guest_name: null,
      guest_email: null,
      guest_phone: null,
    }
    
    console.log('[V10.6.1] Inserting visitor pass:', insertData)
    
    const { data: passData, error: passError } = await adminClient
      .from('visitor_passes')
      .insert(insertData)
      .select()
      .single()
    
    if (passError) {
      console.error('Error creating visitor pass:', passError)
      return NextResponse.json({
        success: false,
        error: 'Failed to create pass after payment',
        details: passError.message,
      }, { status: 500 })
    }
    
    console.log('[V10.6] Demo checkout successful:', passData)
    
    return NextResponse.json({
      success: true,
      mode: 'demo',
      payment_intent_id: paymentIntentId,
      pass: passData,
      message: 'Demo payment successful! Pass created.',
      card_brand: cleanCardNumber.startsWith('4') ? 'visa' : 
                  cleanCardNumber.startsWith('5') ? 'mastercard' : 
                  cleanCardNumber.startsWith('3') ? 'amex' : 'card',
    }, { status: 200 })
  } catch (error) {
    console.error('Unexpected error in POST /api/stripe/demo-checkout:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
