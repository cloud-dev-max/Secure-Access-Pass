import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/check-access
 * Smart scanner logic with global rules enforcement + Multi-Property Support
 * 
 * CRITICAL: Uses Service Role Key to bypass RLS
 * 
 * Priority order:
 * 1. Lookup resident/guest by QR code
 * 2. Maintenance Mode check
 * 3. Operating Hours check
 * 4. Max Capacity check (ENTRY only)
 * 5. Resident-specific rules check
 * 6. Anti-passback check (ENTRY only)
 */
export async function POST(request: NextRequest) {
  try {
    // CRITICAL: Use Admin Client with Service Role Key
    const supabase = createAdminClient()
    const body = await request.json()
    const { qr_code, scan_type } = body

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

    console.log(`\n=== Access Check Started ===`)
    console.log(`QR Code: ${qr_code}`)
    console.log(`Scan Type: ${scan_type}`)

    // ========================================================================
    // STEP 1: Check if QR Code is a Guest Pass
    // ========================================================================
    const { data: guestPass, error: guestError } = await supabase
      .from('guest_passes')
      .select(`
        *,
        property:property_id(id, name, operating_hours_start, operating_hours_end, is_maintenance_mode, maintenance_reason, max_capacity),
        purchaser:purchased_by(name, unit)
      `)
      .eq('qr_code', qr_code)
      .single()

    if (guestPass && !guestError) {
      console.log('✓ Guest pass detected:', guestPass.id)
      const property = guestPass.property as any
      
      // Check guest pass validity
      const now = new Date()
      const expiresAt = new Date(guestPass.expires_at)

      if (guestPass.status === 'used') {
        console.log('❌ DENIED: Guest pass already used')
        await logAccess(supabase, {
          user_id: guestPass.purchased_by,
          property_id: guestPass.property_id,
          qr_code,
          scan_type,
          result: 'DENIED',
          denial_reason: 'Guest pass already used (one-time entry)',
          location_before: 'OUTSIDE',
          location_after: 'OUTSIDE',
          request
        })
        
        return NextResponse.json({
          can_access: false,
          denial_reason: 'This guest pass has already been used (one-time entry)',
          user_name: guestPass.guest_name || 'Guest',
          user_id: null,
          current_location: null,
        }, { status: 200 })
      }

      if (guestPass.status === 'expired' || now > expiresAt) {
        console.log('❌ DENIED: Guest pass expired')
        await logAccess(supabase, {
          user_id: guestPass.purchased_by,
          property_id: guestPass.property_id,
          qr_code,
          scan_type,
          result: 'DENIED',
          denial_reason: 'Guest pass has expired',
          location_before: 'OUTSIDE',
          location_after: 'OUTSIDE',
          request
        })
        
        return NextResponse.json({
          can_access: false,
          denial_reason: 'This guest pass has expired',
          user_name: guestPass.guest_name || 'Guest',
          user_id: null,
          current_location: null,
        }, { status: 200 })
      }

      // Check global rules for guest pass
      if (scan_type === 'ENTRY') {
        // Maintenance check
        if (property.is_maintenance_mode) {
          const reason = property.maintenance_reason || 'Facility is currently closed for maintenance'
          console.log('❌ DENIED: Maintenance mode')
          await logAccess(supabase, {
            user_id: guestPass.purchased_by,
            property_id: guestPass.property_id,
            qr_code,
            scan_type,
            result: 'DENIED',
            denial_reason: reason,
            location_before: 'OUTSIDE',
            location_after: 'OUTSIDE',
            request
          })
          return NextResponse.json({
            can_access: false,
            denial_reason: reason,
            user_name: guestPass.guest_name || 'Guest',
            user_id: null,
            current_location: null,
          }, { status: 200 })
        }

        // Operating hours check
        const currentTime = new Date().toLocaleTimeString('en-US', { 
          hour12: false, 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit' 
        })
        if (currentTime < property.operating_hours_start || currentTime > property.operating_hours_end) {
          const reason = `Pool is closed. Operating hours: ${property.operating_hours_start} - ${property.operating_hours_end}`
          console.log('❌ DENIED: Outside operating hours')
          await logAccess(supabase, {
            user_id: guestPass.purchased_by,
            property_id: guestPass.property_id,
            qr_code,
            scan_type,
            result: 'DENIED',
            denial_reason: reason,
            location_before: 'OUTSIDE',
            location_after: 'OUTSIDE',
            request
          })
          return NextResponse.json({
            can_access: false,
            denial_reason: reason,
            user_name: guestPass.guest_name || 'Guest',
            user_id: null,
            current_location: null,
          }, { status: 200 })
        }

        // Capacity check
        const { count: occupancy } = await supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('property_id', guestPass.property_id)
          .eq('current_location', 'INSIDE')
          .eq('is_active', true)

        if (occupancy !== null && occupancy >= property.max_capacity) {
          const reason = `Facility is at maximum capacity (${property.max_capacity} people)`
          console.log('❌ DENIED: Max capacity reached')
          await logAccess(supabase, {
            user_id: guestPass.purchased_by,
            property_id: guestPass.property_id,
            qr_code,
            scan_type,
            result: 'DENIED',
            denial_reason: reason,
            location_before: 'OUTSIDE',
            location_after: 'OUTSIDE',
            request
          })
          return NextResponse.json({
            can_access: false,
            denial_reason: reason,
            user_name: guestPass.guest_name || 'Guest',
            user_id: null,
            current_location: null,
          }, { status: 200 })
        }
      }

      // Guest pass is valid - Grant access and mark as used
      if (scan_type === 'ENTRY') {
        console.log('✅ GRANTED: Valid guest pass')
        await supabase
          .from('guest_passes')
          .update({ 
            status: 'used',
            used_at: now.toISOString(),
          })
          .eq('id', guestPass.id)

        await logAccess(supabase, {
          user_id: guestPass.purchased_by,
          property_id: guestPass.property_id,
          qr_code,
          scan_type: 'ENTRY',
          result: 'GRANTED',
          location_before: 'OUTSIDE',
          location_after: 'INSIDE',
          request
        })

        return NextResponse.json({
          can_access: true,
          denial_reason: null,
          user_name: guestPass.guest_name || 'Guest',
          user_id: null,
          current_location: 'OUTSIDE',
        }, { status: 200 })
      } else {
        // EXIT for guest pass
        await logAccess(supabase, {
          user_id: guestPass.purchased_by,
          property_id: guestPass.property_id,
          qr_code,
          scan_type: 'EXIT',
          result: 'GRANTED',
          location_before: 'INSIDE',
          location_after: 'OUTSIDE',
          request
        })
        
        return NextResponse.json({
          can_access: true,
          denial_reason: null,
          user_name: guestPass.guest_name || 'Guest',
          user_id: null,
          current_location: 'INSIDE',
        }, { status: 200 })
      }
    }

    // ========================================================================
    // STEP 2: Lookup Resident by QR Code (Multi-Property Support)
    // ========================================================================
    console.log('Looking up resident by QR code...')
    
    const { data: resident, error: residentError } = await supabase
      .from('profiles')
      .select(`
        id,
        name,
        email,
        unit,
        current_location,
        property_id,
        role,
        is_active,
        property:property_id(
          id,
          name,
          operating_hours_start,
          operating_hours_end,
          max_capacity,
          is_maintenance_mode,
          maintenance_reason
        )
      `)
      .eq('qr_code', qr_code)
      .eq('role', 'resident')
      .eq('is_active', true)
      .single()

    if (residentError || !resident) {
      console.log('❌ DENIED: Invalid QR code or inactive resident')
      return NextResponse.json({
        can_access: false,
        denial_reason: 'Invalid QR Code',
        user_name: null,
        user_id: null,
        current_location: null,
      }, { status: 200 })
    }

    console.log(`✓ Resident found: ${resident.name} (Property: ${(resident.property as any)?.name})`)
    const property = resident.property as any

    // ========================================================================
    // STEP 3: Global Rules Check (ENTRY only)
    // ========================================================================
    if (scan_type === 'ENTRY') {
      // Maintenance Mode check
      if (property.is_maintenance_mode) {
        const reason = property.maintenance_reason || 'Facility is currently closed for maintenance'
        console.log('❌ DENIED: Maintenance mode')
        await logAccess(supabase, {
          user_id: resident.id,
          property_id: resident.property_id,
          qr_code,
          scan_type,
          result: 'DENIED',
          denial_reason: reason,
          location_before: resident.current_location,
          location_after: resident.current_location,
          request
        })
        
        return NextResponse.json({
          can_access: false,
          denial_reason: reason,
          user_name: resident.name,
          user_id: resident.id,
          current_location: resident.current_location,
        }, { status: 200 })
      }

      // Operating Hours check
      const currentTime = new Date().toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      })
      
      if (currentTime < property.operating_hours_start || currentTime > property.operating_hours_end) {
        const reason = `Pool is closed. Operating hours: ${property.operating_hours_start} - ${property.operating_hours_end}`
        console.log('❌ DENIED: Outside operating hours')
        await logAccess(supabase, {
          user_id: resident.id,
          property_id: resident.property_id,
          qr_code,
          scan_type,
          result: 'DENIED',
          denial_reason: reason,
          location_before: resident.current_location,
          location_after: resident.current_location,
          request
        })
        
        return NextResponse.json({
          can_access: false,
          denial_reason: reason,
          user_name: resident.name,
          user_id: resident.id,
          current_location: resident.current_location,
        }, { status: 200 })
      }
      console.log(`✓ Within operating hours`)

      // Max Capacity check
      const { count: occupancy } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('property_id', resident.property_id)
        .eq('current_location', 'INSIDE')
        .eq('is_active', true)

      console.log(`Current occupancy: ${occupancy} / ${property.max_capacity}`)
      
      if (occupancy !== null && occupancy >= property.max_capacity) {
        const reason = `Facility is at maximum capacity (${property.max_capacity} people)`
        console.log('❌ DENIED: Max capacity')
        await logAccess(supabase, {
          user_id: resident.id,
          property_id: resident.property_id,
          qr_code,
          scan_type,
          result: 'DENIED',
          denial_reason: reason,
          location_before: resident.current_location,
          location_after: resident.current_location,
          request
        })
        
        return NextResponse.json({
          can_access: false,
          denial_reason: reason,
          user_name: resident.name,
          user_id: resident.id,
          current_location: resident.current_location,
        }, { status: 200 })
      }
      console.log(`✓ Capacity OK`)

      // Anti-Passback check
      if (resident.current_location === 'INSIDE') {
        const reason = 'Pass already in use (already INSIDE)'
        console.log('❌ DENIED: Anti-passback')
        await logAccess(supabase, {
          user_id: resident.id,
          property_id: resident.property_id,
          qr_code,
          scan_type,
          result: 'DENIED',
          denial_reason: reason,
          location_before: resident.current_location,
          location_after: resident.current_location,
          request
        })
        
        return NextResponse.json({
          can_access: false,
          denial_reason: reason,
          user_name: resident.name,
          user_id: resident.id,
          current_location: resident.current_location,
        }, { status: 200 })
      }
      console.log(`✓ Anti-passback OK`)
    }

    // ========================================================================
    // STEP 4: Check Resident-Specific Access Rules
    // ========================================================================
    console.log('Checking resident-specific access rules...')
    
    const { data: ruleStatuses, error: rulesError } = await supabase
      .from('user_rule_status')
      .select(`
        status,
        rule:rule_id(
          id,
          rule_name,
          is_active
        )
      `)
      .eq('user_id', resident.id)

    if (!rulesError && ruleStatuses) {
      for (const ruleStatus of ruleStatuses) {
        const rule = ruleStatus.rule as any
        if (rule && rule.is_active && !ruleStatus.status) {
          const reason = `Access Denied: ${rule.rule_name} is False`
          console.log(`❌ DENIED: Rule failed - ${rule.rule_name}`)
          await logAccess(supabase, {
            user_id: resident.id,
            property_id: resident.property_id,
            qr_code,
            scan_type,
            result: 'DENIED',
            denial_reason: reason,
            location_before: resident.current_location,
            location_after: resident.current_location,
            request
          })
          
          return NextResponse.json({
            can_access: false,
            denial_reason: reason,
            user_name: resident.name,
            user_id: resident.id,
            current_location: resident.current_location,
          }, { status: 200 })
        }
      }
    }
    console.log(`✓ All access rules passed`)

    // ========================================================================
    // STEP 5: GRANT ACCESS - Update Location and Log
    // ========================================================================
    const newLocation = scan_type === 'ENTRY' ? 'INSIDE' : 'OUTSIDE'
    console.log(`✅ GRANTED: Updating location to ${newLocation}`)

    await supabase
      .from('profiles')
      .update({ 
        current_location: newLocation,
        last_scan_at: new Date().toISOString()
      })
      .eq('id', resident.id)

    await logAccess(supabase, {
      user_id: resident.id,
      property_id: resident.property_id,
      qr_code,
      scan_type,
      result: 'GRANTED',
      location_before: resident.current_location,
      location_after: newLocation,
      request
    })

    console.log('=== Access Check Complete ===\n')
    
    return NextResponse.json({
      can_access: true,
      denial_reason: null,
      user_name: resident.name,
      user_id: resident.id,
      current_location: resident.current_location,
    }, { status: 200 })

  } catch (error) {
    console.error('Unexpected error in check-access:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Helper function to log access attempts
async function logAccess(
  supabase: any,
  data: {
    user_id: string
    property_id: string
    qr_code: string
    scan_type: string
    result: string
    denial_reason?: string | null
    location_before: string | null
    location_after: string | null
    request: NextRequest
  }
) {
  await supabase.from('access_logs').insert({
    user_id: data.user_id,
    property_id: data.property_id,
    qr_code: data.qr_code,
    scan_type: data.scan_type,
    result: data.result,
    denial_reason: data.denial_reason || null,
    location_before: data.location_before,
    location_after: data.location_after,
    ip_address: data.request.headers.get('x-forwarded-for') || data.request.headers.get('x-real-ip'),
    user_agent: data.request.headers.get('user-agent'),
  })
}
