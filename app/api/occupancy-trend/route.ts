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
    
    // V9.7 Fix #1: Safe date parsing with fallback to today
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date') // Format: YYYY-MM-DD
    
    // Parse requested date or use today (V9.7: defensive parsing)
    let targetDate: Date
    if (dateParam && dateParam.includes('-')) {
      try {
        // Parse as local date (avoid timezone shifts)
        const [year, month, day] = dateParam.split('-').map(Number)
        if (year && month && day) {
          targetDate = new Date(year, month - 1, day)
          // Validate date
          if (isNaN(targetDate.getTime())) {
            targetDate = new Date()
          }
        } else {
          targetDate = new Date()
        }
      } catch {
        targetDate = new Date()
      }
    } else {
      targetDate = new Date()
    }
    
    // V9.7 Fix #1: Wrap entire data processing in try/catch
    try {
      // Get start and end of the target date (local timezone boundaries)
      const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0)
      const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999)
      
      // V9.10 Fix #1: 24-Hour Restricted Carry-over (Auto-Expire Ghosts)
      // Only count entries/exits from the 24 hours BEFORE target date
      // Users who entered >24h ago without exiting are "expired" and excluded
      const priorDayStart = new Date(startOfDay)
      priorDayStart.setHours(priorDayStart.getHours() - 24) // 24 hours before target date start
      
      const { data: priorLogs, error: priorError } = await adminClient
        .from('access_logs')
        .select('scan_type, guest_count')
        .eq('property_id', propertyId)
        .gte('scanned_at', priorDayStart.toISOString()) // Only last 24 hours
        .lt('scanned_at', startOfDay.toISOString())      // Before target date
      
      if (priorError) {
        console.error('Error fetching prior occupancy:', priorError)
      }
      
      // Calculate overnight occupancy (net of ONLY last 24h entries/exits)
      let overnightOccupancy = 0
      if (priorLogs) {
        priorLogs.forEach(log => {
          const people = 1 + (log.guest_count || 0)
          if (log.scan_type === 'ENTRY') {
            overnightOccupancy += people
          } else if (log.scan_type === 'EXIT') {
            overnightOccupancy -= people
          }
        })
        if (overnightOccupancy < 0) overnightOccupancy = 0 // Safety check
      }
      
      // Fetch all access logs for the target date
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
    
    // V9.7 Fix #1: Bulletproof array initialization (prevent NaN errors)
    // V9.6 Fix #1: Calculate running total (net occupancy), not entries per hour
    const hourlyEntries = Array(24).fill(0) // Explicit array initialization
    const hourlyExits = Array(24).fill(0)   // Prevents undefined errors
    
    // Count entries and exits per hour (wrapped in try/catch for safety)
    try {
      (logs || []).forEach(log => {
        if (!log || !log.scanned_at) return // Skip invalid logs
        
        const logDate = new Date(log.scanned_at)
        const hour = logDate.getHours()
        
        // Validate hour is in range 0-23
        if (hour < 0 || hour > 23) return
        
        const people = 1 + (log.guest_count || 0) // Primary person + guests
        
        if (log.scan_type === 'ENTRY') {
          hourlyEntries[hour] += people
        } else if (log.scan_type === 'EXIT') {
          hourlyExits[hour] += people
        }
      })
    } catch (parseError) {
      console.error('Error parsing logs:', parseError)
      // Continue with zeros - better than crashing
    }
    
    // Calculate running total chronologically (0-23)
    // V9.9 Fix #1: Start with overnight occupancy from prior entries/exits
    let currentOccupancy = overnightOccupancy
    const hourlyData: any[] = []
    
    for (let hour = 0; hour < 24; hour++) {
      // Add entries, subtract exits for this hour
      currentOccupancy += (hourlyEntries[hour] || 0)
      currentOccupancy -= (hourlyExits[hour] || 0)
      if (currentOccupancy < 0) currentOccupancy = 0 // Safety check
      
      const timeLabel = `${String(hour).padStart(2, '0')}:00`
      hourlyData.push({
        hour: timeLabel,
        occupancy: currentOccupancy  // Running total stays constant if no activity
      })
    }
    
      // V9.7 Fix #1: Fixed ReferenceError - use hourlyData instead of deleted hourlyOccupancy
      const maxOccupancy = Math.max(0, ...hourlyData.map(d => d.occupancy || 0))
      
      // V9.9 Fix #2: Hide future hours when viewing today
      const now = new Date()
      const isToday = targetDate.getFullYear() === now.getFullYear() &&
                     targetDate.getMonth() === now.getMonth() &&
                     targetDate.getDate() === now.getDate()
      
      const filteredData = isToday 
        ? hourlyData.filter(d => {
            const hour = parseInt(d.hour.split(':')[0])
            return hour <= now.getHours()
          })
        : hourlyData
      
      return NextResponse.json({
        hourlyTrend: filteredData,  // V9.9 Fix #2: Only show hours up to now for today
        requestedDate: `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`,
        maxOccupancy,
        overnightCarryOver: overnightOccupancy  // V9.9 Fix #1: Return for debugging
      }, { status: 200 })
      
    } catch (dataError) {
      // V9.7 Fix #1: Catch data processing errors
      console.error('Error processing occupancy data:', dataError)
      return NextResponse.json(
        { 
          error: 'Failed to process occupancy data',
          details: dataError instanceof Error ? dataError.message : 'Unknown error'
        },
        { status: 500 }
      )
    }
    
  } catch (error) {
    console.error('Unexpected error in GET /api/occupancy-trend:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
