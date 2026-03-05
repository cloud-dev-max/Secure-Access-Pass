export const runtime = 'edge'

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
    
    // V10.8.43: Use America/New_York timezone for current date
    const estDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    
    // Parse requested date or use today (V9.7: defensive parsing)
    let targetDate: Date
    if (dateParam && dateParam.includes('-')) {
      try {
        // Parse as local date (avoid timezone shifts)
        const [year, month, day] = dateParam.split('-').map(Number)
        if (year && month && day) {
          targetDate = new Date(year, month - 1, day, 12, 0, 0)
          // Validate date
          if (isNaN(targetDate.getTime())) {
            const [y, m, d] = estDateStr.split('-')
            targetDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d), 12, 0, 0)
          }
        } else {
          const [y, m, d] = estDateStr.split('-')
          targetDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d), 12, 0, 0)
        }
      } catch {
        const [y, m, d] = estDateStr.split('-')
        targetDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d), 12, 0, 0)
      }
    } else {
      const [y, m, d] = estDateStr.split('-')
      targetDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d), 12, 0, 0)
    }
    
    // V9.7 Fix #1: Wrap entire data processing in try/catch
    try {
      // Get start and end of the target date (local timezone boundaries)
      const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0)
      const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999)
      
      // V9.11 Fix #1: Presence Pairing Algorithm (Match Drill-Down Logic)
      // V10.8.49: Extended lookback to 14 days (336 hours) to catch "trapped users"
      // Prevents UI crashes from users who checked in days ago but never checked out
      const priorDayStart = new Date(startOfDay)
      priorDayStart.setHours(priorDayStart.getHours() - 336)
      
      // V10.8.44: CRITICAL - Only use access_logs (physical door scans)
      // Do NOT query visitor_passes table - purchases do not equal physical entries
      // Hourly occupancy MUST reflect actual check-ins (ENTRY scans) vs check-outs (EXIT scans)
      // V10.8.49: CRITICAL FIX - Remove SQL filters for system events (they drop NULL qr_codes)
      // Filter system events in JavaScript instead to preserve manual check-ins
      const { data: allLogs, error } = await adminClient
        .from('access_logs')
        .select('user_id, qr_code, scanned_at, scan_type, guest_count, profiles (name, unit)')
        .eq('property_id', propertyId)
        .gte('scanned_at', priorDayStart.toISOString())
        .lte('scanned_at', endOfDay.toISOString())
        .order('scanned_at', { ascending: true })
      
      if (error) {
        console.error('Error fetching occupancy logs:', error)
        return NextResponse.json(
          { error: 'Failed to fetch occupancy data', details: error.message },
          { status: 500 }
        )
      }
    
      // V10.8.49: Filter system events in JavaScript (SQL .neq() drops NULL qr_codes)
      const validLogs = (allLogs || []).filter(log => 
        log.qr_code !== 'SYSTEM_BROADCAST' && log.qr_code !== 'STATUS_CHANGE'
      )

      // V9.14 Fix #1: Group logs by user with joined profile data
      const userLogs = new Map()
      
      validLogs.forEach(log => {
        if (!log || !log.scanned_at) return
        
        const userId = log.user_id || log.qr_code || `unknown-${Math.random()}`
        
        if (!userLogs.has(userId)) {
          // V9.14 Fix #1: Extract joined profile data
          const profileData = Array.isArray(log.profiles) ? log.profiles[0] : log.profiles
          const logName = profileData?.name
          const logUnit = profileData?.unit
          let displayName = logName || 'Unknown'
          if (!logName || logName === 'Unknown' || log.qr_code?.startsWith('GUEST-') || log.qr_code?.startsWith('VISITOR-')) {
            displayName = 'Visitor'
          }
          
          userLogs.set(userId, {
            entries: [],
            exits: [],
            guestCount: log.guest_count || 0,
            name: displayName,
            unit: logUnit || ''
          })
        }
        
        const userLog = userLogs.get(userId)
        const timestamp = new Date(log.scanned_at)
        
        if (log.scan_type === 'ENTRY') {
          userLog.entries.push(timestamp)
          userLog.guestCount = log.guest_count || 0 // Update from most recent entry
        } else if (log.scan_type === 'EXIT') {
          userLog.exits.push(timestamp)
        }
      })
      
      // V9.13 Fix #2: Calculate occupancy + people array for each hour
      const hourlyData: any[] = []
      
      for (let hour = 0; hour < 24; hour++) {
        const hourStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), hour, 0, 0, 0)
        const hourEnd = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), hour, 59, 59, 999)
        
        let hourOccupancy = 0
        const people: any[] = [] // V9.13 Fix #2: Build people array
        
        // Loop through every user and check if they were present during this hour
        userLogs.forEach((userLog) => {
          // Find most recent entry that occurred before or during this hour
          const relevantEntry = userLog.entries
            .filter((t: Date) => t <= hourEnd)
            .sort((a: Date, b: Date) => b.getTime() - a.getTime())[0]
          
          if (!relevantEntry) return // Never entered by this hour
          
          // Find first exit that occurred after that entry
          const relevantExit = userLog.exits
            .filter((t: Date) => t >= relevantEntry)
            .sort((a: Date, b: Date) => a.getTime() - b.getTime())[0]
          
          // User was present if: entered before/during hour AND (no exit OR exit after hour started)
          const wasPresent = relevantEntry <= hourEnd && (!relevantExit || relevantExit >= hourStart)
          
          if (wasPresent) {
            const guestCount = userLog.guestCount || 0
            hourOccupancy += 1 + guestCount
            
            // V9.13 Fix #2: Add person to people array
            people.push({
              name: userLog.name,
              unit: userLog.unit,
              guests: guestCount,
              total: 1 + guestCount
            })
          }
        })
        
        const timeLabel = `${String(hour).padStart(2, '0')}:00`
        hourlyData.push({
          hour: timeLabel,
          occupancy: hourOccupancy,
          people // V9.13 Fix #2: Include people array
        })
      }
    
      // V9.7 Fix #1: Fixed ReferenceError - use hourlyData instead of deleted hourlyOccupancy
      const maxOccupancy = Math.max(0, ...hourlyData.map(d => d.occupancy || 0))
      
      // V9.9 Fix #2: Hide future hours when viewing today
      // V10.8.43: Use America/New_York timezone for current time
      const nowEstStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
      const [nowY, nowM, nowD] = nowEstStr.split('-')
      const now = new Date(parseInt(nowY), parseInt(nowM) - 1, parseInt(nowD), 12, 0, 0)
      
      // Get current hour in America/New_York
      const currentHour = parseInt(new Date().toLocaleTimeString('en-US', { 
        timeZone: 'America/New_York', 
        hour12: false, 
        hour: '2-digit' 
      }))
      
      const isToday = targetDate.getFullYear() === now.getFullYear() &&
                     targetDate.getMonth() === now.getMonth() &&
                     targetDate.getDate() === now.getDate()
      
      const filteredData = isToday 
        ? hourlyData.filter(d => {
            const hour = parseInt(d.hour.split(':')[0])
            return hour <= currentHour
          })
        : hourlyData
      
      return NextResponse.json({
        hourlyTrend: filteredData,  // V9.9 Fix #2: Only show hours up to now for today
        requestedDate: `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`,
        maxOccupancy
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
