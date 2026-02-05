export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          auth_user_id: string | null
          name: string
          email: string
          unit: string
          phone: string | null
          current_location: 'INSIDE' | 'OUTSIDE'
          qr_code: string
          access_pin: string | null // V4
          property_id: string
          role: 'manager' | 'resident' | 'scanner'
          is_active: boolean
          created_at: string
          updated_at: string
          last_scan_at: string | null
        }
        Insert: {
          id?: string
          auth_user_id?: string | null
          name: string
          email: string
          unit: string
          phone?: string | null
          current_location?: 'INSIDE' | 'OUTSIDE'
          qr_code: string
          access_pin?: string | null // V4
          property_id: string
          role?: 'manager' | 'resident' | 'scanner'
          is_active?: boolean
          created_at?: string
          updated_at?: string
          last_scan_at?: string | null
        }
        Update: {
          id?: string
          auth_user_id?: string | null
          name?: string
          email?: string
          unit?: string
          phone?: string | null
          current_location?: 'INSIDE' | 'OUTSIDE'
          qr_code?: string
          access_pin?: string | null // V4
          property_id?: string
          role?: 'manager' | 'resident' | 'scanner'
          is_active?: boolean
          created_at?: string
          updated_at?: string
          last_scan_at?: string | null
        }
      }
      properties: {
        Row: {
          id: string
          name: string
          address: string
          city: string
          state: string
          zip_code: string
          operating_hours_start: string
          operating_hours_end: string
          max_capacity: number
          guest_pass_price: number
          max_guests_per_resident: number // V4
          is_maintenance_mode: boolean
          maintenance_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          address: string
          city: string
          state: string
          zip_code: string
          operating_hours_start?: string
          operating_hours_end?: string
          max_capacity?: number
          guest_pass_price?: number
          max_guests_per_resident?: number // V4
          is_maintenance_mode?: boolean
          maintenance_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          address?: string
          city?: string
          state?: string
          zip_code?: string
          operating_hours_start?: string
          operating_hours_end?: string
          max_capacity?: number
          guest_pass_price?: number
          max_guests_per_resident?: number // V4
          is_maintenance_mode?: boolean
          maintenance_reason?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      guest_passes: {
        Row: {
          id: string
          property_id: string
          purchased_by: string
          guest_name: string | null
          guest_email: string | null
          guest_phone: string | null
          qr_code: string
          price_paid: number
          status: 'active' | 'used' | 'expired' | 'cancelled'
          expires_at: string
          used_at: string | null
          created_at: string
          updated_at: string
          notes: string | null
          ip_address: string | null
          user_agent: string | null
        }
        Insert: {
          id?: string
          property_id: string
          purchased_by: string
          guest_name?: string | null
          guest_email?: string | null
          guest_phone?: string | null
          qr_code: string
          price_paid?: number
          status?: 'active' | 'used' | 'expired' | 'cancelled'
          expires_at: string
          used_at?: string | null
          created_at?: string
          updated_at?: string
          notes?: string | null
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: {
          id?: string
          property_id?: string
          purchased_by?: string
          guest_name?: string | null
          guest_email?: string | null
          guest_phone?: string | null
          qr_code?: string
          price_paid?: number
          status?: 'active' | 'used' | 'expired' | 'cancelled'
          expires_at?: string
          used_at?: string | null
          created_at?: string
          updated_at?: string
          notes?: string | null
          ip_address?: string | null
          user_agent?: string | null
        }
      }
      access_rules: {
        Row: {
          id: string
          property_id: string
          rule_name: string
          description: string | null
          is_active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          property_id: string
          rule_name: string
          description?: string | null
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          property_id?: string
          rule_name?: string
          description?: string | null
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      user_rule_status: {
        Row: {
          id: string
          user_id: string
          rule_id: string
          status: boolean
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          rule_id: string
          status?: boolean
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          rule_id?: string
          status?: boolean
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      access_logs: {
        Row: {
          id: string
          user_id: string | null
          property_id: string
          qr_code: string
          scan_type: 'ENTRY' | 'EXIT'
          result: 'GRANTED' | 'DENIED'
          denial_reason: string | null
          location_before: string | null
          location_after: string | null
          scanned_by: string | null
          scanned_at: string
          ip_address: string | null
          user_agent: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          property_id: string
          qr_code: string
          scan_type: 'ENTRY' | 'EXIT'
          result: 'GRANTED' | 'DENIED'
          denial_reason?: string | null
          location_before?: string | null
          location_after?: string | null
          scanned_by?: string | null
          scanned_at?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          property_id?: string
          qr_code?: string
          scan_type?: 'ENTRY' | 'EXIT'
          result?: 'GRANTED' | 'DENIED'
          denial_reason?: string | null
          location_before?: string | null
          location_after?: string | null
          scanned_by?: string | null
          scanned_at?: string
          ip_address?: string | null
          user_agent?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_user_access: {
        Args: {
          p_qr_code: string
          p_scan_type: string
        }
        Returns: {
          can_access: boolean
          denial_reason: string | null
          user_name: string | null
          user_id: string | null
          current_location: string | null
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Helper types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Property = Database['public']['Tables']['properties']['Row']
export type AccessRule = Database['public']['Tables']['access_rules']['Row']
export type UserRuleStatus = Database['public']['Tables']['user_rule_status']['Row']
export type AccessLog = Database['public']['Tables']['access_logs']['Row']
export type GuestPass = Database['public']['Tables']['guest_passes']['Row']

export type ProfileWithRules = Profile & {
  rule_statuses: (UserRuleStatus & { rule: AccessRule })[]
}

export type GuestPassWithPurchaser = GuestPass & {
  purchaser: Profile | null
}

export type AccessCheckResult = {
  can_access: boolean
  denial_reason: string | null
  user_name: string | null
  user_id: string | null
  current_location: string | null
}

export type FacilityStatus = {
  is_open: boolean
  current_occupancy: number
  max_capacity: number
  operating_hours: {
    start: string
    end: string
  }
  is_maintenance_mode: boolean
  maintenance_reason: string | null
}
