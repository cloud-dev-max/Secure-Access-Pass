export const runtime = 'edge'

import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/revenue/detailed
 * V10.8.25: Detailed revenue export with date range filtering
 * 
 * Query params:
 * - property_id (required): Filter by property
 * - start_date (optional): YYYY-MM-DD format
 * - end_date (optional): YYYY-MM-DD format
 * 
 * Returns:
 * - Array of transactions with resident details
 */
export async function GET(request: NextRequest) {
  try {
    const adminClient = createAdminClient()
    const { searchParams } = new URL(request.url)
    const propertyId = searchParams.get('property_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    
    if (!propertyId) {
      return NextResponse.json(
        { error: 'property_id is required' },
        { status: 400 }
      )
    }
    
    console.log('[V10.8.30] Admin client with foolproof JS merge:', {
      propertyId,
      startDate,
      endDate
    })

    // V10.8.30: Admin client bypasses RLS, foolproof two-step JS merge
    let passesQuery = adminClient
      .from('guest_passes')
      .select('id, created_at, guest_count, price_paid, amount_paid, purchased_by')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false })

    // Apply date filters if provided
    if (startDate) {
      passesQuery = passesQuery.gte('created_at', `${startDate}T00:00:00`)
    }
    if (endDate) {
      passesQuery = passesQuery.lte('created_at', `${endDate}T23:59:59`)
    }

    const { data: passes, error: passesError } = await passesQuery

    if (passesError) {
      console.error('[V10.8.28] Error fetching guest passes:', {
        message: passesError.message,
        details: passesError.details,
        hint: passesError.hint,
        code: passesError.code
      })
      return NextResponse.json(
        { 
          error: 'Failed to fetch guest passes data',
          details: passesError.message,
          hint: passesError.hint
        },
        { status: 500 }
      )
    }

    // V10.8.28: Fetch all resident profiles for the property
    const residentIds = [...new Set((passes || []).map(p => p.purchased_by).filter(Boolean))]
    const { data: profiles, error: profilesError } = await adminClient
      .from('profiles')
      .select('id, name, unit')
      .in('id', residentIds.length > 0 ? residentIds : ['00000000-0000-0000-0000-000000000000'])

    if (profilesError) {
      console.error('[V10.8.28] Error fetching profiles:', profilesError)
      // Continue with unknown residents if profiles fail
    }

    // V10.8.28: Create a map for quick profile lookup
    const profileMap = new Map()
    ;(profiles || []).forEach(profile => {
      profileMap.set(profile.id, profile)
    })

    // V10.8.28: Merge in JavaScript - foolproof approach
    const transactions = (passes || []).map(pass => {
      const profile = pass.purchased_by ? profileMap.get(pass.purchased_by) : null
      return {
        id: pass.id,
        created_at: pass.created_at,
        guest_count: pass.guest_count || 1,
        amount_paid: pass.amount_paid || pass.price_paid || 0,
        price_paid: pass.price_paid || 0,
        resident_name: profile?.name || 'Unknown',
        unit: profile?.unit || 'N/A'
      }
    })

    console.log(`[V10.8.28] Foolproof export returning ${transactions.length} transactions`)

    return NextResponse.json({
      success: true,
      transactions,
      count: transactions.length
    }, { status: 200 })

  } catch (error) {
    console.error('[V10.8.30] Unexpected error in detailed revenue:', error)
    // V10.8.30: Return exact error for debugging
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : (error?.toString() || 'Internal server error'),
        details: error instanceof Error ? error.stack : JSON.stringify(error)
      },
      { status: 500 }
    )
  }
}
