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
      billing_command_idempotency: {
        Row: {
          actor_user_id: string
          completed_at: string | null
          created_at: string
          idempotency_key: string
          organization_id: string
          request_hash: string
          result: Json | null
        }
        Insert: {
          actor_user_id: string
          completed_at?: string | null
          created_at?: string
          idempotency_key: string
          organization_id: string
          request_hash: string
          result?: Json | null
        }
        Update: {
          actor_user_id?: string
          completed_at?: string | null
          created_at?: string
          idempotency_key?: string
          organization_id?: string
          request_hash?: string
          result?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_command_idempotency_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "billing_command_idempotency_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_fiscal_settings: {
        Row: {
          address_line_1: string
          address_line_2: string | null
          billing_email: string | null
          city: string
          country_code: string
          created_at: string
          default_payment_terms_days: number
          legal_name: string
          organization_id: string
          postal_code: string
          region: string | null
          tax_id: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          address_line_1: string
          address_line_2?: string | null
          billing_email?: string | null
          city: string
          country_code?: string
          created_at?: string
          default_payment_terms_days?: number
          legal_name: string
          organization_id: string
          postal_code: string
          region?: string | null
          tax_id: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          address_line_1?: string
          address_line_2?: string | null
          billing_email?: string | null
          city?: string
          country_code?: string
          created_at?: string
          default_payment_terms_days?: number
          legal_name?: string
          organization_id?: string
          postal_code?: string
          region?: string | null
          tax_id?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_fiscal_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_fiscal_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      billing_preinvoice_counters: {
        Row: {
          last_number: number
          organization_id: string
          reference_year: number
        }
        Insert: {
          last_number?: number
          organization_id: string
          reference_year: number
        }
        Update: {
          last_number?: number
          organization_id?: string
          reference_year?: number
        }
        Relationships: [
          {
            foreignKeyName: "billing_preinvoice_counters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_preinvoice_lines: {
        Row: {
          created_at: string
          created_by: string
          description: string
          id: string
          line_amount: number
          organization_id: string
          preinvoice_id: string
          remove_reason: string | null
          removed_at: string | null
          removed_by: string | null
          transport_order_id: string
          valuation_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description: string
          id?: string
          line_amount: number
          organization_id: string
          preinvoice_id: string
          remove_reason?: string | null
          removed_at?: string | null
          removed_by?: string | null
          transport_order_id: string
          valuation_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          line_amount?: number
          organization_id?: string
          preinvoice_id?: string
          remove_reason?: string | null
          removed_at?: string | null
          removed_by?: string | null
          transport_order_id?: string
          valuation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_preinvoice_lines_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "billing_preinvoice_lines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_preinvoice_lines_preinvoice_id_fkey"
            columns: ["preinvoice_id"]
            isOneToOne: false
            referencedRelation: "billing_preinvoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_preinvoice_lines_removed_by_fkey"
            columns: ["removed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "billing_preinvoice_lines_transport_order_id_fkey"
            columns: ["transport_order_id"]
            isOneToOne: false
            referencedRelation: "transport_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_preinvoice_lines_valuation_id_fkey"
            columns: ["valuation_id"]
            isOneToOne: false
            referencedRelation: "transport_order_valuations"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_preinvoices: {
        Row: {
          adjustments_amount: number
          approved_at: string | null
          approved_by: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          client_id: string
          created_at: string
          created_by: string
          currency_code: string
          id: string
          notes: string | null
          organization_id: string
          period_end: string
          period_start: string
          reference: string
          status: Database["public"]["Enums"]["billing_preinvoice_status"]
          subtotal_amount: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          adjustments_amount?: number
          approved_at?: string | null
          approved_by?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          client_id: string
          created_at?: string
          created_by: string
          currency_code?: string
          id?: string
          notes?: string | null
          organization_id: string
          period_end: string
          period_start: string
          reference: string
          status?: Database["public"]["Enums"]["billing_preinvoice_status"]
          subtotal_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Update: {
          adjustments_amount?: number
          approved_at?: string | null
          approved_by?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          client_id?: string
          created_at?: string
          created_by?: string
          currency_code?: string
          id?: string
          notes?: string | null
          organization_id?: string
          period_end?: string
          period_start?: string
          reference?: string
          status?: Database["public"]["Enums"]["billing_preinvoice_status"]
          subtotal_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_preinvoices_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "billing_preinvoices_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "billing_preinvoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_preinvoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "billing_preinvoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_rates: {
        Row: {
          archived_at: string | null
          client_id: string
          components_json: Json
          created_at: string
          created_by: string
          currency_code: string
          destination_location_id: string | null
          id: string
          name: string
          organization_id: string
          origin_location_id: string | null
          previous_rate_id: string | null
          service_type: string | null
          status: Database["public"]["Enums"]["billing_rate_status"]
          supplement_rules_json: Json
          updated_at: string
          valid_from: string
          valid_until: string | null
          version_group_id: string
          version_number: number
        }
        Insert: {
          archived_at?: string | null
          client_id: string
          components_json?: Json
          created_at?: string
          created_by: string
          currency_code?: string
          destination_location_id?: string | null
          id?: string
          name: string
          organization_id: string
          origin_location_id?: string | null
          previous_rate_id?: string | null
          service_type?: string | null
          status?: Database["public"]["Enums"]["billing_rate_status"]
          supplement_rules_json?: Json
          updated_at?: string
          valid_from: string
          valid_until?: string | null
          version_group_id: string
          version_number?: number
        }
        Update: {
          archived_at?: string | null
          client_id?: string
          components_json?: Json
          created_at?: string
          created_by?: string
          currency_code?: string
          destination_location_id?: string | null
          id?: string
          name?: string
          organization_id?: string
          origin_location_id?: string | null
          previous_rate_id?: string | null
          service_type?: string | null
          status?: Database["public"]["Enums"]["billing_rate_status"]
          supplement_rules_json?: Json
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
          version_group_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "billing_rates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_rates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "billing_rates_destination_location_id_fkey"
            columns: ["destination_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_rates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_rates_origin_location_id_fkey"
            columns: ["origin_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_rates_previous_rate_id_fkey"
            columns: ["previous_rate_id"]
            isOneToOne: false
            referencedRelation: "billing_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_supplement_definitions: {
        Row: {
          amount: number
          archived_at: string | null
          charge_mode: Database["public"]["Enums"]["billing_charge_mode"]
          code: string
          created_at: string
          created_by: string
          id: string
          name: string
          organization_id: string
          percentage_base: string | null
          status: Database["public"]["Enums"]["master_data_status"]
          unit_code: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          archived_at?: string | null
          charge_mode: Database["public"]["Enums"]["billing_charge_mode"]
          code: string
          created_at?: string
          created_by: string
          id?: string
          name: string
          organization_id: string
          percentage_base?: string | null
          status?: Database["public"]["Enums"]["master_data_status"]
          unit_code?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          archived_at?: string | null
          charge_mode?: Database["public"]["Enums"]["billing_charge_mode"]
          code?: string
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          organization_id?: string
          percentage_base?: string | null
          status?: Database["public"]["Enums"]["master_data_status"]
          unit_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_supplement_definitions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "billing_supplement_definitions_organization_id_fkey"
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
      company_user_lifecycle: {
        Row: {
          created_at: string
          created_by: string
          deactivated_at: string | null
          deactivated_by: string | null
          first_name: string
          initial_password_changed_at: string | null
          last_name: string
          must_change_password: boolean
          organization_id: string
          status: Database["public"]["Enums"]["company_user_lifecycle_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          deactivated_at?: string | null
          deactivated_by?: string | null
          first_name: string
          initial_password_changed_at?: string | null
          last_name: string
          must_change_password?: boolean
          organization_id: string
          status?: Database["public"]["Enums"]["company_user_lifecycle_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deactivated_at?: string | null
          deactivated_by?: string | null
          first_name?: string
          initial_password_changed_at?: string | null
          last_name?: string
          must_change_password?: boolean
          organization_id?: string
          status?: Database["public"]["Enums"]["company_user_lifecycle_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_user_lifecycle_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "company_user_lifecycle_deactivated_by_fkey"
            columns: ["deactivated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "company_user_lifecycle_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_command_idempotency: {
        Row: {
          actor_user_id: string
          completed_at: string | null
          created_at: string
          idempotency_key: string
          organization_id: string
          request_hash: string
          result: Json | null
        }
        Insert: {
          actor_user_id: string
          completed_at?: string | null
          created_at?: string
          idempotency_key: string
          organization_id: string
          request_hash: string
          result?: Json | null
        }
        Update: {
          actor_user_id?: string
          completed_at?: string | null
          created_at?: string
          idempotency_key?: string
          organization_id?: string
          request_hash?: string
          result?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "document_command_idempotency_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "document_command_idempotency_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_outbox: {
        Row: {
          attempts: number
          correlation_id: string
          created_at: string
          document_id: string | null
          document_version_id: string | null
          event_type: string
          id: string
          last_error: string | null
          next_attempt_at: string
          organization_id: string
          payload: Json
          processed_at: string | null
          status: Database["public"]["Enums"]["document_outbox_status"]
        }
        Insert: {
          attempts?: number
          correlation_id: string
          created_at?: string
          document_id?: string | null
          document_version_id?: string | null
          event_type: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          organization_id: string
          payload?: Json
          processed_at?: string | null
          status?: Database["public"]["Enums"]["document_outbox_status"]
        }
        Update: {
          attempts?: number
          correlation_id?: string
          created_at?: string
          document_id?: string | null
          document_version_id?: string | null
          event_type?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          organization_id?: string
          payload?: Json
          processed_at?: string | null
          status?: Database["public"]["Enums"]["document_outbox_status"]
        }
        Relationships: [
          {
            foreignKeyName: "document_outbox_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_outbox_document_version_id_fkey"
            columns: ["document_version_id"]
            isOneToOne: false
            referencedRelation: "document_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_outbox_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_signatures: {
        Row: {
          created_at: string
          created_by: string
          document_id: string
          document_version_id: string | null
          id: string
          ip_address: unknown
          organization_id: string
          revocation_reason: string | null
          revoked_at: string | null
          signature_data_path: string | null
          signature_hash: string
          signature_type: Database["public"]["Enums"]["document_signature_type"]
          signed_at: string
          signer_name: string
          signer_role: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          document_id: string
          document_version_id?: string | null
          id?: string
          ip_address?: unknown
          organization_id: string
          revocation_reason?: string | null
          revoked_at?: string | null
          signature_data_path?: string | null
          signature_hash: string
          signature_type: Database["public"]["Enums"]["document_signature_type"]
          signed_at: string
          signer_name: string
          signer_role?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          document_id?: string
          document_version_id?: string | null
          id?: string
          ip_address?: unknown
          organization_id?: string
          revocation_reason?: string | null
          revoked_at?: string | null
          signature_data_path?: string | null
          signature_hash?: string
          signature_type?: Database["public"]["Enums"]["document_signature_type"]
          signed_at?: string
          signer_name?: string
          signer_role?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_signatures_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "document_signatures_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_signatures_document_version_id_fkey"
            columns: ["document_version_id"]
            isOneToOne: false
            referencedRelation: "document_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_signatures_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_versions: {
        Row: {
          created_at: string
          document_id: string
          id: string
          metadata: Json
          mime_type: string
          organization_id: string
          original_filename: string
          sha256: string | null
          size_bytes: number
          status: Database["public"]["Enums"]["document_version_status"]
          storage_bucket: string
          storage_path: string
          uploaded_at: string | null
          uploaded_by: string
          version_number: number
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          metadata?: Json
          mime_type: string
          organization_id: string
          original_filename: string
          sha256?: string | null
          size_bytes: number
          status?: Database["public"]["Enums"]["document_version_status"]
          storage_bucket: string
          storage_path: string
          uploaded_at?: string | null
          uploaded_by: string
          version_number: number
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          metadata?: Json
          mime_type?: string
          organization_id?: string
          original_filename?: string
          sha256?: string | null
          size_bytes?: number
          status?: Database["public"]["Enums"]["document_version_status"]
          storage_bucket?: string
          storage_path?: string
          uploaded_at?: string | null
          uploaded_by?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_versions_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      documents: {
        Row: {
          archived_at: string | null
          client_id: string | null
          created_at: string
          created_by: string
          current_version_id: string | null
          description: string | null
          document_type: string
          driver_id: string | null
          id: string
          invoice_id: string | null
          organization_id: string
          source: Database["public"]["Enums"]["document_source"]
          status: Database["public"]["Enums"]["document_status"]
          title: string
          transport_incident_id: string | null
          transport_order_id: string | null
          transport_stop_id: string | null
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          archived_at?: string | null
          client_id?: string | null
          created_at?: string
          created_by: string
          current_version_id?: string | null
          description?: string | null
          document_type: string
          driver_id?: string | null
          id?: string
          invoice_id?: string | null
          organization_id: string
          source: Database["public"]["Enums"]["document_source"]
          status?: Database["public"]["Enums"]["document_status"]
          title: string
          transport_incident_id?: string | null
          transport_order_id?: string | null
          transport_stop_id?: string | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          archived_at?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string
          current_version_id?: string | null
          description?: string | null
          document_type?: string
          driver_id?: string | null
          id?: string
          invoice_id?: string | null
          organization_id?: string
          source?: Database["public"]["Enums"]["document_source"]
          status?: Database["public"]["Enums"]["document_status"]
          title?: string
          transport_incident_id?: string | null
          transport_order_id?: string | null
          transport_stop_id?: string | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "documents_current_version_fk"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "document_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_transport_incident_id_fkey"
            columns: ["transport_incident_id"]
            isOneToOne: false
            referencedRelation: "transport_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_transport_order_id_fkey"
            columns: ["transport_order_id"]
            isOneToOne: false
            referencedRelation: "transport_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_transport_stop_id_fkey"
            columns: ["transport_stop_id"]
            isOneToOne: false
            referencedRelation: "transport_stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_completion_policies: {
        Row: {
          organization_id: string
          require_document: boolean
          require_pod: boolean
          require_signature: boolean
          updated_at: string
          updated_by: string
        }
        Insert: {
          organization_id: string
          require_document?: boolean
          require_pod?: boolean
          require_signature?: boolean
          updated_at?: string
          updated_by: string
        }
        Update: {
          organization_id?: string
          require_document?: boolean
          require_pod?: boolean
          require_signature?: boolean
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_completion_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_completion_policies_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
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
      internal_notifications: {
        Row: {
          archived_at: string | null
          created_at: string
          event_type: string
          id: string
          organization_id: string
          payload: Json
          read_at: string | null
          recipient_user_id: string | null
          status: Database["public"]["Enums"]["internal_notification_status"]
          title: string
          transport_order_id: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          event_type: string
          id?: string
          organization_id: string
          payload?: Json
          read_at?: string | null
          recipient_user_id?: string | null
          status?: Database["public"]["Enums"]["internal_notification_status"]
          title: string
          transport_order_id?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          event_type?: string
          id?: string
          organization_id?: string
          payload?: Json
          read_at?: string | null
          recipient_user_id?: string | null
          status?: Database["public"]["Enums"]["internal_notification_status"]
          title?: string
          transport_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "internal_notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_notifications_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "internal_notifications_transport_order_id_fkey"
            columns: ["transport_order_id"]
            isOneToOne: false
            referencedRelation: "transport_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_command_idempotency: {
        Row: {
          actor_user_id: string
          command: string
          completed_at: string | null
          created_at: string
          idempotency_key: string
          organization_id: string
          request_hash: string
          result: Json | null
        }
        Insert: {
          actor_user_id: string
          command: string
          completed_at?: string | null
          created_at?: string
          idempotency_key: string
          organization_id: string
          request_hash: string
          result?: Json | null
        }
        Update: {
          actor_user_id?: string
          command?: string
          completed_at?: string | null
          created_at?: string
          idempotency_key?: string
          organization_id?: string
          request_hash?: string
          result?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_command_idempotency_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "invoice_command_idempotency_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_lines: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          organization_id: string
          position: number
          quantity: number
          snapshot_json: Json
          subtotal: number
          tax_amount: number
          tax_code: string
          tax_id: string | null
          tax_kind: Database["public"]["Enums"]["invoice_tax_kind"]
          tax_name: string
          tax_rate: number
          total: number
          transport_order_id: string | null
          unit_price: number
          valuation_id: string | null
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          organization_id: string
          position: number
          quantity: number
          snapshot_json: Json
          subtotal: number
          tax_amount: number
          tax_code: string
          tax_id?: string | null
          tax_kind: Database["public"]["Enums"]["invoice_tax_kind"]
          tax_name: string
          tax_rate: number
          total: number
          transport_order_id?: string | null
          unit_price: number
          valuation_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          organization_id?: string
          position?: number
          quantity?: number
          snapshot_json?: Json
          subtotal?: number
          tax_amount?: number
          tax_code?: string
          tax_id?: string | null
          tax_kind?: Database["public"]["Enums"]["invoice_tax_kind"]
          tax_name?: string
          tax_rate?: number
          total?: number
          transport_order_id?: string | null
          unit_price?: number
          valuation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_tax_id_fkey"
            columns: ["tax_id"]
            isOneToOne: false
            referencedRelation: "invoice_taxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_transport_order_id_fkey"
            columns: ["transport_order_id"]
            isOneToOne: false
            referencedRelation: "transport_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_valuation_id_fkey"
            columns: ["valuation_id"]
            isOneToOne: false
            referencedRelation: "transport_order_valuations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payments: {
        Row: {
          amount: number
          correlation_id: string
          created_at: string
          created_by: string
          id: string
          idempotency_key: string
          invoice_id: string
          method: Database["public"]["Enums"]["invoice_payment_method"]
          notes: string | null
          organization_id: string
          payment_date: string
          reference: string | null
        }
        Insert: {
          amount: number
          correlation_id: string
          created_at?: string
          created_by: string
          id?: string
          idempotency_key: string
          invoice_id: string
          method: Database["public"]["Enums"]["invoice_payment_method"]
          notes?: string | null
          organization_id: string
          payment_date: string
          reference?: string | null
        }
        Update: {
          amount?: number
          correlation_id?: string
          created_at?: string
          created_by?: string
          id?: string
          idempotency_key?: string
          invoice_id?: string
          method?: Database["public"]["Enums"]["invoice_payment_method"]
          notes?: string | null
          organization_id?: string
          payment_date?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_series: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string
          fiscal_year_mode: Database["public"]["Enums"]["invoice_fiscal_year_mode"]
          id: string
          is_primary: boolean
          name: string
          next_number: number
          organization_id: string
          prefix: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by: string
          fiscal_year_mode?: Database["public"]["Enums"]["invoice_fiscal_year_mode"]
          id?: string
          is_primary?: boolean
          name: string
          next_number?: number
          organization_id: string
          prefix: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string
          fiscal_year_mode?: Database["public"]["Enums"]["invoice_fiscal_year_mode"]
          id?: string
          is_primary?: boolean
          name?: string
          next_number?: number
          organization_id?: string
          prefix?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_series_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "invoice_series_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_taxes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string
          exemption_reason: string | null
          id: string
          kind: Database["public"]["Enums"]["invoice_tax_kind"]
          name: string
          organization_id: string
          rate: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by: string
          exemption_reason?: string | null
          id?: string
          kind: Database["public"]["Enums"]["invoice_tax_kind"]
          name: string
          organization_id: string
          rate: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string
          exemption_reason?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["invoice_tax_kind"]
          name?: string
          organization_id?: string
          rate?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_taxes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "invoice_taxes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_due: number
          amount_paid: number
          billing_snapshot_json: Json
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          correlation_id: string
          created_at: string
          created_by: string
          currency_code: string
          customer_id: string
          due_date: string | null
          fiscal_snapshot_json: Json
          id: string
          idempotency_key: string
          invoice_number: string
          invoice_series_id: string
          issue_date: string
          issued_at: string | null
          issued_by: string | null
          notes: string | null
          organization_id: string
          payment_terms_days: number
          preinvoice_id: string | null
          rectified_invoice_id: string | null
          service_period_end: string | null
          service_period_start: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax_total: number
          total: number
        }
        Insert: {
          amount_due: number
          amount_paid?: number
          billing_snapshot_json: Json
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          correlation_id: string
          created_at?: string
          created_by: string
          currency_code?: string
          customer_id: string
          due_date?: string | null
          fiscal_snapshot_json: Json
          id?: string
          idempotency_key: string
          invoice_number: string
          invoice_series_id: string
          issue_date: string
          issued_at?: string | null
          issued_by?: string | null
          notes?: string | null
          organization_id: string
          payment_terms_days?: number
          preinvoice_id?: string | null
          rectified_invoice_id?: string | null
          service_period_end?: string | null
          service_period_start?: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax_total: number
          total: number
        }
        Update: {
          amount_due?: number
          amount_paid?: number
          billing_snapshot_json?: Json
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          correlation_id?: string
          created_at?: string
          created_by?: string
          currency_code?: string
          customer_id?: string
          due_date?: string | null
          fiscal_snapshot_json?: Json
          id?: string
          idempotency_key?: string
          invoice_number?: string
          invoice_series_id?: string
          issue_date?: string
          issued_at?: string | null
          issued_by?: string | null
          notes?: string | null
          organization_id?: string
          payment_terms_days?: number
          preinvoice_id?: string | null
          rectified_invoice_id?: string | null
          service_period_end?: string | null
          service_period_start?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_total?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_invoice_series_id_fkey"
            columns: ["invoice_series_id"]
            isOneToOne: false
            referencedRelation: "invoice_series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_preinvoice_id_fkey"
            columns: ["preinvoice_id"]
            isOneToOne: false
            referencedRelation: "billing_preinvoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_rectified_invoice_id_fkey"
            columns: ["rectified_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
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
      ocr_application_command_idempotency: {
        Row: {
          actor_user_id: string
          completed_at: string | null
          created_at: string
          idempotency_key: string
          organization_id: string
          request_hash: string
          result: Json | null
        }
        Insert: {
          actor_user_id: string
          completed_at?: string | null
          created_at?: string
          idempotency_key: string
          organization_id: string
          request_hash: string
          result?: Json | null
        }
        Update: {
          actor_user_id?: string
          completed_at?: string | null
          created_at?: string
          idempotency_key?: string
          organization_id?: string
          request_hash?: string
          result?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ocr_application_command_idempotency_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "ocr_application_command_idempotency_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ocr_application_proposals: {
        Row: {
          application_status: Database["public"]["Enums"]["ocr_application_status"]
          applied_at: string | null
          applied_by: string | null
          comparison_status: Database["public"]["Enums"]["ocr_application_comparison_status"]
          confidence: number | null
          correlation_id: string
          created_at: string
          created_by: string
          current_value_json: Json | null
          decided_at: string | null
          decided_by: string | null
          decision_reason: string | null
          document_id: string
          field_code: string
          id: string
          idempotency_key: string
          normalized_value_json: Json | null
          ocr_job_id: string
          ocr_result_id: string
          ocr_review_id: string
          organization_id: string
          proposed_value_json: Json
          review_status: Database["public"]["Enums"]["ocr_application_review_status"]
          source_summary: Json
          target_entity_id: string | null
          target_entity_type: Database["public"]["Enums"]["ocr_application_target_entity_type"]
          transport_order_id: string
        }
        Insert: {
          application_status?: Database["public"]["Enums"]["ocr_application_status"]
          applied_at?: string | null
          applied_by?: string | null
          comparison_status: Database["public"]["Enums"]["ocr_application_comparison_status"]
          confidence?: number | null
          correlation_id: string
          created_at?: string
          created_by: string
          current_value_json?: Json | null
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          document_id: string
          field_code: string
          id?: string
          idempotency_key: string
          normalized_value_json?: Json | null
          ocr_job_id: string
          ocr_result_id: string
          ocr_review_id: string
          organization_id: string
          proposed_value_json: Json
          review_status?: Database["public"]["Enums"]["ocr_application_review_status"]
          source_summary?: Json
          target_entity_id?: string | null
          target_entity_type: Database["public"]["Enums"]["ocr_application_target_entity_type"]
          transport_order_id: string
        }
        Update: {
          application_status?: Database["public"]["Enums"]["ocr_application_status"]
          applied_at?: string | null
          applied_by?: string | null
          comparison_status?: Database["public"]["Enums"]["ocr_application_comparison_status"]
          confidence?: number | null
          correlation_id?: string
          created_at?: string
          created_by?: string
          current_value_json?: Json | null
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          document_id?: string
          field_code?: string
          id?: string
          idempotency_key?: string
          normalized_value_json?: Json | null
          ocr_job_id?: string
          ocr_result_id?: string
          ocr_review_id?: string
          organization_id?: string
          proposed_value_json?: Json
          review_status?: Database["public"]["Enums"]["ocr_application_review_status"]
          source_summary?: Json
          target_entity_id?: string | null
          target_entity_type?: Database["public"]["Enums"]["ocr_application_target_entity_type"]
          transport_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocr_application_proposals_applied_by_fkey"
            columns: ["applied_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "ocr_application_proposals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "ocr_application_proposals_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "ocr_application_proposals_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_application_proposals_ocr_job_id_fkey"
            columns: ["ocr_job_id"]
            isOneToOne: false
            referencedRelation: "ocr_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_application_proposals_ocr_result_id_fkey"
            columns: ["ocr_result_id"]
            isOneToOne: false
            referencedRelation: "ocr_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_application_proposals_ocr_review_id_fkey"
            columns: ["ocr_review_id"]
            isOneToOne: false
            referencedRelation: "ocr_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_application_proposals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_application_proposals_transport_order_id_fkey"
            columns: ["transport_order_id"]
            isOneToOne: false
            referencedRelation: "transport_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      ocr_command_idempotency: {
        Row: {
          actor_user_id: string
          completed_at: string | null
          created_at: string
          idempotency_key: string
          organization_id: string
          request_hash: string
          result: Json | null
        }
        Insert: {
          actor_user_id: string
          completed_at?: string | null
          created_at?: string
          idempotency_key: string
          organization_id: string
          request_hash: string
          result?: Json | null
        }
        Update: {
          actor_user_id?: string
          completed_at?: string | null
          created_at?: string
          idempotency_key?: string
          organization_id?: string
          request_hash?: string
          result?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ocr_command_idempotency_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "ocr_command_idempotency_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ocr_field_corrections: {
        Row: {
          corrected_at: string
          corrected_by: string
          corrected_value: Json | null
          correction_reason: string | null
          field_code: string
          id: string
          ocr_field_result_id: string | null
          ocr_review_id: string
          organization_id: string
          previous_value: Json | null
        }
        Insert: {
          corrected_at?: string
          corrected_by: string
          corrected_value?: Json | null
          correction_reason?: string | null
          field_code: string
          id?: string
          ocr_field_result_id?: string | null
          ocr_review_id: string
          organization_id: string
          previous_value?: Json | null
        }
        Update: {
          corrected_at?: string
          corrected_by?: string
          corrected_value?: Json | null
          correction_reason?: string | null
          field_code?: string
          id?: string
          ocr_field_result_id?: string | null
          ocr_review_id?: string
          organization_id?: string
          previous_value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ocr_field_corrections_corrected_by_fkey"
            columns: ["corrected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "ocr_field_corrections_ocr_field_result_id_fkey"
            columns: ["ocr_field_result_id"]
            isOneToOne: false
            referencedRelation: "ocr_field_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_field_corrections_ocr_review_id_fkey"
            columns: ["ocr_review_id"]
            isOneToOne: false
            referencedRelation: "ocr_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_field_corrections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ocr_field_results: {
        Row: {
          bounding_box_json: Json | null
          confidence: number | null
          created_at: string
          field_code: string
          id: string
          normalized_value: Json | null
          ocr_result_id: string
          organization_id: string
          page_number: number | null
          raw_value: Json | null
          validation_status: Database["public"]["Enums"]["ocr_field_validation_status"]
          warnings_json: Json
        }
        Insert: {
          bounding_box_json?: Json | null
          confidence?: number | null
          created_at?: string
          field_code: string
          id?: string
          normalized_value?: Json | null
          ocr_result_id: string
          organization_id: string
          page_number?: number | null
          raw_value?: Json | null
          validation_status?: Database["public"]["Enums"]["ocr_field_validation_status"]
          warnings_json?: Json
        }
        Update: {
          bounding_box_json?: Json | null
          confidence?: number | null
          created_at?: string
          field_code?: string
          id?: string
          normalized_value?: Json | null
          ocr_result_id?: string
          organization_id?: string
          page_number?: number | null
          raw_value?: Json | null
          validation_status?: Database["public"]["Enums"]["ocr_field_validation_status"]
          warnings_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ocr_field_results_ocr_result_id_fkey"
            columns: ["ocr_result_id"]
            isOneToOne: false
            referencedRelation: "ocr_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_field_results_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ocr_jobs: {
        Row: {
          attempt_count: number
          completed_at: string | null
          correlation_id: string
          created_at: string
          document_id: string
          document_version_id: string
          failed_at: string | null
          failure_code: string | null
          failure_message: string | null
          id: string
          idempotency_key: string
          max_attempts: number
          organization_id: string
          payload: Json
          payload_hash: string
          provider_code: string
          provider_request_id: string | null
          quota_reservation_id: string | null
          requested_at: string
          requested_by: string
          started_at: string | null
          status: Database["public"]["Enums"]["ocr_job_status"]
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          completed_at?: string | null
          correlation_id: string
          created_at?: string
          document_id: string
          document_version_id: string
          failed_at?: string | null
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          idempotency_key: string
          max_attempts?: number
          organization_id: string
          payload?: Json
          payload_hash: string
          provider_code: string
          provider_request_id?: string | null
          quota_reservation_id?: string | null
          requested_at?: string
          requested_by: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["ocr_job_status"]
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          completed_at?: string | null
          correlation_id?: string
          created_at?: string
          document_id?: string
          document_version_id?: string
          failed_at?: string | null
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          idempotency_key?: string
          max_attempts?: number
          organization_id?: string
          payload?: Json
          payload_hash?: string
          provider_code?: string
          provider_request_id?: string | null
          quota_reservation_id?: string | null
          requested_at?: string
          requested_by?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["ocr_job_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocr_jobs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_jobs_document_version_id_fkey"
            columns: ["document_version_id"]
            isOneToOne: false
            referencedRelation: "document_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_jobs_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      ocr_outbox: {
        Row: {
          attempts: number
          correlation_id: string
          created_at: string
          event_type: string
          id: string
          last_error: string | null
          next_attempt_at: string
          ocr_job_id: string | null
          ocr_result_id: string | null
          organization_id: string
          payload: Json
          processed_at: string | null
          status: Database["public"]["Enums"]["ocr_outbox_status"]
        }
        Insert: {
          attempts?: number
          correlation_id: string
          created_at?: string
          event_type: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          ocr_job_id?: string | null
          ocr_result_id?: string | null
          organization_id: string
          payload?: Json
          processed_at?: string | null
          status?: Database["public"]["Enums"]["ocr_outbox_status"]
        }
        Update: {
          attempts?: number
          correlation_id?: string
          created_at?: string
          event_type?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          ocr_job_id?: string | null
          ocr_result_id?: string | null
          organization_id?: string
          payload?: Json
          processed_at?: string | null
          status?: Database["public"]["Enums"]["ocr_outbox_status"]
        }
        Relationships: [
          {
            foreignKeyName: "ocr_outbox_ocr_job_id_fkey"
            columns: ["ocr_job_id"]
            isOneToOne: false
            referencedRelation: "ocr_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_outbox_ocr_result_id_fkey"
            columns: ["ocr_result_id"]
            isOneToOne: false
            referencedRelation: "ocr_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_outbox_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ocr_quota_reservations: {
        Row: {
          committed_at: string | null
          created_at: string
          id: string
          idempotency_key: string
          limit_code: string
          ocr_job_id: string | null
          organization_id: string
          quantity: number
          reason: string | null
          released_at: string | null
          reserved_at: string
          status: Database["public"]["Enums"]["ocr_quota_reservation_status"]
          updated_at: string
        }
        Insert: {
          committed_at?: string | null
          created_at?: string
          id?: string
          idempotency_key: string
          limit_code: string
          ocr_job_id?: string | null
          organization_id: string
          quantity?: number
          reason?: string | null
          released_at?: string | null
          reserved_at?: string
          status?: Database["public"]["Enums"]["ocr_quota_reservation_status"]
          updated_at?: string
        }
        Update: {
          committed_at?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string
          limit_code?: string
          ocr_job_id?: string | null
          organization_id?: string
          quantity?: number
          reason?: string | null
          released_at?: string | null
          reserved_at?: string
          status?: Database["public"]["Enums"]["ocr_quota_reservation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocr_quota_reservations_ocr_job_id_fkey"
            columns: ["ocr_job_id"]
            isOneToOne: false
            referencedRelation: "ocr_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_quota_reservations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ocr_results: {
        Row: {
          created_at: string
          detected_document_type: string | null
          detected_language: string | null
          document_id: string
          document_version_id: string
          id: string
          normalized_data_json: Json
          ocr_job_id: string
          organization_id: string
          overall_confidence: number | null
          provider_code: string
          provider_model: string | null
          raw_response_json: Json
          schema_version: string
          warnings_json: Json
        }
        Insert: {
          created_at?: string
          detected_document_type?: string | null
          detected_language?: string | null
          document_id: string
          document_version_id: string
          id?: string
          normalized_data_json: Json
          ocr_job_id: string
          organization_id: string
          overall_confidence?: number | null
          provider_code: string
          provider_model?: string | null
          raw_response_json: Json
          schema_version: string
          warnings_json?: Json
        }
        Update: {
          created_at?: string
          detected_document_type?: string | null
          detected_language?: string | null
          document_id?: string
          document_version_id?: string
          id?: string
          normalized_data_json?: Json
          ocr_job_id?: string
          organization_id?: string
          overall_confidence?: number | null
          provider_code?: string
          provider_model?: string | null
          raw_response_json?: Json
          schema_version?: string
          warnings_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ocr_results_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_results_document_version_id_fkey"
            columns: ["document_version_id"]
            isOneToOne: false
            referencedRelation: "document_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_results_ocr_job_id_fkey"
            columns: ["ocr_job_id"]
            isOneToOne: true
            referencedRelation: "ocr_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_results_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ocr_reviews: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          notes: string | null
          ocr_job_id: string
          ocr_result_id: string
          organization_id: string
          reviewed_by: string
          started_at: string
          status: Database["public"]["Enums"]["ocr_review_status"]
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          ocr_job_id: string
          ocr_result_id: string
          organization_id: string
          reviewed_by: string
          started_at?: string
          status?: Database["public"]["Enums"]["ocr_review_status"]
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          ocr_job_id?: string
          ocr_result_id?: string
          organization_id?: string
          reviewed_by?: string
          started_at?: string
          status?: Database["public"]["Enums"]["ocr_review_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocr_reviews_ocr_job_id_fkey"
            columns: ["ocr_job_id"]
            isOneToOne: false
            referencedRelation: "ocr_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_reviews_ocr_result_id_fkey"
            columns: ["ocr_result_id"]
            isOneToOne: false
            referencedRelation: "ocr_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_reviews_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_reviews_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
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
      organization_onboarding: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          completed_steps: number[]
          configuration: Json
          current_step: number
          organization_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          completed_steps?: number[]
          configuration?: Json
          current_step?: number
          organization_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          completed_steps?: number[]
          configuration?: Json
          current_step?: number
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_onboarding_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "organization_onboarding_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
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
      proofs_of_delivery: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string
          delivered_at: string | null
          delivery_notes: string | null
          document_id: string
          id: string
          organization_id: string
          recipient_name: string | null
          recipient_role: string | null
          status: Database["public"]["Enums"]["pod_status"]
          transport_order_id: string
          transport_stop_id: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by: string
          delivered_at?: string | null
          delivery_notes?: string | null
          document_id: string
          id?: string
          organization_id: string
          recipient_name?: string | null
          recipient_role?: string | null
          status?: Database["public"]["Enums"]["pod_status"]
          transport_order_id: string
          transport_stop_id?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string
          delivered_at?: string | null
          delivery_notes?: string | null
          document_id?: string
          id?: string
          organization_id?: string
          recipient_name?: string | null
          recipient_role?: string | null
          status?: Database["public"]["Enums"]["pod_status"]
          transport_order_id?: string
          transport_stop_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proofs_of_delivery_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "proofs_of_delivery_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proofs_of_delivery_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proofs_of_delivery_transport_order_id_fkey"
            columns: ["transport_order_id"]
            isOneToOne: false
            referencedRelation: "transport_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proofs_of_delivery_transport_stop_id_fkey"
            columns: ["transport_stop_id"]
            isOneToOne: false
            referencedRelation: "transport_stops"
            referencedColumns: ["id"]
          },
        ]
      }
      regulatory_command_idempotency: {
        Row: {
          actor_user_id: string
          completed_at: string | null
          created_at: string
          idempotency_key: string
          organization_id: string
          request_hash: string
          result: Json | null
        }
        Insert: {
          actor_user_id: string
          completed_at?: string | null
          created_at?: string
          idempotency_key: string
          organization_id: string
          request_hash: string
          result?: Json | null
        }
        Update: {
          actor_user_id?: string
          completed_at?: string | null
          created_at?: string
          idempotency_key?: string
          organization_id?: string
          request_hash?: string
          result?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "regulatory_command_idempotency_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "regulatory_command_idempotency_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      regulatory_document_counters: {
        Row: {
          document_type: Database["public"]["Enums"]["regulatory_document_type"]
          last_value: number
          organization_id: string
          year: number
        }
        Insert: {
          document_type: Database["public"]["Enums"]["regulatory_document_type"]
          last_value?: number
          organization_id: string
          year: number
        }
        Update: {
          document_type?: Database["public"]["Enums"]["regulatory_document_type"]
          last_value?: number
          organization_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "regulatory_document_counters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      regulatory_document_outbox: {
        Row: {
          attempts: number
          created_at: string
          event_type: string
          id: string
          next_attempt_at: string
          organization_id: string
          payload: Json
          processed_at: string | null
          regulatory_document_id: string
          status: Database["public"]["Enums"]["document_outbox_status"]
        }
        Insert: {
          attempts?: number
          created_at?: string
          event_type: string
          id?: string
          next_attempt_at?: string
          organization_id: string
          payload?: Json
          processed_at?: string | null
          regulatory_document_id: string
          status?: Database["public"]["Enums"]["document_outbox_status"]
        }
        Update: {
          attempts?: number
          created_at?: string
          event_type?: string
          id?: string
          next_attempt_at?: string
          organization_id?: string
          payload?: Json
          processed_at?: string | null
          regulatory_document_id?: string
          status?: Database["public"]["Enums"]["document_outbox_status"]
        }
        Relationships: [
          {
            foreignKeyName: "regulatory_document_outbox_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regulatory_document_outbox_regulatory_document_id_fkey"
            columns: ["regulatory_document_id"]
            isOneToOne: false
            referencedRelation: "transport_regulatory_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      regulatory_validation_policies: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          document_type: Database["public"]["Enums"]["regulatory_document_type"]
          id: string
          organization_id: string | null
          required_paths: string[]
          schema_version: string
          warning_paths: string[]
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          document_type: Database["public"]["Enums"]["regulatory_document_type"]
          id?: string
          organization_id?: string | null
          required_paths?: string[]
          schema_version: string
          warning_paths?: string[]
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          document_type?: Database["public"]["Enums"]["regulatory_document_type"]
          id?: string
          organization_id?: string | null
          required_paths?: string[]
          schema_version?: string
          warning_paths?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "regulatory_validation_policies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "regulatory_validation_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      transport_command_idempotency: {
        Row: {
          actor_user_id: string
          completed_at: string | null
          created_at: string
          idempotency_key: string
          organization_id: string
          request_hash: string
          result: Json | null
        }
        Insert: {
          actor_user_id: string
          completed_at?: string | null
          created_at?: string
          idempotency_key: string
          organization_id: string
          request_hash: string
          result?: Json | null
        }
        Update: {
          actor_user_id?: string
          completed_at?: string | null
          created_at?: string
          idempotency_key?: string
          organization_id?: string
          request_hash?: string
          result?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "transport_command_idempotency_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "transport_command_idempotency_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      transport_executions: {
        Row: {
          arrived_delivery_at: string | null
          arrived_pickup_at: string | null
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          departed_pickup_at: string | null
          driver_notified_at: string | null
          id: string
          loading_completed_at: string | null
          loading_started_at: string | null
          organization_id: string
          status: Database["public"]["Enums"]["transport_execution_status"]
          transport_order_id: string
          unloading_completed_at: string | null
          unloading_started_at: string | null
          updated_at: string
        }
        Insert: {
          arrived_delivery_at?: string | null
          arrived_pickup_at?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          departed_pickup_at?: string | null
          driver_notified_at?: string | null
          id?: string
          loading_completed_at?: string | null
          loading_started_at?: string | null
          organization_id: string
          status?: Database["public"]["Enums"]["transport_execution_status"]
          transport_order_id: string
          unloading_completed_at?: string | null
          unloading_started_at?: string | null
          updated_at?: string
        }
        Update: {
          arrived_delivery_at?: string | null
          arrived_pickup_at?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          departed_pickup_at?: string | null
          driver_notified_at?: string | null
          id?: string
          loading_completed_at?: string | null
          loading_started_at?: string | null
          organization_id?: string
          status?: Database["public"]["Enums"]["transport_execution_status"]
          transport_order_id?: string
          unloading_completed_at?: string | null
          unloading_started_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_executions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "transport_executions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_executions_transport_order_id_fkey"
            columns: ["transport_order_id"]
            isOneToOne: true
            referencedRelation: "transport_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_incidents: {
        Row: {
          archived_at: string | null
          category: Database["public"]["Enums"]["transport_incident_category"]
          description: string
          id: string
          organization_id: string
          reported_at: string
          reported_by: string
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: Database["public"]["Enums"]["transport_incident_severity"]
          status: Database["public"]["Enums"]["transport_incident_status"]
          title: string
          transport_order_id: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          category: Database["public"]["Enums"]["transport_incident_category"]
          description: string
          id?: string
          organization_id: string
          reported_at?: string
          reported_by: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["transport_incident_severity"]
          status?: Database["public"]["Enums"]["transport_incident_status"]
          title: string
          transport_order_id: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          category?: Database["public"]["Enums"]["transport_incident_category"]
          description?: string
          id?: string
          organization_id?: string
          reported_at?: string
          reported_by?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["transport_incident_severity"]
          status?: Database["public"]["Enums"]["transport_incident_status"]
          title?: string
          transport_order_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_incidents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_incidents_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "transport_incidents_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "transport_incidents_transport_order_id_fkey"
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
      transport_notes: {
        Row: {
          archived_at: string | null
          author_user_id: string
          body: string
          created_at: string
          id: string
          note_type: Database["public"]["Enums"]["transport_note_type"]
          organization_id: string
          transport_order_id: string
          updated_at: string
          visible_admin: boolean
          visible_customer: boolean
          visible_driver: boolean
        }
        Insert: {
          archived_at?: string | null
          author_user_id: string
          body: string
          created_at?: string
          id?: string
          note_type?: Database["public"]["Enums"]["transport_note_type"]
          organization_id: string
          transport_order_id: string
          updated_at?: string
          visible_admin?: boolean
          visible_customer?: boolean
          visible_driver?: boolean
        }
        Update: {
          archived_at?: string | null
          author_user_id?: string
          body?: string
          created_at?: string
          id?: string
          note_type?: Database["public"]["Enums"]["transport_note_type"]
          organization_id?: string
          transport_order_id?: string
          updated_at?: string
          visible_admin?: boolean
          visible_customer?: boolean
          visible_driver?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "transport_notes_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "transport_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_notes_transport_order_id_fkey"
            columns: ["transport_order_id"]
            isOneToOne: false
            referencedRelation: "transport_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_order_billing_supplements: {
        Row: {
          amount: number
          charge_mode: Database["public"]["Enums"]["billing_charge_mode"]
          code: string
          created_at: string
          created_by: string
          id: string
          name: string
          organization_id: string
          percentage_base: string | null
          quantity: number
          remove_reason: string | null
          removed_at: string | null
          removed_by: string | null
          supplement_definition_id: string | null
          transport_order_id: string
          unit_code: string | null
        }
        Insert: {
          amount: number
          charge_mode: Database["public"]["Enums"]["billing_charge_mode"]
          code: string
          created_at?: string
          created_by: string
          id?: string
          name: string
          organization_id: string
          percentage_base?: string | null
          quantity?: number
          remove_reason?: string | null
          removed_at?: string | null
          removed_by?: string | null
          supplement_definition_id?: string | null
          transport_order_id: string
          unit_code?: string | null
        }
        Update: {
          amount?: number
          charge_mode?: Database["public"]["Enums"]["billing_charge_mode"]
          code?: string
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          organization_id?: string
          percentage_base?: string | null
          quantity?: number
          remove_reason?: string | null
          removed_at?: string | null
          removed_by?: string | null
          supplement_definition_id?: string | null
          transport_order_id?: string
          unit_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transport_order_billing_supplemen_supplement_definition_id_fkey"
            columns: ["supplement_definition_id"]
            isOneToOne: false
            referencedRelation: "billing_supplement_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_order_billing_supplements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "transport_order_billing_supplements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_order_billing_supplements_removed_by_fkey"
            columns: ["removed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "transport_order_billing_supplements_transport_order_id_fkey"
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
      transport_order_pricing_adjustments: {
        Row: {
          adjustment_kind: Database["public"]["Enums"]["billing_adjustment_kind"]
          amount: number
          charge_mode: Database["public"]["Enums"]["billing_charge_mode"]
          created_at: string
          created_by: string
          effect_sign: number
          id: string
          organization_id: string
          percentage_base: string | null
          quantity: number
          reason: string
          transport_order_id: string
          unit_code: string | null
        }
        Insert: {
          adjustment_kind: Database["public"]["Enums"]["billing_adjustment_kind"]
          amount: number
          charge_mode: Database["public"]["Enums"]["billing_charge_mode"]
          created_at?: string
          created_by: string
          effect_sign: number
          id?: string
          organization_id: string
          percentage_base?: string | null
          quantity?: number
          reason: string
          transport_order_id: string
          unit_code?: string | null
        }
        Update: {
          adjustment_kind?: Database["public"]["Enums"]["billing_adjustment_kind"]
          amount?: number
          charge_mode?: Database["public"]["Enums"]["billing_charge_mode"]
          created_at?: string
          created_by?: string
          effect_sign?: number
          id?: string
          organization_id?: string
          percentage_base?: string | null
          quantity?: number
          reason?: string
          transport_order_id?: string
          unit_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transport_order_pricing_adjustments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "transport_order_pricing_adjustments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_order_pricing_adjustments_transport_order_id_fkey"
            columns: ["transport_order_id"]
            isOneToOne: false
            referencedRelation: "transport_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_order_valuations: {
        Row: {
          adjustments_amount: number
          base_amount: number
          billing_rate_id: string | null
          breakdown_json: Json
          calculated_at: string
          calculated_by: string
          correlation_id: string
          currency_code: string
          id: string
          idempotency_key: string
          input_snapshot_json: Json
          organization_id: string
          rate_snapshot_json: Json
          reopened_at: string | null
          reopened_by: string | null
          superseded_by_valuation_id: string | null
          supplements_amount: number
          total_amount: number
          transport_order_id: string
          validated_at: string | null
          validated_by: string | null
          valuation_number: number
        }
        Insert: {
          adjustments_amount: number
          base_amount: number
          billing_rate_id?: string | null
          breakdown_json: Json
          calculated_at?: string
          calculated_by: string
          correlation_id: string
          currency_code: string
          id?: string
          idempotency_key: string
          input_snapshot_json: Json
          organization_id: string
          rate_snapshot_json: Json
          reopened_at?: string | null
          reopened_by?: string | null
          superseded_by_valuation_id?: string | null
          supplements_amount: number
          total_amount: number
          transport_order_id: string
          validated_at?: string | null
          validated_by?: string | null
          valuation_number: number
        }
        Update: {
          adjustments_amount?: number
          base_amount?: number
          billing_rate_id?: string | null
          breakdown_json?: Json
          calculated_at?: string
          calculated_by?: string
          correlation_id?: string
          currency_code?: string
          id?: string
          idempotency_key?: string
          input_snapshot_json?: Json
          organization_id?: string
          rate_snapshot_json?: Json
          reopened_at?: string | null
          reopened_by?: string | null
          superseded_by_valuation_id?: string | null
          supplements_amount?: number
          total_amount?: number
          transport_order_id?: string
          validated_at?: string | null
          validated_by?: string | null
          valuation_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "transport_order_valuations_billing_rate_id_fkey"
            columns: ["billing_rate_id"]
            isOneToOne: false
            referencedRelation: "billing_rates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_order_valuations_calculated_by_fkey"
            columns: ["calculated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "transport_order_valuations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_order_valuations_reopened_by_fkey"
            columns: ["reopened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "transport_order_valuations_superseded_by_valuation_id_fkey"
            columns: ["superseded_by_valuation_id"]
            isOneToOne: false
            referencedRelation: "transport_order_valuations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_order_valuations_transport_order_id_fkey"
            columns: ["transport_order_id"]
            isOneToOne: false
            referencedRelation: "transport_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_order_valuations_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      transport_orders: {
        Row: {
          archived_at: string | null
          assigned_driver_id: string | null
          assigned_vehicle_id: string | null
          billable_km: number | null
          created_at: string
          created_by: string
          current_valuation_id: string | null
          customer_id: string
          economic_status: Database["public"]["Enums"]["transport_economic_status"]
          external_reference: string | null
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
          billable_km?: number | null
          created_at?: string
          created_by: string
          current_valuation_id?: string | null
          customer_id: string
          economic_status?: Database["public"]["Enums"]["transport_economic_status"]
          external_reference?: string | null
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
          billable_km?: number | null
          created_at?: string
          created_by?: string
          current_valuation_id?: string | null
          customer_id?: string
          economic_status?: Database["public"]["Enums"]["transport_economic_status"]
          external_reference?: string | null
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
            foreignKeyName: "transport_orders_current_valuation_fk"
            columns: ["current_valuation_id"]
            isOneToOne: false
            referencedRelation: "transport_order_valuations"
            referencedColumns: ["id"]
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
      transport_regulatory_documents: {
        Row: {
          cancelled_at: string | null
          closed_at: string | null
          content_hash: string | null
          correlation_id: string
          created_at: string
          created_by: string
          current_snapshot_json: Json
          document_id: string | null
          document_number: string | null
          document_type: Database["public"]["Enums"]["regulatory_document_type"]
          effective_at: string | null
          external_document_id: string | null
          external_provider: string | null
          external_status: string | null
          id: string
          idempotency_key: string
          issued_at: string | null
          organization_id: string
          revision_number: number
          schema_version: string
          status: Database["public"]["Enums"]["regulatory_document_status"]
          transport_order_id: string
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          closed_at?: string | null
          content_hash?: string | null
          correlation_id: string
          created_at?: string
          created_by: string
          current_snapshot_json: Json
          document_id?: string | null
          document_number?: string | null
          document_type: Database["public"]["Enums"]["regulatory_document_type"]
          effective_at?: string | null
          external_document_id?: string | null
          external_provider?: string | null
          external_status?: string | null
          id?: string
          idempotency_key: string
          issued_at?: string | null
          organization_id: string
          revision_number?: number
          schema_version?: string
          status?: Database["public"]["Enums"]["regulatory_document_status"]
          transport_order_id: string
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          closed_at?: string | null
          content_hash?: string | null
          correlation_id?: string
          created_at?: string
          created_by?: string
          current_snapshot_json?: Json
          document_id?: string | null
          document_number?: string | null
          document_type?: Database["public"]["Enums"]["regulatory_document_type"]
          effective_at?: string | null
          external_document_id?: string | null
          external_provider?: string | null
          external_status?: string | null
          id?: string
          idempotency_key?: string
          issued_at?: string | null
          organization_id?: string
          revision_number?: number
          schema_version?: string
          status?: Database["public"]["Enums"]["regulatory_document_status"]
          transport_order_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_regulatory_documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "transport_regulatory_documents_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_regulatory_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_regulatory_documents_transport_order_id_fkey"
            columns: ["transport_order_id"]
            isOneToOne: false
            referencedRelation: "transport_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_regulatory_evidence: {
        Row: {
          actor_user_id: string
          created_at: string
          document_id: string | null
          document_version_id: string | null
          evidence_json: Json
          evidence_type: string
          id: string
          organization_id: string
          regulatory_document_id: string
          revision_id: string
          signature_id: string | null
        }
        Insert: {
          actor_user_id: string
          created_at?: string
          document_id?: string | null
          document_version_id?: string | null
          evidence_json?: Json
          evidence_type: string
          id?: string
          organization_id: string
          regulatory_document_id: string
          revision_id: string
          signature_id?: string | null
        }
        Update: {
          actor_user_id?: string
          created_at?: string
          document_id?: string | null
          document_version_id?: string | null
          evidence_json?: Json
          evidence_type?: string
          id?: string
          organization_id?: string
          regulatory_document_id?: string
          revision_id?: string
          signature_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transport_regulatory_evidence_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "transport_regulatory_evidence_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_regulatory_evidence_document_version_id_fkey"
            columns: ["document_version_id"]
            isOneToOne: false
            referencedRelation: "document_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_regulatory_evidence_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_regulatory_evidence_regulatory_document_id_fkey"
            columns: ["regulatory_document_id"]
            isOneToOne: false
            referencedRelation: "transport_regulatory_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_regulatory_evidence_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "transport_regulatory_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_regulatory_evidence_signature_id_fkey"
            columns: ["signature_id"]
            isOneToOne: false
            referencedRelation: "document_signatures"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_regulatory_revisions: {
        Row: {
          amendment_reason: string | null
          content_hash: string | null
          created_at: string
          created_by: string
          id: string
          organization_id: string
          previous_revision_id: string | null
          regulatory_document_id: string
          revision_number: number
          snapshot_json: Json
        }
        Insert: {
          amendment_reason?: string | null
          content_hash?: string | null
          created_at?: string
          created_by: string
          id?: string
          organization_id: string
          previous_revision_id?: string | null
          regulatory_document_id: string
          revision_number: number
          snapshot_json: Json
        }
        Update: {
          amendment_reason?: string | null
          content_hash?: string | null
          created_at?: string
          created_by?: string
          id?: string
          organization_id?: string
          previous_revision_id?: string | null
          regulatory_document_id?: string
          revision_number?: number
          snapshot_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "transport_regulatory_revisions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "transport_regulatory_revisions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_regulatory_revisions_previous_revision_id_fkey"
            columns: ["previous_revision_id"]
            isOneToOne: false
            referencedRelation: "transport_regulatory_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_regulatory_revisions_regulatory_document_id_fkey"
            columns: ["regulatory_document_id"]
            isOneToOne: false
            referencedRelation: "transport_regulatory_documents"
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
      user_management_commands: {
        Row: {
          action: string
          actor_user_id: string
          completed_at: string | null
          created_at: string
          failure_code: string | null
          id: string
          idempotency_key: string
          organization_id: string
          request_hash: string
          result: Json | null
          status: Database["public"]["Enums"]["user_management_command_status"]
          target_role: Database["public"]["Enums"]["organization_role"] | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_user_id: string
          completed_at?: string | null
          created_at?: string
          failure_code?: string | null
          id?: string
          idempotency_key: string
          organization_id: string
          request_hash: string
          result?: Json | null
          status?: Database["public"]["Enums"]["user_management_command_status"]
          target_role?: Database["public"]["Enums"]["organization_role"] | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string
          completed_at?: string | null
          created_at?: string
          failure_code?: string | null
          id?: string
          idempotency_key?: string
          organization_id?: string
          request_hash?: string
          result?: Json | null
          status?: Database["public"]["Enums"]["user_management_command_status"]
          target_role?: Database["public"]["Enums"]["organization_role"] | null
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_management_commands_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_management_commands_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      transport_waiting_times: {
        Row: {
          execution_id: string | null
          loading_seconds: number | null
          organization_id: string | null
          total_seconds: number | null
          transit_seconds: number | null
          transport_order_id: string | null
          unloading_seconds: number | null
          waiting_delivery_seconds: number | null
          waiting_pickup_seconds: number | null
        }
        Insert: {
          execution_id?: string | null
          loading_seconds?: never
          organization_id?: string | null
          total_seconds?: never
          transit_seconds?: never
          transport_order_id?: string | null
          unloading_seconds?: never
          waiting_delivery_seconds?: never
          waiting_pickup_seconds?: never
        }
        Update: {
          execution_id?: string | null
          loading_seconds?: never
          organization_id?: string | null
          total_seconds?: never
          transit_seconds?: never
          transport_order_id?: string | null
          unloading_seconds?: never
          waiting_delivery_seconds?: never
          waiting_pickup_seconds?: never
        }
        Relationships: [
          {
            foreignKeyName: "transport_executions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_executions_transport_order_id_fkey"
            columns: ["transport_order_id"]
            isOneToOne: true
            referencedRelation: "transport_orders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_orders_to_billing_preinvoice: {
        Args: {
          p_actor: string
          p_correlation: string
          p_key: string
          p_order_ids: string[]
          p_org: string
          p_preinvoice: string
          p_scope: Database["public"]["Enums"]["audit_actor_scope"]
        }
        Returns: Json
      }
      add_transport_order_billing_supplement: {
        Args: {
          p_actor: string
          p_amount: number
          p_charge_mode: Database["public"]["Enums"]["billing_charge_mode"]
          p_code: string
          p_correlation: string
          p_definition: string
          p_key: string
          p_name: string
          p_order: string
          p_org: string
          p_percentage_base: string
          p_quantity: number
          p_scope: Database["public"]["Enums"]["audit_actor_scope"]
          p_unit_code: string
        }
        Returns: Json
      }
      add_transport_order_pricing_adjustment: {
        Args: {
          p_actor: string
          p_adjustment_kind: Database["public"]["Enums"]["billing_adjustment_kind"]
          p_amount: number
          p_charge_mode: Database["public"]["Enums"]["billing_charge_mode"]
          p_correlation: string
          p_effect_sign: number
          p_key: string
          p_order: string
          p_org: string
          p_percentage_base: string
          p_quantity: number
          p_reason: string
          p_scope: Database["public"]["Enums"]["audit_actor_scope"]
          p_unit_code: string
        }
        Returns: Json
      }
      apply_ocr_proposals: {
        Args: {
          p_actor: string
          p_correlation: string
          p_key: string
          p_org: string
          p_proposal_ids: string[]
          p_scope: Database["public"]["Enums"]["audit_actor_scope"]
        }
        Returns: Json
      }
      approve_billing_preinvoice: {
        Args: {
          p_actor: string
          p_correlation: string
          p_key: string
          p_org: string
          p_preinvoice: string
          p_scope: Database["public"]["Enums"]["audit_actor_scope"]
        }
        Returns: Json
      }
      approve_ocr_review: {
        Args: {
          p_actor: string
          p_correlation: string
          p_key: string
          p_notes: string
          p_org: string
          p_review: string
          p_scope: Database["public"]["Enums"]["audit_actor_scope"]
        }
        Returns: Json
      }
      archive_document: {
        Args: {
          p_actor: string
          p_correlation: string
          p_document: string
          p_key: string
          p_org: string
          p_reason: string
          p_scope: Database["public"]["Enums"]["audit_actor_scope"]
        }
        Returns: Json
      }
      archive_ocr_job: {
        Args: {
          p_actor: string
          p_correlation: string
          p_job: string
          p_key: string
          p_org: string
          p_reason: string
          p_scope: Database["public"]["Enums"]["audit_actor_scope"]
        }
        Returns: Json
      }
      begin_document_upload: {
        Args: {
          p_actor: string
          p_correlation: string
          p_description: string
          p_document_type: string
          p_key: string
          p_mime_type: string
          p_org: string
          p_original_filename: string
          p_relations: Json
          p_scope: Database["public"]["Enums"]["audit_actor_scope"]
          p_size_bytes: number
          p_source: Database["public"]["Enums"]["document_source"]
          p_title: string
        }
        Returns: Json
      }
      begin_document_version_upload: {
        Args: {
          p_actor: string
          p_correlation: string
          p_document: string
          p_key: string
          p_mime_type: string
          p_org: string
          p_original_filename: string
          p_scope: Database["public"]["Enums"]["audit_actor_scope"]
          p_size_bytes: number
        }
        Returns: Json
      }
      begin_invoice_pdf: {
        Args: {
          p_actor: string
          p_correlation: string
          p_invoice: string
          p_key: string
          p_org: string
          p_scope: Database["public"]["Enums"]["audit_actor_scope"]
          p_sha256: string
          p_size: number
        }
        Returns: Json
      }
      billing_actor_authorized: {
        Args: {
          p_actor: string
          p_org: string
          p_scope: Database["public"]["Enums"]["audit_actor_scope"]
          p_write?: boolean
        }
        Returns: boolean
      }
      billing_next_preinvoice_reference: {
        Args: { p_org: string; p_reference_year: number }
        Returns: string
      }
      billing_recalculate_preinvoice_totals: {
        Args: { p_preinvoice: string }
        Returns: undefined
      }
      billing_round_amount: { Args: { p_value: number }; Returns: number }
      build_regulatory_snapshot: {
        Args: {
          p_order: string
          p_org: string
          p_schema?: string
          p_type: Database["public"]["Enums"]["regulatory_document_type"]
        }
        Returns: Json
      }
      can_access_master_data: {
        Args: {
          p_module_code: string
          p_organization_id: string
          p_write?: boolean
        }
        Returns: boolean
      }
      cancel_billing_preinvoice: {
        Args: {
          p_actor: string
          p_correlation: string
          p_key: string
          p_org: string
          p_preinvoice: string
          p_reason: string
          p_scope: Database["public"]["Enums"]["audit_actor_scope"]
        }
        Returns: Json
      }
      cancel_invoice: {
        Args: {
          p_actor: string
          p_correlation: string
          p_invoice: string
          p_key: string
          p_org: string
          p_reason: string
          p_scope: Database["public"]["Enums"]["audit_actor_scope"]
        }
        Returns: Json
      }
      command_document_signature: {
        Args: {
          p_action: string
          p_actor: string
          p_correlation: string
          p_document: string
          p_key: string
          p_org: string
          p_scope: Database["public"]["Enums"]["audit_actor_scope"]
          p_signature: string
          p_values: Json
          p_version: string
        }
        Returns: Json
      }
      command_proof_of_delivery: {
        Args: {
          p_action: string
          p_actor: string
          p_correlation: string
          p_document: string
          p_key: string
          p_order: string
          p_org: string
          p_pod: string
          p_scope: Database["public"]["Enums"]["audit_actor_scope"]
          p_stop: string
          p_values: Json
        }
        Returns: Json
      }
      complete_company_user_command: {
        Args: {
          p_actor: string
          p_command: string
          p_email: string
          p_first: string
          p_last: string
          p_must_change: boolean
          p_phone: string
          p_user: string
        }
        Returns: Json
      }
      complete_ocr_job_result: {
        Args: {
          p_actor: string
          p_correlation: string
          p_fields: Json
          p_job: string
          p_key: string
          p_org: string
          p_result: Json
          p_scope: Database["public"]["Enums"]["audit_actor_scope"]
        }
        Returns: Json
      }
      configure_invoice_fiscal: {
        Args: {
          p_actor: string
          p_correlation: string
          p_org: string
          p_scope: Database["public"]["Enums"]["audit_actor_scope"]
          p_series: Json
          p_settings: Json
          p_taxes: Json
        }
        Returns: Json
      }
      confirm_document_upload: {
        Args: {
          p_actor: string
          p_actual_mime: string
          p_actual_size: number
          p_correlation: string
          p_document: string
          p_key: string
          p_metadata: Json
          p_org: string
          p_scope: Database["public"]["Enums"]["audit_actor_scope"]
          p_sha256: string
          p_version: string
        }
        Returns: Json
      }
      confirm_invoice_pdf: {
        Args: {
          p_actor: string
          p_correlation: string
          p_document: string
          p_invoice: string
          p_key: string
          p_org: string
          p_scope: Database["public"]["Enums"]["audit_actor_scope"]
          p_sha256: string
          p_version: string
        }
        Returns: Json
      }
      correct_ocr_field: {
        Args: {
          p_actor: string
          p_corrected_value: Json
          p_correlation: string
          p_field_code: string
          p_field_result: string
          p_key: string
          p_org: string
          p_reason: string
          p_review: string
          p_scope: Database["public"]["Enums"]["audit_actor_scope"]
        }
        Returns: Json
      }
      create_billing_preinvoice: {
        Args: {
          p_actor: string
          p_client: string
          p_correlation: string
          p_key: string
          p_notes: string
          p_order_ids: string[]
          p_org: string
          p_period_end: string
          p_period_start: string
          p_scope: Database["public"]["Enums"]["audit_actor_scope"]
        }
        Returns: Json
      }
      create_corrective_invoice: {
        Args: {
          p_actor: string
          p_correlation: string
          p_invoice: string
          p_issue_date: string
          p_key: string
          p_org: string
          p_reason: string
          p_scope: Database["public"]["Enums"]["audit_actor_scope"]
          p_series: string
          p_subtotal: number
        }
        Returns: Json
      }
      create_regulatory_document: {
        Args: {
          p_actor: string
          p_correlation: string
          p_key: string
          p_order: string
          p_org: string
          p_scope: Database["public"]["Enums"]["audit_actor_scope"]
          p_type: Database["public"]["Enums"]["regulatory_document_type"]
        }
        Returns: Json
      }
      create_regulatory_revision: {
        Args: {
          p_actor: string
          p_correlation: string
          p_document: string
          p_key: string
          p_org: string
          p_reason: string
          p_scope: Database["public"]["Enums"]["audit_actor_scope"]
        }
        Returns: Json
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
      document_actor_authorized: {
        Args: {
          p_actor: string
          p_module: string
          p_org: string
          p_scope: Database["public"]["Enums"]["audit_actor_scope"]
        }
        Returns: boolean
      }
      driver_has_order_access: {
        Args: { p_module?: string; p_order_id: string }
        Returns: boolean
      }
      execute_driver_transport_operation: {
        Args: {
          p_actor: string
          p_correlation: string
          p_key: string
          p_order: string
          p_org: string
          p_resource: string
          p_target: string
          p_values: Json
        }
        Returns: Json
      }
      execute_transport_operation: {
        Args: {
          p_action: string
          p_actor_scope: Database["public"]["Enums"]["audit_actor_scope"]
          p_actor_user_id: string
          p_correlation_id: string
          p_entity_id: string
          p_idempotency_key: string
          p_organization_id: string
          p_reason: string
          p_resource: string
          p_target_status: string
          p_transport_order_id: string
          p_values: Json
        }
        Returns: Json
      }
      fail_document_upload: {
        Args: {
          p_actor: string
          p_correlation: string
          p_document: string
          p_key: string
          p_org: string
          p_reason: string
          p_scope: Database["public"]["Enums"]["audit_actor_scope"]
          p_version: string
        }
        Returns: Json
      }
      fail_ocr_job: {
        Args: {
          p_actor: string
          p_correlation: string
          p_failure_code: string
          p_failure_message: string
          p_job: string
          p_key: string
          p_org: string
          p_provider_processed: boolean
          p_scope: Database["public"]["Enums"]["audit_actor_scope"]
        }
        Returns: Json
      }
      is_platform_superadmin: { Args: never; Returns: boolean }
      issue_preinvoice_invoice: {
        Args: {
          p_actor: string
          p_correlation: string
          p_due_date: string
          p_issue_date: string
          p_key: string
          p_notes: string
          p_org: string
          p_preinvoice: string
          p_scope: Database["public"]["Enums"]["audit_actor_scope"]
          p_series: string
          p_tax: string
        }
        Returns: Json
      }
      issue_transport_regulatory_document: {
        Args: {
          p_actor: string
          p_correlation: string
          p_document: string
          p_key: string
          p_org: string
          p_scope: Database["public"]["Enums"]["audit_actor_scope"]
        }
        Returns: Json
      }
      mark_company_user_command_failure: {
        Args: {
          p_actor: string
          p_code: string
          p_command: string
          p_status: Database["public"]["Enums"]["user_management_command_status"]
        }
        Returns: undefined
      }
      mark_invoice_overdue: {
        Args: {
          p_actor: string
          p_correlation: string
          p_invoice: string
          p_org: string
          p_scope: Database["public"]["Enums"]["audit_actor_scope"]
        }
        Returns: Json
      }
      mark_ocr_processing_started: {
        Args: {
          p_actor: string
          p_correlation: string
          p_job: string
          p_key: string
          p_org: string
          p_provider_request_id: string
          p_scope: Database["public"]["Enums"]["audit_actor_scope"]
        }
        Returns: Json
      }
      next_invoice_number: {
        Args: { p_issue_date: string; p_org: string; p_series: string }
        Returns: string
      }
      next_transport_order_number: {
        Args: { p_organization_id: string }
        Returns: string
      }
      ocr_actor_authorized: {
        Args: {
          p_actor: string
          p_org: string
          p_scope: Database["public"]["Enums"]["audit_actor_scope"]
        }
        Returns: boolean
      }
      ocr_application_module_enabled: {
        Args: { p_module_code: string; p_org: string }
        Returns: boolean
      }
      ocr_application_normalized_digits: {
        Args: { p_value: string }
        Returns: string
      }
      ocr_application_normalized_lower: {
        Args: { p_value: string }
        Returns: string
      }
      ocr_application_normalized_text: {
        Args: { p_value: string }
        Returns: string
      }
      ocr_application_normalized_upper: {
        Args: { p_value: string }
        Returns: string
      }
      ocr_limit_value_for_organization: {
        Args: { p_limit_code: string; p_org: string }
        Returns: number
      }
      ocr_sanitized_message: { Args: { p_text: string }; Returns: string }
      persist_transport_order_valuation: {
        Args: {
          p_actor: string
          p_adjustments_amount: number
          p_base_amount: number
          p_breakdown: Json
          p_correlation: string
          p_currency_code: string
          p_input_snapshot: Json
          p_key: string
          p_order: string
          p_org: string
          p_rate_id: string
          p_rate_snapshot: Json
          p_scope: Database["public"]["Enums"]["audit_actor_scope"]
          p_supplements_amount: number
          p_total_amount: number
        }
        Returns: Json
      }
      phase_c_module_enabled: {
        Args: { p_organization_id: string }
        Returns: boolean
      }
      phase_k_actor_can_manage: {
        Args: { p_actor: string; p_org: string }
        Returns: boolean
      }
      phase_k_effective_limit: {
        Args: { p_code: string; p_org: string }
        Returns: number
      }
      prepare_company_user_command: {
        Args: {
          p_actor: string
          p_hash: string
          p_key: string
          p_org: string
          p_role: Database["public"]["Enums"]["organization_role"]
        }
        Returns: Json
      }
      reconcile_ocr_jobs: {
        Args: { p_limit?: number; p_org: string }
        Returns: Json
      }
      record_invoice_payment: {
        Args: {
          p_actor: string
          p_amount: number
          p_correlation: string
          p_date: string
          p_invoice: string
          p_key: string
          p_method: Database["public"]["Enums"]["invoice_payment_method"]
          p_notes: string
          p_org: string
          p_reference: string
          p_scope: Database["public"]["Enums"]["audit_actor_scope"]
        }
        Returns: Json
      }
      regulatory_document_access: {
        Args: { p_module?: string; p_order: string }
        Returns: boolean
      }
      regulatory_idempotency_claim: {
        Args: { p_actor: string; p_hash: string; p_key: string; p_org: string }
        Returns: Json
      }
      reject_ocr_review: {
        Args: {
          p_actor: string
          p_correlation: string
          p_key: string
          p_org: string
          p_reason: string
          p_review: string
          p_scope: Database["public"]["Enums"]["audit_actor_scope"]
        }
        Returns: Json
      }
      remove_order_from_billing_preinvoice: {
        Args: {
          p_actor: string
          p_correlation: string
          p_key: string
          p_order: string
          p_org: string
          p_preinvoice: string
          p_reason: string
          p_scope: Database["public"]["Enums"]["audit_actor_scope"]
        }
        Returns: Json
      }
      reopen_transport_order_valuation: {
        Args: {
          p_actor: string
          p_correlation: string
          p_key: string
          p_order: string
          p_org: string
          p_reason: string
          p_scope: Database["public"]["Enums"]["audit_actor_scope"]
        }
        Returns: Json
      }
      request_document_ocr: {
        Args: {
          p_actor: string
          p_correlation: string
          p_document: string
          p_document_version: string
          p_key: string
          p_org: string
          p_payload: Json
          p_provider_code: string
          p_scope: Database["public"]["Enums"]["audit_actor_scope"]
        }
        Returns: Json
      }
      start_ocr_review: {
        Args: {
          p_actor: string
          p_correlation: string
          p_job: string
          p_key: string
          p_notes: string
          p_org: string
          p_result: string
          p_scope: Database["public"]["Enums"]["audit_actor_scope"]
        }
        Returns: Json
      }
      transition_regulatory_document: {
        Args: {
          p_actor: string
          p_correlation: string
          p_document: string
          p_key: string
          p_org: string
          p_reason: string
          p_scope: Database["public"]["Enums"]["audit_actor_scope"]
          p_target: Database["public"]["Enums"]["regulatory_document_status"]
        }
        Returns: Json
      }
      validate_regulatory_snapshot: {
        Args: { p_snapshot: Json }
        Returns: Json
      }
      validate_transport_order_valuation: {
        Args: {
          p_actor: string
          p_correlation: string
          p_key: string
          p_order: string
          p_org: string
          p_reason: string
          p_scope: Database["public"]["Enums"]["audit_actor_scope"]
        }
        Returns: Json
      }
    }
    Enums: {
      audit_actor_scope: "platform" | "organization" | "system"
      billing_adjustment_kind: "discount" | "surcharge" | "correction"
      billing_charge_mode: "fixed" | "percent" | "per_unit"
      billing_interval: "monthly" | "yearly" | "custom"
      billing_preinvoice_status:
        | "draft"
        | "review"
        | "approved"
        | "cancelled"
        | "converted"
      billing_rate_status: "active" | "inactive" | "archived"
      company_user_lifecycle_status:
        | "pending"
        | "active"
        | "blocked"
        | "deactivated"
        | "compensated"
        | "reconciliation_required"
      document_outbox_status: "pending" | "processing" | "completed" | "failed"
      document_signature_type:
        | "drawn"
        | "typed"
        | "uploaded"
        | "future_certificate"
      document_source:
        | "upload"
        | "camera"
        | "generated"
        | "imported"
        | "legacy"
        | "future_ocr"
      document_status:
        | "pending_upload"
        | "available"
        | "quarantined"
        | "archived"
        | "failed"
      document_version_status:
        | "pending_upload"
        | "available"
        | "quarantined"
        | "failed"
      driver_employment_status:
        | "pending"
        | "active"
        | "inactive"
        | "on_leave"
        | "terminated"
        | "archived"
      fleet_asset_status: "active" | "inactive" | "maintenance" | "archived"
      internal_notification_status: "unread" | "read" | "archived"
      invoice_fiscal_year_mode: "calendar_year" | "continuous"
      invoice_payment_method:
        | "bank_transfer"
        | "cash"
        | "card"
        | "direct_debit"
        | "other"
      invoice_status:
        | "draft"
        | "issued"
        | "partially_paid"
        | "paid"
        | "overdue"
        | "cancelled"
        | "rectified"
      invoice_tax_kind:
        | "standard"
        | "reduced"
        | "super_reduced"
        | "zero"
        | "exempt"
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
      ocr_application_comparison_status:
        | "exact_match"
        | "new_value"
        | "conflict"
        | "target_missing"
        | "invalid"
        | "ambiguous"
      ocr_application_review_status:
        | "pending"
        | "ready"
        | "conflict"
        | "invalid"
        | "ignored"
      ocr_application_status:
        | "pending"
        | "approved"
        | "applied"
        | "rejected"
        | "failed"
        | "archived"
      ocr_application_target_entity_type:
        | "transport_order"
        | "transport_stop"
        | "transport_item"
        | "client"
        | "location"
        | "vehicle"
        | "driver"
      ocr_field_validation_status:
        | "extracted"
        | "valid"
        | "uncertain"
        | "invalid"
        | "missing"
        | "not_applicable"
      ocr_job_status:
        | "queued"
        | "processing"
        | "succeeded"
        | "failed"
        | "cancelled"
        | "needs_review"
        | "reviewed"
        | "archived"
      ocr_outbox_status: "pending" | "processing" | "completed" | "failed"
      ocr_quota_reservation_status:
        | "reserved"
        | "committed"
        | "released"
        | "expired"
      ocr_review_status:
        | "pending"
        | "in_progress"
        | "approved"
        | "rejected"
        | "archived"
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
      pod_status: "pending" | "captured" | "confirmed" | "rejected" | "archived"
      profile_status: "active" | "blocked"
      regulatory_document_status:
        | "draft"
        | "ready"
        | "issued"
        | "in_execution"
        | "completed"
        | "amended"
        | "cancelled"
        | "archived"
      regulatory_document_type: "control_document" | "ecmr_draft"
      subscription_status:
        | "trial"
        | "active"
        | "past_due"
        | "suspended"
        | "cancelled"
        | "expired"
      transport_economic_status:
        | "unpriced"
        | "calculated"
        | "needs_recalculation"
        | "validated"
        | "prefactured"
        | "invoiced"
        | "cancelled"
      transport_execution_status:
        | "pending"
        | "driver_notified"
        | "heading_to_pickup"
        | "arrived_pickup"
        | "waiting_pickup"
        | "loading"
        | "loaded"
        | "departed_pickup"
        | "in_transit"
        | "arrived_delivery"
        | "waiting_delivery"
        | "unloading"
        | "delivered"
        | "completed"
        | "cancelled"
      transport_incident_category:
        | "delay"
        | "breakdown"
        | "traffic"
        | "customer_absent"
        | "wrong_address"
        | "missing_goods"
        | "damaged_goods"
        | "documentation"
        | "other"
      transport_incident_severity: "low" | "normal" | "high" | "critical"
      transport_incident_status:
        | "open"
        | "in_progress"
        | "resolved"
        | "closed"
        | "archived"
      transport_note_type: "operational" | "driver" | "customer" | "internal"
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
      user_management_command_status:
        | "prepared"
        | "completed"
        | "compensated"
        | "reconciliation_required"
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
      billing_adjustment_kind: ["discount", "surcharge", "correction"],
      billing_charge_mode: ["fixed", "percent", "per_unit"],
      billing_interval: ["monthly", "yearly", "custom"],
      billing_preinvoice_status: [
        "draft",
        "review",
        "approved",
        "cancelled",
        "converted",
      ],
      billing_rate_status: ["active", "inactive", "archived"],
      company_user_lifecycle_status: [
        "pending",
        "active",
        "blocked",
        "deactivated",
        "compensated",
        "reconciliation_required",
      ],
      document_outbox_status: ["pending", "processing", "completed", "failed"],
      document_signature_type: [
        "drawn",
        "typed",
        "uploaded",
        "future_certificate",
      ],
      document_source: [
        "upload",
        "camera",
        "generated",
        "imported",
        "legacy",
        "future_ocr",
      ],
      document_status: [
        "pending_upload",
        "available",
        "quarantined",
        "archived",
        "failed",
      ],
      document_version_status: [
        "pending_upload",
        "available",
        "quarantined",
        "failed",
      ],
      driver_employment_status: [
        "pending",
        "active",
        "inactive",
        "on_leave",
        "terminated",
        "archived",
      ],
      fleet_asset_status: ["active", "inactive", "maintenance", "archived"],
      internal_notification_status: ["unread", "read", "archived"],
      invoice_fiscal_year_mode: ["calendar_year", "continuous"],
      invoice_payment_method: [
        "bank_transfer",
        "cash",
        "card",
        "direct_debit",
        "other",
      ],
      invoice_status: [
        "draft",
        "issued",
        "partially_paid",
        "paid",
        "overdue",
        "cancelled",
        "rectified",
      ],
      invoice_tax_kind: [
        "standard",
        "reduced",
        "super_reduced",
        "zero",
        "exempt",
      ],
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
      ocr_application_comparison_status: [
        "exact_match",
        "new_value",
        "conflict",
        "target_missing",
        "invalid",
        "ambiguous",
      ],
      ocr_application_review_status: [
        "pending",
        "ready",
        "conflict",
        "invalid",
        "ignored",
      ],
      ocr_application_status: [
        "pending",
        "approved",
        "applied",
        "rejected",
        "failed",
        "archived",
      ],
      ocr_application_target_entity_type: [
        "transport_order",
        "transport_stop",
        "transport_item",
        "client",
        "location",
        "vehicle",
        "driver",
      ],
      ocr_field_validation_status: [
        "extracted",
        "valid",
        "uncertain",
        "invalid",
        "missing",
        "not_applicable",
      ],
      ocr_job_status: [
        "queued",
        "processing",
        "succeeded",
        "failed",
        "cancelled",
        "needs_review",
        "reviewed",
        "archived",
      ],
      ocr_outbox_status: ["pending", "processing", "completed", "failed"],
      ocr_quota_reservation_status: [
        "reserved",
        "committed",
        "released",
        "expired",
      ],
      ocr_review_status: [
        "pending",
        "in_progress",
        "approved",
        "rejected",
        "archived",
      ],
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
      pod_status: ["pending", "captured", "confirmed", "rejected", "archived"],
      profile_status: ["active", "blocked"],
      regulatory_document_status: [
        "draft",
        "ready",
        "issued",
        "in_execution",
        "completed",
        "amended",
        "cancelled",
        "archived",
      ],
      regulatory_document_type: ["control_document", "ecmr_draft"],
      subscription_status: [
        "trial",
        "active",
        "past_due",
        "suspended",
        "cancelled",
        "expired",
      ],
      transport_economic_status: [
        "unpriced",
        "calculated",
        "needs_recalculation",
        "validated",
        "prefactured",
        "invoiced",
        "cancelled",
      ],
      transport_execution_status: [
        "pending",
        "driver_notified",
        "heading_to_pickup",
        "arrived_pickup",
        "waiting_pickup",
        "loading",
        "loaded",
        "departed_pickup",
        "in_transit",
        "arrived_delivery",
        "waiting_delivery",
        "unloading",
        "delivered",
        "completed",
        "cancelled",
      ],
      transport_incident_category: [
        "delay",
        "breakdown",
        "traffic",
        "customer_absent",
        "wrong_address",
        "missing_goods",
        "damaged_goods",
        "documentation",
        "other",
      ],
      transport_incident_severity: ["low", "normal", "high", "critical"],
      transport_incident_status: [
        "open",
        "in_progress",
        "resolved",
        "closed",
        "archived",
      ],
      transport_note_type: ["operational", "driver", "customer", "internal"],
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
      user_management_command_status: [
        "prepared",
        "completed",
        "compensated",
        "reconciliation_required",
      ],
    },
  },
} as const

