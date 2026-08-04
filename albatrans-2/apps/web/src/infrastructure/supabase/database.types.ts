export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      client_contacts: {
        Row: {
          client_id: string
          created_at: string
          created_by: string
          email: string | null
          id: string
          is_primary: boolean
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          role: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_contacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "client_contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          archived_at: string | null
          billing_email: string | null
          created_at: string
          created_by: string
          email: string | null
          external_reference: string | null
          id: string
          legal_name: string
          notes: string | null
          organization_id: string
          payment_terms_days: number
          phone: string | null
          status: Database["public"]["Enums"]["master_data_status"]
          tax_id: string | null
          trade_name: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          billing_email?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          external_reference?: string | null
          id?: string
          legal_name: string
          notes?: string | null
          organization_id: string
          payment_terms_days?: number
          phone?: string | null
          status?: Database["public"]["Enums"]["master_data_status"]
          tax_id?: string | null
          trade_name: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          billing_email?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          external_reference?: string | null
          id?: string
          legal_name?: string
          notes?: string | null
          organization_id?: string
          payment_terms_days?: number
          phone?: string | null
          status?: Database["public"]["Enums"]["master_data_status"]
          tax_id?: string | null
          trade_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_vehicle_assignments: {
        Row: {
          assigned_by: string
          created_at: string
          driver_id: string
          ends_at: string | null
          id: string
          notes: string | null
          organization_id: string
          starts_at: string
          vehicle_id: string
        }
        Insert: {
          assigned_by: string
          created_at?: string
          driver_id: string
          ends_at?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          starts_at: string
          vehicle_id: string
        }
        Update: {
          assigned_by?: string
          created_at?: string
          driver_id?: string
          ends_at?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          starts_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_vehicle_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "driver_vehicle_assignments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_vehicle_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_vehicle_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          active_from: string | null
          active_until: string | null
          archived_at: string | null
          created_at: string
          created_by: string
          display_name: string
          email: string | null
          employee_number: string | null
          employment_status: Database["public"]["Enums"]["driver_employment_status"]
          first_name: string
          id: string
          internal_reference: string | null
          last_name: string
          license_expires_at: string | null
          license_number: string | null
          membership_id: string | null
          notes: string | null
          organization_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          active_from?: string | null
          active_until?: string | null
          archived_at?: string | null
          created_at?: string
          created_by: string
          display_name: string
          email?: string | null
          employee_number?: string | null
          employment_status?: Database["public"]["Enums"]["driver_employment_status"]
          first_name: string
          id?: string
          internal_reference?: string | null
          last_name: string
          license_expires_at?: string | null
          license_number?: string | null
          membership_id?: string | null
          notes?: string | null
          organization_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active_from?: string | null
          active_until?: string | null
          archived_at?: string | null
          created_at?: string
          created_by?: string
          display_name?: string
          email?: string | null
          employee_number?: string | null
          employment_status?: Database["public"]["Enums"]["driver_employment_status"]
          first_name?: string
          id?: string
          internal_reference?: string | null
          last_name?: string
          license_expires_at?: string | null
          license_number?: string | null
          membership_id?: string | null
          notes?: string | null
          organization_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drivers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "drivers_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "organization_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drivers_organization_id_fkey"
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
      locations: {
        Row: {
          address_line_1: string
          address_line_2: string | null
          archived_at: string | null
          city: string
          client_id: string | null
          country_code: string
          created_at: string
          created_by: string
          id: string
          instructions: string | null
          latitude: number | null
          longitude: number | null
          name: string
          organization_id: string
          postal_code: string
          region: string | null
          status: Database["public"]["Enums"]["master_data_status"]
          updated_at: string
        }
        Insert: {
          address_line_1: string
          address_line_2?: string | null
          archived_at?: string | null
          city: string
          client_id?: string | null
          country_code: string
          created_at?: string
          created_by: string
          id?: string
          instructions?: string | null
          latitude?: number | null
          longitude?: number | null
          name: string
          organization_id: string
          postal_code: string
          region?: string | null
          status?: Database["public"]["Enums"]["master_data_status"]
          updated_at?: string
        }
        Update: {
          address_line_1?: string
          address_line_2?: string | null
          archived_at?: string | null
          city?: string
          client_id?: string | null
          country_code?: string
          created_at?: string
          created_by?: string
          id?: string
          instructions?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          organization_id?: string
          postal_code?: string
          region?: string | null
          status?: Database["public"]["Enums"]["master_data_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "locations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      trailers: {
        Row: {
          archived_at: string | null
          brand: string | null
          capacity_kg: number | null
          capacity_m3: number | null
          created_at: string
          created_by: string
          id: string
          inspection_expires_at: string | null
          insurance_expires_at: string | null
          internal_code: string | null
          model: string | null
          notes: string | null
          organization_id: string
          registration_plate: string
          status: Database["public"]["Enums"]["fleet_asset_status"]
          trailer_type: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          brand?: string | null
          capacity_kg?: number | null
          capacity_m3?: number | null
          created_at?: string
          created_by: string
          id?: string
          inspection_expires_at?: string | null
          insurance_expires_at?: string | null
          internal_code?: string | null
          model?: string | null
          notes?: string | null
          organization_id: string
          registration_plate: string
          status?: Database["public"]["Enums"]["fleet_asset_status"]
          trailer_type: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          brand?: string | null
          capacity_kg?: number | null
          capacity_m3?: number | null
          created_at?: string
          created_by?: string
          id?: string
          inspection_expires_at?: string | null
          insurance_expires_at?: string | null
          internal_code?: string | null
          model?: string | null
          notes?: string | null
          organization_id?: string
          registration_plate?: string
          status?: Database["public"]["Enums"]["fleet_asset_status"]
          trailer_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trailers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "trailers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_assignments: {
        Row: {
          assigned_by: string
          created_at: string
          driver_id: string
          ends_at: string
          id: string
          notes: string | null
          organization_id: string
          starts_at: string
          transport_order_id: string
          unassigned_at: string | null
          vehicle_id: string
        }
        Insert: {
          assigned_by: string
          created_at?: string
          driver_id: string
          ends_at: string
          id?: string
          notes?: string | null
          organization_id: string
          starts_at: string
          transport_order_id: string
          unassigned_at?: string | null
          vehicle_id: string
        }
        Update: {
          assigned_by?: string
          created_at?: string
          driver_id?: string
          ends_at?: string
          id?: string
          notes?: string | null
          organization_id?: string
          starts_at?: string
          transport_order_id?: string
          unassigned_at?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "transport_assignments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_assignments_transport_order_id_fkey"
            columns: ["transport_order_id"]
            isOneToOne: false
            referencedRelation: "transport_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_events: {
        Row: {
          actor_user_id: string
          correlation_id: string
          entity_id: string | null
          entity_type: string
          event_type: string
          id: string
          occurred_at: string
          organization_id: string
          payload: Json
          transport_order_id: string
        }
        Insert: {
          actor_user_id: string
          correlation_id?: string
          entity_id?: string | null
          entity_type: string
          event_type: string
          id?: string
          occurred_at?: string
          organization_id: string
          payload?: Json
          transport_order_id: string
        }
        Update: {
          actor_user_id?: string
          correlation_id?: string
          entity_id?: string | null
          entity_type?: string
          event_type?: string
          id?: string
          occurred_at?: string
          organization_id?: string
          payload?: Json
          transport_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "transport_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_events_transport_order_id_fkey"
            columns: ["transport_order_id"]
            isOneToOne: false
            referencedRelation: "transport_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_items: {
        Row: {
          created_at: string
          created_by: string
          description: string
          id: string
          is_adr: boolean
          notes: string | null
          organization_id: string
          packages: number
          pallets: number
          reference: string | null
          stop_id: string
          temperature_max_c: number | null
          temperature_min_c: number | null
          transport_order_id: string
          updated_at: string
          volume_m3: number | null
          weight_kg: number | null
        }
        Insert: {
          created_at?: string
          created_by: string
          description: string
          id?: string
          is_adr?: boolean
          notes?: string | null
          organization_id: string
          packages?: number
          pallets?: number
          reference?: string | null
          stop_id: string
          temperature_max_c?: number | null
          temperature_min_c?: number | null
          transport_order_id: string
          updated_at?: string
          volume_m3?: number | null
          weight_kg?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          is_adr?: boolean
          notes?: string | null
          organization_id?: string
          packages?: number
          pallets?: number
          reference?: string | null
          stop_id?: string
          temperature_max_c?: number | null
          temperature_min_c?: number | null
          transport_order_id?: string
          updated_at?: string
          volume_m3?: number | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transport_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "transport_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_items_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "transport_stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_items_transport_order_id_fkey"
            columns: ["transport_order_id"]
            isOneToOne: false
            referencedRelation: "transport_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_order_counters: {
        Row: {
          last_value: number
          organization_id: string
        }
        Insert: {
          last_value?: number
          organization_id: string
        }
        Update: {
          last_value?: number
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_order_counters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_orders: {
        Row: {
          archived_at: string | null
          assigned_driver_id: string | null
          assigned_vehicle_id: string | null
          created_at: string
          created_by: string
          customer_id: string
          id: string
          notes: string | null
          order_number: string
          organization_id: string
          planned_delivery_at: string | null
          planned_pickup_at: string | null
          priority: Database["public"]["Enums"]["transport_priority"]
          requested_delivery_at: string | null
          requested_pickup_at: string | null
          status: Database["public"]["Enums"]["transport_order_status"]
          transport_type: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          assigned_driver_id?: string | null
          assigned_vehicle_id?: string | null
          created_at?: string
          created_by: string
          customer_id: string
          id?: string
          notes?: string | null
          order_number: string
          organization_id: string
          planned_delivery_at?: string | null
          planned_pickup_at?: string | null
          priority?: Database["public"]["Enums"]["transport_priority"]
          requested_delivery_at?: string | null
          requested_pickup_at?: string | null
          status?: Database["public"]["Enums"]["transport_order_status"]
          transport_type: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          assigned_driver_id?: string | null
          assigned_vehicle_id?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string
          id?: string
          notes?: string | null
          order_number?: string
          organization_id?: string
          planned_delivery_at?: string | null
          planned_pickup_at?: string | null
          priority?: Database["public"]["Enums"]["transport_priority"]
          requested_delivery_at?: string | null
          requested_pickup_at?: string | null
          status?: Database["public"]["Enums"]["transport_order_status"]
          transport_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_orders_assigned_driver_id_fkey"
            columns: ["assigned_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_orders_assigned_vehicle_id_fkey"
            columns: ["assigned_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "transport_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_stops: {
        Row: {
          created_at: string
          created_by: string
          customer_id: string | null
          id: string
          location_id: string
          notes: string | null
          organization_id: string
          position: number
          status: Database["public"]["Enums"]["transport_stop_status"]
          stop_type: Database["public"]["Enums"]["transport_stop_type"]
          transport_order_id: string
          updated_at: string
          window_ends_at: string | null
          window_starts_at: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          customer_id?: string | null
          id?: string
          location_id: string
          notes?: string | null
          organization_id: string
          position: number
          status?: Database["public"]["Enums"]["transport_stop_status"]
          stop_type: Database["public"]["Enums"]["transport_stop_type"]
          transport_order_id: string
          updated_at?: string
          window_ends_at?: string | null
          window_starts_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          customer_id?: string | null
          id?: string
          location_id?: string
          notes?: string | null
          organization_id?: string
          position?: number
          status?: Database["public"]["Enums"]["transport_stop_status"]
          stop_type?: Database["public"]["Enums"]["transport_stop_type"]
          transport_order_id?: string
          updated_at?: string
          window_ends_at?: string | null
          window_starts_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transport_stops_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "transport_stops_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_stops_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_stops_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_stops_transport_order_id_fkey"
            columns: ["transport_order_id"]
            isOneToOne: false
            referencedRelation: "transport_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          archived_at: string | null
          brand: string | null
          capacity_kg: number | null
          capacity_m3: number | null
          created_at: string
          created_by: string
          id: string
          inspection_expires_at: string | null
          insurance_expires_at: string | null
          internal_code: string | null
          model: string | null
          notes: string | null
          organization_id: string
          registration_plate: string
          status: Database["public"]["Enums"]["fleet_asset_status"]
          updated_at: string
          vehicle_type: string
        }
        Insert: {
          archived_at?: string | null
          brand?: string | null
          capacity_kg?: number | null
          capacity_m3?: number | null
          created_at?: string
          created_by: string
          id?: string
          inspection_expires_at?: string | null
          insurance_expires_at?: string | null
          internal_code?: string | null
          model?: string | null
          notes?: string | null
          organization_id: string
          registration_plate: string
          status?: Database["public"]["Enums"]["fleet_asset_status"]
          updated_at?: string
          vehicle_type: string
        }
        Update: {
          archived_at?: string | null
          brand?: string | null
          capacity_kg?: number | null
          capacity_m3?: number | null
          created_at?: string
          created_by?: string
          id?: string
          inspection_expires_at?: string | null
          insurance_expires_at?: string | null
          internal_code?: string | null
          model?: string | null
          notes?: string | null
          organization_id?: string
          registration_plate?: string
          status?: Database["public"]["Enums"]["fleet_asset_status"]
          updated_at?: string
          vehicle_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "vehicles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_master_data: {
        Args: {
          p_module_code: string
          p_organization_id: string
          p_write?: boolean
        }
        Returns: boolean
      }
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
      next_transport_order_number: {
        Args: { p_organization_id: string }
        Returns: string
      }
    }
    Enums: {
      audit_actor_scope: "platform" | "organization" | "system"
      billing_interval: "monthly" | "yearly" | "custom"
      driver_employment_status:
        | "pending"
        | "active"
        | "inactive"
        | "on_leave"
        | "terminated"
        | "archived"
      fleet_asset_status: "active" | "inactive" | "maintenance" | "archived"
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
      master_data_status: "active" | "inactive" | "archived"
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
      transport_order_status:
        | "draft"
        | "planned"
        | "assigned"
        | "loading"
        | "in_transit"
        | "unloading"
        | "completed"
        | "cancelled"
        | "archived"
      transport_priority: "low" | "normal" | "high" | "urgent"
      transport_stop_status: "pending" | "arrived" | "completed" | "skipped"
      transport_stop_type:
        | "pickup"
        | "delivery"
        | "waypoint"
        | "cross_dock"
        | "return"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      audit_actor_scope: ["platform", "organization", "system"],
      billing_interval: ["monthly", "yearly", "custom"],
      driver_employment_status: [
        "pending",
        "active",
        "inactive",
        "on_leave",
        "terminated",
        "archived",
      ],
      fleet_asset_status: ["active", "inactive", "maintenance", "archived"],
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
      master_data_status: ["active", "inactive", "archived"],
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
      transport_order_status: [
        "draft",
        "planned",
        "assigned",
        "loading",
        "in_transit",
        "unloading",
        "completed",
        "cancelled",
        "archived",
      ],
      transport_priority: ["low", "normal", "high", "urgent"],
      transport_stop_status: ["pending", "arrived", "completed", "skipped"],
      transport_stop_type: [
        "pickup",
        "delivery",
        "waypoint",
        "cross_dock",
        "return",
      ],
    },
  },
} as const

