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
    
    console.log('[V10.8.19] Revenue query for property:', propertyId)

    // Get current settings for guest pass price
    const { data: settings } = await adminClient
      .from('properties')
      .select('guest_pass_price')
      .eq('id', propertyId)
      .single()

    const guestPassPrice = settings?.guest_pass_price || 5.00

    // V10.8.19: Get all visitor passes for this specific property
    // V10.8.24: Include price_paid and amount_paid for accurate revenue calculation
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
    // Use amount_paid if available, fallback to price_paid, then guestPassPrice
    const totalPasses = passes.length
    const totalRevenue = passes.reduce((sum, pass) => {
      const actualAmount = pass.amount_paid || pass.price_paid || guestPassPrice
      return sum + actualAmount
    }, 0)

    // V8.5 Fix #3: Use LOCAL timezone consistently for all date operations
    const today = new Date()
    const getTodayDateString = () => {
      const year = today.getFullYear()
      const month = String(today.getMonth() + 1).padStart(2, '0')
      const day = String(today.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    const todayStr = getTodayDateString()

    // V10.8.24: Group by date for daily revenue (using actual amounts paid)
    const revenueByDate: { [key: string]: { count: number; revenue: number } } = {}
    passes.forEach(pass => {
      // Convert created_at to local date string
      const passDate = new Date(pass.created_at)
      const year = passDate.getFullYear()
      const month = String(passDate.getMonth() + 1).padStart(2, '0')
      const day = String(passDate.getDate()).padStart(2, '0')
      const date = `${year}-${month}-${day}`
      
      if (!revenueByDate[date]) {
        revenueByDate[date] = { count: 0, revenue: 0 }
      }
      revenueByDate[date].count++
      // V10.8.24: Use actual amount paid instead of current price
      const actualAmount = pass.amount_paid || pass.price_paid || guestPassPrice
      revenueByDate[date].revenue += actualAmount
    })

    // V8.5 Fix #3: Calculate TODAY's revenue and passes explicitly
    const todayRevenue = revenueByDate[todayStr]?.revenue || 0
    const todayPasses = revenueByDate[todayStr]?.count || 0

    // Get last 30 days of data (using local timezone)
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date(today)
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
      const weekStart = new Date(today)
      weekStart.setDate(weekStart.getDate() - (i * 7 + 6))
      const weekEnd = new Date(today)
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
      const month = new Date(today.getFullYear(), today.getMonth() - i, 1)
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

    // Current month stats
    const currentMonth = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    const currentMonthData = monthlyRevenue[monthlyRevenue.length - 1]

    // V10.8.24: Last 7 days stats (sum actual amounts)
    const last7Days = passes.filter(pass => {
      const passDate = new Date(pass.created_at)
      const daysAgo = (today.getTime() - passDate.getTime()) / (1000 * 60 * 60 * 24)
      return daysAgo <= 7
    })
    const last7DaysRevenue = last7Days.reduce((sum, pass) => {
      const actualAmount = pass.amount_paid || pass.price_paid || guestPassPrice
      return sum + actualAmount
    }, 0)

    // V8.9 Fix #2: Active passes - count where status='active' OR is_inside=true (handles null expires_at)
    const now = new Date()
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
          revenue: currentMonthData.revenue,
          count: currentMonthData.count,
        },
        last7Days: {
          revenue: last7DaysRevenue,
          count: last7Days.length,
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
