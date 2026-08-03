export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      audit_events: {
        Row: {
          action: string
          actor_scope: Database["public"]["Enums"]["audit_actor_scope"]
          actor_user_id: string | null
          after_data: Json | null
          before_data: Json | null
          correlation_id: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: unknown
          occurred_at: string
          organization_id: string | null
          reason: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_scope: Database["public"]["Enums"]["audit_actor_scope"]
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          correlation_id: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: unknown
          occurred_at?: string
          organization_id?: string | null
          reason?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_scope?: Database["public"]["Enums"]["audit_actor_scope"]
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          correlation_id?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: unknown
          occurred_at?: string
          organization_id?: string | null
          reason?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      legacy_identity_links: {
        Row: {
          created_at: string
          id: string
          legacy_entity_type: Database["public"]["Enums"]["legacy_entity_type"]
          legacy_id_text: string
          legacy_table: string
          legacy_username: string | null
          membership_id: string
          migration_status: Database["public"]["Enums"]["legacy_migration_status"]
          organization_id: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          legacy_entity_type: Database["public"]["Enums"]["legacy_entity_type"]
          legacy_id_text: string
          legacy_table: string
          legacy_username?: string | null
          membership_id: string
          migration_status?: Database["public"]["Enums"]["legacy_migration_status"]
          organization_id: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          legacy_entity_type?: Database["public"]["Enums"]["legacy_entity_type"]
          legacy_id_text?: string
          legacy_table?: string
          legacy_username?: string | null
          membership_id?: string
          migration_status?: Database["public"]["Enums"]["legacy_migration_status"]
          organization_id?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legacy_identity_links_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: true
            referencedRelation: "organization_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legacy_identity_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      limit_definitions: {
        Row: {
          code: string
          created_at: string
          description: string | null
          enforcement: Database["public"]["Enums"]["limit_enforcement"]
          id: string
          module_id: string | null
          name: string
          period: Database["public"]["Enums"]["limit_period"]
          status: Database["public"]["Enums"]["limit_status"]
          unit: Database["public"]["Enums"]["limit_unit"]
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          enforcement: Database["public"]["Enums"]["limit_enforcement"]
          id?: string
          module_id?: string | null
          name: string
          period: Database["public"]["Enums"]["limit_period"]
          status?: Database["public"]["Enums"]["limit_status"]
          unit: Database["public"]["Enums"]["limit_unit"]
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          enforcement?: Database["public"]["Enums"]["limit_enforcement"]
          id?: string
          module_id?: string | null
          name?: string
          period?: Database["public"]["Enums"]["limit_period"]
          status?: Database["public"]["Enums"]["limit_status"]
          unit?: Database["public"]["Enums"]["limit_unit"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "limit_definitions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          category: string
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
          route_prefix: string | null
          sort_order: number
          status: Database["public"]["Enums"]["module_status"]
          updated_at: string
        }
        Insert: {
          category: string
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          route_prefix?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["module_status"]
          updated_at?: string
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          route_prefix?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["module_status"]
          updated_at?: string
        }
        Relationships: []
      }
      organization_limit_overrides: {
        Row: {
          changed_at: string
          changed_by: string
          created_at: string
          limit_definition_id: string
          limit_value: number | null
          organization_id: string
          override_mode: Database["public"]["Enums"]["limit_override_mode"]
          reason: string | null
          updated_at: string
        }
        Insert: {
          changed_at?: string
          changed_by: string
          created_at?: string
          limit_definition_id: string
          limit_value?: number | null
          organization_id: string
          override_mode?: Database["public"]["Enums"]["limit_override_mode"]
          reason?: string | null
          updated_at?: string
        }
        Update: {
          changed_at?: string
          changed_by?: string
          created_at?: string
          limit_definition_id?: string
          limit_value?: number | null
          organization_id?: string
          override_mode?: Database["public"]["Enums"]["limit_override_mode"]
          reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_limit_overrides_limit_definition_id_fkey"
            columns: ["limit_definition_id"]
            isOneToOne: false
            referencedRelation: "limit_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_limit_overrides_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_memberships: {
        Row: {
          created_at: string
          id: string
          invited_at: string | null
          invited_by: string | null
          joined_at: string | null
          organization_id: string
          role: Database["public"]["Enums"]["organization_role"]
          status: Database["public"]["Enums"]["membership_status"]
          suspended_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          joined_at?: string | null
          organization_id: string
          role: Database["public"]["Enums"]["organization_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          suspended_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          joined_at?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["organization_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          suspended_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_module_overrides: {
        Row: {
          changed_at: string
          changed_by: string
          configuration: Json
          created_at: string
          module_id: string
          organization_id: string
          override_mode: Database["public"]["Enums"]["module_override_mode"]
          reason: string | null
          updated_at: string
        }
        Insert: {
          changed_at?: string
          changed_by: string
          configuration?: Json
          created_at?: string
          module_id: string
          organization_id: string
          override_mode?: Database["public"]["Enums"]["module_override_mode"]
          reason?: string | null
          updated_at?: string
        }
        Update: {
          changed_at?: string
          changed_by?: string
          configuration?: Json
          created_at?: string
          module_id?: string
          organization_id?: string
          override_mode?: Database["public"]["Enums"]["module_override_mode"]
          reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_module_overrides_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_module_overrides_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_ends_at: string | null
          current_period_starts_at: string | null
          grace_period_ends_at: string | null
          id: string
          notes: string | null
          organization_id: string
          paid_through: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          plan_id: string
          starts_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_ends_at?: string | null
          current_period_starts_at?: string | null
          grace_period_ends_at?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          paid_through?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          plan_id: string
          starts_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_ends_at?: string | null
          current_period_starts_at?: string | null
          grace_period_ends_at?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          paid_through?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          plan_id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_usage_counters: {
        Row: {
          metric_code: string
          organization_id: string
          period_end: string | null
          period_start: string
          updated_at: string
          usage_value: number
        }
        Insert: {
          metric_code: string
          organization_id: string
          period_end?: string | null
          period_start: string
          updated_at?: string
          usage_value?: number
        }
        Update: {
          metric_code?: string
          organization_id?: string
          period_end?: string | null
          period_start?: string
          updated_at?: string
          usage_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "organization_usage_counters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          archived_at: string | null
          country_code: string
          created_at: string
          created_by: string
          currency_code: string
          email: string | null
          id: string
          internal_notes: string | null
          legal_name: string
          phone: string | null
          status: Database["public"]["Enums"]["organization_status"]
          status_changed_at: string
          status_changed_by: string | null
          status_reason: string | null
          tax_id: string | null
          timezone: string
          trade_name: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          country_code?: string
          created_at?: string
          created_by: string
          currency_code?: string
          email?: string | null
          id?: string
          internal_notes?: string | null
          legal_name: string
          phone?: string | null
          status?: Database["public"]["Enums"]["organization_status"]
          status_changed_at?: string
          status_changed_by?: string | null
          status_reason?: string | null
          tax_id?: string | null
          timezone?: string
          trade_name?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          country_code?: string
          created_at?: string
          created_by?: string
          currency_code?: string
          email?: string | null
          id?: string
          internal_notes?: string | null
          legal_name?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["organization_status"]
          status_changed_at?: string
          status_changed_by?: string | null
          status_reason?: string | null
          tax_id?: string | null
          timezone?: string
          trade_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      plan_limits: {
        Row: {
          created_at: string
          limit_definition_id: string
          limit_value: number
          plan_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          limit_definition_id: string
          limit_value: number
          plan_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          limit_definition_id?: string
          limit_value?: number
          plan_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_limits_limit_definition_id_fkey"
            columns: ["limit_definition_id"]
            isOneToOne: false
            referencedRelation: "limit_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_limits_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_modules: {
        Row: {
          configuration: Json
          created_at: string
          enabled: boolean
          module_id: string
          plan_id: string
          updated_at: string
        }
        Insert: {
          configuration?: Json
          created_at?: string
          enabled: boolean
          module_id: string
          plan_id: string
          updated_at?: string
        }
        Update: {
          configuration?: Json
          created_at?: string
          enabled?: boolean
          module_id?: string
          plan_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_modules_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_modules_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          base_price: number | null
          billing_interval: Database["public"]["Enums"]["billing_interval"]
          code: Database["public"]["Enums"]["plan_code"]
          created_at: string
          currency_code: string
          description: string | null
          id: string
          name: string
          status: Database["public"]["Enums"]["plan_status"]
          updated_at: string
        }
        Insert: {
          base_price?: number | null
          billing_interval: Database["public"]["Enums"]["billing_interval"]
          code: Database["public"]["Enums"]["plan_code"]
          created_at?: string
          currency_code?: string
          description?: string | null
          id?: string
          name: string
          status?: Database["public"]["Enums"]["plan_status"]
          updated_at?: string
        }
        Update: {
          base_price?: number | null
          billing_interval?: Database["public"]["Enums"]["billing_interval"]
          code?: Database["public"]["Enums"]["plan_code"]
          created_at?: string
          currency_code?: string
          description?: string | null
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["plan_status"]
          updated_at?: string
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string
          role: Database["public"]["Enums"]["platform_role"]
          singleton_key: boolean
          status: Database["public"]["Enums"]["platform_admin_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role?: Database["public"]["Enums"]["platform_role"]
          singleton_key?: boolean
          status?: Database["public"]["Enums"]["platform_admin_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: Database["public"]["Enums"]["platform_role"]
          singleton_key?: boolean
          status?: Database["public"]["Enums"]["platform_admin_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          last_login_at: string | null
          locale: string
          phone: string | null
          status: Database["public"]["Enums"]["profile_status"]
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          last_login_at?: string | null
          locale?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["profile_status"]
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          last_login_at?: string | null
          locale?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["profile_status"]
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_organization_has_capacity: {
        Args: {
          p_current_usage: number
          p_limit_code: string
          p_requested_amount?: number
        }
        Returns: boolean
      }
      current_organization_id: { Args: never; Returns: string }
      current_organization_is_active: { Args: never; Returns: boolean }
      current_organization_limit_value: {
        Args: { p_limit_code: string }
        Returns: number
      }
      current_organization_module_enabled: {
        Args: { p_module_code: string }
        Returns: boolean
      }
      current_organization_role: {
        Args: never
        Returns: Database["public"]["Enums"]["organization_role"]
      }
      current_profile_is_active: { Args: never; Returns: boolean }
      is_platform_superadmin: { Args: never; Returns: boolean }
    }
    Enums: {
      audit_actor_scope: "platform" | "organization" | "system"
      billing_interval: "monthly" | "yearly" | "custom"
      legacy_entity_type: "admin_empresa" | "conductor"
      legacy_migration_status:
        | "pending"
        | "matched"
        | "invited"
        | "activated"
        | "conflict"
        | "retired"
      limit_enforcement: "hard" | "soft" | "informational"
      limit_override_mode: "inherit" | "custom"
      limit_period: "total" | "monthly" | "daily"
      limit_status: "active" | "deprecated"
      limit_unit: "count" | "bytes" | "requests"
      membership_status:
        | "invited"
        | "active"
        | "blocked"
        | "suspended"
        | "revoked"
      module_override_mode: "inherit" | "enabled" | "disabled"
      module_status: "active" | "deprecated"
      organization_role: "admin_empresa" | "conductor"
      organization_status:
        | "pending"
        | "active"
        | "maintenance"
        | "blocked"
        | "suspended"
        | "archived"
      payment_status: "not_required" | "pending" | "paid" | "overdue" | "failed"
      plan_code: "starter" | "professional" | "enterprise" | "custom"
      plan_status: "active" | "inactive" | "archived"
      platform_admin_status: "active" | "blocked"
      platform_role: "superadmin"
      profile_status: "active" | "blocked"
      subscription_status:
        | "trial"
        | "active"
        | "past_due"
        | "suspended"
        | "cancelled"
        | "expired"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      audit_actor_scope: ["platform", "organization", "system"],
      billing_interval: ["monthly", "yearly", "custom"],
      legacy_entity_type: ["admin_empresa", "conductor"],
      legacy_migration_status: [
        "pending",
        "matched",
        "invited",
        "activated",
        "conflict",
        "retired",
      ],
      limit_enforcement: ["hard", "soft", "informational"],
      limit_override_mode: ["inherit", "custom"],
      limit_period: ["total", "monthly", "daily"],
      limit_status: ["active", "deprecated"],
      limit_unit: ["count", "bytes", "requests"],
      membership_status: [
        "invited",
        "active",
        "blocked",
        "suspended",
        "revoked",
      ],
      module_override_mode: ["inherit", "enabled", "disabled"],
      module_status: ["active", "deprecated"],
      organization_role: ["admin_empresa", "conductor"],
      organization_status: [
        "pending",
        "active",
        "maintenance",
        "blocked",
        "suspended",
        "archived",
      ],
      payment_status: ["not_required", "pending", "paid", "overdue", "failed"],
      plan_code: ["starter", "professional", "enterprise", "custom"],
      plan_status: ["active", "inactive", "archived"],
      platform_admin_status: ["active", "blocked"],
      platform_role: ["superadmin"],
      profile_status: ["active", "blocked"],
      subscription_status: [
        "trial",
        "active",
        "past_due",
        "suspended",
        "cancelled",
        "expired",
      ],
    },
  },
} as const

