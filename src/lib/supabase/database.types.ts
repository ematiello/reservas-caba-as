export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      amenities: {
        Row: {
          code: string
          id: string
          name: string
        }
        Insert: {
          code: string
          id?: string
          name: string
        }
        Update: {
          code?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          at: string
          diff: Json | null
          id: number
          org_id: string | null
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          at?: string
          diff?: Json | null
          id?: never
          org_id?: string | null
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          at?: string
          diff?: Json | null
          id?: never
          org_id?: string | null
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      booking_payments: {
        Row: {
          amount_cents: number
          booking_id: string
          created_at: string
          currency: string
          id: string
          kind: Database["public"]["Enums"]["guest_payment_kind"]
          method: Database["public"]["Enums"]["guest_payment_method"]
          org_id: string
          paid_at: string
          recorded_by: string | null
          reference: string
          voided_at: string | null
        }
        Insert: {
          amount_cents: number
          booking_id: string
          created_at?: string
          currency?: string
          id?: string
          kind: Database["public"]["Enums"]["guest_payment_kind"]
          method: Database["public"]["Enums"]["guest_payment_method"]
          org_id: string
          paid_at?: string
          recorded_by?: string | null
          reference?: string
          voided_at?: string | null
        }
        Update: {
          amount_cents?: number
          booking_id?: string
          created_at?: string
          currency?: string
          id?: string
          kind?: Database["public"]["Enums"]["guest_payment_kind"]
          method?: Database["public"]["Enums"]["guest_payment_method"]
          org_id?: string
          paid_at?: string
          recorded_by?: string | null
          reference?: string
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_payments_org_id_booking_id_fkey"
            columns: ["org_id", "booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "booking_payments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          check_in: string
          check_out: string
          cleaning_buffer_days: number
          created_at: string
          created_by: string | null
          currency: string
          deposit_cents: number | null
          expires_at: string | null
          guest_id: string | null
          guests_count: number | null
          id: string
          kind: Database["public"]["Enums"]["booking_kind"]
          notes: string
          occupied: unknown
          org_id: string
          price_breakdown: Json | null
          property_id: string
          status: Database["public"]["Enums"]["booking_status"]
          total_cents: number | null
          unit_id: string
          updated_at: string
        }
        Insert: {
          check_in: string
          check_out: string
          cleaning_buffer_days?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          deposit_cents?: number | null
          expires_at?: string | null
          guest_id?: string | null
          guests_count?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["booking_kind"]
          notes?: string
          occupied?: unknown
          org_id: string
          price_breakdown?: Json | null
          property_id: string
          status: Database["public"]["Enums"]["booking_status"]
          total_cents?: number | null
          unit_id: string
          updated_at?: string
        }
        Update: {
          check_in?: string
          check_out?: string
          cleaning_buffer_days?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          deposit_cents?: number | null
          expires_at?: string | null
          guest_id?: string | null
          guests_count?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["booking_kind"]
          notes?: string
          occupied?: unknown
          org_id?: string
          price_breakdown?: Json | null
          property_id?: string
          status?: Database["public"]["Enums"]["booking_status"]
          total_cents?: number | null
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_org_id_guest_id_fkey"
            columns: ["org_id", "guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "bookings_org_id_property_id_fkey"
            columns: ["org_id", "property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "bookings_property_id_unit_id_fkey"
            columns: ["property_id", "unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["property_id", "id"]
          },
        ]
      }
      error_log: {
        Row: {
          count: number
          detail: string | null
          digest: string | null
          fingerprint: string
          first_at: string
          id: number
          last_at: string
          message: string
          org_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          route: string | null
          severity: string
          source: string
          status: string
          user_id: string | null
        }
        Insert: {
          count?: number
          detail?: string | null
          digest?: string | null
          fingerprint: string
          first_at?: string
          id?: never
          last_at?: string
          message: string
          org_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          route?: string | null
          severity?: string
          source: string
          status?: string
          user_id?: string | null
        }
        Update: {
          count?: number
          detail?: string | null
          digest?: string | null
          fingerprint?: string
          first_at?: string
          id?: never
          last_at?: string
          message?: string
          org_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          route?: string | null
          severity?: string
          source?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "error_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      guests: {
        Row: {
          consent_at: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          marketing_consent: boolean
          notes: string
          org_id: string
          phone: string | null
        }
        Insert: {
          consent_at?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          marketing_consent?: boolean
          notes?: string
          org_id: string
          phone?: string | null
        }
        Update: {
          consent_at?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          marketing_consent?: boolean
          notes?: string
          org_id?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          date: string
          id: string
          name: string
          org_id: string | null
        }
        Insert: {
          date: string
          id?: string
          name: string
          org_id?: string | null
        }
        Update: {
          date?: string
          id?: string
          name?: string
          org_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "holidays_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          created_by: string
          expires_at: string
          id: string
          org_id: string
          revoked_at: string | null
          role: Database["public"]["Enums"]["member_role"]
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          org_id: string
          revoked_at?: string | null
          role: Database["public"]["Enums"]["member_role"]
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          org_id?: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      length_discounts: {
        Row: {
          created_at: string
          id: string
          min_nights: number
          org_id: string
          pct: number
          property_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          min_nights: number
          org_id: string
          pct: number
          property_id: string
        }
        Update: {
          created_at?: string
          id?: string
          min_nights?: number
          org_id?: string
          pct?: number
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "length_discounts_org_id_property_id_fkey"
            columns: ["org_id", "property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      media: {
        Row: {
          alt: string
          created_at: string
          id: string
          org_id: string
          property_id: string
          sort: number
          storage_path: string
          unit_id: string | null
        }
        Insert: {
          alt?: string
          created_at?: string
          id?: string
          org_id: string
          property_id: string
          sort?: number
          storage_path: string
          unit_id?: string | null
        }
        Update: {
          alt?: string
          created_at?: string
          id?: string
          org_id?: string
          property_id?: string
          sort?: number
          storage_path?: string
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_org_id_property_id_fkey"
            columns: ["org_id", "property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "media_property_id_unit_id_fkey"
            columns: ["property_id", "unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["property_id", "id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          org_id: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          org_id: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          org_id?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          disabled_at: string | null
          disabled_by: string | null
          id: string
          name: string
          slug: string
          status: Database["public"]["Enums"]["org_status"]
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          disabled_at?: string | null
          disabled_by?: string | null
          id?: string
          name: string
          slug: string
          status?: Database["public"]["Enums"]["org_status"]
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          disabled_at?: string | null
          disabled_by?: string | null
          id?: string
          name?: string
          slug?: string
          status?: Database["public"]["Enums"]["org_status"]
        }
        Relationships: []
      }
      plans: {
        Row: {
          created_at: string
          currency: string
          id: string
          is_active: boolean
          max_members: number | null
          max_units: number | null
          name: string
          price_cents: number
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          max_members?: number | null
          max_units?: number | null
          name: string
          price_cents: number
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          max_members?: number | null
          max_units?: number | null
          name?: string
          price_cents?: number
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          default_grace_days: number
          id: boolean
          trial_days: number
          updated_at: string
        }
        Insert: {
          default_grace_days?: number
          id?: boolean
          trial_days?: number
          updated_at?: string
        }
        Update: {
          default_grace_days?: number
          id?: boolean
          trial_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          phone: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          phone?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string
          phone?: string | null
          user_id?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string | null
          check_in_time: string | null
          check_out_time: string | null
          city: string | null
          cleaning_buffer_days: number
          created_at: string
          deposit_pct: number
          description: string
          id: string
          is_published: boolean
          lat: number | null
          lng: number | null
          name: string
          org_id: string
          province: string | null
          provisional_hold_hours: number
          slug: string
          timezone: string
          updated_at: string
          weekend_days: number[]
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          check_in_time?: string | null
          check_out_time?: string | null
          city?: string | null
          cleaning_buffer_days?: number
          created_at?: string
          deposit_pct?: number
          description?: string
          id?: string
          is_published?: boolean
          lat?: number | null
          lng?: number | null
          name: string
          org_id: string
          province?: string | null
          provisional_hold_hours?: number
          slug: string
          timezone?: string
          updated_at?: string
          weekend_days?: number[]
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          check_in_time?: string | null
          check_out_time?: string | null
          city?: string | null
          cleaning_buffer_days?: number
          created_at?: string
          deposit_pct?: number
          description?: string
          id?: string
          is_published?: boolean
          lat?: number | null
          lng?: number | null
          name?: string
          org_id?: string
          province?: string | null
          provisional_hold_hours?: number
          slug?: string
          timezone?: string
          updated_at?: string
          weekend_days?: number[]
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_rules: {
        Row: {
          category_id: string | null
          created_at: string
          date_from: string | null
          date_to: string | null
          extra_guest_cents: number | null
          guests_included: number | null
          id: string
          kind: Database["public"]["Enums"]["rate_kind"]
          min_nights: number | null
          name: string
          org_id: string
          price_cents: number
          priority: number | null
          property_id: string
          unit_id: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          date_from?: string | null
          date_to?: string | null
          extra_guest_cents?: number | null
          guests_included?: number | null
          id?: string
          kind: Database["public"]["Enums"]["rate_kind"]
          min_nights?: number | null
          name: string
          org_id: string
          price_cents: number
          priority?: number | null
          property_id: string
          unit_id?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string
          date_from?: string | null
          date_to?: string | null
          extra_guest_cents?: number | null
          guests_included?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["rate_kind"]
          min_nights?: number | null
          name?: string
          org_id?: string
          price_cents?: number
          priority?: number | null
          property_id?: string
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rate_rules_org_id_property_id_fkey"
            columns: ["org_id", "property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "rate_rules_property_id_category_id_fkey"
            columns: ["property_id", "category_id"]
            isOneToOne: false
            referencedRelation: "unit_categories"
            referencedColumns: ["property_id", "id"]
          },
          {
            foreignKeyName: "rate_rules_property_id_unit_id_fkey"
            columns: ["property_id", "unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["property_id", "id"]
          },
        ]
      }
      subscription_payments: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          org_id: string
          paid_at: string
          period_end: string
          period_start: string
          recorded_by: string | null
          subscription_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          org_id: string
          paid_at: string
          period_end: string
          period_start: string
          recorded_by?: string | null
          subscription_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          org_id?: string
          paid_at?: string
          period_end?: string
          period_start?: string
          recorded_by?: string | null
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string
          current_period_start: string
          discount_cents: number | null
          discount_pct: number | null
          discount_until: string | null
          grace_days: number
          id: string
          org_id: string
          plan_id: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_period_end: string
          current_period_start: string
          discount_cents?: number | null
          discount_pct?: number | null
          discount_until?: string | null
          grace_days: number
          id?: string
          org_id: string
          plan_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          discount_cents?: number | null
          discount_pct?: number | null
          discount_until?: string | null
          grace_days?: number
          id?: string
          org_id?: string
          plan_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_amenities: {
        Row: {
          amenity_id: string
          org_id: string
          unit_id: string
        }
        Insert: {
          amenity_id: string
          org_id: string
          unit_id: string
        }
        Update: {
          amenity_id?: string
          org_id?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_amenities_amenity_id_fkey"
            columns: ["amenity_id"]
            isOneToOne: false
            referencedRelation: "amenities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_amenities_org_id_unit_id_fkey"
            columns: ["org_id", "unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      unit_categories: {
        Row: {
          created_at: string
          description: string
          id: string
          name: string
          org_id: string
          property_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          name: string
          org_id: string
          property_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          name?: string
          org_id?: string
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_categories_org_id_property_id_fkey"
            columns: ["org_id", "property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      units: {
        Row: {
          bedrooms: number | null
          beds: number | null
          category_id: string | null
          created_at: string
          description: string
          id: string
          is_published: boolean
          kind: Database["public"]["Enums"]["unit_kind"]
          max_guests: number
          name: string
          org_id: string
          property_id: string
          sort: number
          updated_at: string
        }
        Insert: {
          bedrooms?: number | null
          beds?: number | null
          category_id?: string | null
          created_at?: string
          description?: string
          id?: string
          is_published?: boolean
          kind: Database["public"]["Enums"]["unit_kind"]
          max_guests: number
          name: string
          org_id: string
          property_id: string
          sort?: number
          updated_at?: string
        }
        Update: {
          bedrooms?: number | null
          beds?: number | null
          category_id?: string | null
          created_at?: string
          description?: string
          id?: string
          is_published?: boolean
          kind?: Database["public"]["Enums"]["unit_kind"]
          max_guests?: number
          name?: string
          org_id?: string
          property_id?: string
          sort?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_org_id_property_id_fkey"
            columns: ["org_id", "property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "units_property_id_category_id_fkey"
            columns: ["property_id", "category_id"]
            isOneToOne: false
            referencedRelation: "unit_categories"
            referencedColumns: ["property_id", "id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: { Args: { p_token: string }; Returns: string }
      audit_entries: {
        Args: { p_before?: number; p_limit?: number; p_org?: string }
        Returns: {
          action: string
          actor: string
          actor_id: string
          actor_kind: string
          at: string
          diff: Json
          id: number
          org_id: string
          org_name: string
          record_id: string
          table_name: string
        }[]
      }
      cancel_subscription: { Args: { p_org: string }; Returns: undefined }
      create_booking: {
        Args: {
          p_check_in: string
          p_check_out: string
          p_guest_email?: string
          p_guest_name?: string
          p_guest_phone?: string
          p_guests_count?: number
          p_kind?: Database["public"]["Enums"]["booking_kind"]
          p_notes?: string
          p_status?: Database["public"]["Enums"]["booking_status"]
          p_unit: string
        }
        Returns: string
      }
      create_booking_for_category: {
        Args: {
          p_category: string
          p_check_in: string
          p_check_out: string
          p_guest_email?: string
          p_guest_name?: string
          p_guest_phone?: string
          p_guests_count: number
          p_notes?: string
          p_status?: Database["public"]["Enums"]["booking_status"]
        }
        Returns: string
      }
      expire_provisional_bookings: { Args: never; Returns: number }
      grant_platform_admin: { Args: { p_email: string }; Returns: string }
      list_platform_admins: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string
          user_id: string
        }[]
      }
      log_admin_access: {
        Args: { p_area: string; p_org: string }
        Returns: undefined
      }
      log_error: {
        Args: {
          p_detail?: string
          p_digest?: string
          p_fingerprint: string
          p_message: string
          p_org?: string
          p_route?: string
          p_severity: string
          p_source: string
          p_user?: string
        }
        Returns: undefined
      }
      org_access_active: { Args: { p_org: string }; Returns: boolean }
      public_availability: {
        Args: { p_from: string; p_slug: string; p_to: string }
        Returns: {
          ends_on: string
          starts_on: string
          unit_id: string
        }[]
      }
      public_property_state: { Args: { p_slug: string }; Returns: string }
      public_search: {
        Args: {
          p_check_in?: string
          p_check_out?: string
          p_guests?: number
          p_query?: string
        }
        Returns: {
          city: string
          free_units: number
          name: string
          province: string
          slug: string
        }[]
      }
      purge_error_log: { Args: never; Returns: number }
      reactivate_subscription: {
        Args: { p_org: string; p_until: string }
        Returns: undefined
      }
      record_subscription_payment: {
        Args: {
          p_amount_cents: number
          p_method: Database["public"]["Enums"]["payment_method"]
          p_months?: number
          p_notes?: string
          p_org: string
          p_paid_at: string
        }
        Returns: string
      }
      register_organization: {
        Args: { p_name: string; p_slug: string }
        Returns: string
      }
      review_organization: {
        Args: { p_approve: boolean; p_org: string; p_plan?: string }
        Returns: undefined
      }
      revoke_platform_admin: { Args: { p_user: string }; Returns: undefined }
      run_subscription_lifecycle: { Args: { p_today?: string }; Returns: Json }
      set_error_status: {
        Args: { p_id: number; p_status: string }
        Returns: undefined
      }
      set_organization_disabled: {
        Args: { p_disabled: boolean; p_org: string }
        Returns: undefined
      }
      suspend_subscription: { Args: { p_org: string }; Returns: undefined }
      update_organization: {
        Args: { p_name: string; p_org: string; p_slug?: string }
        Returns: undefined
      }
    }
    Enums: {
      booking_kind: "booking" | "block"
      booking_status:
        | "provisional"
        | "confirmed"
        | "checked_in"
        | "checked_out"
        | "cancelled"
        | "expired"
      guest_payment_kind: "deposit" | "payment" | "refund"
      guest_payment_method: "cash" | "transfer" | "mercadopago" | "other"
      member_role: "owner" | "admin" | "operator"
      org_status: "pending_approval" | "active" | "rejected"
      payment_method: "cash" | "transfer" | "mercadopago" | "other"
      rate_kind: "base" | "season" | "weekend" | "holiday" | "special"
      subscription_status:
        | "trial"
        | "active"
        | "past_due"
        | "suspended"
        | "cancelled"
      unit_kind: "cabin" | "house" | "apartment" | "room"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      booking_kind: ["booking", "block"],
      booking_status: [
        "provisional",
        "confirmed",
        "checked_in",
        "checked_out",
        "cancelled",
        "expired",
      ],
      guest_payment_kind: ["deposit", "payment", "refund"],
      guest_payment_method: ["cash", "transfer", "mercadopago", "other"],
      member_role: ["owner", "admin", "operator"],
      org_status: ["pending_approval", "active", "rejected"],
      payment_method: ["cash", "transfer", "mercadopago", "other"],
      rate_kind: ["base", "season", "weekend", "holiday", "special"],
      subscription_status: [
        "trial",
        "active",
        "past_due",
        "suspended",
        "cancelled",
      ],
      unit_kind: ["cabin", "house", "apartment", "room"],
    },
  },
} as const
