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
    
    console.log('[V10.8.27] Detailed revenue query:', {
      propertyId,
      startDate,
      endDate
    })

    // V10.8.27: Build query for guest_passes with resident details (simplified join)
    let query = adminClient
      .from('guest_passes')
      .select('id, created_at, guest_count, price_paid, amount_paid, purchased_by, profiles (name, unit)')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false })

    // Apply date filters if provided
    if (startDate) {
      query = query.gte('created_at', `${startDate}T00:00:00`)
    }
    if (endDate) {
      query = query.lte('created_at', `${endDate}T23:59:59`)
    }

    const { data: passes, error } = await query

    if (error) {
      // V10.8.27: Surface exact Supabase error details
      console.error('[V10.8.27] Error fetching detailed revenue:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      })
      return NextResponse.json(
        { 
          error: 'Failed to fetch detailed revenue data',
          details: error.message,
          hint: error.hint
        },
        { status: 500 }
      )
    }

    // Transform data for CSV export
    const transactions = (passes || []).map(pass => ({
      id: pass.id,
      created_at: pass.created_at,
      guest_count: pass.guest_count || 1,
      amount_paid: pass.amount_paid || pass.price_paid || 0,
      price_paid: pass.price_paid || 0,
      resident_name: pass.profiles?.name || 'Unknown',
      unit: pass.profiles?.unit || 'N/A'
    }))

    console.log(`[V10.8.25] Returning ${transactions.length} transactions`)

    return NextResponse.json({
      success: true,
      transactions,
      count: transactions.length
    }, { status: 200 })

  } catch (error) {
    console.error('[V10.8.25] Unexpected error in detailed revenue:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
