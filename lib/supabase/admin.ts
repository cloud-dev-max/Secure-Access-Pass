import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'

/**
 * Admin Supabase Client (Service Role)
 * 
 * IMPORTANT: This client bypasses Row Level Security (RLS).
 * Only use in API routes, NEVER expose to client-side code.
 * 
 * Use cases:
 * - Creating residents/rules (bypasses RLS insert policies)
 * - Bulk operations
 * - Admin-level data access
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'Missing Supabase environment variables. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local'
    )
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/**
 * Ensures the default property exists in the database.
 * Creates it automatically if missing (prevents foreign key errors).
 * 
 * @returns Property ID (from env or newly created)
 */
export async function ensurePropertyExists() {
  const adminClient = createAdminClient()
  const propertyId = process.env.NEXT_PUBLIC_DEFAULT_PROPERTY_ID || '00000000-0000-0000-0000-000000000001'

  // Check if property exists
  const { data: existingProperty, error: checkError } = await adminClient
    .from('properties')
    .select('id')
    .eq('id', propertyId)
    .single()

  if (existingProperty) {
    return propertyId
  }

  // Property doesn't exist, create it
  console.log(`Property ${propertyId} not found. Creating default property...`)

  const { error: insertError } = await adminClient
    .from('properties')
    .insert({
      id: propertyId,
      name: 'Default Property',
      address: '123 Main Street',
      city: 'Default City',
      state: 'CA',
      zip_code: '00000',
    })

  if (insertError) {
    console.error('Failed to create default property:', insertError)
    throw new Error(`Failed to create property: ${insertError.message}`)
  }

  console.log(`Default property ${propertyId} created successfully`)
  return propertyId
}
