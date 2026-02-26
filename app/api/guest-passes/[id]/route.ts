export const runtime = 'edge'

import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/guest-passes/[id]
 * Fetch a single guest pass by ID (for sharing link)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminClient = createAdminClient()
    const { id } = await params

    const { data, error } = await adminClient
      .from('visitor_passes')
      .select(`
        *,
        purchaser:purchased_by(name, unit)
      `)
      .eq('id', id)
      .single()

    if (error || !data) {
      console.error('Guest pass not found:', id)
      return NextResponse.json(
        { error: 'Guest pass not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(data, { status: 200 })
  } catch (error) {
    console.error('Unexpected error in GET /api/guest-passes/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
