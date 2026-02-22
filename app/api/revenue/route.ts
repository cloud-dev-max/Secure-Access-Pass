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
    const propertyId = process.env.NEXT_PUBLIC_DEFAULT_PROPERTY_ID || '00000000-0000-0000-0000-000000000001'

    // Get current settings for guest pass price
    const { data: settings } = await adminClient
      .from('properties')
      .select('guest_pass_price')
      .eq('id', propertyId)
      .single()

    const guestPassPrice = settings?.guest_pass_price || 5.00

    // Get all visitor passes for this property
    const { data: guestPasses, error } = await adminClient
      .from('visitor_passes')
      .select('id, created_at, status, expires_at, purchased_by')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching guest passes:', error)
      return NextResponse.json({ error: 'Failed to fetch revenue data' }, { status: 500 })
    }

    const passes = guestPasses || []

    // Calculate total revenue
    const totalPasses = passes.length
    const totalRevenue = totalPasses * guestPassPrice

    // Group by date for daily revenue
    const revenueByDate: { [key: string]: { count: number; revenue: number } } = {}
    passes.forEach(pass => {
      const date = new Date(pass.created_at).toISOString().split('T')[0]
      if (!revenueByDate[date]) {
        revenueByDate[date] = { count: 0, revenue: 0 }
      }
      revenueByDate[date].count++
      revenueByDate[date].revenue += guestPassPrice
    })

    // Get last 30 days of data
    const today = new Date()
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date(today)
      date.setDate(date.getDate() - (29 - i))
      return date.toISOString().split('T')[0]
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

    // Last 7 days stats
    const last7Days = passes.filter(pass => {
      const passDate = new Date(pass.created_at)
      const daysAgo = (today.getTime() - passDate.getTime()) / (1000 * 60 * 60 * 24)
      return daysAgo <= 7
    })
    const last7DaysRevenue = last7Days.length * guestPassPrice

    // Active vs expired passes
    const activePasses = passes.filter(p => p.status === 'active').length
    const expiredPasses = passes.filter(p => p.status === 'expired' || p.status === 'used').length

    return NextResponse.json({
      success: true,
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
