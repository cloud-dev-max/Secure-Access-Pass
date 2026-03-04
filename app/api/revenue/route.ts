export const runtime = 'edge'

import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/revenue
 * V7: Revenue analytics for guest pass sales
 * 
 * Returns:
 * - Total revenue
 * - Revenue by day/week/month
 * - Pass count statistics
 * - Revenue trend data
 */
export async function GET(request: NextRequest) {
  try {
    const adminClient = createAdminClient()
    // V10.8.19: Accept property_id from query parameter for multi-tenancy
    const { searchParams } = new URL(request.url)
    const propertyId = searchParams.get('property_id')
    
    if (!propertyId) {
      return NextResponse.json(
        { error: 'property_id is required' },
        { status: 400 }
      )
    }
    
    // V10.8.29: MAJOR REFACTOR - Accept local timezone boundaries from frontend
    const todayStartParam = searchParams.get('todayStart')
    const todayEndParam = searchParams.get('todayEnd')
    const last7DaysStartParam = searchParams.get('last7DaysStart')
    const thisMonthStartParam = searchParams.get('thisMonthStart')
    const thisMonthEndParam = searchParams.get('thisMonthEnd')
    
    // Frontend dictates time - fallback to UTC only if params missing
    const todayStart = todayStartParam ? new Date(todayStartParam) : new Date(new Date().setHours(0, 0, 0, 0))
    const todayEnd = todayEndParam ? new Date(todayEndParam) : new Date(new Date().setHours(23, 59, 59, 999))
    const last7DaysStart = last7DaysStartParam ? new Date(last7DaysStartParam) : new Date(new Date().setDate(new Date().getDate() - 6))
    const thisMonthStart = thisMonthStartParam ? new Date(thisMonthStartParam) : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const thisMonthEnd = thisMonthEndParam ? new Date(thisMonthEndParam) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59, 999)
    
    console.log('[V10.8.29] Revenue query with LOCAL timezone boundaries:', {
      propertyId,
      todayStart: todayStart.toISOString(),
      todayEnd: todayEnd.toISOString(),
      last7DaysStart: last7DaysStart.toISOString(),
      thisMonthStart: thisMonthStart.toISOString(),
      thisMonthEnd: thisMonthEnd.toISOString()
    })

    // Get current settings for guest pass price
    const { data: settings } = await adminClient
      .from('properties')
      .select('guest_pass_price')
      .eq('id', propertyId)
      .single()

    const guestPassPrice = settings?.guest_pass_price || 5.00

    // V10.8.29: Get all guest passes for this property (corrected table name from V10.8.27)
    const { data: guestPasses, error } = await adminClient
      .from('visitor_passes')
      .select('id, created_at, status, expires_at, purchased_by, is_inside, price_paid, amount_paid')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching guest passes:', error)
      return NextResponse.json({ error: 'Failed to fetch revenue data' }, { status: 500 })
    }

    const passes = guestPasses || []

    // V10.8.24: Calculate total revenue by summing actual amounts paid
    const totalPasses = passes.length
    const totalRevenue = passes.reduce((sum, pass) => {
      const actualAmount = pass.amount_paid || pass.price_paid || guestPassPrice
      return sum + actualAmount
    }, 0)

    // V10.8.29: Helper to format date for grouping (using passed boundaries)
    const getTodayDateString = () => {
      const year = todayStart.getFullYear()
      const month = String(todayStart.getMonth() + 1).padStart(2, '0')
      const day = String(todayStart.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    const todayStr = getTodayDateString()

    // V10.8.24: Group by date for daily revenue (using actual amounts paid)
    const revenueByDate: { [key: string]: { count: number; revenue: number } } = {}
    passes.forEach(pass => {
      // V10.8.37: Use America/New_York timezone for date bucketing
      const passDate = new Date(pass.created_at)
      const date = passDate.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
      
      if (!revenueByDate[date]) {
        revenueByDate[date] = { count: 0, revenue: 0 }
      }
      revenueByDate[date].count++
      // V10.8.24: Use actual amount paid instead of current price
      const actualAmount = pass.amount_paid || pass.price_paid || guestPassPrice
      revenueByDate[date].revenue += actualAmount
    })

    // V10.8.29: Calculate TODAY's revenue using passed boundaries
    const todayPassesFiltered = passes.filter(pass => {
      const passDate = new Date(pass.created_at)
      return passDate >= todayStart && passDate <= todayEnd
    })
    const todayRevenue = todayPassesFiltered.reduce((sum, pass) => {
      const actualAmount = pass.amount_paid || pass.price_paid || guestPassPrice
      return sum + actualAmount
    }, 0)
    const todayPasses = todayPassesFiltered.length

    // V10.8.35: Fix - Add const now for date calculations
    const now = new Date()
    
    // Get last 30 days of data (using local timezone)
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date(now)
      date.setDate(date.getDate() - (29 - i))
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    })

    const dailyRevenue = last30Days.map(date => ({
      date,
      count: revenueByDate[date]?.count || 0,
      revenue: revenueByDate[date]?.revenue || 0,
    }))

    // Weekly aggregation (last 12 weeks)
    const weeklyRevenue: { week: string; count: number; revenue: number }[] = []
    for (let i = 11; i >= 0; i--) {
      const weekStart = new Date(now)
      weekStart.setDate(weekStart.getDate() - (i * 7 + 6))
      const weekEnd = new Date(now)
      weekEnd.setDate(weekEnd.getDate() - (i * 7))
      
      const weekLabel = `${weekStart.getMonth() + 1}/${weekStart.getDate()}-${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`
      
      let weekCount = 0
      let weekRevenue = 0
      
      for (let j = 0; j < 7; j++) {
        const date = new Date(weekStart)
        date.setDate(date.getDate() + j)
        const dateStr = date.toISOString().split('T')[0]
        if (revenueByDate[dateStr]) {
          weekCount += revenueByDate[dateStr].count
          weekRevenue += revenueByDate[dateStr].revenue
        }
      }
      
      weeklyRevenue.push({ week: weekLabel, count: weekCount, revenue: weekRevenue })
    }

    // Monthly aggregation (last 12 months)
    const monthlyRevenue: { month: string; count: number; revenue: number }[] = []
    for (let i = 11; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthLabel = month.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      
      let monthCount = 0
      let monthRevenue = 0
      
      Object.keys(revenueByDate).forEach(date => {
        const passDate = new Date(date)
        if (passDate.getFullYear() === month.getFullYear() && 
            passDate.getMonth() === month.getMonth()) {
          monthCount += revenueByDate[date].count
          monthRevenue += revenueByDate[date].revenue
        }
      })
      
      monthlyRevenue.push({ month: monthLabel, count: monthCount, revenue: monthRevenue })
    }

    // V10.8.29: Current month stats using passed boundaries
    const currentMonth = thisMonthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    const thisMonthPassesFiltered = passes.filter(pass => {
      const passDate = new Date(pass.created_at)
      return passDate >= thisMonthStart && passDate <= thisMonthEnd
    })
    const thisMonthRevenue = thisMonthPassesFiltered.reduce((sum, pass) => {
      const actualAmount = pass.amount_paid || pass.price_paid || guestPassPrice
      return sum + actualAmount
    }, 0)
    const thisMonthCount = thisMonthPassesFiltered.length

    // V10.8.29: Last 7 days stats using passed boundaries
    const last7DaysPassesFiltered = passes.filter(pass => {
      const passDate = new Date(pass.created_at)
      return passDate >= last7DaysStart && passDate <= todayEnd
    })
    const last7DaysRevenue = last7DaysPassesFiltered.reduce((sum, pass) => {
      const actualAmount = pass.amount_paid || pass.price_paid || guestPassPrice
      return sum + actualAmount
    }, 0)

    // V8.9 Fix #2: Active passes - count where status='active' OR is_inside=true (handles null expires_at)
    // V10.8.36: Reuse now variable from line 123 (no redeclaration)
    const activePasses = passes.filter(p => {
      // Pass is active if: status is 'active' OR currently inside
      if (p.status === 'active' || p.is_inside === true) {
        // If expires_at is null, it's a pending pass (valid)
        if (!p.expires_at) return true
        // Otherwise check if not expired
        return new Date(p.expires_at) > now
      }
      return false
    }).length
    const expiredPasses = passes.filter(p => p.status === 'expired' || (p.expires_at && new Date(p.expires_at) <= now)).length

    // V10.8.27: Dual-metric visitor pass counts
    // Checked-in count: passes currently inside (status='used' AND is_inside=true)
    const checkedInCount = passes.filter(p => p.status === 'used' && p.is_inside === true).length
    // Unused count: passes that are active but not yet scanned
    const unusedCount = passes.filter(p => p.status === 'active' && !p.is_inside).length

    return NextResponse.json({
      success: true,
      // V8.5 Fix #3: Add top-level today values for Dashboard card
      todayRevenue,
      todayPasses,
      // V10.8.27: Add dual-metric visitor pass counts
      checkedInCount,
      unusedCount,
      summary: {
        totalRevenue,
        totalPasses,
        activePasses,
        expiredPasses,
        guestPassPrice,
        currentMonth: {
          label: currentMonth,
          revenue: thisMonthRevenue,
          count: thisMonthCount,
        },
        last7Days: {
          revenue: last7DaysRevenue,
          count: last7DaysPassesFiltered.length,
        },
      },
      charts: {
        daily: dailyRevenue,
        weekly: weeklyRevenue,
        monthly: monthlyRevenue,
      },
    }, { status: 200 })

  } catch (error) {
    console.error('Unexpected error in GET /api/revenue:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
