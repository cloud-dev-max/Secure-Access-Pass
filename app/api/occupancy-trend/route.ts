import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/occupancy-trend
 * V9.3 Feature #5: Calculate hourly occupancy trend for today
 * Returns net occupancy per hour based on entry/exit logs
 */
export async function GET(request: NextRequest) {
  try {
    const adminClient = createAdminClient()
    const propertyId = process.env.NEXT_PUBLIC_DEFAULT_PROPERTY_ID || '00000000-0000-0000-0000-000000000001'
    
    // V9.5 Fix #2: Accept date parameter from query string (default to today)
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date') // Format: YYYY-MM-DD
    
    // Parse requested date or use today
    let targetDate: Date
    if (dateParam) {
      // Parse as local date (avoid timezone shifts)
      const [year, month, day] = dateParam.split('-').map(Number)
      targetDate = new Date(year, month - 1, day)
    } else {
      targetDate = new Date()
    }
    
    // Get start and end of the target date (local timezone boundaries)
    const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0)
    const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999)
    
    // Fetch all access logs for today
    const { data: logs, error } = await adminClient
      .from('access_logs')
      .select('scanned_at, scan_type, guest_count')
      .eq('property_id', propertyId)
      .gte('scanned_at', startOfDay.toISOString())
      .lte('scanned_at', endOfDay.toISOString())
      .order('scanned_at', { ascending: true })
    
    if (error) {
      console.error('Error fetching occupancy logs:', error)
      return NextResponse.json(
        { error: 'Failed to fetch occupancy data', details: error.message },
        { status: 500 }
      )
    }
    
    // Initialize hourly buckets (0-23)
    const hourlyOccupancy: { [hour: number]: number } = {}
    for (let i = 0; i < 24; i++) {
      hourlyOccupancy[i] = 0
    }
    
    // Calculate net occupancy per hour
    let currentOccupancy = 0
    const hourlyData: any[] = []
    
    logs.forEach(log => {
      const logDate = new Date(log.scanned_at)
      const hour = logDate.getHours()
      const people = 1 + (log.guest_count || 0) // Primary person + guests
      
      if (log.scan_type === 'ENTRY') {
        currentOccupancy += people
      } else if (log.scan_type === 'EXIT') {
        currentOccupancy -= people
        if (currentOccupancy < 0) currentOccupancy = 0 // Safety check
      }
      
      hourlyOccupancy[hour] = currentOccupancy
    })
    
    // Build array of hourly data points
    for (let hour = 0; hour < 24; hour++) {
      const timeLabel = `${String(hour).padStart(2, '0')}:00`
      hourlyData.push({
        hour: timeLabel,  // V9.5 Fix #2: Use time string for chart X-axis
        occupancy: hourlyOccupancy[hour]
      })
    }
    
    return NextResponse.json({
      hourlyTrend: hourlyData,  // V9.5 Fix #2: Match frontend expectation
      requestedDate: `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`,
      maxOccupancy: Math.max(...Object.values(hourlyOccupancy))
    }, { status: 200 })
    
  } catch (error) {
    console.error('Unexpected error in GET /api/occupancy-trend:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
