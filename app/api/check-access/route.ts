import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/check-access
 * V8.2: Enhanced Visitor Pass & Activity Logging
 * 
 * CRITICAL: Uses Service Role Key to bypass RLS
 * 
 * V8.2 Changes:
 * - Properly logs all visitor pass scans to access_logs table
 * - Updates visitor_passes.is_inside and used_at timestamps
 * - Supports re-entry with "WELCOME BACK" messaging
 * - Tracks occupancy for visitor passes
 * - Group entry/exit support for residents with guest_count
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    const body = await request.json()
    const { qr_code, scan_type, guest_count = 0, check_only = false } = body

    if (!qr_code || !scan_type) {
      return NextResponse.json(
        { error: 'Missing required fields: qr_code, scan_type' },
        { status: 400 }
      )
    }

    if (!['ENTRY', 'EXIT'].includes(scan_type)) {
      return NextResponse.json(
        { error: 'Invalid scan_type. Must be ENTRY or EXIT' },
        { status: 400 }
      )
    }

    console.log(`\n=== V8.2 Access Check ===`)
    console.log(`QR: ${qr_code}, Type: ${scan_type}, Guests: ${guest_count}, CheckOnly: ${check_only}`)

    // ========================================================================
    // STEP 1: Check if QR Code is a Visitor Pass
    // ========================================================================
    const { data: visitorPass, error: visitorError } = await supabase
      .from('visitor_passes')
      .select(`
        *,
        property:property_id(id, name, operating_hours_start, operating_hours_end, is_maintenance_mode, maintenance_reason, max_capacity),
        purchaser:purchased_by(name, unit)
      `)
      .eq('qr_code', qr_code)
      .single()

    if (visitorPass && !visitorError) {
      console.log('✓ Visitor pass detected')
      
      if (check_only) {
        return NextResponse.json({
          can_access: true,
          user_type: 'visitor',
          user_name: visitorPass.guest_name || 'Visitor',
          user_id: null,
          current_location: 'OUTSIDE'
        })
      }

      const property = visitorPass.property as any
      const now = new Date()
      const expiresAt = new Date(visitorPass.expires_at)

      // V7.9 Fix #1: Check expiration first (passes expire at 11:59 PM same day)
      if (visitorPass.status === 'expired' || now > expiresAt) {
        console.log('❌ DENIED: Visitor pass expired')
        return NextResponse.json({
          can_access: false,
          denial_reason: 'This visitor pass has expired',
          user_name: visitorPass.guest_name || 'Visitor'
        })
      }

      // V7.9 Fix #1: Check if re-entry (pass was used but still valid today)
      const isReEntry = (visitorPass.status === 'used' || visitorPass.status === 'active') && visitorPass.used_at
      const isCurrentlyInside = visitorPass.is_inside === true

      // V7.9 Fix #1: Block if trying to enter when already inside
      if (scan_type === 'ENTRY' && isCurrentlyInside) {
        console.log('❌ DENIED: Visitor already inside')
        return NextResponse.json({
          can_access: false,
          denial_reason: 'This visitor is already inside the facility',
          user_name: visitorPass.guest_name || 'Visitor'
        })
      }

      // V7.9 Fix #1: Block if trying to exit when already outside
      if (scan_type === 'EXIT' && !isCurrentlyInside) {
        console.log('❌ DENIED: Visitor already outside')
        return NextResponse.json({
          can_access: false,
          denial_reason: 'This visitor is not currently inside',
          user_name: visitorPass.guest_name || 'Visitor'
        })
      }

      // Check global rules for visitor pass
      if (scan_type === 'ENTRY') {
        if (property.is_maintenance_mode) {
          return NextResponse.json({
            can_access: false,
            denial_reason: property.maintenance_reason || 'Facility closed for maintenance'
          })
        }

        const currentTime = new Date().toLocaleTimeString('en-US', { 
          hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' 
        })
        if (currentTime < property.operating_hours_start || currentTime > property.operating_hours_end) {
          return NextResponse.json({
            can_access: false,
            denial_reason: `Pool is closed. Hours: ${property.operating_hours_start} - ${property.operating_hours_end}`
          })
        }

        const { count: occupancy } = await supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('property_id', visitorPass.property_id)
          .eq('current_location', 'INSIDE')
          .eq('is_active', true)

        if (occupancy !== null && occupancy >= property.max_capacity) {
          return NextResponse.json({
            can_access: false,
            denial_reason: `Facility at max capacity (${property.max_capacity})`
          })
        }
      }

      // V8.2 Fix #1: Update visitor_passes table with is_inside and used_at
      if (scan_type === 'ENTRY') {
        // Set is_inside=TRUE, mark as used (but only set used_at if first entry)
        const updateData: any = { 
          is_inside: true,
          status: 'used'
        }
        // Only set used_at on first entry (for revenue tracking)
        if (!visitorPass.used_at) {
          updateData.used_at = new Date().toISOString()
          console.log('✓ First entry - setting used_at timestamp')
        } else {
          console.log('✓ Re-entry detected - keeping original used_at')
        }
        const { error: updateError } = await supabase
          .from('visitor_passes')
          .update(updateData)
          .eq('id', visitorPass.id)
        if (updateError) {
          console.error('❌ Failed to update visitor_passes:', updateError)
        } else {
          console.log('✓ Visitor pass updated: is_inside=true, status=used')
        }
      } else if (scan_type === 'EXIT') {
        // Set is_inside=FALSE on exit
        const { error: updateError } = await supabase
          .from('visitor_passes')
          .update({ is_inside: false })
          .eq('id', visitorPass.id)
        if (updateError) {
          console.error('❌ Failed to update visitor_passes:', updateError)
        } else {
          console.log('✓ Visitor pass updated: is_inside=false')
        }
      }

      // V8.2 Fix #1: Log visitor pass scan to access_logs
      const ip = request.headers.get('x-forwarded-for') || 'unknown'
      const userAgent = request.headers.get('user-agent') || 'unknown'
      const logEntry = {
        user_id: visitorPass.purchased_by,
        property_id: visitorPass.property_id,
        qr_code,
        scan_type,
        result: 'GRANTED',
        denial_reason: null,
        location_before: scan_type === 'ENTRY' ? 'OUTSIDE' : 'INSIDE',
        location_after: scan_type === 'ENTRY' ? 'INSIDE' : 'OUTSIDE',
        guest_count: 0,
        event_type: 'SCAN',
        ip_address: ip,
        user_agent: userAgent
      }
      const { error: logError } = await supabase.from('access_logs').insert(logEntry)
      if (logError) {
        console.error('❌ Failed to log visitor pass scan:', logError)
      } else {
        console.log('✓ Visitor pass scan logged to access_logs')
      }

      // V7.9 Fix #1: Return with re-entry indicator
      return NextResponse.json({
        can_access: true,
        user_name: visitorPass.guest_name || 'Visitor',
        user_id: null,
        user_type: 'visitor_pass',
        current_location: scan_type === 'ENTRY' ? 'INSIDE' : 'OUTSIDE',
        is_re_entry: isReEntry && scan_type === 'ENTRY' // V7.9: Flag for UI to show 'WELCOME BACK'
      })
    }

    // ========================================================================
    // STEP 2: Lookup Resident by QR Code
    // ========================================================================
    const { data: resident, error: residentError } = await supabase
      .from('profiles')
      .select(`
        *,
        property:property_id(
          id, name, operating_hours_start, operating_hours_end,
          is_maintenance_mode, maintenance_reason, max_capacity,
          max_guests_per_resident
        )
      `)
      .eq('qr_code', qr_code)
      .eq('role', 'resident')
      .eq('is_active', true)
      .single()

    if (residentError || !resident) {
      console.log('❌ No resident/visitor found with QR code')
      return NextResponse.json({
        can_access: false,
        denial_reason: 'Invalid QR code',
        user_name: 'Unknown'
      }, { status: 200 })
    }

    console.log(`✓ Resident found: ${resident.name}`)
    const property = resident.property as any

    // V6: Calculate effective guest limit (personal overrides property)
    const effectiveGuestLimit = resident.personal_guest_limit ?? property.max_guests_per_resident ?? 3

    // Check-only mode: Return resident info for scanner UI
    if (check_only) {
      return NextResponse.json({
        can_access: true,
        user_type: 'resident',
        user_name: resident.name,
        user_id: resident.id,
        current_location: resident.current_location,
        active_guests: resident.active_guests || 0,
        personal_guest_limit: resident.personal_guest_limit,
        property_max_guests: property.max_guests_per_resident || 3
      })
    }

    // ========================================================================
    // STEP 3: Validate Group Size
    // ========================================================================
    if (scan_type === 'ENTRY' && guest_count > effectiveGuestLimit) {
      console.log(`❌ DENIED: Too many guests (${guest_count} > ${effectiveGuestLimit})`)
      return NextResponse.json({
        can_access: false,
        denial_reason: `Maximum ${effectiveGuestLimit} accompanying guests allowed`,
        user_name: resident.name
      })
    }

    // ========================================================================
    // STEP 4: Global Rules Check (ENTRY only)
    // ========================================================================
    if (scan_type === 'ENTRY') {
      // Maintenance mode
      if (property.is_maintenance_mode) {
        console.log('❌ DENIED: Maintenance mode')
        const reason = property.maintenance_reason || 'Facility is currently closed for maintenance'
        return NextResponse.json({
          can_access: false,
          denial_reason: reason,
          user_name: resident.name
        })
      }

      // Operating hours
      const currentTime = new Date().toLocaleTimeString('en-US', { 
        hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' 
      })
      if (currentTime < property.operating_hours_start || currentTime > property.operating_hours_end) {
        console.log('❌ DENIED: Outside operating hours')
        const reason = `Pool is closed. Hours: ${property.operating_hours_start} - ${property.operating_hours_end}`
        return NextResponse.json({
          can_access: false,
          denial_reason: reason,
          user_name: resident.name
        })
      }

      // Capacity check (count resident + guests)
      const totalGroupSize = 1 + guest_count
      const { count: currentOccupancy } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('property_id', resident.property_id)
        .eq('current_location', 'INSIDE')
        .eq('is_active', true)

      const occupancy = currentOccupancy || 0
      if (occupancy + totalGroupSize > property.max_capacity) {
        console.log('❌ DENIED: Would exceed capacity')
        return NextResponse.json({
          can_access: false,
          denial_reason: `Facility at max capacity (${property.max_capacity})`,
          user_name: resident.name
        })
      }
    }

    // ========================================================================
    // STEP 5: Check Resident-Specific Access Rules
    // ========================================================================
    if (scan_type === 'ENTRY') {
      const { data: ruleStatuses, error: rulesError } = await supabase
        .from('user_rule_status')
        .select(`
          id,
          status,
          rule:rule_id(id, rule_name, is_active)
        `)
        .eq('user_id', resident.id)

      if (!rulesError && ruleStatuses) {
        for (const rs of ruleStatuses) {
          const rule = rs.rule as any
          if (rule?.is_active && !rs.status) {
            // V5: Human-friendly error messages
            let denialReason = `Access Denied: ${rule.rule_name}`
            
            if (rule.rule_name.toLowerCase().includes('rent')) {
              denialReason = 'Rent Payment Outstanding'
            } else if (rule.rule_name.toLowerCase().includes('lease')) {
              denialReason = 'Lease Violation - Contact Management'
            } else if (rule.rule_name.toLowerCase().includes('id') || rule.rule_name.toLowerCase().includes('verification')) {
              denialReason = 'ID Verification Required'
            }

            console.log(`❌ DENIED: Rule failed - ${rule.rule_name}`)
            return NextResponse.json({
              can_access: false,
              denial_reason: denialReason,
              user_name: resident.name
            })
          }
        }
      }
    }

    // ========================================================================
    // STEP 6: GRANT ACCESS - Update Location and Guest Count
    // ========================================================================
    const locationBefore = resident.current_location
    let locationAfter = locationBefore
    let newActiveGuests = resident.active_guests || 0

    if (scan_type === 'ENTRY') {
      if (locationBefore === 'OUTSIDE') {
        // Normal entry with group
        locationAfter = 'INSIDE'
        newActiveGuests = guest_count
      } else {
        // Already inside - add more guests
        locationAfter = 'INSIDE'
        newActiveGuests = (resident.active_guests || 0) + guest_count
      }
    } else {
      // EXIT logic
      if (guest_count === 0 && (resident.active_guests || 0) === 0) {
        // Just resident leaving
        locationAfter = 'OUTSIDE'
        newActiveGuests = 0
      } else if (guest_count > 0) {
        // Partial exit
        newActiveGuests = Math.max(0, (resident.active_guests || 0) - guest_count)
        if (newActiveGuests === 0) {
          // All guests left, resident also leaving
          locationAfter = 'OUTSIDE'
        } else {
          // Some guests remain
          locationAfter = 'INSIDE'
        }
      }
    }

    // Update resident location and active_guests
    await supabase
      .from('profiles')
      .update({
        current_location: locationAfter,
        active_guests: newActiveGuests,
        last_scan_at: new Date().toISOString()
      })
      .eq('id', resident.id)

    console.log(`✓ Updated: ${locationBefore} → ${locationAfter}, Active Guests: ${newActiveGuests}`)

    // Log access event with V6 group info
    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'
    await supabase.from('access_logs').insert({
      user_id: resident.id,
      property_id: resident.property_id,
      qr_code,
      scan_type,
      result: 'GRANTED',
      denial_reason: null,
      location_before: locationBefore,
      location_after: locationAfter,
      guest_count: guest_count,
      event_type: guest_count > 0 ? 'GROUP_ENTRY' : 'SCAN',
      ip_address: ip,
      user_agent: userAgent
    })

    // V6: Format display message
    let displayMessage = resident.name
    if (guest_count > 0) {
      displayMessage = `${resident.name} + ${guest_count} Guest${guest_count > 1 ? 's' : ''}`
    }

    return NextResponse.json({
      can_access: true,
      user_name: displayMessage,
      user_id: resident.id,
      current_location: locationAfter,
      active_guests: newActiveGuests
    }, { status: 200 })

  } catch (error) {
    console.error('Unexpected error in POST /api/check-access:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}
