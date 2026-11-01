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
          id: string
          name: string
          slug: string
          status: Database["public"]["Enums"]["org_status"]
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          name: string
          slug: string
          status?: Database["public"]["Enums"]["org_status"]
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
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
      org_access_active: { Args: { p_org: string }; Returns: boolean }
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
      run_subscription_lifecycle: { Args: { p_today?: string }; Returns: Json }
      suspend_subscription: { Args: { p_org: string }; Returns: undefined }
    }
    Enums: {
      member_role: "owner" | "admin" | "operator"
      org_status: "pending_approval" | "active" | "rejected"
      payment_method: "cash" | "transfer" | "mercadopago" | "other"
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
      member_role: ["owner", "admin", "operator"],
      org_status: ["pending_approval", "active", "rejected"],
      payment_method: ["cash", "transfer", "mercadopago", "other"],
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
