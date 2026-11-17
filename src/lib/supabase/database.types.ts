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
      accounts: {
        Row: {
          archived_at: string | null
          color: string | null
          created_at: string
          created_by: string | null
          id: string
          initial_balance_cents: number
          institution: string | null
          name: string
          owner_user_id: string | null
          type: Database["public"]["Enums"]["account_type"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          initial_balance_cents?: number
          institution?: string | null
          name: string
          owner_user_id?: string | null
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          initial_balance_cents?: number
          institution?: string | null
          name?: string
          owner_user_id?: string | null
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_messages: {
        Row: {
          body: string | null
          channel: Database["public"]["Enums"]["channel_kind"]
          created_at: string
          direction: Database["public"]["Enums"]["message_direction"]
          external_message_id: string
          goal_contribution_id: string | null
          id: string
          link_id: string | null
          parsed: Json | null
          transaction_id: string | null
          undone_at: string | null
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          body?: string | null
          channel: Database["public"]["Enums"]["channel_kind"]
          created_at?: string
          direction: Database["public"]["Enums"]["message_direction"]
          external_message_id: string
          goal_contribution_id?: string | null
          id?: string
          link_id?: string | null
          parsed?: Json | null
          transaction_id?: string | null
          undone_at?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          body?: string | null
          channel?: Database["public"]["Enums"]["channel_kind"]
          created_at?: string
          direction?: Database["public"]["Enums"]["message_direction"]
          external_message_id?: string
          goal_contribution_id?: string | null
          id?: string
          link_id?: string | null
          parsed?: Json | null
          transaction_id?: string | null
          undone_at?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_messages_goal_contribution_id_fkey"
            columns: ["goal_contribution_id"]
            isOneToOne: false
            referencedRelation: "goal_contributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_messages_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "channel_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_messages_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_sessions: {
        Row: {
          expires_at: string
          link_id: string
          state: Json
          updated_at: string
        }
        Insert: {
          expires_at?: string
          link_id: string
          state?: Json
          updated_at?: string
        }
        Update: {
          expires_at?: string
          link_id?: string
          state?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_sessions_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: true
            referencedRelation: "channel_links"
            referencedColumns: ["id"]
          },
        ]
      }
      card_invoices: {
        Row: {
          card_id: string
          closing_date: string
          created_at: string
          due_date: string
          id: string
          paid_amount_cents: number | null
          paid_at: string | null
          paid_from_account_id: string | null
          reference_month: string
          status: Database["public"]["Enums"]["invoice_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          card_id: string
          closing_date: string
          created_at?: string
          due_date: string
          id?: string
          paid_amount_cents?: number | null
          paid_at?: string | null
          paid_from_account_id?: string | null
          reference_month: string
          status?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          card_id?: string
          closing_date?: string
          created_at?: string
          due_date?: string
          id?: string
          paid_amount_cents?: number | null
          paid_at?: string | null
          paid_from_account_id?: string | null
          reference_month?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_invoices_card_id_workspace_id_fkey"
            columns: ["card_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "card_invoices_paid_from_account_id_workspace_id_fkey"
            columns: ["paid_from_account_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "workspace_id"]
          },
        ]
      }
      categories: {
        Row: {
          archived_at: string | null
          color: string
          created_at: string
          created_by: string | null
          icon: string
          id: string
          is_default: boolean
          kind: Database["public"]["Enums"]["transaction_kind"]
          name: string
          sort_order: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          color?: string
          created_at?: string
          created_by?: string | null
          icon?: string
          id?: string
          is_default?: boolean
          kind: Database["public"]["Enums"]["transaction_kind"]
          name: string
          sort_order?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          color?: string
          created_at?: string
          created_by?: string | null
          icon?: string
          id?: string
          is_default?: boolean
          kind?: Database["public"]["Enums"]["transaction_kind"]
          name?: string
          sort_order?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_link_codes: {
        Row: {
          attempts: number
          channel: Database["public"]["Enums"]["channel_kind"]
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          user_id: string
        }
        Insert: {
          attempts?: number
          channel: Database["public"]["Enums"]["channel_kind"]
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          user_id: string
        }
        Update: {
          attempts?: number
          channel?: Database["public"]["Enums"]["channel_kind"]
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      channel_links: {
        Row: {
          channel: Database["public"]["Enums"]["channel_kind"]
          created_at: string
          default_workspace_id: string | null
          display_label: string | null
          external_id: string
          id: string
          last_message_at: string | null
          user_id: string
          verified_at: string
        }
        Insert: {
          channel: Database["public"]["Enums"]["channel_kind"]
          created_at?: string
          default_workspace_id?: string | null
          display_label?: string | null
          external_id: string
          id?: string
          last_message_at?: string | null
          user_id: string
          verified_at?: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["channel_kind"]
          created_at?: string
          default_workspace_id?: string | null
          display_label?: string | null
          external_id?: string
          id?: string
          last_message_at?: string | null
          user_id?: string
          verified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_links_default_workspace_id_fkey"
            columns: ["default_workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_cards: {
        Row: {
          archived_at: string | null
          brand: string | null
          closing_day: number
          color: string | null
          created_at: string
          created_by: string | null
          due_day: number
          id: string
          last4: string | null
          limit_cents: number | null
          name: string
          owner_user_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          brand?: string | null
          closing_day: number
          color?: string | null
          created_at?: string
          created_by?: string | null
          due_day: number
          id?: string
          last4?: string | null
          limit_cents?: number | null
          name: string
          owner_user_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          brand?: string | null
          closing_day?: number
          color?: string | null
          created_at?: string
          created_by?: string | null
          due_day?: number
          id?: string
          last4?: string | null
          limit_cents?: number | null
          name?: string
          owner_user_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_cards_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_contributions: {
        Row: {
          account_id: string | null
          amount_cents: number
          contributed_on: string
          created_at: string
          created_by: string | null
          goal_id: string
          id: string
          member_user_id: string | null
          note: string | null
          source: Database["public"]["Enums"]["entry_source"]
          workspace_id: string
        }
        Insert: {
          account_id?: string | null
          amount_cents: number
          contributed_on?: string
          created_at?: string
          created_by?: string | null
          goal_id: string
          id?: string
          member_user_id?: string | null
          note?: string | null
          source?: Database["public"]["Enums"]["entry_source"]
          workspace_id: string
        }
        Update: {
          account_id?: string | null
          amount_cents?: number
          contributed_on?: string
          created_at?: string
          created_by?: string | null
          goal_id?: string
          id?: string
          member_user_id?: string | null
          note?: string | null
          source?: Database["public"]["Enums"]["entry_source"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_contributions_account_id_workspace_id_fkey"
            columns: ["account_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "goal_contributions_goal_id_workspace_id_fkey"
            columns: ["goal_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id", "workspace_id"]
          },
        ]
      }
      goals: {
        Row: {
          achieved_at: string | null
          color: string
          created_at: string
          created_by: string | null
          icon: string
          id: string
          name: string
          status: Database["public"]["Enums"]["goal_status"]
          target_cents: number
          target_date: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          achieved_at?: string | null
          color?: string
          created_at?: string
          created_by?: string | null
          icon?: string
          id?: string
          name: string
          status?: Database["public"]["Enums"]["goal_status"]
          target_cents: number
          target_date?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          achieved_at?: string | null
          color?: string
          created_at?: string
          created_by?: string | null
          icon?: string
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["goal_status"]
          target_cents?: number
          target_date?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batches: {
        Row: {
          account_id: string | null
          card_id: string | null
          created_at: string
          created_by: string | null
          duplicate_rows: number
          error_message: string | null
          file_name: string
          format: Database["public"]["Enums"]["import_format"]
          id: string
          imported_rows: number
          status: Database["public"]["Enums"]["import_status"]
          total_rows: number
          workspace_id: string
        }
        Insert: {
          account_id?: string | null
          card_id?: string | null
          created_at?: string
          created_by?: string | null
          duplicate_rows?: number
          error_message?: string | null
          file_name: string
          format: Database["public"]["Enums"]["import_format"]
          id?: string
          imported_rows?: number
          status?: Database["public"]["Enums"]["import_status"]
          total_rows?: number
          workspace_id: string
        }
        Update: {
          account_id?: string | null
          card_id?: string | null
          created_at?: string
          created_by?: string | null
          duplicate_rows?: number
          error_message?: string | null
          file_name?: string
          format?: Database["public"]["Enums"]["import_format"]
          id?: string
          imported_rows?: number
          status?: Database["public"]["Enums"]["import_status"]
          total_rows?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_account_id_workspace_id_fkey"
            columns: ["account_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "import_batches_card_id_workspace_id_fkey"
            columns: ["card_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "import_batches_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      installment_plans: {
        Row: {
          card_id: string
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string
          first_invoice_month: string
          id: string
          installment_count: number
          purchase_date: string
          total_amount_cents: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          card_id: string
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          first_invoice_month: string
          id?: string
          installment_count: number
          purchase_date: string
          total_amount_cents: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          card_id?: string
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          first_invoice_month?: string
          id?: string
          installment_count?: number
          purchase_date?: string
          total_amount_cents?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "installment_plans_card_id_workspace_id_fkey"
            columns: ["card_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "installment_plans_category_id_workspace_id_fkey"
            columns: ["category_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "installment_plans_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          last_workspace_id: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id: string
          last_workspace_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          last_workspace_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_last_workspace_fk"
            columns: ["last_workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          count: number
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          window_start: string
        }
        Update: {
          count?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      recurrences: {
        Row: {
          account_id: string | null
          amount_cents: number
          card_id: string | null
          category_id: string | null
          created_at: string
          created_by: string | null
          day_of_month: number
          description: string
          ends_on: string | null
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["transaction_kind"]
          last_generated_month: string | null
          member_user_id: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          starts_on: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          account_id?: string | null
          amount_cents: number
          card_id?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          day_of_month: number
          description: string
          ends_on?: string | null
          id?: string
          is_active?: boolean
          kind: Database["public"]["Enums"]["transaction_kind"]
          last_generated_month?: string | null
          member_user_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          starts_on: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          account_id?: string | null
          amount_cents?: number
          card_id?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          day_of_month?: number
          description?: string
          ends_on?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["transaction_kind"]
          last_generated_month?: string | null
          member_user_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          starts_on?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurrences_account_id_workspace_id_fkey"
            columns: ["account_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "recurrences_card_id_workspace_id_fkey"
            columns: ["card_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "recurrences_category_id_workspace_id_fkey"
            columns: ["category_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "recurrences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string | null
          amount_cents: number
          card_id: string | null
          category_id: string | null
          created_at: string
          created_by: string | null
          dedupe_hash: string | null
          description: string
          id: string
          import_batch_id: string | null
          installment_number: number | null
          installment_plan_id: string | null
          installment_total: number | null
          invoice_id: string | null
          is_settled: boolean
          kind: Database["public"]["Enums"]["transaction_kind"]
          member_user_id: string | null
          notes: string | null
          occurred_on: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          recurrence_id: string | null
          recurrence_month: string | null
          source: Database["public"]["Enums"]["entry_source"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          account_id?: string | null
          amount_cents: number
          card_id?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          dedupe_hash?: string | null
          description: string
          id?: string
          import_batch_id?: string | null
          installment_number?: number | null
          installment_plan_id?: string | null
          installment_total?: number | null
          invoice_id?: string | null
          is_settled?: boolean
          kind: Database["public"]["Enums"]["transaction_kind"]
          member_user_id?: string | null
          notes?: string | null
          occurred_on: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          recurrence_id?: string | null
          recurrence_month?: string | null
          source?: Database["public"]["Enums"]["entry_source"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          account_id?: string | null
          amount_cents?: number
          card_id?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          dedupe_hash?: string | null
          description?: string
          id?: string
          import_batch_id?: string | null
          installment_number?: number | null
          installment_plan_id?: string | null
          installment_total?: number | null
          invoice_id?: string | null
          is_settled?: boolean
          kind?: Database["public"]["Enums"]["transaction_kind"]
          member_user_id?: string | null
          notes?: string | null
          occurred_on?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          recurrence_id?: string | null
          recurrence_month?: string | null
          source?: Database["public"]["Enums"]["entry_source"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_workspace_id_fkey"
            columns: ["account_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "transactions_card_id_workspace_id_fkey"
            columns: ["card_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "transactions_category_id_workspace_id_fkey"
            columns: ["category_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "transactions_import_batch_id_workspace_id_fkey"
            columns: ["import_batch_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "transactions_installment_plan_id_workspace_id_fkey"
            columns: ["installment_plan_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "installment_plans"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "transactions_invoice_id_card_id_fkey"
            columns: ["invoice_id", "card_id"]
            isOneToOne: false
            referencedRelation: "card_invoices"
            referencedColumns: ["id", "card_id"]
          },
          {
            foreignKeyName: "transactions_recurrence_id_workspace_id_fkey"
            columns: ["recurrence_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "recurrences"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "transactions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          revoked_at: string | null
          role: Database["public"]["Enums"]["member_role"]
          token_hash: string
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          token_hash: string
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          token_hash?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_invites_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          joined_at: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          joined_at?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          joined_at?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          currency: string
          id: string
          kind: Database["public"]["Enums"]["workspace_kind"]
          name: string
          owner_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          kind: Database["public"]["Enums"]["workspace_kind"]
          name: string
          owner_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          kind?: Database["public"]["Enums"]["workspace_kind"]
          name?: string
          owner_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_workspace_invite: { Args: { p_token: string }; Returns: string }
      consume_channel_link_code: {
        Args: {
          p_channel: Database["public"]["Enums"]["channel_kind"]
          p_code: string
          p_display_label?: string
          p_external_id: string
        }
        Returns: string
      }
      create_channel_link_code: {
        Args: { p_channel: Database["public"]["Enums"]["channel_kind"] }
        Returns: string
      }
      create_household: { Args: { p_name: string }; Returns: string }
      create_workspace_invite: {
        Args: {
          p_email: string
          p_role?: Database["public"]["Enums"]["member_role"]
          p_workspace_id: string
        }
        Returns: string
      }
      delete_my_account: { Args: never; Returns: undefined }
      get_account_deletion_blockers: {
        Args: never
        Returns: {
          other_members: number
          workspace_id: string
          workspace_name: string
        }[]
      }
      get_invite_preview: {
        Args: { p_token: string }
        Returns: {
          already_member: boolean
          email_matches: boolean
          invited_email: string
          inviter_name: string
          role: Database["public"]["Enums"]["member_role"]
          status: string
          workspace_name: string
        }[]
      }
      get_workspace_members: {
        Args: { p_workspace_id: string }
        Returns: {
          email: string
          full_name: string
          is_owner: boolean
          joined_at: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }[]
      }
      hit_rate_limit: {
        Args: { p_key: string; p_max: number; p_window_seconds: number }
        Returns: boolean
      }
      transfer_workspace_ownership: {
        Args: { p_new_owner: string; p_workspace_id: string }
        Returns: undefined
      }
    }
    Enums: {
      account_type: "checking" | "savings" | "wallet" | "investment" | "other"
      channel_kind: "whatsapp" | "telegram"
      entry_source: "manual" | "recurrence" | "import" | "whatsapp" | "telegram"
      goal_status: "active" | "achieved" | "archived"
      import_format: "csv" | "ofx"
      import_status: "pending" | "processed" | "failed" | "reverted"
      invoice_status: "open" | "closed" | "paid"
      member_role: "admin" | "member"
      message_direction: "in" | "out"
      payment_method:
        | "pix"
        | "debit"
        | "credit"
        | "cash"
        | "transfer"
        | "boleto"
        | "other"
      transaction_kind: "income" | "expense"
      workspace_kind: "personal" | "household"
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
      account_type: ["checking", "savings", "wallet", "investment", "other"],
      channel_kind: ["whatsapp", "telegram"],
      entry_source: ["manual", "recurrence", "import", "whatsapp", "telegram"],
      goal_status: ["active", "achieved", "archived"],
      import_format: ["csv", "ofx"],
      import_status: ["pending", "processed", "failed", "reverted"],
      invoice_status: ["open", "closed", "paid"],
      member_role: ["admin", "member"],
      message_direction: ["in", "out"],
      payment_method: [
        "pix",
        "debit",
        "credit",
        "cash",
        "transfer",
        "boleto",
        "other",
      ],
      transaction_kind: ["income", "expense"],
      workspace_kind: ["personal", "household"],
    },
  },
} as const

