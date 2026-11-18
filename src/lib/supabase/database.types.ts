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
      assistant_actions: {
        Row: {
          batch_id: string
          channel: string
          created_at: string
          id: string
          input_kind: string
          intent: string
          original_text: string
          provider: string | null
          record_id: string
          record_table: string
          undo_kind: string
          undone_at: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          batch_id: string
          channel?: string
          created_at?: string
          id?: string
          input_kind?: string
          intent: string
          original_text: string
          provider?: string | null
          record_id: string
          record_table: string
          undo_kind?: string
          undone_at?: string | null
          user_id?: string
          workspace_id: string
        }
        Update: {
          batch_id?: string
          channel?: string
          created_at?: string
          id?: string
          input_kind?: string
          intent?: string
          original_text?: string
          provider?: string | null
          record_id?: string
          record_table?: string
          undo_kind?: string
          undone_at?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_actions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_messages: {
        Row: {
          body: string
          channel: string
          created_at: string
          id: string
          input_kind: string
          payload: Json | null
          role: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          body: string
          channel?: string
          created_at?: string
          id?: string
          input_kind?: string
          payload?: Json | null
          role: string
          user_id?: string
          workspace_id?: string | null
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          id?: string
          input_kind?: string
          payload?: Json | null
          role?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assistant_messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_sessions: {
        Row: {
          channel: string
          expires_at: string
          state: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          channel?: string
          expires_at?: string
          state?: Json
          updated_at?: string
          user_id?: string
        }
        Update: {
          channel?: string
          expires_at?: string
          state?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      assistant_usage: {
        Row: {
          calls: number
          day: string
          provider: string
          user_id: string
        }
        Insert: {
          calls?: number
          day: string
          provider: string
          user_id: string
        }
        Update: {
          calls?: number
          day?: string
          provider?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          at: string
          id: number
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
          workspace_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          at?: string
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
          workspace_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          at?: string
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
          workspace_id?: string
        }
        Relationships: []
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
          reference_month: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          card_id: string
          closing_date: string
          created_at?: string
          due_date: string
          id?: string
          reference_month: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          card_id?: string
          closing_date?: string
          created_at?: string
          due_date?: string
          id?: string
          reference_month?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_invoices_card_id_workspace_id_fkey"
            columns: ["card_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "credit_card_summaries"
            referencedColumns: ["card_id", "workspace_id"]
          },
          {
            foreignKeyName: "card_invoices_card_id_workspace_id_fkey"
            columns: ["card_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
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
          parent_id: string | null
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
          parent_id?: string | null
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
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_fk"
            columns: ["parent_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "categories_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      category_rules: {
        Row: {
          category_id: string
          created_at: string
          created_by: string | null
          hits: number
          id: string
          pattern: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          created_by?: string | null
          hits?: number
          id?: string
          pattern: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          created_by?: string | null
          hits?: number
          id?: string
          pattern?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_rules_category_id_workspace_id_fkey"
            columns: ["category_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "category_rules_workspace_id_fkey"
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
          is_planned: boolean
          member_user_id: string | null
          note: string | null
          recurrence_date: string | null
          recurrence_id: string | null
          source: Database["public"]["Enums"]["entry_source"]
          updated_at: string
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
          is_planned?: boolean
          member_user_id?: string | null
          note?: string | null
          recurrence_date?: string | null
          recurrence_id?: string | null
          source?: Database["public"]["Enums"]["entry_source"]
          updated_at?: string
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
          is_planned?: boolean
          member_user_id?: string | null
          note?: string | null
          recurrence_date?: string | null
          recurrence_id?: string | null
          source?: Database["public"]["Enums"]["entry_source"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_contributions_account_id_workspace_id_fkey"
            columns: ["account_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id", "workspace_id"]
          },
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
            referencedRelation: "goal_summaries"
            referencedColumns: ["goal_id", "workspace_id"]
          },
          {
            foreignKeyName: "goal_contributions_goal_id_workspace_id_fkey"
            columns: ["goal_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "goal_contributions_recurrence_fk"
            columns: ["recurrence_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "recurrences"
            referencedColumns: ["id", "workspace_id"]
          },
        ]
      }
      goals: {
        Row: {
          achieved_at: string | null
          annual_return_bps: number
          color: string
          created_at: string
          created_by: string | null
          icon: string
          id: string
          initial_cents: number
          name: string
          notes: string | null
          priority: number
          reserve_account_id: string | null
          status: Database["public"]["Enums"]["goal_status"]
          target_cents: number
          target_date: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          achieved_at?: string | null
          annual_return_bps?: number
          color?: string
          created_at?: string
          created_by?: string | null
          icon?: string
          id?: string
          initial_cents?: number
          name: string
          notes?: string | null
          priority?: number
          reserve_account_id?: string | null
          status?: Database["public"]["Enums"]["goal_status"]
          target_cents: number
          target_date?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          achieved_at?: string | null
          annual_return_bps?: number
          color?: string
          created_at?: string
          created_by?: string | null
          icon?: string
          id?: string
          initial_cents?: number
          name?: string
          notes?: string | null
          priority?: number
          reserve_account_id?: string | null
          status?: Database["public"]["Enums"]["goal_status"]
          target_cents?: number
          target_date?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_reserve_fk"
            columns: ["reserve_account_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id", "workspace_id"]
          },
          {
            foreignKeyName: "goals_reserve_fk"
            columns: ["reserve_account_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "workspace_id"]
          },
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
            referencedRelation: "account_balances"
            referencedColumns: ["account_id", "workspace_id"]
          },
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
            referencedRelation: "credit_card_summaries"
            referencedColumns: ["card_id", "workspace_id"]
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
            referencedRelation: "credit_card_summaries"
            referencedColumns: ["card_id", "workspace_id"]
          },
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
      invoice_payments: {
        Row: {
          account_id: string | null
          amount_cents: number
          created_at: string
          created_by: string | null
          id: string
          invoice_id: string
          paid_on: string
          workspace_id: string
        }
        Insert: {
          account_id?: string | null
          amount_cents: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id: string
          paid_on: string
          workspace_id: string
        }
        Update: {
          account_id?: string | null
          amount_cents?: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string
          paid_on?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_account_id_workspace_id_fkey"
            columns: ["account_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id", "workspace_id"]
          },
          {
            foreignKeyName: "invoice_payments_account_id_workspace_id_fkey"
            columns: ["account_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "invoice_payments_invoice_id_workspace_id_fkey"
            columns: ["invoice_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "card_invoice_summaries"
            referencedColumns: ["invoice_id", "workspace_id"]
          },
          {
            foreignKeyName: "invoice_payments_invoice_id_workspace_id_fkey"
            columns: ["invoice_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "card_invoices"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "invoice_payments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_deliveries: {
        Row: {
          attempts: number
          channel: string
          created_at: string
          id: string
          last_error: string | null
          next_attempt_at: string
          notification_id: string
          sent_at: string | null
          status: string
        }
        Insert: {
          attempts?: number
          channel: string
          created_at?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          notification_id: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          channel?: string
          created_at?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          notification_id?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_prefs: {
        Row: {
          enabled: boolean
          kind: string
          push: boolean
          telegram: boolean
          user_id: string
        }
        Insert: {
          enabled?: boolean
          kind: string
          push?: boolean
          telegram?: boolean
          user_id?: string
        }
        Update: {
          enabled?: boolean
          kind?: string
          push?: boolean
          telegram?: boolean
          user_id?: string
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          quiet_enabled: boolean
          quiet_end: string
          quiet_start: string
          updated_at: string
          user_id: string
        }
        Insert: {
          quiet_enabled?: boolean
          quiet_end?: string
          quiet_start?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          quiet_enabled?: boolean
          quiet_end?: string
          quiet_start?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          event_key: string
          id: string
          kind: string
          read_at: string | null
          title: string
          url: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          event_key: string
          id?: string
          kind: string
          read_at?: string | null
          title: string
          url?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          event_key?: string
          id?: string
          kind?: string
          read_at?: string | null
          title?: string
          url?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_workspace_id_fkey"
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
          hide_amounts: boolean
          id: string
          last_workspace_id: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          hide_amounts?: boolean
          id: string
          last_workspace_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          hide_amounts?: boolean
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
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          device_label: string | null
          endpoint: string
          failures: number
          id: string
          last_success_at: string | null
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          device_label?: string | null
          endpoint: string
          failures?: number
          id?: string
          last_success_at?: string | null
          p256dh: string
          user_id?: string
        }
        Update: {
          auth?: string
          created_at?: string
          device_label?: string | null
          endpoint?: string
          failures?: number
          id?: string
          last_success_at?: string | null
          p256dh?: string
          user_id?: string
        }
        Relationships: []
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
          auto_confirm: boolean
          card_id: string | null
          category_id: string | null
          created_at: string
          created_by: string | null
          day_of_month: number
          description: string
          ends_on: string | null
          frequency: Database["public"]["Enums"]["recurrence_frequency"]
          goal_id: string | null
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["transaction_kind"]
          last_generated_on: string | null
          member_user_id: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          starts_on: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          account_id?: string | null
          amount_cents: number
          auto_confirm?: boolean
          card_id?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          day_of_month: number
          description: string
          ends_on?: string | null
          frequency?: Database["public"]["Enums"]["recurrence_frequency"]
          goal_id?: string | null
          id?: string
          is_active?: boolean
          kind: Database["public"]["Enums"]["transaction_kind"]
          last_generated_on?: string | null
          member_user_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          starts_on: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          account_id?: string | null
          amount_cents?: number
          auto_confirm?: boolean
          card_id?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          day_of_month?: number
          description?: string
          ends_on?: string | null
          frequency?: Database["public"]["Enums"]["recurrence_frequency"]
          goal_id?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["transaction_kind"]
          last_generated_on?: string | null
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
            referencedRelation: "account_balances"
            referencedColumns: ["account_id", "workspace_id"]
          },
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
            referencedRelation: "credit_card_summaries"
            referencedColumns: ["card_id", "workspace_id"]
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
            foreignKeyName: "recurrences_goal_fk"
            columns: ["goal_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "goal_summaries"
            referencedColumns: ["goal_id", "workspace_id"]
          },
          {
            foreignKeyName: "recurrences_goal_fk"
            columns: ["goal_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "goals"
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
      telegram_updates: {
        Row: {
          attempts: number
          chat_id: number | null
          finished_at: string | null
          kind: string
          last_error: string | null
          received_at: string
          status: string
          update_id: number
        }
        Insert: {
          attempts?: number
          chat_id?: number | null
          finished_at?: string | null
          kind: string
          last_error?: string | null
          received_at?: string
          status?: string
          update_id: number
        }
        Update: {
          attempts?: number
          chat_id?: number | null
          finished_at?: string | null
          kind?: string
          last_error?: string | null
          received_at?: string
          status?: string
          update_id?: number
        }
        Relationships: []
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
          recurrence_date: string | null
          recurrence_id: string | null
          source: Database["public"]["Enums"]["entry_source"]
          updated_at: string
          updated_by: string | null
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
          recurrence_date?: string | null
          recurrence_id?: string | null
          source?: Database["public"]["Enums"]["entry_source"]
          updated_at?: string
          updated_by?: string | null
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
          recurrence_date?: string | null
          recurrence_id?: string | null
          source?: Database["public"]["Enums"]["entry_source"]
          updated_at?: string
          updated_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_workspace_id_fkey"
            columns: ["account_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id", "workspace_id"]
          },
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
            referencedRelation: "credit_card_summaries"
            referencedColumns: ["card_id", "workspace_id"]
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
            referencedRelation: "card_invoice_summaries"
            referencedColumns: ["invoice_id", "card_id"]
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
      transfers: {
        Row: {
          amount_cents: number
          created_at: string
          created_by: string | null
          description: string | null
          from_account_id: string
          id: string
          occurred_on: string
          to_account_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          from_account_id: string
          id?: string
          occurred_on: string
          to_account_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          from_account_id?: string
          id?: string
          occurred_on?: string
          to_account_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfers_from_account_id_workspace_id_fkey"
            columns: ["from_account_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id", "workspace_id"]
          },
          {
            foreignKeyName: "transfers_from_account_id_workspace_id_fkey"
            columns: ["from_account_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "transfers_to_account_id_workspace_id_fkey"
            columns: ["to_account_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id", "workspace_id"]
          },
          {
            foreignKeyName: "transfers_to_account_id_workspace_id_fkey"
            columns: ["to_account_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "transfers_workspace_id_fkey"
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
      account_balances: {
        Row: {
          account_id: string | null
          archived_at: string | null
          balance_cents: number | null
          color: string | null
          initial_balance_cents: number | null
          name: string | null
          pending_cents: number | null
          type: Database["public"]["Enums"]["account_type"] | null
          workspace_id: string | null
        }
        Insert: {
          account_id?: string | null
          archived_at?: string | null
          balance_cents?: never
          color?: string | null
          initial_balance_cents?: number | null
          name?: string | null
          pending_cents?: never
          type?: Database["public"]["Enums"]["account_type"] | null
          workspace_id?: string | null
        }
        Update: {
          account_id?: string | null
          archived_at?: string | null
          balance_cents?: never
          color?: string | null
          initial_balance_cents?: number | null
          name?: string | null
          pending_cents?: never
          type?: Database["public"]["Enums"]["account_type"] | null
          workspace_id?: string | null
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
      card_invoice_summaries: {
        Row: {
          card_id: string | null
          closing_date: string | null
          due_date: string | null
          invoice_id: string | null
          items: number | null
          paid_cents: number | null
          reference_month: string | null
          remaining_cents: number | null
          status: string | null
          total_cents: number | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "card_invoices_card_id_workspace_id_fkey"
            columns: ["card_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "credit_card_summaries"
            referencedColumns: ["card_id", "workspace_id"]
          },
          {
            foreignKeyName: "card_invoices_card_id_workspace_id_fkey"
            columns: ["card_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id", "workspace_id"]
          },
        ]
      }
      credit_card_summaries: {
        Row: {
          archived_at: string | null
          available_cents: number | null
          brand: string | null
          card_id: string | null
          closing_day: number | null
          color: string | null
          due_day: number | null
          last4: string | null
          limit_cents: number | null
          name: string | null
          used_cents: number | null
          workspace_id: string | null
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
      goal_summaries: {
        Row: {
          achieved_at: string | null
          annual_return_bps: number | null
          color: string | null
          contributions_count: number | null
          created_at: string | null
          deposited_cents: number | null
          goal_id: string | null
          icon: string | null
          initial_cents: number | null
          last_contribution_on: string | null
          name: string | null
          notes: string | null
          plan_account_id: string | null
          plan_amount_cents: number | null
          plan_auto_confirm: boolean | null
          plan_day: number | null
          plan_frequency:
            | Database["public"]["Enums"]["recurrence_frequency"]
            | null
          plan_recurrence_id: string | null
          planned_cents: number | null
          priority: number | null
          reserve_account_id: string | null
          saved_cents: number | null
          status: Database["public"]["Enums"]["goal_status"] | null
          target_cents: number | null
          target_date: string | null
          withdrawn_cents: number | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goals_reserve_fk"
            columns: ["reserve_account_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id", "workspace_id"]
          },
          {
            foreignKeyName: "goals_reserve_fk"
            columns: ["reserve_account_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "goals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ops_dead_letters: {
        Row: {
          attempts: number | null
          created_at: string | null
          last_error: string | null
          origem: string | null
          ref: string | null
          tipo: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_workspace_invite: { Args: { p_token: string }; Returns: string }
      analytics_by_category: {
        Args: {
          p_account_id?: string
          p_basis?: Database["public"]["Enums"]["analytics_basis"]
          p_card_id?: string
          p_category_id?: string
          p_from: string
          p_kind?: Database["public"]["Enums"]["transaction_kind"]
          p_member_id?: string
          p_to: string
          p_workspace_id: string
        }
        Returns: {
          category_id: string
          entries: number
          parent_id: string
          planned_cents: number
          total_cents: number
        }[]
      }
      analytics_by_member: {
        Args: {
          p_account_id?: string
          p_basis?: Database["public"]["Enums"]["analytics_basis"]
          p_card_id?: string
          p_category_id?: string
          p_from: string
          p_member_id?: string
          p_to: string
          p_workspace_id: string
        }
        Returns: {
          entries: number
          expense_cents: number
          income_cents: number
          member_id: string
        }[]
      }
      analytics_by_source: {
        Args: {
          p_account_id?: string
          p_basis?: Database["public"]["Enums"]["analytics_basis"]
          p_card_id?: string
          p_category_id?: string
          p_from: string
          p_member_id?: string
          p_to: string
          p_workspace_id: string
        }
        Returns: {
          entries: number
          expense_cents: number
          income_cents: number
          source_id: string
          source_type: string
        }[]
      }
      analytics_entries: {
        Args: {
          p_account_id?: string
          p_basis?: Database["public"]["Enums"]["analytics_basis"]
          p_card_id?: string
          p_category_id?: string
          p_from: string
          p_include_projected?: boolean
          p_member_id?: string
          p_to: string
          p_workspace_id: string
        }
        Returns: {
          account_id: string
          amount_cents: number
          bucket_date: string
          card_id: string
          category_id: string
          description: string
          installment_number: number
          installment_total: number
          invoice_id: string
          is_fixed: boolean
          is_planned: boolean
          is_projected: boolean
          kind: Database["public"]["Enums"]["transaction_kind"]
          member_id: string
          occurred_on: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          root_category_id: string
          transaction_id: string
        }[]
      }
      analytics_monthly: {
        Args: {
          p_account_id?: string
          p_basis?: Database["public"]["Enums"]["analytics_basis"]
          p_card_id?: string
          p_category_id?: string
          p_from: string
          p_member_id?: string
          p_to: string
          p_workspace_id: string
        }
        Returns: {
          expense_cents: number
          expense_planned_cents: number
          income_cents: number
          income_planned_cents: number
          month: string
        }[]
      }
      analytics_position: {
        Args: {
          p_account_id?: string
          p_card_id?: string
          p_until: string
          p_workspace_id: string
        }
        Returns: {
          available_limit_cents: number
          balance_cents: number
          invoices_due_cents: number
          is_projection: boolean
          limit_cents: number
          open_invoices_cents: number
          planned_expense_cents: number
          planned_income_cents: number
          planned_savings_cents: number
          projected_balance_cents: number
        }[]
      }
      analytics_savings: {
        Args: {
          p_account_id?: string
          p_from: string
          p_member_id?: string
          p_to: string
          p_workspace_id: string
        }
        Returns: {
          deposited_cents: number
          entries: number
          planned_cents: number
          saved_cents: number
          withdrawn_cents: number
        }[]
      }
      analytics_totals: {
        Args: {
          p_account_id?: string
          p_basis?: Database["public"]["Enums"]["analytics_basis"]
          p_card_id?: string
          p_category_id?: string
          p_from: string
          p_member_id?: string
          p_to: string
          p_workspace_id: string
        }
        Returns: {
          entries: number
          expense_cents: number
          expense_planned_cents: number
          income_cents: number
          income_planned_cents: number
        }[]
      }
      analytics_upcoming: {
        Args: { p_days?: number; p_workspace_id: string }
        Returns: {
          account_id: string
          amount_cents: number
          card_id: string
          category_id: string
          description: string
          due_on: string
          is_overdue: boolean
          item_type: string
          ref_id: string
        }[]
      }
      apply_recurrence_to_future: {
        Args: { p_recurrence_id: string }
        Returns: number
      }
      assistant_take_quota: {
        Args: {
          p_daily_limit: number
          p_per_minute: number
          p_provider: string
        }
        Returns: {
          allowed: boolean
          reason: string
          used_today: number
        }[]
      }
      claim_notification_deliveries: {
        Args: { p_limit?: number }
        Returns: {
          attempts: number
          body: string
          channel: string
          delivery_id: string
          telegram_chat_id: string
          title: string
          url: string
          user_id: string
        }[]
      }
      consume_channel_link_code: {
        Args: {
          p_channel: Database["public"]["Enums"]["channel_kind"]
          p_code: string
          p_display_label?: string
          p_external_id: string
        }
        Returns: string
      }
      create_card_purchase: {
        Args: {
          p_card_id: string
          p_category_id?: string
          p_description: string
          p_installments: number
          p_member_user_id?: string
          p_notes?: string
          p_occurred_on: string
          p_source?: Database["public"]["Enums"]["entry_source"]
          p_total_cents: number
          p_workspace_id: string
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
      delete_category: {
        Args: { p_category_id: string; p_reassign_to?: string }
        Returns: undefined
      }
      delete_installments: {
        Args: { p_scope: string; p_transaction_id: string }
        Returns: number
      }
      delete_my_account: { Args: never; Returns: undefined }
      finish_notification_delivery: {
        Args: { p_error?: string; p_id: string; p_result: string }
        Returns: undefined
      }
      generate_workspace_recurrences: {
        Args: { p_workspace_id: string }
        Returns: number
      }
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
      planning_capacity_inputs: {
        Args: { p_months?: number; p_workspace_id: string }
        Returns: {
          expense_fixed_cents: number
          expense_variable_cents: number
          income_fixed_cents: number
          income_variable_cents: number
          is_projection: boolean
          month: string
          saved_cents: number
        }[]
      }
      restore_deleted_transaction: {
        Args: { p_transaction_id: string }
        Returns: string
      }
      transfer_workspace_ownership: {
        Args: { p_new_owner: string; p_workspace_id: string }
        Returns: undefined
      }
      update_installments: {
        Args: {
          p_category_id: string
          p_description: string
          p_member_user_id: string
          p_notes: string
          p_scope: string
          p_transaction_id: string
        }
        Returns: number
      }
    }
    Enums: {
      account_type: "checking" | "savings" | "wallet" | "investment" | "other"
      analytics_basis: "accrual" | "cash"
      channel_kind: "whatsapp" | "telegram"
      entry_source:
        | "manual"
        | "recurrence"
        | "import"
        | "whatsapp"
        | "telegram"
        | "assistant"
      goal_status: "active" | "paused" | "achieved" | "archived"
      import_format: "csv" | "ofx"
      import_status: "pending" | "processed" | "failed" | "reverted"
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
      recurrence_frequency: "weekly" | "monthly" | "yearly"
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
      analytics_basis: ["accrual", "cash"],
      channel_kind: ["whatsapp", "telegram"],
      entry_source: [
        "manual",
        "recurrence",
        "import",
        "whatsapp",
        "telegram",
        "assistant",
      ],
      goal_status: ["active", "paused", "achieved", "archived"],
      import_format: ["csv", "ofx"],
      import_status: ["pending", "processed", "failed", "reverted"],
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
      recurrence_frequency: ["weekly", "monthly", "yearly"],
      transaction_kind: ["income", "expense"],
      workspace_kind: ["personal", "household"],
    },
  },
} as const

