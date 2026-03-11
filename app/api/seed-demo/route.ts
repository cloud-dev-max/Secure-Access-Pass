export const runtime = 'edge'

import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/seed-demo
 * V10.8.56: Demo Seeder for investor pitches
 * Generates realistic 7-day access logs and guest passes for demo purposes
 */
export async function POST(request: NextRequest) {
  try {
    const adminClient = createAdminClient()
    const { property_id } = await request.json()

    if (!property_id) {
      return NextResponse.json(
        { error: 'property_id is required' },
        { status: 400 }
      )
    }

    // Fetch all residents for this property
    const { data: residents, error: residentsError } = await adminClient
      .from('profiles')
      .select('id, name, unit')
      .eq('property_id', property_id)
      .eq('role', 'resident')
      .eq('is_active', true)

    if (residentsError) {
      console.error('Error fetching residents:', residentsError)
      return NextResponse.json(
        { error: 'Failed to fetch residents', details: residentsError.message },
        { status: 500 }
      )
    }

    if (!residents || residents.length === 0) {
      return NextResponse.json(
        { error: 'Please add residents first before generating demo data' },
        { status: 400 }
      )
    }

    // Generate realistic data for last 7 days
    const logsToInsert: any[] = []
    const passesToInsert: any[] = []
    const today = new Date()
    
    // Helper: Get random resident
    const getRandomResident = () => residents[Math.floor(Math.random() * residents.length)]
    
    // Helper: Get random hour between min and max
    const getRandomHour = (min: number, max: number) => 
      min + Math.floor(Math.random() * (max - min))

    // Generate access logs for last 7 days
    for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
      const date = new Date(today)
      date.setDate(date.getDate() - dayOffset)
      const dateStr = date.toISOString().split('T')[0]

      // Generate 5-10 resident visits per day
      const numVisits = 5 + Math.floor(Math.random() * 6)
      const visitedResidents = new Set()

      for (let i = 0; i < numVisits; i++) {
        const resident = getRandomResident()
        
        // Skip if already visited today (to avoid duplicates)
        if (visitedResidents.has(resident.id)) continue
        visitedResidents.add(resident.id)

        // Generate ENTRY time (morning 6 AM - 10 AM)
        const entryHour = getRandomHour(6, 10)
        const entryMinute = Math.floor(Math.random() * 60)
        const entryTime = new Date(date)
        entryTime.setHours(entryHour, entryMinute, 0, 0)

        // Generate EXIT time (afternoon 2 PM - 8 PM, 4-10 hours after entry)
        const exitHour = getRandomHour(14, 20)
        const exitMinute = Math.floor(Math.random() * 60)
        const exitTime = new Date(date)
        exitTime.setHours(exitHour, exitMinute, 0, 0)

        // Random guest count (0-3)
        const guestCount = Math.floor(Math.random() * 4)

        // V10.8.58: Create ENTRY log with exact CSV schema
        logsToInsert.push({
          property_id,
          user_id: resident.id,
          scan_type: 'ENTRY',
          result: 'GRANTED',
          guest_count: guestCount,
          event_type: 'SCAN',
          qr_code: 'DEMO-PASS',
          ip_address: '127.0.0.1',
          user_agent: 'Demo Seeder',
          scanned_at: entryTime.toISOString()
        })

        // Create EXIT log (80% chance of exit)
        if (Math.random() > 0.2) {
          logsToInsert.push({
            property_id,
            user_id: resident.id,
            scan_type: 'EXIT',
            result: 'GRANTED',
            guest_count: guestCount,
            event_type: 'SCAN',
            qr_code: 'DEMO-PASS',
            ip_address: '127.0.0.1',
            user_agent: 'Demo Seeder',
            scanned_at: exitTime.toISOString()
          })
        }
      }
    }

    // Generate 15-20 guest passes over last 7 days
    const numPasses = 15 + Math.floor(Math.random() * 6)
    for (let i = 0; i < numPasses; i++) {
      const dayOffset = Math.floor(Math.random() * 7)
      const date = new Date(today)
      date.setDate(date.getDate() - dayOffset)
      
      // Random time during day
      const hour = getRandomHour(8, 18)
      const minute = Math.floor(Math.random() * 60)
      date.setHours(hour, minute, 0, 0)

      const resident = getRandomResident()
      const guestCount = 1 + Math.floor(Math.random() * 3) // 1-3 guests

      // V10.8.58: Create visitor pass with exact CSV schema
      passesToInsert.push({
        property_id,
        purchased_by: resident.id,
        guest_name: 'Demo Guest',
        guest_count: guestCount,
        amount_paid: 5.00,
        price_paid: 5.00,
        status: 'active',
        qr_code: 'DEMO-PASS-' + Math.random().toString(36).substring(7),
        is_inside: false,
        is_demo: true,
        payment_intent_id: 'pi_demo_seeder',
        valid_date: date.toISOString().split('T')[0],
        created_at: date.toISOString(),
        updated_at: date.toISOString()
      })
    }

    // Bulk insert access logs
    if (logsToInsert.length > 0) {
      const { error: logsError } = await adminClient
        .from('access_logs')
        .insert(logsToInsert)

      if (logsError) {
        console.error('Error inserting logs:', logsError)
        return NextResponse.json(
          { error: logsError.message || 'Failed to insert access logs', details: logsError?.details || logsError },
          { status: 500 }
        )
      }
    }

    // Bulk insert visitor passes
    if (passesToInsert.length > 0) {
      const { error: passesError } = await adminClient
        .from('visitor_passes')
        .insert(passesToInsert)

      if (passesError) {
        console.error('Error inserting passes:', passesError)
        return NextResponse.json(
          { error: passesError.message || 'Failed to insert visitor passes', details: passesError?.details || passesError },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      message: '7-day demo data generated successfully',
      stats: {
        access_logs: logsToInsert.length,
        visitor_passes: passesToInsert.length
      }
    }, { status: 200 })

  } catch (error) {
    console.error('Error in POST /api/seed-demo:', error)
    return NextResponse.json(
      { error: 'Failed to generate demo data', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
