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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      action_items: {
        Row: {
          assignee_id: string | null
          completed: boolean | null
          contact_id: string | null
          created_at: string | null
          deal_id: string | null
          due_date: string | null
          id: string
          meeting_id: string | null
          metadata: Json | null
          priority: string | null
          text: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          assignee_id?: string | null
          completed?: boolean | null
          contact_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          due_date?: string | null
          id?: string
          meeting_id?: string | null
          metadata?: Json | null
          priority?: string | null
          text: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          assignee_id?: string | null
          completed?: boolean | null
          contact_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          due_date?: string | null
          id?: string
          meeting_id?: string | null
          metadata?: Json | null
          priority?: string | null
          text?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_items_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_items_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_items_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      activities: {
        Row: {
          amount: number | null
          auto_matched: boolean | null
          avatar_url: string | null
          clerk_org_id: string | null
          client_name: string
          company_id: string | null
          contact_id: string | null
          contact_identifier: string | null
          contact_identifier_type: string | null
          created_at: string | null
          date: string
          deal_id: string | null
          details: string | null
          execution_order: number | null
          id: string
          is_processed: boolean | null
          is_rebooking: boolean | null
          is_self_generated: boolean | null
          is_split: boolean | null
          meeting_id: string | null
          next_actions_count: number | null
          next_actions_generated_at: string | null
          original_activity_id: string | null
          outbound_type: string | null
          owner_id: string | null
          priority: string
          proposal_date: string | null
          quantity: number
          sale_date: string | null
          sales_rep: string
          savvycal_booking_id: string | null
          savvycal_link_id: string | null
          split_percentage: number | null
          status: string
          subject: string | null
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount?: number | null
          auto_matched?: boolean | null
          avatar_url?: string | null
          clerk_org_id?: string | null
          client_name: string
          company_id?: string | null
          contact_id?: string | null
          contact_identifier?: string | null
          contact_identifier_type?: string | null
          created_at?: string | null
          date?: string
          deal_id?: string | null
          details?: string | null
          execution_order?: number | null
          id?: string
          is_processed?: boolean | null
          is_rebooking?: boolean | null
          is_self_generated?: boolean | null
          is_split?: boolean | null
          meeting_id?: string | null
          next_actions_count?: number | null
          next_actions_generated_at?: string | null
          original_activity_id?: string | null
          outbound_type?: string | null
          owner_id?: string | null
          priority?: string
          proposal_date?: string | null
          quantity?: number
          sale_date?: string | null
          sales_rep: string
          savvycal_booking_id?: string | null
          savvycal_link_id?: string | null
          split_percentage?: number | null
          status?: string
          subject?: string | null
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number | null
          auto_matched?: boolean | null
          avatar_url?: string | null
          clerk_org_id?: string | null
          client_name?: string
          company_id?: string | null
          contact_id?: string | null
          contact_identifier?: string | null
          contact_identifier_type?: string | null
          created_at?: string | null
          date?: string
          deal_id?: string | null
          details?: string | null
          execution_order?: number | null
          id?: string
          is_processed?: boolean | null
          is_rebooking?: boolean | null
          is_self_generated?: boolean | null
          is_split?: boolean | null
          meeting_id?: string | null
          next_actions_count?: number | null
          next_actions_generated_at?: string | null
          original_activity_id?: string | null
          outbound_type?: string | null
          owner_id?: string | null
          priority?: string
          proposal_date?: string | null
          quantity?: number
          sale_date?: string | null
          sales_rep?: string
          savvycal_booking_id?: string | null
          savvycal_link_id?: string | null
          split_percentage?: number | null
          status?: string
          subject?: string | null
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_original_activity_id_fkey"
            columns: ["original_activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_original_activity_id_fkey"
            columns: ["original_activity_id"]
            isOneToOne: false
            referencedRelation: "activities_with_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_activities_company_id"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_activities_contact_id"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_sync_rules: {
        Row: {
          activity_type: string
          auto_create_deal: boolean | null
          created_at: string | null
          id: string
          is_active: boolean | null
          min_priority: string | null
          owner_id: string
          target_stage_name: string | null
          updated_at: string | null
        }
        Insert: {
          activity_type: string
          auto_create_deal?: boolean | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          min_priority?: string | null
          owner_id: string
          target_stage_name?: string | null
          updated_at?: string | null
        }
        Update: {
          activity_type?: string
          auto_create_deal?: boolean | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          min_priority?: string | null
          owner_id?: string
          target_stage_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_sync_rules_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "activities_with_profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "activity_sync_rules_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "deal_activities_with_profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "activity_sync_rules_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_sync_rules_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "team_meeting_analytics"
            referencedColumns: ["user_id"]
          },
        ]
      }
      ai_cost_events: {
        Row: {
          created_at: string | null
          estimated_cost: number
          feature: string | null
          id: string
          input_tokens: number
          metadata: Json | null
          model: string
          org_id: string | null
          output_tokens: number
          provider: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          estimated_cost: number
          feature?: string | null
          id?: string
          input_tokens: number
          metadata?: Json | null
          model: string
          org_id?: string | null
          output_tokens: number
          provider: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          estimated_cost?: number
          feature?: string | null
          id?: string
          input_tokens?: number
          metadata?: Json | null
          model?: string
          org_id?: string | null
          output_tokens?: number
          provider?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_cost_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_insights: {
        Row: {
          contact_id: string | null
          created_at: string | null
          deal_id: string | null
          expires_at: string | null
          id: string
          insight_text: string
          insight_type: string
          metadata: Json | null
          priority: string
          suggested_actions: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          expires_at?: string | null
          id?: string
          insight_text: string
          insight_type: string
          metadata?: Json | null
          priority?: string
          suggested_actions?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          expires_at?: string | null
          id?: string
          insight_text?: string
          insight_type?: string
          metadata?: Json | null
          priority?: string
          suggested_actions?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_insights_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_insights_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      api_key_usage: {
        Row: {
          api_key_id: string
          created_at: string | null
          endpoint: string
          id: string
          ip_address: unknown
          user_agent: string | null
        }
        Insert: {
          api_key_id: string
          created_at?: string | null
          endpoint: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_key_usage_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          key_hash: string
          key_preview: string | null
          last_used: string | null
          last_used_at: string | null
          name: string
          permissions: Json
          rate_limit: number
          updated_at: string | null
          usage_count: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          key_preview?: string | null
          last_used?: string | null
          last_used_at?: string | null
          name: string
          permissions?: Json
          rate_limit?: number
          updated_at?: string | null
          usage_count?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          key_preview?: string | null
          last_used?: string | null
          last_used_at?: string | null
          name?: string
          permissions?: Json
          rate_limit?: number
          updated_at?: string | null
          usage_count?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "activities_with_profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "api_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "deal_activities_with_profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "api_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_meeting_analytics"
            referencedColumns: ["user_id"]
          },
        ]
      }
      api_requests: {
        Row: {
          api_key_id: string | null
          created_at: string | null
          endpoint: string
          id: string
          method: string
          response_time_ms: number | null
          status_code: number | null
          user_id: string | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string | null
          endpoint: string
          id?: string
          method: string
          response_time_ms?: number | null
          status_code?: number | null
          user_id?: string | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string | null
          endpoint?: string
          id?: string
          method?: string
          response_time_ms?: number | null
          status_code?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_requests_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          changed_at: string | null
          changed_fields: string[] | null
          id: string
          ip_address: unknown
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changed_at?: string | null
          changed_fields?: string[] | null
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_at?: string | null
          changed_fields?: string[] | null
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      automation_executions: {
        Row: {
          activity_id: string | null
          deal_id: string | null
          error_message: string | null
          executed_at: string | null
          executed_by: string | null
          execution_result: Json | null
          execution_time_ms: number | null
          id: string
          is_test_run: boolean | null
          nodes_executed: number | null
          nodes_total: number | null
          rule_id: string | null
          status: string
          task_id: string | null
          test_scenario_id: string | null
          trigger_data: Json
        }
        Insert: {
          activity_id?: string | null
          deal_id?: string | null
          error_message?: string | null
          executed_at?: string | null
          executed_by?: string | null
          execution_result?: Json | null
          execution_time_ms?: number | null
          id?: string
          is_test_run?: boolean | null
          nodes_executed?: number | null
          nodes_total?: number | null
          rule_id?: string | null
          status?: string
          task_id?: string | null
          test_scenario_id?: string | null
          trigger_data: Json
        }
        Update: {
          activity_id?: string | null
          deal_id?: string | null
          error_message?: string | null
          executed_at?: string | null
          executed_by?: string | null
          execution_result?: Json | null
          execution_time_ms?: number | null
          id?: string
          is_test_run?: boolean | null
          nodes_executed?: number | null
          nodes_total?: number | null
          rule_id?: string | null
          status?: string
          task_id?: string | null
          test_scenario_id?: string | null
          trigger_data?: Json
        }
        Relationships: [
          {
            foreignKeyName: "automation_executions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_executions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities_with_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_executions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_executions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_history: {
        Row: {
          amount: number
          created_at: string | null
          currency: string
          description: string | null
          event_type: string
          hosted_invoice_url: string | null
          id: string
          metadata: Json | null
          org_id: string
          pdf_url: string | null
          period_end: string | null
          period_start: string | null
          receipt_url: string | null
          status: string
          stripe_charge_id: string | null
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string | null
          stripe_refund_id: string | null
          subscription_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string
          description?: string | null
          event_type: string
          hosted_invoice_url?: string | null
          id?: string
          metadata?: Json | null
          org_id: string
          pdf_url?: string | null
          period_end?: string | null
          period_start?: string | null
          receipt_url?: string | null
          status?: string
          stripe_charge_id?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_refund_id?: string | null
          subscription_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string
          description?: string | null
          event_type?: string
          hosted_invoice_url?: string | null
          id?: string
          metadata?: Json | null
          org_id?: string
          pdf_url?: string | null
          period_end?: string | null
          period_start?: string | null
          receipt_url?: string | null
          status?: string
          stripe_charge_id?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_refund_id?: string | null
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_history_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_history_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "organization_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_sources: {
        Row: {
          api_name: string
          category: string | null
          color: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          api_name: string
          category?: string | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          api_name?: string
          category?: string | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      branding_settings: {
        Row: {
          created_at: string | null
          created_by: string | null
          icon_url: string | null
          id: string
          logo_dark_url: string | null
          logo_light_url: string | null
          org_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          icon_url?: string | null
          id?: string
          logo_dark_url?: string | null
          logo_light_url?: string | null
          org_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          icon_url?: string | null
          id?: string
          logo_dark_url?: string | null
          logo_light_url?: string | null
          org_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branding_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_attendees: {
        Row: {
          comment: string | null
          created_at: string | null
          email: string
          event_id: string
          id: string
          is_organizer: boolean | null
          is_required: boolean | null
          name: string | null
          responded_at: string | null
          response_status: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          email: string
          event_id: string
          id?: string
          is_organizer?: boolean | null
          is_required?: boolean | null
          name?: string | null
          responded_at?: string | null
          response_status?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          email?: string
          event_id?: string
          id?: string
          is_organizer?: boolean | null
          is_required?: boolean | null
          name?: string | null
          responded_at?: string | null
          response_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events_with_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_calendars: {
        Row: {
          clerk_org_id: string | null
          color: string | null
          created_at: string | null
          description: string | null
          external_id: string | null
          historical_sync_completed: boolean | null
          historical_sync_start_date: string | null
          id: string
          is_primary: boolean | null
          is_public: boolean | null
          is_visible: boolean | null
          last_sync_token: string | null
          last_synced_at: string | null
          name: string
          settings: Json | null
          sync_enabled: boolean | null
          sync_frequency_minutes: number | null
          timezone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          clerk_org_id?: string | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          external_id?: string | null
          historical_sync_completed?: boolean | null
          historical_sync_start_date?: string | null
          id?: string
          is_primary?: boolean | null
          is_public?: boolean | null
          is_visible?: boolean | null
          last_sync_token?: string | null
          last_synced_at?: string | null
          name: string
          settings?: Json | null
          sync_enabled?: boolean | null
          sync_frequency_minutes?: number | null
          timezone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          clerk_org_id?: string | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          external_id?: string | null
          historical_sync_completed?: boolean | null
          historical_sync_start_date?: string | null
          id?: string
          is_primary?: boolean | null
          is_public?: boolean | null
          is_visible?: boolean | null
          last_sync_token?: string | null
          last_synced_at?: string | null
          name?: string
          settings?: Json | null
          sync_enabled?: boolean | null
          sync_frequency_minutes?: number | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          ai_generated: boolean | null
          ai_suggested_time: boolean | null
          all_day: boolean | null
          attendees_count: number | null
          busy_status: string | null
          calendar_id: string
          clerk_org_id: string | null
          color: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string | null
          creator_email: string | null
          deal_id: string | null
          description: string | null
          end_time: string
          etag: string | null
          external_id: string | null
          external_updated_at: string | null
          hangout_link: string | null
          html_link: string | null
          id: string
          location: string | null
          mcp_connection_id: string | null
          meeting_id: string | null
          meeting_prep: Json | null
          meeting_provider: string | null
          meeting_url: string | null
          org_id: string | null
          organizer_email: string | null
          original_start_time: string | null
          raw_data: Json | null
          recurrence_id: string | null
          recurrence_rule: string | null
          reminders: Json | null
          response_status: string | null
          start_time: string
          status: string | null
          sync_error: string | null
          sync_status: string | null
          synced_at: string | null
          title: string
          transparency: string | null
          updated_at: string | null
          user_id: string
          visibility: string | null
          workflow_id: string | null
        }
        Insert: {
          ai_generated?: boolean | null
          ai_suggested_time?: boolean | null
          all_day?: boolean | null
          attendees_count?: number | null
          busy_status?: string | null
          calendar_id: string
          clerk_org_id?: string | null
          color?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          creator_email?: string | null
          deal_id?: string | null
          description?: string | null
          end_time: string
          etag?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          hangout_link?: string | null
          html_link?: string | null
          id?: string
          location?: string | null
          mcp_connection_id?: string | null
          meeting_id?: string | null
          meeting_prep?: Json | null
          meeting_provider?: string | null
          meeting_url?: string | null
          org_id?: string | null
          organizer_email?: string | null
          original_start_time?: string | null
          raw_data?: Json | null
          recurrence_id?: string | null
          recurrence_rule?: string | null
          reminders?: Json | null
          response_status?: string | null
          start_time: string
          status?: string | null
          sync_error?: string | null
          sync_status?: string | null
          synced_at?: string | null
          title: string
          transparency?: string | null
          updated_at?: string | null
          user_id: string
          visibility?: string | null
          workflow_id?: string | null
        }
        Update: {
          ai_generated?: boolean | null
          ai_suggested_time?: boolean | null
          all_day?: boolean | null
          attendees_count?: number | null
          busy_status?: string | null
          calendar_id?: string
          clerk_org_id?: string | null
          color?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          creator_email?: string | null
          deal_id?: string | null
          description?: string | null
          end_time?: string
          etag?: string | null
          external_id?: string | null
          external_updated_at?: string | null
          hangout_link?: string | null
          html_link?: string | null
          id?: string
          location?: string | null
          mcp_connection_id?: string | null
          meeting_id?: string | null
          meeting_prep?: Json | null
          meeting_provider?: string | null
          meeting_url?: string | null
          org_id?: string | null
          organizer_email?: string | null
          original_start_time?: string | null
          raw_data?: Json | null
          recurrence_id?: string | null
          recurrence_rule?: string | null
          reminders?: Json | null
          response_status?: string | null
          start_time?: string
          status?: string | null
          sync_error?: string | null
          sync_status?: string | null
          synced_at?: string | null
          title?: string
          transparency?: string | null
          updated_at?: string | null
          user_id?: string
          visibility?: string | null
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendar_calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_mcp_connection_id_fkey"
            columns: ["mcp_connection_id"]
            isOneToOne: false
            referencedRelation: "mcp_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_reminders: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          is_sent: boolean | null
          minutes_before: number
          sent_at: string | null
          type: string | null
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          is_sent?: boolean | null
          minutes_before: number
          sent_at?: string | null
          type?: string | null
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          is_sent?: boolean | null
          minutes_before?: number
          sent_at?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_reminders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_reminders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events_with_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_sync_logs: {
        Row: {
          calendar_id: string | null
          completed_at: string | null
          error_message: string | null
          events_created: number | null
          events_deleted: number | null
          events_skipped: number | null
          events_updated: number | null
          id: string
          metadata: Json | null
          started_at: string | null
          sync_status: string
          sync_token_after: string | null
          sync_token_before: string | null
          sync_type: string
          user_id: string
        }
        Insert: {
          calendar_id?: string | null
          completed_at?: string | null
          error_message?: string | null
          events_created?: number | null
          events_deleted?: number | null
          events_skipped?: number | null
          events_updated?: number | null
          id?: string
          metadata?: Json | null
          started_at?: string | null
          sync_status: string
          sync_token_after?: string | null
          sync_token_before?: string | null
          sync_type: string
          user_id: string
        }
        Update: {
          calendar_id?: string | null
          completed_at?: string | null
          error_message?: string | null
          events_created?: number | null
          events_deleted?: number | null
          events_skipped?: number | null
          events_updated?: number | null
          id?: string
          metadata?: Json | null
          started_at?: string | null
          sync_status?: string
          sync_token_after?: string | null
          sync_token_before?: string | null
          sync_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_sync_logs_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendar_calendars"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_features: {
        Row: {
          challenge_id: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          order_index: number | null
          title: string
          updated_at: string | null
        }
        Insert: {
          challenge_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          order_index?: number | null
          title: string
          updated_at?: string | null
        }
        Update: {
          challenge_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          order_index?: number | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "challenge_features_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          order_index: number | null
          subtext: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          order_index?: number | null
          subtext?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          order_index?: number | null
          subtext?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      clerk_sync_log: {
        Row: {
          clerk_id: string
          error_message: string | null
          event_data: Json | null
          event_type: string
          id: string
          success: boolean | null
          synced_at: string | null
        }
        Insert: {
          clerk_id: string
          error_message?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          success?: boolean | null
          synced_at?: string | null
        }
        Update: {
          clerk_id?: string
          error_message?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          success?: boolean | null
          synced_at?: string | null
        }
        Relationships: []
      }
      clerk_user_mappings: {
        Row: {
          clerk_user_id: string
          created_at: string | null
          email: string
          supabase_user_id: string
          updated_at: string | null
        }
        Insert: {
          clerk_user_id: string
          created_at?: string | null
          email: string
          supabase_user_id: string
          updated_at?: string | null
        }
        Update: {
          clerk_user_id?: string
          created_at?: string | null
          email?: string
          supabase_user_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          churn_date: string | null
          churn_reason: string | null
          clerk_org_id: string | null
          company_name: string
          contact_email: string | null
          contact_name: string | null
          created_at: string | null
          deal_id: string | null
          final_billing_date: string | null
          id: string
          notice_given_date: string | null
          owner_id: string
          status: Database["public"]["Enums"]["client_status"]
          subscription_amount: number | null
          subscription_start_date: string | null
          updated_at: string | null
        }
        Insert: {
          churn_date?: string | null
          churn_reason?: string | null
          clerk_org_id?: string | null
          company_name: string
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string | null
          deal_id?: string | null
          final_billing_date?: string | null
          id?: string
          notice_given_date?: string | null
          owner_id: string
          status?: Database["public"]["Enums"]["client_status"]
          subscription_amount?: number | null
          subscription_start_date?: string | null
          updated_at?: string | null
        }
        Update: {
          churn_date?: string | null
          churn_reason?: string | null
          clerk_org_id?: string | null
          company_name?: string
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string | null
          deal_id?: string | null
          final_billing_date?: string | null
          id?: string
          notice_given_date?: string | null
          owner_id?: string
          status?: Database["public"]["Enums"]["client_status"]
          subscription_amount?: number | null
          subscription_start_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: true
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "activities_with_profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "clients_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "deal_activities_with_profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "clients_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "team_meeting_analytics"
            referencedColumns: ["user_id"]
          },
        ]
      }
      communication_events: {
        Row: {
          action_items: Json | null
          ai_analyzed: boolean | null
          ai_model: string | null
          body: string | null
          click_count: number | null
          communication_date: string
          company_id: string | null
          contact_id: string | null
          created_at: string | null
          deal_id: string | null
          direction: string
          email_body_preview: string | null
          email_subject: string | null
          email_thread_id: string | null
          event_timestamp: string
          event_type: string
          external_id: string | null
          external_source: string | null
          id: string
          is_thread_start: boolean | null
          key_topics: Json | null
          metadata: Json | null
          open_count: number | null
          previous_event_id: string | null
          response_required: boolean | null
          response_time_hours: number | null
          sentiment_label: string | null
          sentiment_score: number | null
          snippet: string | null
          subject: string | null
          sync_source: string | null
          thread_id: string | null
          thread_position: number | null
          tone: string | null
          urgency: string | null
          user_id: string
          was_clicked: boolean | null
          was_opened: boolean | null
          was_replied: boolean | null
        }
        Insert: {
          action_items?: Json | null
          ai_analyzed?: boolean | null
          ai_model?: string | null
          body?: string | null
          click_count?: number | null
          communication_date?: string
          company_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          direction: string
          email_body_preview?: string | null
          email_subject?: string | null
          email_thread_id?: string | null
          event_timestamp: string
          event_type: string
          external_id?: string | null
          external_source?: string | null
          id?: string
          is_thread_start?: boolean | null
          key_topics?: Json | null
          metadata?: Json | null
          open_count?: number | null
          previous_event_id?: string | null
          response_required?: boolean | null
          response_time_hours?: number | null
          sentiment_label?: string | null
          sentiment_score?: number | null
          snippet?: string | null
          subject?: string | null
          sync_source?: string | null
          thread_id?: string | null
          thread_position?: number | null
          tone?: string | null
          urgency?: string | null
          user_id: string
          was_clicked?: boolean | null
          was_opened?: boolean | null
          was_replied?: boolean | null
        }
        Update: {
          action_items?: Json | null
          ai_analyzed?: boolean | null
          ai_model?: string | null
          body?: string | null
          click_count?: number | null
          communication_date?: string
          company_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          direction?: string
          email_body_preview?: string | null
          email_subject?: string | null
          email_thread_id?: string | null
          event_timestamp?: string
          event_type?: string
          external_id?: string | null
          external_source?: string | null
          id?: string
          is_thread_start?: boolean | null
          key_topics?: Json | null
          metadata?: Json | null
          open_count?: number | null
          previous_event_id?: string | null
          response_required?: boolean | null
          response_time_hours?: number | null
          sentiment_label?: string | null
          sentiment_score?: number | null
          snippet?: string | null
          subject?: string | null
          sync_source?: string | null
          thread_id?: string | null
          thread_position?: number | null
          tone?: string | null
          urgency?: string | null
          user_id?: string
          was_clicked?: boolean | null
          was_opened?: boolean | null
          was_replied?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_events_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_events_previous_event_id_fkey"
            columns: ["previous_event_id"]
            isOneToOne: false
            referencedRelation: "communication_events"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          clerk_org_id: string | null
          created_at: string | null
          description: string | null
          domain: string | null
          first_seen_at: string | null
          id: string
          industry: string | null
          linkedin_url: string | null
          name: string
          owner_id: string
          phone: string | null
          size: string | null
          source: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          clerk_org_id?: string | null
          created_at?: string | null
          description?: string | null
          domain?: string | null
          first_seen_at?: string | null
          id?: string
          industry?: string | null
          linkedin_url?: string | null
          name: string
          owner_id: string
          phone?: string | null
          size?: string | null
          source?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          clerk_org_id?: string | null
          created_at?: string | null
          description?: string | null
          domain?: string | null
          first_seen_at?: string | null
          id?: string
          industry?: string | null
          linkedin_url?: string | null
          name?: string
          owner_id?: string
          phone?: string | null
          size?: string | null
          source?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "activities_with_profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "companies_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "deal_activities_with_profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "companies_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "team_meeting_analytics"
            referencedColumns: ["user_id"]
          },
        ]
      }
      company_meeting_insights: {
        Row: {
          avg_sentiment_score: number | null
          buying_committee_size: number | null
          company_id: string
          competitors_mentioned: string[] | null
          created_at: string | null
          deal_probability: number | null
          decision_makers: string[] | null
          decision_timeline_days: number | null
          engagement_score: number | null
          id: string
          inferred_deal_stage: string | null
          insights_summary: string | null
          key_topics: string[] | null
          last_meeting_date: string | null
          last_updated_at: string | null
          meeting_frequency_days: number | null
          pain_points: string[] | null
          sentiment_trend: string | null
          total_contacts_met: number | null
          total_meetings: number | null
        }
        Insert: {
          avg_sentiment_score?: number | null
          buying_committee_size?: number | null
          company_id: string
          competitors_mentioned?: string[] | null
          created_at?: string | null
          deal_probability?: number | null
          decision_makers?: string[] | null
          decision_timeline_days?: number | null
          engagement_score?: number | null
          id?: string
          inferred_deal_stage?: string | null
          insights_summary?: string | null
          key_topics?: string[] | null
          last_meeting_date?: string | null
          last_updated_at?: string | null
          meeting_frequency_days?: number | null
          pain_points?: string[] | null
          sentiment_trend?: string | null
          total_contacts_met?: number | null
          total_meetings?: number | null
        }
        Update: {
          avg_sentiment_score?: number | null
          buying_committee_size?: number | null
          company_id?: string
          competitors_mentioned?: string[] | null
          created_at?: string | null
          deal_probability?: number | null
          decision_makers?: string[] | null
          decision_timeline_days?: number | null
          engagement_score?: number | null
          id?: string
          inferred_deal_stage?: string | null
          insights_summary?: string | null
          key_topics?: string[] | null
          last_meeting_date?: string | null
          last_updated_at?: string | null
          meeting_frequency_days?: number | null
          pain_points?: string[] | null
          sentiment_trend?: string | null
          total_contacts_met?: number | null
          total_meetings?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "company_meeting_insights_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_meeting_insights: {
        Row: {
          avg_sentiment_score: number | null
          avg_talk_time_customer_pct: number | null
          competitors_mentioned: string[] | null
          contact_id: string
          created_at: string | null
          decision_criteria: string[] | null
          engagement_score: number | null
          id: string
          insights_summary: string | null
          key_topics: string[] | null
          last_meeting_date: string | null
          last_updated_at: string | null
          next_suggested_followup: string | null
          objections: string[] | null
          pain_points: string[] | null
          response_rate: number | null
          sentiment_trend: string | null
          total_meetings: number | null
        }
        Insert: {
          avg_sentiment_score?: number | null
          avg_talk_time_customer_pct?: number | null
          competitors_mentioned?: string[] | null
          contact_id: string
          created_at?: string | null
          decision_criteria?: string[] | null
          engagement_score?: number | null
          id?: string
          insights_summary?: string | null
          key_topics?: string[] | null
          last_meeting_date?: string | null
          last_updated_at?: string | null
          next_suggested_followup?: string | null
          objections?: string[] | null
          pain_points?: string[] | null
          response_rate?: number | null
          sentiment_trend?: string | null
          total_meetings?: number | null
        }
        Update: {
          avg_sentiment_score?: number | null
          avg_talk_time_customer_pct?: number | null
          competitors_mentioned?: string[] | null
          contact_id?: string
          created_at?: string | null
          decision_criteria?: string[] | null
          engagement_score?: number | null
          id?: string
          insights_summary?: string | null
          key_topics?: string[] | null
          last_meeting_date?: string | null
          last_updated_at?: string | null
          next_suggested_followup?: string | null
          objections?: string[] | null
          pain_points?: string[] | null
          response_rate?: number | null
          sentiment_trend?: string | null
          total_meetings?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_meeting_insights_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_notes: {
        Row: {
          clerk_org_id: string | null
          contact_id: string
          content: string
          created_at: string | null
          created_by: string
          id: string
          is_pinned: boolean | null
          tags: string[] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          clerk_org_id?: string | null
          contact_id: string
          content: string
          created_at?: string | null
          created_by: string
          id?: string
          is_pinned?: boolean | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          clerk_org_id?: string | null
          contact_id?: string
          content?: string
          created_at?: string | null
          created_by?: string
          id?: string
          is_pinned?: boolean | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_notes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          clerk_org_id: string | null
          company: string | null
          company_id: string | null
          created_at: string | null
          email: string
          engagement_level: string | null
          first_name: string | null
          first_seen_at: string | null
          full_name: string | null
          health_score: number | null
          id: string
          is_primary: boolean | null
          last_ai_analysis: string | null
          last_interaction_at: string | null
          last_name: string | null
          linkedin_url: string | null
          owner_id: string | null
          phone: string | null
          source: string | null
          title: string | null
          total_meetings_count: number | null
          updated_at: string | null
        }
        Insert: {
          clerk_org_id?: string | null
          company?: string | null
          company_id?: string | null
          created_at?: string | null
          email: string
          engagement_level?: string | null
          first_name?: string | null
          first_seen_at?: string | null
          full_name?: string | null
          health_score?: number | null
          id?: string
          is_primary?: boolean | null
          last_ai_analysis?: string | null
          last_interaction_at?: string | null
          last_name?: string | null
          linkedin_url?: string | null
          owner_id?: string | null
          phone?: string | null
          source?: string | null
          title?: string | null
          total_meetings_count?: number | null
          updated_at?: string | null
        }
        Update: {
          clerk_org_id?: string | null
          company?: string | null
          company_id?: string | null
          created_at?: string | null
          email?: string
          engagement_level?: string | null
          first_name?: string | null
          first_seen_at?: string | null
          full_name?: string | null
          health_score?: number | null
          id?: string
          is_primary?: boolean | null
          last_ai_analysis?: string | null
          last_interaction_at?: string | null
          last_name?: string | null
          linkedin_url?: string | null
          owner_id?: string | null
          phone?: string | null
          source?: string | null
          title?: string | null
          total_meetings_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_contacts_company_id"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      content: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          duration: number | null
          id: string
          is_active: boolean | null
          thumbnail: string | null
          title: string
          type: string
          updated_at: string | null
          url: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          duration?: number | null
          id?: string
          is_active?: boolean | null
          thumbnail?: string | null
          title: string
          type: string
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          duration?: number | null
          id?: string
          is_active?: boolean | null
          thumbnail?: string | null
          title?: string
          type?: string
          updated_at?: string | null
          url?: string | null
        }
        Relationships: []
      }
      content_topic_links: {
        Row: {
          content_id: string
          created_at: string
          topic_index: number
        }
        Insert: {
          content_id: string
          created_at?: string
          topic_index: number
        }
        Update: {
          content_id?: string
          created_at?: string
          topic_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "content_topic_links_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "meeting_generated_content"
            referencedColumns: ["id"]
          },
        ]
      }
      copilot_analytics: {
        Row: {
          claude_api_time_ms: number | null
          context_type: string | null
          conversation_id: string | null
          created_at: string | null
          error_message: string | null
          error_type: string | null
          estimated_cost_cents: number | null
          has_context: boolean | null
          id: string
          input_tokens: number | null
          message_length: number | null
          output_tokens: number | null
          request_type: string
          response_length: number | null
          response_time_ms: number | null
          status: string
          tool_execution_time_ms: number | null
          tool_iterations: number | null
          tools_error_count: number | null
          tools_success_count: number | null
          tools_used: Json | null
          user_id: string
        }
        Insert: {
          claude_api_time_ms?: number | null
          context_type?: string | null
          conversation_id?: string | null
          created_at?: string | null
          error_message?: string | null
          error_type?: string | null
          estimated_cost_cents?: number | null
          has_context?: boolean | null
          id?: string
          input_tokens?: number | null
          message_length?: number | null
          output_tokens?: number | null
          request_type: string
          response_length?: number | null
          response_time_ms?: number | null
          status?: string
          tool_execution_time_ms?: number | null
          tool_iterations?: number | null
          tools_error_count?: number | null
          tools_success_count?: number | null
          tools_used?: Json | null
          user_id: string
        }
        Update: {
          claude_api_time_ms?: number | null
          context_type?: string | null
          conversation_id?: string | null
          created_at?: string | null
          error_message?: string | null
          error_type?: string | null
          estimated_cost_cents?: number | null
          has_context?: boolean | null
          id?: string
          input_tokens?: number | null
          message_length?: number | null
          output_tokens?: number | null
          request_type?: string
          response_length?: number | null
          response_time_ms?: number | null
          status?: string
          tool_execution_time_ms?: number | null
          tool_iterations?: number | null
          tools_error_count?: number | null
          tools_success_count?: number | null
          tools_used?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "copilot_analytics_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "copilot_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      copilot_conversations: {
        Row: {
          created_at: string | null
          id: string
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      copilot_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          metadata: Json | null
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "copilot_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "copilot_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_rates: {
        Row: {
          created_at: string | null
          effective_from: string | null
          effective_to: string | null
          id: string
          input_cost_per_million: number
          model: string
          output_cost_per_million: number
          provider: string
        }
        Insert: {
          created_at?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          input_cost_per_million: number
          model: string
          output_cost_per_million: number
          provider: string
        }
        Update: {
          created_at?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          input_cost_per_million?: number
          model?: string
          output_cost_per_million?: number
          provider?: string
        }
        Relationships: []
      }
      cron_job_logs: {
        Row: {
          created_at: string | null
          error_details: string | null
          id: string
          job_name: string
          message: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          error_details?: string | null
          id?: string
          job_name: string
          message?: string | null
          status: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          error_details?: string | null
          id?: string
          job_name?: string
          message?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      csv_mapping_templates: {
        Row: {
          column_mappings: Json
          created_at: string | null
          description: string | null
          id: string
          last_used_at: string | null
          name: string
          source_hint: string | null
          updated_at: string | null
          usage_count: number | null
          user_id: string
        }
        Insert: {
          column_mappings?: Json
          created_at?: string | null
          description?: string | null
          id?: string
          last_used_at?: string | null
          name: string
          source_hint?: string | null
          updated_at?: string | null
          usage_count?: number | null
          user_id: string
        }
        Update: {
          column_mappings?: Json
          created_at?: string | null
          description?: string | null
          id?: string
          last_used_at?: string | null
          name?: string
          source_hint?: string | null
          updated_at?: string | null
          usage_count?: number | null
          user_id?: string
        }
        Relationships: []
      }
      deal_activities: {
        Row: {
          activity_id: string | null
          activity_type: string
          completed: boolean | null
          contact_email: string | null
          created_at: string | null
          deal_id: string | null
          due_date: string | null
          id: string
          is_matched: boolean | null
          notes: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          activity_id?: string | null
          activity_type: string
          completed?: boolean | null
          contact_email?: string | null
          created_at?: string | null
          deal_id?: string | null
          due_date?: string | null
          id?: string
          is_matched?: boolean | null
          notes?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          activity_id?: string | null
          activity_type?: string
          completed?: boolean | null
          contact_email?: string | null
          created_at?: string | null
          deal_id?: string | null
          due_date?: string | null
          id?: string
          is_matched?: boolean | null
          notes?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_activities_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_activities_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities_with_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_health_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          action_priority: string | null
          alert_type: string
          created_at: string | null
          deal_id: string
          dismissed_at: string | null
          health_score_id: string | null
          id: string
          message: string
          metadata: Json | null
          notification_id: string | null
          notification_sent: boolean | null
          notification_sent_at: string | null
          resolved_at: string | null
          severity: string | null
          status: string | null
          suggested_actions: string[] | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          action_priority?: string | null
          alert_type: string
          created_at?: string | null
          deal_id: string
          dismissed_at?: string | null
          health_score_id?: string | null
          id?: string
          message: string
          metadata?: Json | null
          notification_id?: string | null
          notification_sent?: boolean | null
          notification_sent_at?: string | null
          resolved_at?: string | null
          severity?: string | null
          status?: string | null
          suggested_actions?: string[] | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          action_priority?: string | null
          alert_type?: string
          created_at?: string | null
          deal_id?: string
          dismissed_at?: string | null
          health_score_id?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          notification_id?: string | null
          notification_sent?: boolean | null
          notification_sent_at?: string | null
          resolved_at?: string | null
          severity?: string | null
          status?: string | null
          suggested_actions?: string[] | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_health_alerts_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_health_alerts_health_score_id_fkey"
            columns: ["health_score_id"]
            isOneToOne: false
            referencedRelation: "deal_health_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_health_history: {
        Row: {
          activity_score: number | null
          created_at: string | null
          deal_id: string
          engagement_score: number | null
          id: string
          overall_health_score: number | null
          sentiment_score: number | null
          snapshot_at: string | null
          stage_velocity_score: number | null
        }
        Insert: {
          activity_score?: number | null
          created_at?: string | null
          deal_id: string
          engagement_score?: number | null
          id?: string
          overall_health_score?: number | null
          sentiment_score?: number | null
          snapshot_at?: string | null
          stage_velocity_score?: number | null
        }
        Update: {
          activity_score?: number | null
          created_at?: string | null
          deal_id?: string
          engagement_score?: number | null
          id?: string
          overall_health_score?: number | null
          sentiment_score?: number | null
          snapshot_at?: string | null
          stage_velocity_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_health_history_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_health_rules: {
        Row: {
          alert_message_template: string | null
          alert_severity: string | null
          conditions: Json | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_system_rule: boolean | null
          rule_name: string
          rule_type: string
          suggested_action_template: string | null
          threshold_operator: string | null
          threshold_unit: string | null
          threshold_value: number
          updated_at: string | null
        }
        Insert: {
          alert_message_template?: string | null
          alert_severity?: string | null
          conditions?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_system_rule?: boolean | null
          rule_name: string
          rule_type: string
          suggested_action_template?: string | null
          threshold_operator?: string | null
          threshold_unit?: string | null
          threshold_value: number
          updated_at?: string | null
        }
        Update: {
          alert_message_template?: string | null
          alert_severity?: string | null
          conditions?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_system_rule?: boolean | null
          rule_name?: string
          rule_type?: string
          suggested_action_template?: string | null
          threshold_operator?: string | null
          threshold_unit?: string | null
          threshold_value?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      deal_health_scores: {
        Row: {
          activity_count_last_30_days: number | null
          activity_score: number | null
          avg_response_time_hours: number | null
          avg_sentiment_last_3_meetings: number | null
          created_at: string | null
          days_in_current_stage: number | null
          days_since_last_activity: number | null
          days_since_last_meeting: number | null
          deal_id: string
          engagement_score: number | null
          health_status: string | null
          id: string
          last_calculated_at: string | null
          meeting_count_last_30_days: number | null
          overall_health_score: number | null
          predicted_close_probability: number | null
          predicted_days_to_close: number | null
          response_time_score: number | null
          risk_factors: string[] | null
          risk_level: string | null
          sentiment_score: number | null
          sentiment_trend: string | null
          stage_velocity_score: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          activity_count_last_30_days?: number | null
          activity_score?: number | null
          avg_response_time_hours?: number | null
          avg_sentiment_last_3_meetings?: number | null
          created_at?: string | null
          days_in_current_stage?: number | null
          days_since_last_activity?: number | null
          days_since_last_meeting?: number | null
          deal_id: string
          engagement_score?: number | null
          health_status?: string | null
          id?: string
          last_calculated_at?: string | null
          meeting_count_last_30_days?: number | null
          overall_health_score?: number | null
          predicted_close_probability?: number | null
          predicted_days_to_close?: number | null
          response_time_score?: number | null
          risk_factors?: string[] | null
          risk_level?: string | null
          sentiment_score?: number | null
          sentiment_trend?: string | null
          stage_velocity_score?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          activity_count_last_30_days?: number | null
          activity_score?: number | null
          avg_response_time_hours?: number | null
          avg_sentiment_last_3_meetings?: number | null
          created_at?: string | null
          days_in_current_stage?: number | null
          days_since_last_activity?: number | null
          days_since_last_meeting?: number | null
          deal_id?: string
          engagement_score?: number | null
          health_status?: string | null
          id?: string
          last_calculated_at?: string | null
          meeting_count_last_30_days?: number | null
          overall_health_score?: number | null
          predicted_close_probability?: number | null
          predicted_days_to_close?: number | null
          response_time_score?: number | null
          risk_factors?: string[] | null
          risk_level?: string | null
          sentiment_score?: number | null
          sentiment_trend?: string | null
          stage_velocity_score?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_health_scores_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: true
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_migration_reviews: {
        Row: {
          created_at: string | null
          deal_id: string
          id: string
          original_company: string | null
          original_contact_email: string | null
          original_contact_name: string | null
          reason: string
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string | null
          suggested_company_id: string | null
          suggested_contact_id: string | null
        }
        Insert: {
          created_at?: string | null
          deal_id: string
          id?: string
          original_company?: string | null
          original_contact_email?: string | null
          original_contact_name?: string | null
          reason: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
          suggested_company_id?: string | null
          suggested_contact_id?: string | null
        }
        Update: {
          created_at?: string | null
          deal_id?: string
          id?: string
          original_company?: string | null
          original_contact_email?: string | null
          original_contact_name?: string | null
          reason?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
          suggested_company_id?: string | null
          suggested_contact_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_migration_reviews_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_migration_reviews_suggested_company_id_fkey"
            columns: ["suggested_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_migration_reviews_suggested_contact_id_fkey"
            columns: ["suggested_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_notes: {
        Row: {
          clerk_org_id: string | null
          content: string
          created_at: string | null
          created_by: string
          deal_id: string
          id: string
          is_pinned: boolean | null
          tags: string[] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          clerk_org_id?: string | null
          content: string
          created_at?: string | null
          created_by: string
          deal_id: string
          id?: string
          is_pinned?: boolean | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          clerk_org_id?: string | null
          content?: string
          created_at?: string | null
          created_by?: string
          deal_id?: string
          id?: string
          is_pinned?: boolean | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_notes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_splits: {
        Row: {
          amount: number
          clerk_org_id: string | null
          created_at: string | null
          deal_id: string
          id: string
          notes: string | null
          percentage: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount?: number
          clerk_org_id?: string | null
          created_at?: string | null
          deal_id: string
          id?: string
          notes?: string | null
          percentage: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          clerk_org_id?: string | null
          created_at?: string | null
          deal_id?: string
          id?: string
          notes?: string | null
          percentage?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_splits_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_splits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "activities_with_profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "deal_splits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "deal_activities_with_profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "deal_splits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_splits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_meeting_analytics"
            referencedColumns: ["user_id"]
          },
        ]
      }
      deal_stage_history: {
        Row: {
          deal_id: string
          duration_seconds: number | null
          entered_at: string | null
          exited_at: string | null
          id: string
          stage_id: string
          user_id: string
        }
        Insert: {
          deal_id: string
          duration_seconds?: number | null
          entered_at?: string | null
          exited_at?: string | null
          id?: string
          stage_id: string
          user_id: string
        }
        Update: {
          deal_id?: string
          duration_seconds?: number | null
          entered_at?: string | null
          exited_at?: string | null
          id?: string
          stage_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_stage_history_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_stage_history_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "deal_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_stages: {
        Row: {
          color: string
          created_at: string | null
          default_probability: number
          description: string | null
          id: string
          name: string
          order_position: number
          updated_at: string | null
        }
        Insert: {
          color: string
          created_at?: string | null
          default_probability: number
          description?: string | null
          id?: string
          name: string
          order_position: number
          updated_at?: string | null
        }
        Update: {
          color?: string
          created_at?: string | null
          default_probability?: number
          description?: string | null
          id?: string
          name?: string
          order_position?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      deals: {
        Row: {
          annual_value: number | null
          clerk_org_id: string | null
          close_date: string | null
          closed_lost_date: string | null
          closed_won_date: string | null
          company: string
          company_id: string | null
          contact_email: string | null
          contact_identifier: string | null
          contact_identifier_type: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          deal_size: string | null
          description: string | null
          expected_close_date: string | null
          first_meeting_date: string | null
          health_score: number | null
          id: string
          lead_source_channel: string | null
          lead_source_type: string | null
          momentum_score: number | null
          monthly_mrr: number | null
          name: string
          next_steps: string | null
          notes: string | null
          one_off_revenue: number | null
          opportunity_date: string | null
          owner_id: string
          primary_contact_id: string | null
          priority: string | null
          probability: number | null
          risk_level: string | null
          savvycal_booking_id: string | null
          savvycal_link_id: string | null
          sql_date: string | null
          stage_changed_at: string | null
          stage_id: string
          stage_migration_notes: string | null
          status: string | null
          updated_at: string | null
          value: number
          verbal_date: string | null
        }
        Insert: {
          annual_value?: number | null
          clerk_org_id?: string | null
          close_date?: string | null
          closed_lost_date?: string | null
          closed_won_date?: string | null
          company: string
          company_id?: string | null
          contact_email?: string | null
          contact_identifier?: string | null
          contact_identifier_type?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          deal_size?: string | null
          description?: string | null
          expected_close_date?: string | null
          first_meeting_date?: string | null
          health_score?: number | null
          id?: string
          lead_source_channel?: string | null
          lead_source_type?: string | null
          momentum_score?: number | null
          monthly_mrr?: number | null
          name: string
          next_steps?: string | null
          notes?: string | null
          one_off_revenue?: number | null
          opportunity_date?: string | null
          owner_id: string
          primary_contact_id?: string | null
          priority?: string | null
          probability?: number | null
          risk_level?: string | null
          savvycal_booking_id?: string | null
          savvycal_link_id?: string | null
          sql_date?: string | null
          stage_changed_at?: string | null
          stage_id: string
          stage_migration_notes?: string | null
          status?: string | null
          updated_at?: string | null
          value: number
          verbal_date?: string | null
        }
        Update: {
          annual_value?: number | null
          clerk_org_id?: string | null
          close_date?: string | null
          closed_lost_date?: string | null
          closed_won_date?: string | null
          company?: string
          company_id?: string | null
          contact_email?: string | null
          contact_identifier?: string | null
          contact_identifier_type?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          deal_size?: string | null
          description?: string | null
          expected_close_date?: string | null
          first_meeting_date?: string | null
          health_score?: number | null
          id?: string
          lead_source_channel?: string | null
          lead_source_type?: string | null
          momentum_score?: number | null
          monthly_mrr?: number | null
          name?: string
          next_steps?: string | null
          notes?: string | null
          one_off_revenue?: number | null
          opportunity_date?: string | null
          owner_id?: string
          primary_contact_id?: string | null
          priority?: string | null
          probability?: number | null
          risk_level?: string | null
          savvycal_booking_id?: string | null
          savvycal_link_id?: string | null
          sql_date?: string | null
          stage_changed_at?: string | null
          stage_id?: string
          stage_migration_notes?: string | null
          status?: string | null
          updated_at?: string | null
          value?: number
          verbal_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "deal_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_deals_company_id"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      email_attachments: {
        Row: {
          content_id: string | null
          created_at: string | null
          email_id: string
          filename: string
          id: string
          is_inline: boolean | null
          mime_type: string
          size_bytes: number
          storage_url: string | null
        }
        Insert: {
          content_id?: string | null
          created_at?: string | null
          email_id: string
          filename: string
          id?: string
          is_inline?: boolean | null
          mime_type: string
          size_bytes: number
          storage_url?: string | null
        }
        Update: {
          content_id?: string | null
          created_at?: string | null
          email_id?: string
          filename?: string
          id?: string
          is_inline?: boolean | null
          mime_type?: string
          size_bytes?: number
          storage_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_attachments_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "emails"
            referencedColumns: ["id"]
          },
        ]
      }
      email_label_map: {
        Row: {
          created_at: string | null
          email_id: string
          label_id: string
        }
        Insert: {
          created_at?: string | null
          email_id: string
          label_id: string
        }
        Update: {
          created_at?: string | null
          email_id?: string
          label_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_label_map_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_label_map_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "email_labels"
            referencedColumns: ["id"]
          },
        ]
      }
      email_labels: {
        Row: {
          color: string | null
          created_at: string | null
          icon: string | null
          id: string
          name: string
          position: number | null
          type: string | null
          user_id: string
          visibility: boolean | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          name: string
          position?: number | null
          type?: string | null
          user_id: string
          visibility?: boolean | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          name?: string
          position?: number | null
          type?: string | null
          user_id?: string
          visibility?: boolean | null
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body_html: string
          body_text: string | null
          category: string | null
          created_at: string | null
          id: string
          is_public: boolean | null
          name: string
          subject: string
          updated_at: string | null
          usage_count: number | null
          user_id: string
          variables: Json | null
        }
        Insert: {
          body_html: string
          body_text?: string | null
          category?: string | null
          created_at?: string | null
          id?: string
          is_public?: boolean | null
          name: string
          subject: string
          updated_at?: string | null
          usage_count?: number | null
          user_id: string
          variables?: Json | null
        }
        Update: {
          body_html?: string
          body_text?: string | null
          category?: string | null
          created_at?: string | null
          id?: string
          is_public?: boolean | null
          name?: string
          subject?: string
          updated_at?: string | null
          usage_count?: number | null
          user_id?: string
          variables?: Json | null
        }
        Relationships: []
      }
      email_threads: {
        Row: {
          created_at: string | null
          id: string
          is_archived: boolean | null
          is_important: boolean | null
          is_read: boolean | null
          is_starred: boolean | null
          last_message_at: string
          message_count: number | null
          participants: Json
          subject: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_archived?: boolean | null
          is_important?: boolean | null
          is_read?: boolean | null
          is_starred?: boolean | null
          last_message_at?: string
          message_count?: number | null
          participants?: Json
          subject: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_archived?: boolean | null
          is_important?: boolean | null
          is_read?: boolean | null
          is_starred?: boolean | null
          last_message_at?: string
          message_count?: number | null
          participants?: Json
          subject?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      emails: {
        Row: {
          ai_action_required: boolean | null
          ai_category: string | null
          ai_priority: number | null
          ai_sentiment: string | null
          ai_summary: string | null
          attachments_count: number | null
          bcc_emails: Json | null
          body_html: string | null
          body_text: string | null
          cc_emails: Json | null
          created_at: string | null
          external_id: string | null
          from_email: string
          from_name: string | null
          headers: Json | null
          id: string
          is_archived: boolean | null
          is_draft: boolean | null
          is_read: boolean | null
          is_sent: boolean | null
          is_starred: boolean | null
          is_trash: boolean | null
          labels: Json | null
          mcp_connection_id: string | null
          received_at: string | null
          sent_at: string | null
          subject: string | null
          thread_id: string | null
          to_emails: Json
          updated_at: string | null
          user_id: string
          workflow_metadata: Json | null
        }
        Insert: {
          ai_action_required?: boolean | null
          ai_category?: string | null
          ai_priority?: number | null
          ai_sentiment?: string | null
          ai_summary?: string | null
          attachments_count?: number | null
          bcc_emails?: Json | null
          body_html?: string | null
          body_text?: string | null
          cc_emails?: Json | null
          created_at?: string | null
          external_id?: string | null
          from_email: string
          from_name?: string | null
          headers?: Json | null
          id?: string
          is_archived?: boolean | null
          is_draft?: boolean | null
          is_read?: boolean | null
          is_sent?: boolean | null
          is_starred?: boolean | null
          is_trash?: boolean | null
          labels?: Json | null
          mcp_connection_id?: string | null
          received_at?: string | null
          sent_at?: string | null
          subject?: string | null
          thread_id?: string | null
          to_emails?: Json
          updated_at?: string | null
          user_id: string
          workflow_metadata?: Json | null
        }
        Update: {
          ai_action_required?: boolean | null
          ai_category?: string | null
          ai_priority?: number | null
          ai_sentiment?: string | null
          ai_summary?: string | null
          attachments_count?: number | null
          bcc_emails?: Json | null
          body_html?: string | null
          body_text?: string | null
          cc_emails?: Json | null
          created_at?: string | null
          external_id?: string | null
          from_email?: string
          from_name?: string | null
          headers?: Json | null
          id?: string
          is_archived?: boolean | null
          is_draft?: boolean | null
          is_read?: boolean | null
          is_sent?: boolean | null
          is_starred?: boolean | null
          is_trash?: boolean | null
          labels?: Json | null
          mcp_connection_id?: string | null
          received_at?: string | null
          sent_at?: string | null
          subject?: string | null
          thread_id?: string | null
          to_emails?: Json
          updated_at?: string | null
          user_id?: string
          workflow_metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "emails_mcp_connection_id_fkey"
            columns: ["mcp_connection_id"]
            isOneToOne: false
            referencedRelation: "mcp_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "email_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      execution_checkpoints: {
        Row: {
          can_resume: boolean | null
          checkpoint_name: string
          created_at: string | null
          execution_id: string
          id: string
          node_id: string
          node_outputs: Json | null
          state: Json
          variables: Json | null
          workflow_id: string
        }
        Insert: {
          can_resume?: boolean | null
          checkpoint_name: string
          created_at?: string | null
          execution_id: string
          id?: string
          node_id: string
          node_outputs?: Json | null
          state?: Json
          variables?: Json | null
          workflow_id: string
        }
        Update: {
          can_resume?: boolean | null
          checkpoint_name?: string
          created_at?: string | null
          execution_id?: string
          id?: string
          node_id?: string
          node_outputs?: Json | null
          state?: Json
          variables?: Json | null
          workflow_id?: string
        }
        Relationships: []
      }
      execution_snapshots: {
        Row: {
          cpu_time: number | null
          error_details: Json | null
          execution_id: string
          http_requests: Json | null
          id: string
          memory_usage: number | null
          node_id: string
          node_outputs: Json | null
          sequence_number: number
          snapshot_type: string | null
          state: Json
          timestamp: string | null
          variables: Json | null
          workflow_id: string
        }
        Insert: {
          cpu_time?: number | null
          error_details?: Json | null
          execution_id: string
          http_requests?: Json | null
          id?: string
          memory_usage?: number | null
          node_id: string
          node_outputs?: Json | null
          sequence_number: number
          snapshot_type?: string | null
          state?: Json
          timestamp?: string | null
          variables?: Json | null
          workflow_id: string
        }
        Update: {
          cpu_time?: number | null
          error_details?: Json | null
          execution_id?: string
          http_requests?: Json | null
          id?: string
          memory_usage?: number | null
          node_id?: string
          node_outputs?: Json | null
          sequence_number?: number
          snapshot_type?: string | null
          state?: Json
          timestamp?: string | null
          variables?: Json | null
          workflow_id?: string
        }
        Relationships: []
      }
      fathom_integrations: {
        Row: {
          access_token: string
          created_at: string | null
          fathom_user_email: string | null
          fathom_user_id: string | null
          id: string
          is_active: boolean | null
          last_sync_at: string | null
          refresh_token: string
          scopes: string[] | null
          token_expires_at: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string | null
          fathom_user_email?: string | null
          fathom_user_id?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          refresh_token: string
          scopes?: string[] | null
          token_expires_at: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string | null
          fathom_user_email?: string | null
          fathom_user_id?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          refresh_token?: string
          scopes?: string[] | null
          token_expires_at?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      fathom_oauth_states: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          state: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          state: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      fathom_sync_state: {
        Row: {
          created_at: string | null
          cursor_position: string | null
          error_count: number | null
          id: string
          integration_id: string
          last_error_at: string | null
          last_successful_sync: string | null
          last_sync_completed_at: string | null
          last_sync_error: string | null
          last_sync_started_at: string | null
          meetings_synced: number | null
          sync_date_range_end: string | null
          sync_date_range_start: string | null
          sync_status: string
          total_meetings_found: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          cursor_position?: string | null
          error_count?: number | null
          id?: string
          integration_id: string
          last_error_at?: string | null
          last_successful_sync?: string | null
          last_sync_completed_at?: string | null
          last_sync_error?: string | null
          last_sync_started_at?: string | null
          meetings_synced?: number | null
          sync_date_range_end?: string | null
          sync_date_range_start?: string | null
          sync_status?: string
          total_meetings_found?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          cursor_position?: string | null
          error_count?: number | null
          id?: string
          integration_id?: string
          last_error_at?: string | null
          last_successful_sync?: string | null
          last_sync_completed_at?: string | null
          last_sync_error?: string | null
          last_sync_started_at?: string | null
          meetings_synced?: number | null
          sync_date_range_end?: string | null
          sync_date_range_start?: string | null
          sync_status?: string
          total_meetings_found?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fathom_sync_state_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: true
            referencedRelation: "fathom_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      fathom_transcript_retry_jobs: {
        Row: {
          attempt_count: number
          completed_at: string | null
          created_at: string
          id: string
          last_error: string | null
          max_attempts: number
          meeting_id: string
          next_retry_at: string
          recording_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempt_count?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          meeting_id: string
          next_retry_at: string
          recording_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempt_count?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          meeting_id?: string
          next_retry_at?: string
          recording_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fathom_transcript_retry_jobs_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      ghost_detection_signals: {
        Row: {
          created_at: string | null
          detected_at: string | null
          id: string
          metadata: Json | null
          relationship_health_id: string
          resolved_at: string | null
          severity: string
          signal_context: string | null
          signal_data: Json | null
          signal_type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          detected_at?: string | null
          id?: string
          metadata?: Json | null
          relationship_health_id: string
          resolved_at?: string | null
          severity: string
          signal_context?: string | null
          signal_data?: Json | null
          signal_type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          detected_at?: string | null
          id?: string
          metadata?: Json | null
          relationship_health_id?: string
          resolved_at?: string | null
          severity?: string
          signal_context?: string | null
          signal_data?: Json | null
          signal_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ghost_detection_signals_relationship_health_id_fkey"
            columns: ["relationship_health_id"]
            isOneToOne: false
            referencedRelation: "relationship_health_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      global_topic_sources: {
        Row: {
          company_id: string | null
          contact_id: string | null
          created_at: string
          fathom_url: string | null
          global_topic_id: string
          id: string
          meeting_date: string | null
          meeting_id: string
          similarity_score: number
          timestamp_seconds: number | null
          topic_description: string | null
          topic_index: number
          topic_title: string
        }
        Insert: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          fathom_url?: string | null
          global_topic_id: string
          id?: string
          meeting_date?: string | null
          meeting_id: string
          similarity_score?: number
          timestamp_seconds?: number | null
          topic_description?: string | null
          topic_index: number
          topic_title: string
        }
        Update: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          fathom_url?: string | null
          global_topic_id?: string
          id?: string
          meeting_date?: string | null
          meeting_id?: string
          similarity_score?: number
          timestamp_seconds?: number | null
          topic_description?: string | null
          topic_index?: number
          topic_title?: string
        }
        Relationships: [
          {
            foreignKeyName: "global_topic_sources_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "global_topic_sources_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "global_topic_sources_global_topic_id_fkey"
            columns: ["global_topic_id"]
            isOneToOne: false
            referencedRelation: "global_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "global_topic_sources_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      global_topics: {
        Row: {
          canonical_description: string | null
          canonical_title: string
          created_at: string
          deleted_at: string | null
          first_seen_at: string
          frequency_score: number
          id: string
          is_archived: boolean
          last_seen_at: string
          recency_score: number
          relevance_score: number
          source_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          canonical_description?: string | null
          canonical_title: string
          created_at?: string
          deleted_at?: string | null
          first_seen_at?: string
          frequency_score?: number
          id?: string
          is_archived?: boolean
          last_seen_at?: string
          recency_score?: number
          relevance_score?: number
          source_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          canonical_description?: string | null
          canonical_title?: string
          created_at?: string
          deleted_at?: string | null
          first_seen_at?: string
          frequency_score?: number
          id?: string
          is_archived?: boolean
          last_seen_at?: string
          recency_score?: number
          relevance_score?: number
          source_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      google_calendars: {
        Row: {
          access_role: string | null
          calendar_id: string
          color_id: string | null
          created_at: string | null
          description: string | null
          id: string
          integration_id: string
          is_primary: boolean | null
          name: string
          time_zone: string | null
          updated_at: string | null
        }
        Insert: {
          access_role?: string | null
          calendar_id: string
          color_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          integration_id: string
          is_primary?: boolean | null
          name: string
          time_zone?: string | null
          updated_at?: string | null
        }
        Update: {
          access_role?: string | null
          calendar_id?: string
          color_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          integration_id?: string
          is_primary?: boolean | null
          name?: string
          time_zone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_calendars_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "google_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      google_docs_templates: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_global: boolean | null
          name: string
          template_content: Json
          template_type: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_global?: boolean | null
          name: string
          template_content: Json
          template_type: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_global?: boolean | null
          name?: string
          template_content?: Json
          template_type?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      google_drive_folders: {
        Row: {
          created_at: string | null
          folder_id: string
          id: string
          integration_id: string
          mime_type: string | null
          name: string
          parent_id: string | null
          path: string | null
          updated_at: string | null
          web_view_link: string | null
        }
        Insert: {
          created_at?: string | null
          folder_id: string
          id?: string
          integration_id: string
          mime_type?: string | null
          name: string
          parent_id?: string | null
          path?: string | null
          updated_at?: string | null
          web_view_link?: string | null
        }
        Update: {
          created_at?: string | null
          folder_id?: string
          id?: string
          integration_id?: string
          mime_type?: string | null
          name?: string
          parent_id?: string | null
          path?: string | null
          updated_at?: string | null
          web_view_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_drive_folders_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "google_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      google_email_labels: {
        Row: {
          created_at: string | null
          id: string
          integration_id: string
          label_id: string
          label_list_visibility: string | null
          message_list_visibility: string | null
          name: string
          type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          integration_id: string
          label_id: string
          label_list_visibility?: string | null
          message_list_visibility?: string | null
          name: string
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          integration_id?: string
          label_id?: string
          label_list_visibility?: string | null
          message_list_visibility?: string | null
          name?: string
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_email_labels_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "google_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      google_integrations: {
        Row: {
          access_token: string
          clerk_org_id: string | null
          created_at: string | null
          email: string
          expires_at: string | null
          id: string
          is_active: boolean | null
          refresh_token: string | null
          scopes: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          clerk_org_id?: string | null
          created_at?: string | null
          email: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          refresh_token?: string | null
          scopes: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          clerk_org_id?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          refresh_token?: string | null
          scopes?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      google_oauth_states: {
        Row: {
          code_challenge: string
          code_verifier: string
          created_at: string | null
          expires_at: string
          id: string
          redirect_uri: string
          state: string
          user_id: string
        }
        Insert: {
          code_challenge: string
          code_verifier: string
          created_at?: string | null
          expires_at?: string
          id?: string
          redirect_uri: string
          state: string
          user_id: string
        }
        Update: {
          code_challenge?: string
          code_verifier?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          redirect_uri?: string
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      google_service_logs: {
        Row: {
          action: string
          created_at: string | null
          error_message: string | null
          id: string
          integration_id: string | null
          request_data: Json | null
          response_data: Json | null
          service: string
          status: string
        }
        Insert: {
          action: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          integration_id?: string | null
          request_data?: Json | null
          response_data?: Json | null
          service: string
          status: string
        }
        Update: {
          action?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          integration_id?: string | null
          request_data?: Json | null
          response_data?: Json | null
          service?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_service_logs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "google_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      google_task_lists: {
        Row: {
          created_at: string | null
          etag: string | null
          google_list_id: string
          id: string
          integration_id: string | null
          is_default: boolean | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          etag?: string | null
          google_list_id: string
          id?: string
          integration_id?: string | null
          is_default?: boolean | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          etag?: string | null
          google_list_id?: string
          id?: string
          integration_id?: string | null
          is_default?: boolean | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_task_lists_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "google_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      google_task_mappings: {
        Row: {
          created_at: string | null
          etag: string | null
          google_list_id: string
          google_task_id: string
          id: string
          sync_direction: string | null
          task_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          etag?: string | null
          google_list_id: string
          google_task_id: string
          id?: string
          sync_direction?: string | null
          task_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          etag?: string | null
          google_list_id?: string
          google_task_id?: string
          id?: string
          sync_direction?: string | null
          task_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_task_mappings_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      google_tasks_list_configs: {
        Row: {
          auto_create_in_list: boolean | null
          created_at: string | null
          display_order: number | null
          google_list_id: string
          id: string
          is_primary: boolean | null
          list_title: string
          priority_filter: string[] | null
          status_filter: string[] | null
          sync_direction: string
          sync_enabled: boolean | null
          task_categories: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auto_create_in_list?: boolean | null
          created_at?: string | null
          display_order?: number | null
          google_list_id: string
          id?: string
          is_primary?: boolean | null
          list_title: string
          priority_filter?: string[] | null
          status_filter?: string[] | null
          sync_direction?: string
          sync_enabled?: boolean | null
          task_categories?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auto_create_in_list?: boolean | null
          created_at?: string | null
          display_order?: number | null
          google_list_id?: string
          id?: string
          is_primary?: boolean | null
          list_title?: string
          priority_filter?: string[] | null
          status_filter?: string[] | null
          sync_direction?: string
          sync_enabled?: boolean | null
          task_categories?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      google_tasks_sync_conflicts: {
        Row: {
          conflict_type: string
          created_at: string | null
          google_data: Json | null
          google_list_id: string | null
          google_task_id: string | null
          id: string
          local_data: Json | null
          resolution_notes: string | null
          resolved: boolean | null
          resolved_at: string | null
          task_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          conflict_type: string
          created_at?: string | null
          google_data?: Json | null
          google_list_id?: string | null
          google_task_id?: string | null
          id?: string
          local_data?: Json | null
          resolution_notes?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          task_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          conflict_type?: string
          created_at?: string | null
          google_data?: Json | null
          google_list_id?: string | null
          google_task_id?: string | null
          id?: string
          local_data?: Json | null
          resolution_notes?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          task_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_tasks_sync_conflicts_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      google_tasks_sync_status: {
        Row: {
          conflicts_count: number | null
          created_at: string | null
          error_message: string | null
          id: string
          last_full_sync_at: string | null
          last_incremental_sync_at: string | null
          selected_list_id: string | null
          selected_list_title: string | null
          sync_state: string | null
          tasks_synced_count: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          conflicts_count?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          last_full_sync_at?: string | null
          last_incremental_sync_at?: string | null
          selected_list_id?: string | null
          selected_list_title?: string | null
          sync_state?: string | null
          tasks_synced_count?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          conflicts_count?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          last_full_sync_at?: string | null
          last_incremental_sync_at?: string | null
          selected_list_id?: string | null
          selected_list_title?: string | null
          sync_state?: string | null
          tasks_synced_count?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      http_request_recordings: {
        Row: {
          body: Json | null
          error: string | null
          execution_id: string
          headers: Json | null
          id: string
          method: string
          node_id: string
          recorded_at: string | null
          request_sequence: number
          response_body: Json | null
          response_headers: Json | null
          response_status: number | null
          response_time_ms: number | null
          url: string
          workflow_id: string
        }
        Insert: {
          body?: Json | null
          error?: string | null
          execution_id: string
          headers?: Json | null
          id?: string
          method: string
          node_id: string
          recorded_at?: string | null
          request_sequence: number
          response_body?: Json | null
          response_headers?: Json | null
          response_status?: number | null
          response_time_ms?: number | null
          url: string
          workflow_id: string
        }
        Update: {
          body?: Json | null
          error?: string | null
          execution_id?: string
          headers?: Json | null
          id?: string
          method?: string
          node_id?: string
          recorded_at?: string | null
          request_sequence?: number
          response_body?: Json | null
          response_headers?: Json | null
          response_status?: number | null
          response_time_ms?: number | null
          url?: string
          workflow_id?: string
        }
        Relationships: []
      }
      impersonation_logs: {
        Row: {
          action: string
          admin_email: string
          admin_id: string
          created_at: string | null
          id: string
          metadata: Json | null
          target_user_email: string
          target_user_id: string
        }
        Insert: {
          action: string
          admin_email: string
          admin_id: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          target_user_email: string
          target_user_id: string
        }
        Update: {
          action?: string
          admin_email?: string
          admin_id?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          target_user_email?: string
          target_user_id?: string
        }
        Relationships: []
      }
      internal_email_domains: {
        Row: {
          created_at: string | null
          domain: string
          id: string
          is_active: boolean | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          domain: string
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          domain?: string
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      internal_users: {
        Row: {
          added_by: string | null
          created_at: string | null
          email: string
          id: string
          is_active: boolean | null
          name: string | null
          reason: string | null
          updated_at: string | null
        }
        Insert: {
          added_by?: string | null
          created_at?: string | null
          email: string
          id?: string
          is_active?: boolean | null
          name?: string | null
          reason?: string | null
          updated_at?: string | null
        }
        Update: {
          added_by?: string | null
          created_at?: string | null
          email?: string
          id?: string
          is_active?: boolean | null
          name?: string | null
          reason?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      intervention_templates: {
        Row: {
          avg_response_time_hours: number | null
          best_performing_deal_stage: string | null
          best_performing_industry: string | null
          best_performing_persona: string | null
          context_trigger: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_control_variant: boolean | null
          is_system_template: boolean | null
          last_used_at: string | null
          parent_template_id: string | null
          performance_by_segment: Json | null
          personalization_fields: Json | null
          recommended_timing: string | null
          recovery_rate_percent: number | null
          response_rate_percent: number | null
          subject_line: string | null
          tags: string[] | null
          template_body: string
          template_name: string
          template_type: string
          times_clicked: number | null
          times_opened: number | null
          times_recovered: number | null
          times_replied: number | null
          times_sent: number | null
          updated_at: string | null
          usage_notes: string | null
          user_id: string | null
          variant_name: string | null
        }
        Insert: {
          avg_response_time_hours?: number | null
          best_performing_deal_stage?: string | null
          best_performing_industry?: string | null
          best_performing_persona?: string | null
          context_trigger: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_control_variant?: boolean | null
          is_system_template?: boolean | null
          last_used_at?: string | null
          parent_template_id?: string | null
          performance_by_segment?: Json | null
          personalization_fields?: Json | null
          recommended_timing?: string | null
          recovery_rate_percent?: number | null
          response_rate_percent?: number | null
          subject_line?: string | null
          tags?: string[] | null
          template_body: string
          template_name: string
          template_type: string
          times_clicked?: number | null
          times_opened?: number | null
          times_recovered?: number | null
          times_replied?: number | null
          times_sent?: number | null
          updated_at?: string | null
          usage_notes?: string | null
          user_id?: string | null
          variant_name?: string | null
        }
        Update: {
          avg_response_time_hours?: number | null
          best_performing_deal_stage?: string | null
          best_performing_industry?: string | null
          best_performing_persona?: string | null
          context_trigger?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_control_variant?: boolean | null
          is_system_template?: boolean | null
          last_used_at?: string | null
          parent_template_id?: string | null
          performance_by_segment?: Json | null
          personalization_fields?: Json | null
          recommended_timing?: string | null
          recovery_rate_percent?: number | null
          response_rate_percent?: number | null
          subject_line?: string | null
          tags?: string[] | null
          template_body?: string
          template_name?: string
          template_type?: string
          times_clicked?: number | null
          times_opened?: number | null
          times_recovered?: number | null
          times_replied?: number | null
          times_sent?: number | null
          updated_at?: string | null
          usage_notes?: string | null
          user_id?: string | null
          variant_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intervention_templates_parent_template_id_fkey"
            columns: ["parent_template_id"]
            isOneToOne: false
            referencedRelation: "intervention_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      interventions: {
        Row: {
          ai_recommendation_score: number | null
          click_count: number | null
          clicked_at: string | null
          company_id: string | null
          contact_id: string | null
          context_trigger: string
          created_at: string | null
          days_since_last_contact: number | null
          deal_id: string | null
          delivered_at: string | null
          first_open_at: string | null
          health_score_at_send: number | null
          id: string
          intervention_body: string
          intervention_channel: string
          metadata: Json | null
          open_count: number | null
          opened_at: string | null
          outcome: string | null
          outcome_notes: string | null
          personalization_data: Json | null
          recovered_at: string | null
          relationship_health_id: string
          replied_at: string | null
          response_text: string | null
          response_type: string | null
          sent_at: string | null
          status: string
          subject_line: string | null
          suggested_reply: string | null
          template_id: string | null
          template_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ai_recommendation_score?: number | null
          click_count?: number | null
          clicked_at?: string | null
          company_id?: string | null
          contact_id?: string | null
          context_trigger: string
          created_at?: string | null
          days_since_last_contact?: number | null
          deal_id?: string | null
          delivered_at?: string | null
          first_open_at?: string | null
          health_score_at_send?: number | null
          id?: string
          intervention_body: string
          intervention_channel?: string
          metadata?: Json | null
          open_count?: number | null
          opened_at?: string | null
          outcome?: string | null
          outcome_notes?: string | null
          personalization_data?: Json | null
          recovered_at?: string | null
          relationship_health_id: string
          replied_at?: string | null
          response_text?: string | null
          response_type?: string | null
          sent_at?: string | null
          status?: string
          subject_line?: string | null
          suggested_reply?: string | null
          template_id?: string | null
          template_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ai_recommendation_score?: number | null
          click_count?: number | null
          clicked_at?: string | null
          company_id?: string | null
          contact_id?: string | null
          context_trigger?: string
          created_at?: string | null
          days_since_last_contact?: number | null
          deal_id?: string | null
          delivered_at?: string | null
          first_open_at?: string | null
          health_score_at_send?: number | null
          id?: string
          intervention_body?: string
          intervention_channel?: string
          metadata?: Json | null
          open_count?: number | null
          opened_at?: string | null
          outcome?: string | null
          outcome_notes?: string | null
          personalization_data?: Json | null
          recovered_at?: string | null
          relationship_health_id?: string
          replied_at?: string | null
          response_text?: string | null
          response_type?: string | null
          sent_at?: string | null
          status?: string
          subject_line?: string | null
          suggested_reply?: string | null
          template_id?: string | null
          template_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interventions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interventions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interventions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interventions_relationship_health_id_fkey"
            columns: ["relationship_health_id"]
            isOneToOne: false
            referencedRelation: "relationship_health_scores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interventions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "intervention_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_events: {
        Row: {
          created_at: string | null
          event_type: string
          external_id: string | null
          external_occured_at: string | null
          external_source: string
          id: string
          lead_id: string | null
          payload: Json
          payload_hash: string | null
          received_at: string | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          external_id?: string | null
          external_occured_at?: string | null
          external_source?: string
          id?: string
          lead_id?: string | null
          payload: Json
          payload_hash?: string | null
          received_at?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          external_id?: string | null
          external_occured_at?: string | null
          external_source?: string
          id?: string
          lead_id?: string | null
          payload?: Json
          payload_hash?: string | null
          received_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_prep_notes: {
        Row: {
          body: string
          clerk_org_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_auto_generated: boolean | null
          is_pinned: boolean | null
          lead_id: string
          metadata: Json | null
          note_type: string
          sort_order: number | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          body: string
          clerk_org_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_auto_generated?: boolean | null
          is_pinned?: boolean | null
          lead_id: string
          metadata?: Json | null
          note_type: string
          sort_order?: number | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          body?: string
          clerk_org_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_auto_generated?: boolean | null
          is_pinned?: boolean | null
          lead_id?: string
          metadata?: Json | null
          note_type?: string
          sort_order?: number | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_prep_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_sources: {
        Row: {
          channel: string | null
          created_at: string | null
          default_owner_id: string | null
          description: string | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          name: string
          source_key: string
          updated_at: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          channel?: string | null
          created_at?: string | null
          default_owner_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name: string
          source_key: string
          updated_at?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          channel?: string | null
          created_at?: string | null
          default_owner_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name?: string
          source_key?: string
          updated_at?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_sources_default_owner_id_fkey"
            columns: ["default_owner_id"]
            isOneToOne: false
            referencedRelation: "activities_with_profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "lead_sources_default_owner_id_fkey"
            columns: ["default_owner_id"]
            isOneToOne: false
            referencedRelation: "deal_activities_with_profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "lead_sources_default_owner_id_fkey"
            columns: ["default_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_sources_default_owner_id_fkey"
            columns: ["default_owner_id"]
            isOneToOne: false
            referencedRelation: "team_meeting_analytics"
            referencedColumns: ["user_id"]
          },
        ]
      }
      leads: {
        Row: {
          attendee_count: number | null
          booking_link_id: string | null
          booking_link_name: string | null
          booking_link_slug: string | null
          booking_scope_slug: string | null
          clerk_org_id: string | null
          company_id: string | null
          conferencing_type: string | null
          conferencing_url: string | null
          contact_email: string | null
          contact_first_name: string | null
          contact_id: string | null
          contact_last_name: string | null
          contact_marketing_opt_in: boolean | null
          contact_name: string | null
          contact_phone: string | null
          contact_timezone: string | null
          converted_deal_id: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          domain: string | null
          enrichment_provider: string | null
          enrichment_status: string
          external_attendee_emails: string[] | null
          external_id: string | null
          external_occured_at: string | null
          external_source: string
          first_seen_at: string | null
          id: string
          meeting_description: string | null
          meeting_duration_minutes: number | null
          meeting_end: string | null
          meeting_start: string | null
          meeting_timezone: string | null
          meeting_title: string | null
          meeting_url: string | null
          metadata: Json | null
          owner_id: string | null
          prep_status: string
          prep_summary: string | null
          priority: string
          scheduler_email: string | null
          scheduler_name: string | null
          source_campaign: string | null
          source_channel: string | null
          source_id: string | null
          source_medium: string | null
          status: string
          tags: string[] | null
          updated_at: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          attendee_count?: number | null
          booking_link_id?: string | null
          booking_link_name?: string | null
          booking_link_slug?: string | null
          booking_scope_slug?: string | null
          clerk_org_id?: string | null
          company_id?: string | null
          conferencing_type?: string | null
          conferencing_url?: string | null
          contact_email?: string | null
          contact_first_name?: string | null
          contact_id?: string | null
          contact_last_name?: string | null
          contact_marketing_opt_in?: boolean | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_timezone?: string | null
          converted_deal_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          domain?: string | null
          enrichment_provider?: string | null
          enrichment_status?: string
          external_attendee_emails?: string[] | null
          external_id?: string | null
          external_occured_at?: string | null
          external_source?: string
          first_seen_at?: string | null
          id?: string
          meeting_description?: string | null
          meeting_duration_minutes?: number | null
          meeting_end?: string | null
          meeting_start?: string | null
          meeting_timezone?: string | null
          meeting_title?: string | null
          meeting_url?: string | null
          metadata?: Json | null
          owner_id?: string | null
          prep_status?: string
          prep_summary?: string | null
          priority?: string
          scheduler_email?: string | null
          scheduler_name?: string | null
          source_campaign?: string | null
          source_channel?: string | null
          source_id?: string | null
          source_medium?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          attendee_count?: number | null
          booking_link_id?: string | null
          booking_link_name?: string | null
          booking_link_slug?: string | null
          booking_scope_slug?: string | null
          clerk_org_id?: string | null
          company_id?: string | null
          conferencing_type?: string | null
          conferencing_url?: string | null
          contact_email?: string | null
          contact_first_name?: string | null
          contact_id?: string | null
          contact_last_name?: string | null
          contact_marketing_opt_in?: boolean | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_timezone?: string | null
          converted_deal_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          domain?: string | null
          enrichment_provider?: string | null
          enrichment_status?: string
          external_attendee_emails?: string[] | null
          external_id?: string | null
          external_occured_at?: string | null
          external_source?: string
          first_seen_at?: string | null
          id?: string
          meeting_description?: string | null
          meeting_duration_minutes?: number | null
          meeting_end?: string | null
          meeting_start?: string | null
          meeting_timezone?: string | null
          meeting_title?: string | null
          meeting_url?: string | null
          metadata?: Json | null
          owner_id?: string | null
          prep_status?: string
          prep_summary?: string | null
          priority?: string
          scheduler_email?: string | null
          scheduler_name?: string | null
          source_campaign?: string | null
          source_channel?: string | null
          source_id?: string | null
          source_medium?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_converted_deal_id_fkey"
            columns: ["converted_deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "activities_with_profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "leads_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "deal_activities_with_profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "leads_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "team_meeting_analytics"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "leads_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_connections: {
        Row: {
          created_at: string | null
          credentials: Json
          id: string
          is_active: boolean | null
          last_sync: string | null
          service_type: string
          settings: Json | null
          sync_status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          credentials: Json
          id?: string
          is_active?: boolean | null
          last_sync?: string | null
          service_type: string
          settings?: Json | null
          sync_status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          credentials?: Json
          id?: string
          is_active?: boolean | null
          last_sync?: string | null
          service_type?: string
          settings?: Json | null
          sync_status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      meeting_action_items: {
        Row: {
          ai_analyzed_at: string | null
          ai_confidence: number | null
          ai_confidence_score: number | null
          ai_deadline: string | null
          ai_generated: boolean | null
          ai_reasoning: string | null
          ai_task_type: string | null
          assigned_to_email: string | null
          assigned_to_name: string | null
          assignee_email: string | null
          assignee_name: string | null
          category: string | null
          completed: boolean | null
          created_at: string | null
          deadline_at: string | null
          deadline_date: string | null
          id: string
          importance: string | null
          is_sales_rep_task: boolean | null
          linked_task_id: string | null
          meeting_id: string
          needs_review: boolean | null
          playback_url: string | null
          priority: string | null
          sync_error: string | null
          sync_status: string | null
          synced_at: string | null
          synced_to_task: boolean | null
          task_id: string | null
          timestamp_seconds: number | null
          title: string
          updated_at: string | null
        }
        Insert: {
          ai_analyzed_at?: string | null
          ai_confidence?: number | null
          ai_confidence_score?: number | null
          ai_deadline?: string | null
          ai_generated?: boolean | null
          ai_reasoning?: string | null
          ai_task_type?: string | null
          assigned_to_email?: string | null
          assigned_to_name?: string | null
          assignee_email?: string | null
          assignee_name?: string | null
          category?: string | null
          completed?: boolean | null
          created_at?: string | null
          deadline_at?: string | null
          deadline_date?: string | null
          id?: string
          importance?: string | null
          is_sales_rep_task?: boolean | null
          linked_task_id?: string | null
          meeting_id: string
          needs_review?: boolean | null
          playback_url?: string | null
          priority?: string | null
          sync_error?: string | null
          sync_status?: string | null
          synced_at?: string | null
          synced_to_task?: boolean | null
          task_id?: string | null
          timestamp_seconds?: number | null
          title: string
          updated_at?: string | null
        }
        Update: {
          ai_analyzed_at?: string | null
          ai_confidence?: number | null
          ai_confidence_score?: number | null
          ai_deadline?: string | null
          ai_generated?: boolean | null
          ai_reasoning?: string | null
          ai_task_type?: string | null
          assigned_to_email?: string | null
          assigned_to_name?: string | null
          assignee_email?: string | null
          assignee_name?: string | null
          category?: string | null
          completed?: boolean | null
          created_at?: string | null
          deadline_at?: string | null
          deadline_date?: string | null
          id?: string
          importance?: string | null
          is_sales_rep_task?: boolean | null
          linked_task_id?: string | null
          meeting_id?: string
          needs_review?: boolean | null
          playback_url?: string | null
          priority?: string | null
          sync_error?: string | null
          sync_status?: string | null
          synced_at?: string | null
          synced_to_task?: boolean | null
          task_id?: string | null
          timestamp_seconds?: number | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_action_items_linked_task_id_fkey"
            columns: ["linked_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_action_items_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_action_items_backup_20250106: {
        Row: {
          ai_analyzed_at: string | null
          ai_confidence: number | null
          ai_confidence_score: number | null
          ai_deadline: string | null
          ai_generated: boolean | null
          ai_reasoning: string | null
          ai_task_type: string | null
          assigned_to_email: string | null
          assigned_to_name: string | null
          assignee_email: string | null
          assignee_name: string | null
          category: string | null
          completed: boolean | null
          created_at: string | null
          deadline_at: string | null
          deadline_date: string | null
          id: string | null
          is_sales_rep_task: boolean | null
          linked_task_id: string | null
          meeting_id: string | null
          needs_review: boolean | null
          playback_url: string | null
          priority: string | null
          sync_error: string | null
          sync_status: string | null
          synced_at: string | null
          synced_to_task: boolean | null
          task_id: string | null
          timestamp_seconds: number | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          ai_analyzed_at?: string | null
          ai_confidence?: number | null
          ai_confidence_score?: number | null
          ai_deadline?: string | null
          ai_generated?: boolean | null
          ai_reasoning?: string | null
          ai_task_type?: string | null
          assigned_to_email?: string | null
          assigned_to_name?: string | null
          assignee_email?: string | null
          assignee_name?: string | null
          category?: string | null
          completed?: boolean | null
          created_at?: string | null
          deadline_at?: string | null
          deadline_date?: string | null
          id?: string | null
          is_sales_rep_task?: boolean | null
          linked_task_id?: string | null
          meeting_id?: string | null
          needs_review?: boolean | null
          playback_url?: string | null
          priority?: string | null
          sync_error?: string | null
          sync_status?: string | null
          synced_at?: string | null
          synced_to_task?: boolean | null
          task_id?: string | null
          timestamp_seconds?: number | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_analyzed_at?: string | null
          ai_confidence?: number | null
          ai_confidence_score?: number | null
          ai_deadline?: string | null
          ai_generated?: boolean | null
          ai_reasoning?: string | null
          ai_task_type?: string | null
          assigned_to_email?: string | null
          assigned_to_name?: string | null
          assignee_email?: string | null
          assignee_name?: string | null
          category?: string | null
          completed?: boolean | null
          created_at?: string | null
          deadline_at?: string | null
          deadline_date?: string | null
          id?: string | null
          is_sales_rep_task?: boolean | null
          linked_task_id?: string | null
          meeting_id?: string | null
          needs_review?: boolean | null
          playback_url?: string | null
          priority?: string | null
          sync_error?: string | null
          sync_status?: string | null
          synced_at?: string | null
          synced_to_task?: boolean | null
          task_id?: string | null
          timestamp_seconds?: number | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      meeting_attendees: {
        Row: {
          email: string | null
          id: string
          is_external: boolean | null
          meeting_id: string | null
          name: string | null
          role: string | null
        }
        Insert: {
          email?: string | null
          id?: string
          is_external?: boolean | null
          meeting_id?: string | null
          name?: string | null
          role?: string | null
        }
        Update: {
          email?: string | null
          id?: string
          is_external?: boolean | null
          meeting_id?: string | null
          name?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_attendees_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_contacts: {
        Row: {
          contact_id: string
          created_at: string | null
          id: string
          is_primary: boolean | null
          meeting_id: string
          role: string | null
        }
        Insert: {
          contact_id: string
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          meeting_id: string
          role?: string | null
        }
        Update: {
          contact_id?: string
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          meeting_id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_contacts_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_content_topics: {
        Row: {
          cost_cents: number | null
          created_at: string
          created_by: string
          deleted_at: string | null
          extraction_version: number
          id: string
          meeting_id: string
          model_used: string
          tokens_used: number | null
          topics: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          cost_cents?: number | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          extraction_version?: number
          id?: string
          meeting_id: string
          model_used: string
          tokens_used?: number | null
          topics?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          cost_cents?: number | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          extraction_version?: number
          id?: string
          meeting_id?: string
          model_used?: string
          tokens_used?: number | null
          topics?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_content_topics_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_documents: {
        Row: {
          created_at: string | null
          document_id: string
          document_title: string | null
          document_url: string
          id: string
          meeting_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          document_id: string
          document_title?: string | null
          document_url: string
          id?: string
          meeting_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          document_id?: string
          document_title?: string | null
          document_url?: string
          id?: string
          meeting_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      meeting_file_search_index: {
        Row: {
          content_hash: string | null
          error_message: string | null
          file_name: string | null
          id: string
          indexed_at: string | null
          meeting_id: string | null
          meeting_owner_id: string | null
          metadata: Json | null
          org_id: string | null
          status: string | null
          store_name: string
          user_id: string | null
        }
        Insert: {
          content_hash?: string | null
          error_message?: string | null
          file_name?: string | null
          id?: string
          indexed_at?: string | null
          meeting_id?: string | null
          meeting_owner_id?: string | null
          metadata?: Json | null
          org_id?: string | null
          status?: string | null
          store_name: string
          user_id?: string | null
        }
        Update: {
          content_hash?: string | null
          error_message?: string | null
          file_name?: string | null
          id?: string
          indexed_at?: string | null
          meeting_id?: string | null
          meeting_owner_id?: string | null
          metadata?: Json | null
          org_id?: string | null
          status?: string | null
          store_name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_file_search_index_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_generated_content: {
        Row: {
          content: string
          content_type: string
          cost_cents: number | null
          created_at: string
          created_by: string
          deleted_at: string | null
          id: string
          is_latest: boolean
          meeting_id: string
          model_used: string
          parent_id: string | null
          prompt_used: string | null
          title: string | null
          tokens_used: number | null
          updated_at: string
          version: number
        }
        Insert: {
          content: string
          content_type: string
          cost_cents?: number | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          id?: string
          is_latest?: boolean
          meeting_id: string
          model_used: string
          parent_id?: string | null
          prompt_used?: string | null
          title?: string | null
          tokens_used?: number | null
          updated_at?: string
          version?: number
        }
        Update: {
          content?: string
          content_type?: string
          cost_cents?: number | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          id?: string
          is_latest?: boolean
          meeting_id?: string
          model_used?: string
          parent_id?: string | null
          prompt_used?: string | null
          title?: string | null
          tokens_used?: number | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "meeting_generated_content_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_generated_content_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "meeting_generated_content"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_index_queue: {
        Row: {
          attempts: number | null
          created_at: string | null
          error_message: string | null
          id: string
          last_attempt_at: string | null
          max_attempts: number | null
          meeting_id: string | null
          priority: number | null
          user_id: string | null
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          last_attempt_at?: string | null
          max_attempts?: number | null
          meeting_id?: string | null
          priority?: number | null
          user_id?: string | null
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          last_attempt_at?: string | null
          max_attempts?: number | null
          meeting_id?: string | null
          priority?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_index_queue_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: true
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_intelligence_queries: {
        Row: {
          created_at: string | null
          id: string
          parsed_filters: Json | null
          parsed_semantic_query: string | null
          query_text: string
          response_time_ms: number | null
          results_count: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          parsed_filters?: Json | null
          parsed_semantic_query?: string | null
          query_text: string
          response_time_ms?: number | null
          results_count?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          parsed_filters?: Json | null
          parsed_semantic_query?: string | null
          query_text?: string
          response_time_ms?: number | null
          results_count?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      meeting_metrics: {
        Row: {
          avg_response_latency_ms: number | null
          id: string
          interruption_count: number | null
          meeting_id: string | null
          words_spoken_customer: number | null
          words_spoken_rep: number | null
        }
        Insert: {
          avg_response_latency_ms?: number | null
          id?: string
          interruption_count?: number | null
          meeting_id?: string | null
          words_spoken_customer?: number | null
          words_spoken_rep?: number | null
        }
        Update: {
          avg_response_latency_ms?: number | null
          id?: string
          interruption_count?: number | null
          meeting_id?: string | null
          words_spoken_customer?: number | null
          words_spoken_rep?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_metrics_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_topics: {
        Row: {
          id: string
          label: string | null
          meeting_id: string | null
        }
        Insert: {
          id?: string
          label?: string | null
          meeting_id?: string | null
        }
        Update: {
          id?: string
          label?: string | null
          meeting_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_topics_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          ai_training_metadata: Json | null
          calendar_invitees_type: string | null
          calls_url: string | null
          clerk_org_id: string | null
          coach_rating: number | null
          coach_summary: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string | null
          created_by: string | null
          duration_minutes: number | null
          fathom_created_at: string | null
          fathom_embed_url: string | null
          fathom_recording_id: string
          fathom_user_id: string | null
          id: string
          last_synced_at: string | null
          last_transcript_fetch_at: string | null
          meeting_end: string | null
          meeting_start: string | null
          next_actions_count: number | null
          next_actions_generated_at: string | null
          next_steps_oneliner: string | null
          org_id: string | null
          owner_email: string | null
          owner_user_id: string | null
          primary_contact_id: string | null
          sentiment_reasoning: string | null
          sentiment_score: number | null
          share_url: string | null
          start_time: string | null
          summary: string | null
          summary_oneliner: string | null
          sync_status: string | null
          talk_time_customer_pct: number | null
          talk_time_judgement: string | null
          talk_time_rep_pct: number | null
          team_name: string | null
          thumbnail_url: string | null
          title: string | null
          transcript_doc_url: string | null
          transcript_fetch_attempts: number | null
          transcript_language: string | null
          transcript_text: string | null
          updated_at: string | null
        }
        Insert: {
          ai_training_metadata?: Json | null
          calendar_invitees_type?: string | null
          calls_url?: string | null
          clerk_org_id?: string | null
          coach_rating?: number | null
          coach_summary?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          duration_minutes?: number | null
          fathom_created_at?: string | null
          fathom_embed_url?: string | null
          fathom_recording_id: string
          fathom_user_id?: string | null
          id?: string
          last_synced_at?: string | null
          last_transcript_fetch_at?: string | null
          meeting_end?: string | null
          meeting_start?: string | null
          next_actions_count?: number | null
          next_actions_generated_at?: string | null
          next_steps_oneliner?: string | null
          org_id?: string | null
          owner_email?: string | null
          owner_user_id?: string | null
          primary_contact_id?: string | null
          sentiment_reasoning?: string | null
          sentiment_score?: number | null
          share_url?: string | null
          start_time?: string | null
          summary?: string | null
          summary_oneliner?: string | null
          sync_status?: string | null
          talk_time_customer_pct?: number | null
          talk_time_judgement?: string | null
          talk_time_rep_pct?: number | null
          team_name?: string | null
          thumbnail_url?: string | null
          title?: string | null
          transcript_doc_url?: string | null
          transcript_fetch_attempts?: number | null
          transcript_language?: string | null
          transcript_text?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_training_metadata?: Json | null
          calendar_invitees_type?: string | null
          calls_url?: string | null
          clerk_org_id?: string | null
          coach_rating?: number | null
          coach_summary?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          duration_minutes?: number | null
          fathom_created_at?: string | null
          fathom_embed_url?: string | null
          fathom_recording_id?: string
          fathom_user_id?: string | null
          id?: string
          last_synced_at?: string | null
          last_transcript_fetch_at?: string | null
          meeting_end?: string | null
          meeting_start?: string | null
          next_actions_count?: number | null
          next_actions_generated_at?: string | null
          next_steps_oneliner?: string | null
          org_id?: string | null
          owner_email?: string | null
          owner_user_id?: string | null
          primary_contact_id?: string | null
          sentiment_reasoning?: string | null
          sentiment_score?: number | null
          share_url?: string | null
          start_time?: string | null
          summary?: string | null
          summary_oneliner?: string | null
          sync_status?: string | null
          talk_time_customer_pct?: number | null
          talk_time_judgement?: string | null
          talk_time_rep_pct?: number | null
          team_name?: string | null
          thumbnail_url?: string | null
          title?: string | null
          transcript_doc_url?: string | null
          transcript_fetch_attempts?: number | null
          transcript_language?: string | null
          transcript_text?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_meetings_company_id"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_meetings_contact_id"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings_waitlist: {
        Row: {
          access_granted_by: string | null
          admin_notes: string | null
          company_name: string
          converted_at: string | null
          created_at: string | null
          crm_other: string | null
          crm_tool: string | null
          dialer_other: string | null
          dialer_tool: string | null
          effective_position: number | null
          email: string
          full_name: string
          granted_access_at: string | null
          granted_by: string | null
          id: string
          is_seeded: boolean
          linkedin_boost_claimed: boolean | null
          linkedin_first_share_at: string | null
          linkedin_share_claimed: boolean | null
          magic_link_expires_at: string | null
          magic_link_sent_at: string | null
          meeting_recorder_other: string | null
          meeting_recorder_tool: string | null
          profile_image_url: string | null
          referral_code: string
          referral_count: number | null
          referred_by_code: string | null
          released_at: string | null
          released_by: string | null
          signup_position: number | null
          status: Database["public"]["Enums"]["waitlist_status"]
          total_points: number | null
          twitter_boost_claimed: boolean | null
          twitter_first_share_at: string | null
          updated_at: string | null
          user_id: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          access_granted_by?: string | null
          admin_notes?: string | null
          company_name: string
          converted_at?: string | null
          created_at?: string | null
          crm_other?: string | null
          crm_tool?: string | null
          dialer_other?: string | null
          dialer_tool?: string | null
          effective_position?: number | null
          email: string
          full_name: string
          granted_access_at?: string | null
          granted_by?: string | null
          id?: string
          is_seeded?: boolean
          linkedin_boost_claimed?: boolean | null
          linkedin_first_share_at?: string | null
          linkedin_share_claimed?: boolean | null
          magic_link_expires_at?: string | null
          magic_link_sent_at?: string | null
          meeting_recorder_other?: string | null
          meeting_recorder_tool?: string | null
          profile_image_url?: string | null
          referral_code: string
          referral_count?: number | null
          referred_by_code?: string | null
          released_at?: string | null
          released_by?: string | null
          signup_position?: number | null
          status?: Database["public"]["Enums"]["waitlist_status"]
          total_points?: number | null
          twitter_boost_claimed?: boolean | null
          twitter_first_share_at?: string | null
          updated_at?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          access_granted_by?: string | null
          admin_notes?: string | null
          company_name?: string
          converted_at?: string | null
          created_at?: string | null
          crm_other?: string | null
          crm_tool?: string | null
          dialer_other?: string | null
          dialer_tool?: string | null
          effective_position?: number | null
          email?: string
          full_name?: string
          granted_access_at?: string | null
          granted_by?: string | null
          id?: string
          is_seeded?: boolean
          linkedin_boost_claimed?: boolean | null
          linkedin_first_share_at?: string | null
          linkedin_share_claimed?: boolean | null
          magic_link_expires_at?: string | null
          magic_link_sent_at?: string | null
          meeting_recorder_other?: string | null
          meeting_recorder_tool?: string | null
          profile_image_url?: string | null
          referral_code?: string
          referral_count?: number | null
          referred_by_code?: string | null
          released_at?: string | null
          released_by?: string | null
          signup_position?: number | null
          status?: Database["public"]["Enums"]["waitlist_status"]
          total_points?: number | null
          twitter_boost_claimed?: boolean | null
          twitter_first_share_at?: string | null
          updated_at?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meetings_waitlist_access_granted_by_fkey"
            columns: ["access_granted_by"]
            isOneToOne: false
            referencedRelation: "activities_with_profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "meetings_waitlist_access_granted_by_fkey"
            columns: ["access_granted_by"]
            isOneToOne: false
            referencedRelation: "deal_activities_with_profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "meetings_waitlist_access_granted_by_fkey"
            columns: ["access_granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_waitlist_access_granted_by_fkey"
            columns: ["access_granted_by"]
            isOneToOne: false
            referencedRelation: "team_meeting_analytics"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "meetings_waitlist_referred_by_code_fkey"
            columns: ["referred_by_code"]
            isOneToOne: false
            referencedRelation: "meetings_waitlist"
            referencedColumns: ["referral_code"]
          },
          {
            foreignKeyName: "meetings_waitlist_released_by_fkey"
            columns: ["released_by"]
            isOneToOne: false
            referencedRelation: "activities_with_profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "meetings_waitlist_released_by_fkey"
            columns: ["released_by"]
            isOneToOne: false
            referencedRelation: "deal_activities_with_profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "meetings_waitlist_released_by_fkey"
            columns: ["released_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_waitlist_released_by_fkey"
            columns: ["released_by"]
            isOneToOne: false
            referencedRelation: "team_meeting_analytics"
            referencedColumns: ["user_id"]
          },
        ]
      }
      next_action_suggestions: {
        Row: {
          accepted_at: string | null
          action_type: string
          activity_id: string
          activity_type: string
          ai_model: string | null
          company_id: string | null
          completed_at: string | null
          confidence_score: number | null
          contact_id: string | null
          context_quality: number | null
          created_at: string | null
          created_task_id: string | null
          deal_id: string | null
          dismissed_at: string | null
          id: string
          importance: string | null
          reasoning: string
          recommended_deadline: string | null
          status: string | null
          timestamp_seconds: number | null
          title: string
          urgency: string | null
          user_feedback: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          action_type: string
          activity_id: string
          activity_type: string
          ai_model?: string | null
          company_id?: string | null
          completed_at?: string | null
          confidence_score?: number | null
          contact_id?: string | null
          context_quality?: number | null
          created_at?: string | null
          created_task_id?: string | null
          deal_id?: string | null
          dismissed_at?: string | null
          id?: string
          importance?: string | null
          reasoning: string
          recommended_deadline?: string | null
          status?: string | null
          timestamp_seconds?: number | null
          title: string
          urgency?: string | null
          user_feedback?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          action_type?: string
          activity_id?: string
          activity_type?: string
          ai_model?: string | null
          company_id?: string | null
          completed_at?: string | null
          confidence_score?: number | null
          contact_id?: string | null
          context_quality?: number | null
          created_at?: string | null
          created_task_id?: string | null
          deal_id?: string | null
          dismissed_at?: string | null
          id?: string
          importance?: string | null
          reasoning?: string
          recommended_deadline?: string | null
          status?: string | null
          timestamp_seconds?: number | null
          title?: string
          urgency?: string | null
          user_feedback?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "next_action_suggestions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "next_action_suggestions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "next_action_suggestions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      node_executions: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          execution_id: string
          id: string
          input_data: Json | null
          node_id: string
          node_type: string
          output_data: Json | null
          started_at: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          execution_id: string
          id?: string
          input_data?: Json | null
          node_id: string
          node_type: string
          output_data?: Json | null
          started_at?: string | null
          status: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          execution_id?: string
          id?: string
          input_data?: Json | null
          node_id?: string
          node_type?: string
          output_data?: Json | null
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
      node_fixtures: {
        Row: {
          created_at: string | null
          data: Json
          environment: string | null
          fixture_name: string
          fixture_type: string | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          node_id: string
          updated_at: string | null
          workflow_id: string
        }
        Insert: {
          created_at?: string | null
          data?: Json
          environment?: string | null
          fixture_name: string
          fixture_type?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          node_id: string
          updated_at?: string | null
          workflow_id: string
        }
        Update: {
          created_at?: string | null
          data?: Json
          environment?: string | null
          fixture_name?: string
          fixture_type?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          node_id?: string
          updated_at?: string | null
          workflow_id?: string
        }
        Relationships: []
      }
      notification_rate_limits: {
        Row: {
          created_at: string
          id: string
          notification_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notification_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notification_type?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_url: string | null
          category: string | null
          created_at: string | null
          created_by: string | null
          entity_id: string | null
          entity_type: string | null
          expires_at: string | null
          id: string
          message: string
          metadata: Json | null
          read: boolean | null
          read_at: string | null
          title: string
          type: string | null
          user_id: string
          workflow_execution_id: string | null
        }
        Insert: {
          action_url?: string | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          entity_id?: string | null
          entity_type?: string | null
          expires_at?: string | null
          id?: string
          message: string
          metadata?: Json | null
          read?: boolean | null
          read_at?: string | null
          title: string
          type?: string | null
          user_id: string
          workflow_execution_id?: string | null
        }
        Update: {
          action_url?: string | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          entity_id?: string | null
          entity_type?: string | null
          expires_at?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          read?: boolean | null
          read_at?: string | null
          title?: string
          type?: string | null
          user_id?: string
          workflow_execution_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "activities_with_profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "notifications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "deal_activities_with_profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "notifications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_meeting_analytics"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "activities_with_profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "deal_activities_with_profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_meeting_analytics"
            referencedColumns: ["user_id"]
          },
        ]
      }
      org_file_search_stores: {
        Row: {
          created_at: string | null
          display_name: string | null
          error_message: string | null
          id: string
          last_sync_at: string | null
          org_id: string
          status: string | null
          store_name: string
          total_files: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          error_message?: string | null
          id?: string
          last_sync_at?: string | null
          org_id: string
          status?: string | null
          store_name: string
          total_files?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          error_message?: string | null
          id?: string
          last_sync_at?: string | null
          org_id?: string
          status?: string | null
          store_name?: string
          total_files?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      organization_feature_flags: {
        Row: {
          created_at: string | null
          enabled_at: string | null
          enabled_by: string | null
          expires_at: string | null
          feature_key: string
          id: string
          is_enabled: boolean
          org_id: string
          override_reason: string | null
          updated_at: string | null
          usage_limit: number | null
        }
        Insert: {
          created_at?: string | null
          enabled_at?: string | null
          enabled_by?: string | null
          expires_at?: string | null
          feature_key: string
          id?: string
          is_enabled?: boolean
          org_id: string
          override_reason?: string | null
          updated_at?: string | null
          usage_limit?: number | null
        }
        Update: {
          created_at?: string | null
          enabled_at?: string | null
          enabled_by?: string | null
          expires_at?: string | null
          feature_key?: string
          id?: string
          is_enabled?: boolean
          org_id?: string
          override_reason?: string | null
          updated_at?: string | null
          usage_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_feature_flags_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          org_id: string
          role: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          org_id: string
          role?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          org_id?: string
          role?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_memberships: {
        Row: {
          created_at: string | null
          org_id: string
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          org_id: string
          role?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          org_id?: string
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_subscriptions: {
        Row: {
          admin_notes: string | null
          billing_cycle: string
          cancel_at_period_end: boolean | null
          canceled_at: string | null
          cancellation_reason: string | null
          created_at: string | null
          current_period_end: string
          current_period_start: string
          custom_max_ai_tokens: number | null
          custom_max_meetings: number | null
          custom_max_storage_mb: number | null
          custom_max_users: number | null
          id: string
          org_id: string
          plan_id: string
          quantity: number | null
          started_at: string
          status: string
          stripe_customer_id: string | null
          stripe_latest_invoice_id: string | null
          stripe_payment_method_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          trial_start_at: string | null
          updated_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          billing_cycle?: string
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null
          cancellation_reason?: string | null
          created_at?: string | null
          current_period_end?: string
          current_period_start?: string
          custom_max_ai_tokens?: number | null
          custom_max_meetings?: number | null
          custom_max_storage_mb?: number | null
          custom_max_users?: number | null
          id?: string
          org_id: string
          plan_id: string
          quantity?: number | null
          started_at?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_latest_invoice_id?: string | null
          stripe_payment_method_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          trial_start_at?: string | null
          updated_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          billing_cycle?: string
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null
          cancellation_reason?: string | null
          created_at?: string | null
          current_period_end?: string
          current_period_start?: string
          custom_max_ai_tokens?: number | null
          custom_max_meetings?: number | null
          custom_max_storage_mb?: number | null
          custom_max_users?: number | null
          id?: string
          org_id?: string
          plan_id?: string
          quantity?: number | null
          started_at?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_latest_invoice_id?: string | null
          stripe_payment_method_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          trial_start_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_usage: {
        Row: {
          active_users_count: number
          ai_tokens_used: number
          created_at: string | null
          id: string
          meetings_count: number
          meetings_duration_minutes: number
          org_id: string
          period_end: string
          period_start: string
          storage_used_mb: number
          updated_at: string | null
          usage_breakdown: Json | null
        }
        Insert: {
          active_users_count?: number
          ai_tokens_used?: number
          created_at?: string | null
          id?: string
          meetings_count?: number
          meetings_duration_minutes?: number
          org_id: string
          period_end: string
          period_start: string
          storage_used_mb?: number
          updated_at?: string | null
          usage_breakdown?: Json | null
        }
        Update: {
          active_users_count?: number
          ai_tokens_used?: number
          created_at?: string | null
          id?: string
          meetings_count?: number
          meetings_duration_minutes?: number
          org_id?: string
          period_end?: string
          period_start?: string
          storage_used_mb?: number
          updated_at?: string | null
          usage_breakdown?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_usage_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          company_bio: string | null
          company_country_code: string | null
          company_domain: string | null
          company_enriched_at: string | null
          company_enrichment_confidence: number | null
          company_enrichment_raw: Json | null
          company_enrichment_status: string
          company_industry: string | null
          company_linkedin_url: string | null
          company_size: string | null
          company_timezone: string | null
          company_website: string | null
          created_at: string | null
          created_by: string | null
          currency_code: string
          currency_locale: string
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          company_bio?: string | null
          company_country_code?: string | null
          company_domain?: string | null
          company_enriched_at?: string | null
          company_enrichment_confidence?: number | null
          company_enrichment_raw?: Json | null
          company_enrichment_status?: string
          company_industry?: string | null
          company_linkedin_url?: string | null
          company_size?: string | null
          company_timezone?: string | null
          company_website?: string | null
          created_at?: string | null
          created_by?: string | null
          currency_code?: string
          currency_locale?: string
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          company_bio?: string | null
          company_country_code?: string | null
          company_domain?: string | null
          company_enriched_at?: string | null
          company_enrichment_confidence?: number | null
          company_enrichment_raw?: Json | null
          company_enrichment_status?: string
          company_industry?: string | null
          company_linkedin_url?: string | null
          company_size?: string | null
          company_timezone?: string | null
          company_website?: string | null
          created_at?: string | null
          created_by?: string | null
          currency_code?: string
          currency_locale?: string
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      pipeline_stage_recommendations: {
        Row: {
          auto_apply_enabled: boolean | null
          auto_apply_threshold: number | null
          company_id: string | null
          confidence_score: number | null
          contact_id: string | null
          created_at: string | null
          current_stage: string
          deal_id: string | null
          expires_at: string | null
          id: string
          key_signals: string[] | null
          meeting_id: string
          meeting_sentiment_score: number | null
          meeting_summary: string | null
          metadata: Json | null
          recommendation_reason: string | null
          recommended_stage: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          auto_apply_enabled?: boolean | null
          auto_apply_threshold?: number | null
          company_id?: string | null
          confidence_score?: number | null
          contact_id?: string | null
          created_at?: string | null
          current_stage: string
          deal_id?: string | null
          expires_at?: string | null
          id?: string
          key_signals?: string[] | null
          meeting_id: string
          meeting_sentiment_score?: number | null
          meeting_summary?: string | null
          metadata?: Json | null
          recommendation_reason?: string | null
          recommended_stage: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          auto_apply_enabled?: boolean | null
          auto_apply_threshold?: number | null
          company_id?: string | null
          confidence_score?: number | null
          contact_id?: string | null
          created_at?: string | null
          current_stage?: string
          deal_id?: string | null
          expires_at?: string | null
          id?: string
          key_signals?: string[] | null
          meeting_id?: string
          meeting_sentiment_score?: number | null
          meeting_summary?: string | null
          metadata?: Json | null
          recommendation_reason?: string | null
          recommended_stage?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stage_recommendations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_stage_recommendations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_stage_recommendations_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_stage_recommendations_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_plans: {
        Row: {
          created_at: string | null
          description: string | null
          features: string[] | null
          id: string
          interval: string | null
          is_active: boolean | null
          is_popular: boolean | null
          name: string
          order_index: number | null
          price: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          features?: string[] | null
          id?: string
          interval?: string | null
          is_active?: boolean | null
          is_popular?: boolean | null
          name: string
          order_index?: number | null
          price?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          features?: string[] | null
          id?: string
          interval?: string | null
          is_active?: boolean | null
          is_popular?: boolean | null
          name?: string
          order_index?: number | null
          price?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          auth_provider: string | null
          avatar_url: string | null
          bio: string | null
          clerk_user_id: string | null
          created_at: string | null
          email: string
          first_name: string | null
          id: string
          is_admin: boolean | null
          last_login_at: string | null
          last_name: string | null
          stage: string | null
          updated_at: string | null
        }
        Insert: {
          auth_provider?: string | null
          avatar_url?: string | null
          bio?: string | null
          clerk_user_id?: string | null
          created_at?: string | null
          email: string
          first_name?: string | null
          id: string
          is_admin?: boolean | null
          last_login_at?: string | null
          last_name?: string | null
          stage?: string | null
          updated_at?: string | null
        }
        Update: {
          auth_provider?: string | null
          avatar_url?: string | null
          bio?: string | null
          clerk_user_id?: string | null
          created_at?: string | null
          email?: string
          first_name?: string | null
          id?: string
          is_admin?: boolean | null
          last_login_at?: string | null
          last_name?: string | null
          stage?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      proposal_jobs: {
        Row: {
          action: string
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          input_data: Json
          max_retries: number | null
          output_content: string | null
          output_usage: Json | null
          retry_count: number | null
          started_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          action: string
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          input_data: Json
          max_retries?: number | null
          output_content?: string | null
          output_usage?: Json | null
          retry_count?: number | null
          started_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          action?: string
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          input_data?: Json
          max_retries?: number | null
          output_content?: string | null
          output_usage?: Json | null
          retry_count?: number | null
          started_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      proposal_templates: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_default: boolean | null
          name: string
          type: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          type: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          type?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      proposals: {
        Row: {
          contact_id: string | null
          content: string
          created_at: string | null
          id: string
          is_public: boolean | null
          last_viewed_at: string | null
          meeting_id: string | null
          password_hash: string | null
          share_token: string | null
          share_views: number | null
          status: string | null
          title: string | null
          type: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          contact_id?: string | null
          content: string
          created_at?: string | null
          id?: string
          is_public?: boolean | null
          last_viewed_at?: string | null
          meeting_id?: string | null
          password_hash?: string | null
          share_token?: string | null
          share_views?: number | null
          status?: string | null
          title?: string | null
          type: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          contact_id?: string | null
          content?: string
          created_at?: string | null
          id?: string
          is_public?: boolean | null
          last_viewed_at?: string | null
          meeting_id?: string | null
          password_hash?: string | null
          share_token?: string | null
          share_views?: number | null
          status?: string | null
          title?: string | null
          type?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit: {
        Row: {
          created_at: string | null
          endpoint: string
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          endpoint: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          endpoint?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      relationship_health_history: {
        Row: {
          changes_from_previous: Json | null
          communication_frequency_score: number | null
          created_at: string | null
          engagement_quality_score: number | null
          ghost_probability_percent: number | null
          health_status: string
          id: string
          is_ghost_risk: boolean | null
          meeting_pattern_score: number | null
          overall_health_score: number
          relationship_health_id: string
          response_behavior_score: number | null
          sentiment_score: number | null
          snapshot_at: string
          snapshot_reason: string | null
          user_id: string
        }
        Insert: {
          changes_from_previous?: Json | null
          communication_frequency_score?: number | null
          created_at?: string | null
          engagement_quality_score?: number | null
          ghost_probability_percent?: number | null
          health_status: string
          id?: string
          is_ghost_risk?: boolean | null
          meeting_pattern_score?: number | null
          overall_health_score: number
          relationship_health_id: string
          response_behavior_score?: number | null
          sentiment_score?: number | null
          snapshot_at?: string
          snapshot_reason?: string | null
          user_id: string
        }
        Update: {
          changes_from_previous?: Json | null
          communication_frequency_score?: number | null
          created_at?: string | null
          engagement_quality_score?: number | null
          ghost_probability_percent?: number | null
          health_status?: string
          id?: string
          is_ghost_risk?: boolean | null
          meeting_pattern_score?: number | null
          overall_health_score?: number
          relationship_health_id?: string
          response_behavior_score?: number | null
          sentiment_score?: number | null
          snapshot_at?: string
          snapshot_reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "relationship_health_history_relationship_health_id_fkey"
            columns: ["relationship_health_id"]
            isOneToOne: false
            referencedRelation: "relationship_health_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      relationship_health_scores: {
        Row: {
          at_risk_deal_value: number | null
          avg_response_time_hours: number | null
          avg_sentiment_last_3_interactions: number | null
          baseline_contact_frequency_days: number | null
          baseline_meeting_frequency_days: number | null
          baseline_response_time_hours: number | null
          communication_frequency_score: number | null
          company_id: string | null
          contact_id: string | null
          created_at: string | null
          days_since_last_contact: number | null
          days_since_last_response: number | null
          days_until_predicted_ghost: number | null
          email_count_30_days: number | null
          email_open_rate_percent: number | null
          engagement_quality_score: number | null
          ghost_probability_percent: number | null
          ghost_signals: Json | null
          health_status: string
          id: string
          is_ghost_risk: boolean | null
          last_calculated_at: string | null
          last_meaningful_interaction: Json | null
          meeting_count_30_days: number | null
          meeting_pattern_score: number | null
          overall_health_score: number
          related_deals_count: number | null
          relationship_type: string
          response_behavior_score: number | null
          response_rate_percent: number | null
          risk_factors: string[] | null
          risk_level: string
          sentiment_score: number | null
          sentiment_trend: string | null
          total_deal_value: number | null
          total_interactions_30_days: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          at_risk_deal_value?: number | null
          avg_response_time_hours?: number | null
          avg_sentiment_last_3_interactions?: number | null
          baseline_contact_frequency_days?: number | null
          baseline_meeting_frequency_days?: number | null
          baseline_response_time_hours?: number | null
          communication_frequency_score?: number | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          days_since_last_contact?: number | null
          days_since_last_response?: number | null
          days_until_predicted_ghost?: number | null
          email_count_30_days?: number | null
          email_open_rate_percent?: number | null
          engagement_quality_score?: number | null
          ghost_probability_percent?: number | null
          ghost_signals?: Json | null
          health_status: string
          id?: string
          is_ghost_risk?: boolean | null
          last_calculated_at?: string | null
          last_meaningful_interaction?: Json | null
          meeting_count_30_days?: number | null
          meeting_pattern_score?: number | null
          overall_health_score: number
          related_deals_count?: number | null
          relationship_type: string
          response_behavior_score?: number | null
          response_rate_percent?: number | null
          risk_factors?: string[] | null
          risk_level: string
          sentiment_score?: number | null
          sentiment_trend?: string | null
          total_deal_value?: number | null
          total_interactions_30_days?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          at_risk_deal_value?: number | null
          avg_response_time_hours?: number | null
          avg_sentiment_last_3_interactions?: number | null
          baseline_contact_frequency_days?: number | null
          baseline_meeting_frequency_days?: number | null
          baseline_response_time_hours?: number | null
          communication_frequency_score?: number | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          days_since_last_contact?: number | null
          days_since_last_response?: number | null
          days_until_predicted_ghost?: number | null
          email_count_30_days?: number | null
          email_open_rate_percent?: number | null
          engagement_quality_score?: number | null
          ghost_probability_percent?: number | null
          ghost_signals?: Json | null
          health_status?: string
          id?: string
          is_ghost_risk?: boolean | null
          last_calculated_at?: string | null
          last_meaningful_interaction?: Json | null
          meeting_count_30_days?: number | null
          meeting_pattern_score?: number | null
          overall_health_score?: number
          related_deals_count?: number | null
          relationship_type?: string
          response_behavior_score?: number | null
          response_rate_percent?: number | null
          risk_factors?: string[] | null
          risk_level?: string
          sentiment_score?: number | null
          sentiment_trend?: string | null
          total_deal_value?: number | null
          total_interactions_30_days?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "relationship_health_scores_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationship_health_scores_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmap_comments: {
        Row: {
          comment: string
          created_at: string | null
          id: string
          is_admin_comment: boolean | null
          suggestion_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          comment: string
          created_at?: string | null
          id?: string
          is_admin_comment?: boolean | null
          suggestion_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string | null
          id?: string
          is_admin_comment?: boolean | null
          suggestion_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_comments_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "roadmap_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmap_suggestions: {
        Row: {
          admin_notes: string | null
          assigned_to: string | null
          completion_date: string | null
          created_at: string | null
          description: string
          estimated_effort: string | null
          hub_last_sync_at: string | null
          hub_sync_error: string | null
          hub_sync_status: string | null
          hub_task_code: string | null
          hub_task_id: string | null
          id: string
          priority: string
          status: string
          submitted_at: string | null
          submitted_by: string
          target_version: string | null
          ticket_id: number
          title: string
          type: string
          updated_at: string | null
          votes_count: number | null
        }
        Insert: {
          admin_notes?: string | null
          assigned_to?: string | null
          completion_date?: string | null
          created_at?: string | null
          description: string
          estimated_effort?: string | null
          hub_last_sync_at?: string | null
          hub_sync_error?: string | null
          hub_sync_status?: string | null
          hub_task_code?: string | null
          hub_task_id?: string | null
          id?: string
          priority?: string
          status?: string
          submitted_at?: string | null
          submitted_by: string
          target_version?: string | null
          ticket_id?: number
          title: string
          type: string
          updated_at?: string | null
          votes_count?: number | null
        }
        Update: {
          admin_notes?: string | null
          assigned_to?: string | null
          completion_date?: string | null
          created_at?: string | null
          description?: string
          estimated_effort?: string | null
          hub_last_sync_at?: string | null
          hub_sync_error?: string | null
          hub_sync_status?: string | null
          hub_task_code?: string | null
          hub_task_id?: string | null
          id?: string
          priority?: string
          status?: string
          submitted_at?: string | null
          submitted_by?: string
          target_version?: string | null
          ticket_id?: number
          title?: string
          type?: string
          updated_at?: string | null
          votes_count?: number | null
        }
        Relationships: []
      }
      roadmap_votes: {
        Row: {
          created_at: string | null
          id: string
          suggestion_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          suggestion_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          suggestion_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_votes_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "roadmap_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      savvycal_link_mappings: {
        Row: {
          channel: string
          created_at: string | null
          default_owner_email: string | null
          description: string | null
          id: string
          is_active: boolean | null
          link_id: string
          medium: string | null
          source_name: string
          updated_at: string | null
        }
        Insert: {
          channel?: string
          created_at?: string | null
          default_owner_email?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          link_id: string
          medium?: string | null
          source_name: string
          updated_at?: string | null
        }
        Update: {
          channel?: string
          created_at?: string | null
          default_owner_email?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          link_id?: string
          medium?: string | null
          source_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      savvycal_source_mappings: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          link_id: string
          meeting_link: string | null
          notes: string | null
          org_id: string | null
          private_link: string | null
          source: string
          source_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          link_id: string
          meeting_link?: string | null
          notes?: string | null
          org_id?: string | null
          private_link?: string | null
          source: string
          source_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          link_id?: string
          meeting_link?: string | null
          notes?: string | null
          org_id?: string | null
          private_link?: string | null
          source?: string
          source_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "savvycal_source_mappings_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "booking_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      scenario_fixtures: {
        Row: {
          created_at: string | null
          description: string | null
          difficulty: string | null
          expected_outputs: Json | null
          id: string
          is_baseline: boolean | null
          node_fixtures: Json | null
          scenario_name: string
          tags: string[] | null
          trigger_data: Json | null
          updated_at: string | null
          validation_rules: Json | null
          workflow_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          difficulty?: string | null
          expected_outputs?: Json | null
          id?: string
          is_baseline?: boolean | null
          node_fixtures?: Json | null
          scenario_name: string
          tags?: string[] | null
          trigger_data?: Json | null
          updated_at?: string | null
          validation_rules?: Json | null
          workflow_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          difficulty?: string | null
          expected_outputs?: Json | null
          id?: string
          is_baseline?: boolean | null
          node_fixtures?: Json | null
          scenario_name?: string
          tags?: string[] | null
          trigger_data?: Json | null
          updated_at?: string | null
          validation_rules?: Json | null
          workflow_id?: string
        }
        Relationships: []
      }
      sentiment_alerts: {
        Row: {
          alert_type: string
          contact_id: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          meeting_id: string | null
          message: string
          sentiment_score: number | null
          severity: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          alert_type: string
          contact_id?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          meeting_id?: string | null
          message: string
          sentiment_score?: number | null
          severity: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          alert_type?: string
          contact_id?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          meeting_id?: string | null
          message?: string
          sentiment_score?: number | null
          severity?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sentiment_alerts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sentiment_alerts_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      slack_channels: {
        Row: {
          channel_id: string
          channel_name: string
          created_at: string | null
          id: string
          integration_id: string
          is_archived: boolean | null
          is_member: boolean | null
          is_private: boolean | null
          updated_at: string | null
        }
        Insert: {
          channel_id: string
          channel_name: string
          created_at?: string | null
          id?: string
          integration_id: string
          is_archived?: boolean | null
          is_member?: boolean | null
          is_private?: boolean | null
          updated_at?: string | null
        }
        Update: {
          channel_id?: string
          channel_name?: string
          created_at?: string | null
          id?: string
          integration_id?: string
          is_archived?: boolean | null
          is_member?: boolean | null
          is_private?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "slack_channels_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "slack_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      slack_integrations: {
        Row: {
          access_token: string
          app_id: string
          authed_user: Json | null
          bot_user_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          scope: string
          team_id: string
          team_name: string
          token_type: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          app_id: string
          authed_user?: Json | null
          bot_user_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          scope: string
          team_id: string
          team_name: string
          token_type?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          app_id?: string
          authed_user?: Json | null
          bot_user_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          scope?: string
          team_id?: string
          team_name?: string
          token_type?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      smart_task_templates: {
        Row: {
          clerk_org_id: string | null
          created_at: string | null
          created_by: string | null
          days_after_trigger: number
          id: string
          is_active: boolean | null
          priority: string | null
          task_description: string | null
          task_title: string
          task_type: string
          trigger_activity_type: string
          updated_at: string | null
        }
        Insert: {
          clerk_org_id?: string | null
          created_at?: string | null
          created_by?: string | null
          days_after_trigger?: number
          id?: string
          is_active?: boolean | null
          priority?: string | null
          task_description?: string | null
          task_title: string
          task_type?: string
          trigger_activity_type: string
          updated_at?: string | null
        }
        Update: {
          clerk_org_id?: string | null
          created_at?: string | null
          created_by?: string | null
          days_after_trigger?: number
          id?: string
          is_active?: boolean | null
          priority?: string | null
          task_description?: string | null
          task_title?: string
          task_type?: string
          trigger_activity_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      solutions: {
        Row: {
          challenge_id: string | null
          created_at: string | null
          demo_url: string | null
          description: string | null
          features: string[] | null
          id: string
          is_active: boolean | null
          order_index: number | null
          title: string
          updated_at: string | null
        }
        Insert: {
          challenge_id?: string | null
          created_at?: string | null
          demo_url?: string | null
          description?: string | null
          features?: string[] | null
          id?: string
          is_active?: boolean | null
          order_index?: number | null
          title: string
          updated_at?: string | null
        }
        Update: {
          challenge_id?: string | null
          created_at?: string | null
          demo_url?: string | null
          description?: string | null
          features?: string[] | null
          id?: string
          is_active?: boolean | null
          order_index?: number | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "solutions_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      stages: {
        Row: {
          created_at: string | null
          id: string
          name: string
          position: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          position?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          position?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          badge_text: string | null
          created_at: string | null
          cta_text: string | null
          cta_url: string | null
          currency: string
          description: string | null
          display_order: number | null
          features: Json
          highlight_features: string[] | null
          id: string
          included_seats: number | null
          is_active: boolean | null
          is_default: boolean | null
          is_free_tier: boolean | null
          is_public: boolean | null
          max_ai_tokens_per_month: number | null
          max_meetings_per_month: number | null
          max_storage_mb: number | null
          max_users: number | null
          meeting_retention_months: number | null
          name: string
          per_seat_price: number | null
          price_monthly: number
          price_yearly: number
          slug: string
          stripe_price_id_monthly: string | null
          stripe_price_id_yearly: string | null
          stripe_product_id: string | null
          stripe_seat_price_id: string | null
          stripe_sync_error: string | null
          stripe_synced_at: string | null
          trial_days: number | null
          updated_at: string | null
        }
        Insert: {
          badge_text?: string | null
          created_at?: string | null
          cta_text?: string | null
          cta_url?: string | null
          currency?: string
          description?: string | null
          display_order?: number | null
          features?: Json
          highlight_features?: string[] | null
          id?: string
          included_seats?: number | null
          is_active?: boolean | null
          is_default?: boolean | null
          is_free_tier?: boolean | null
          is_public?: boolean | null
          max_ai_tokens_per_month?: number | null
          max_meetings_per_month?: number | null
          max_storage_mb?: number | null
          max_users?: number | null
          meeting_retention_months?: number | null
          name: string
          per_seat_price?: number | null
          price_monthly?: number
          price_yearly?: number
          slug: string
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          stripe_product_id?: string | null
          stripe_seat_price_id?: string | null
          stripe_sync_error?: string | null
          stripe_synced_at?: string | null
          trial_days?: number | null
          updated_at?: string | null
        }
        Update: {
          badge_text?: string | null
          created_at?: string | null
          cta_text?: string | null
          cta_url?: string | null
          currency?: string
          description?: string | null
          display_order?: number | null
          features?: Json
          highlight_features?: string[] | null
          id?: string
          included_seats?: number | null
          is_active?: boolean | null
          is_default?: boolean | null
          is_free_tier?: boolean | null
          is_public?: boolean | null
          max_ai_tokens_per_month?: number | null
          max_meetings_per_month?: number | null
          max_storage_mb?: number | null
          max_users?: number | null
          meeting_retention_months?: number | null
          name?: string
          per_seat_price?: number | null
          price_monthly?: number
          price_yearly?: number
          slug?: string
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          stripe_product_id?: string | null
          stripe_seat_price_id?: string | null
          stripe_sync_error?: string | null
          stripe_synced_at?: string | null
          trial_days?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      subscription_seat_usage: {
        Row: {
          active_seats: number
          billed_at: string | null
          created_at: string | null
          id: string
          included_seats: number
          org_id: string
          overage_amount_cents: number | null
          overage_seats: number | null
          period_end: string
          period_start: string
          stripe_usage_record_id: string | null
          subscription_id: string | null
          updated_at: string | null
        }
        Insert: {
          active_seats?: number
          billed_at?: string | null
          created_at?: string | null
          id?: string
          included_seats?: number
          org_id: string
          overage_amount_cents?: number | null
          overage_seats?: number | null
          period_end: string
          period_start: string
          stripe_usage_record_id?: string | null
          subscription_id?: string | null
          updated_at?: string | null
        }
        Update: {
          active_seats?: number
          billed_at?: string | null
          created_at?: string | null
          id?: string
          included_seats?: number
          org_id?: string
          overage_amount_cents?: number | null
          overage_seats?: number | null
          period_end?: string
          period_start?: string
          stripe_usage_record_id?: string | null
          subscription_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_seat_usage_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_seat_usage_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "organization_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      system_config: {
        Row: {
          created_at: string | null
          description: string | null
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      targets: {
        Row: {
          closed_by: string | null
          created_at: string | null
          created_by: string | null
          end_date: string
          id: string
          meetings_target: number
          outbound_target: number
          previous_target_id: string | null
          proposal_target: number
          revenue_target: number
          start_date: string
          team_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          closed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          end_date: string
          id?: string
          meetings_target: number
          outbound_target: number
          previous_target_id?: string | null
          proposal_target: number
          revenue_target: number
          start_date: string
          team_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          closed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          end_date?: string
          id?: string
          meetings_target?: number
          outbound_target?: number
          previous_target_id?: string | null
          proposal_target?: number
          revenue_target?: number
          start_date?: string
          team_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "targets_previous_target_id_fkey"
            columns: ["previous_target_id"]
            isOneToOne: false
            referencedRelation: "targets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "targets_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "targets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "activities_with_profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "targets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "deal_activities_with_profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "targets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "targets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_meeting_analytics"
            referencedColumns: ["user_id"]
          },
        ]
      }
      task_notifications: {
        Row: {
          created_at: string | null
          id: string
          meeting_id: string | null
          message: string
          metadata: Json | null
          notification_type: string
          read: boolean | null
          task_count: number | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          meeting_id?: string | null
          message: string
          metadata?: Json | null
          notification_type: string
          read?: boolean | null
          task_count?: number | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          meeting_id?: string | null
          message?: string
          metadata?: Json | null
          notification_type?: string
          read?: boolean | null
          task_count?: number | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_notifications_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string
          category: string | null
          clerk_org_id: string | null
          company: string | null
          company_id: string | null
          completed: boolean | null
          completed_at: string | null
          contact_email: string | null
          contact_id: string | null
          contact_name: string | null
          created_at: string | null
          created_by: string
          deal_id: string | null
          description: string | null
          due_date: string | null
          google_etag: string | null
          google_list_id: string | null
          google_position: string | null
          google_task_id: string | null
          id: string
          importance: string | null
          last_synced_at: string | null
          meeting_action_item_id: string | null
          meeting_id: string | null
          metadata: Json | null
          notes: string | null
          owner_id: string | null
          parent_task_id: string | null
          primary_google_list_id: string | null
          priority: string | null
          source: string | null
          status: string | null
          sync_status: string | null
          synced_to_lists: Json | null
          task_type: string | null
          title: string
          type: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to: string
          category?: string | null
          clerk_org_id?: string | null
          company?: string | null
          company_id?: string | null
          completed?: boolean | null
          completed_at?: string | null
          contact_email?: string | null
          contact_id?: string | null
          contact_name?: string | null
          created_at?: string | null
          created_by: string
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          google_etag?: string | null
          google_list_id?: string | null
          google_position?: string | null
          google_task_id?: string | null
          id?: string
          importance?: string | null
          last_synced_at?: string | null
          meeting_action_item_id?: string | null
          meeting_id?: string | null
          metadata?: Json | null
          notes?: string | null
          owner_id?: string | null
          parent_task_id?: string | null
          primary_google_list_id?: string | null
          priority?: string | null
          source?: string | null
          status?: string | null
          sync_status?: string | null
          synced_to_lists?: Json | null
          task_type?: string | null
          title: string
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string
          category?: string | null
          clerk_org_id?: string | null
          company?: string | null
          company_id?: string | null
          completed?: boolean | null
          completed_at?: string | null
          contact_email?: string | null
          contact_id?: string | null
          contact_name?: string | null
          created_at?: string | null
          created_by?: string
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          google_etag?: string | null
          google_list_id?: string | null
          google_position?: string | null
          google_task_id?: string | null
          id?: string
          importance?: string | null
          last_synced_at?: string | null
          meeting_action_item_id?: string | null
          meeting_id?: string | null
          metadata?: Json | null
          notes?: string | null
          owner_id?: string | null
          parent_task_id?: string | null
          primary_google_list_id?: string | null
          priority?: string | null
          source?: string | null
          status?: string | null
          sync_status?: string | null
          synced_to_lists?: Json | null
          task_type?: string | null
          title?: string
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_tasks_company_id"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_tasks_contact_id"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "activities_with_profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "deal_activities_with_profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "team_meeting_analytics"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "activities_with_profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "deal_activities_with_profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_meeting_analytics"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tasks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_meeting_action_item_id_fkey"
            columns: ["meeting_action_item_id"]
            isOneToOne: false
            referencedRelation: "meeting_action_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks_backup_20250106: {
        Row: {
          assigned_to: string | null
          category: string | null
          company: string | null
          company_id: string | null
          completed: boolean | null
          completed_at: string | null
          contact_email: string | null
          contact_id: string | null
          contact_name: string | null
          created_at: string | null
          created_by: string | null
          deal_id: string | null
          description: string | null
          due_date: string | null
          google_etag: string | null
          google_list_id: string | null
          google_position: string | null
          google_task_id: string | null
          id: string | null
          last_synced_at: string | null
          meeting_action_item_id: string | null
          meeting_id: string | null
          metadata: Json | null
          notes: string | null
          owner_id: string | null
          parent_task_id: string | null
          primary_google_list_id: string | null
          priority: string | null
          source: string | null
          status: string | null
          sync_status: string | null
          synced_to_lists: Json | null
          task_type: string | null
          title: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          category?: string | null
          company?: string | null
          company_id?: string | null
          completed?: boolean | null
          completed_at?: string | null
          contact_email?: string | null
          contact_id?: string | null
          contact_name?: string | null
          created_at?: string | null
          created_by?: string | null
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          google_etag?: string | null
          google_list_id?: string | null
          google_position?: string | null
          google_task_id?: string | null
          id?: string | null
          last_synced_at?: string | null
          meeting_action_item_id?: string | null
          meeting_id?: string | null
          metadata?: Json | null
          notes?: string | null
          owner_id?: string | null
          parent_task_id?: string | null
          primary_google_list_id?: string | null
          priority?: string | null
          source?: string | null
          status?: string | null
          sync_status?: string | null
          synced_to_lists?: Json | null
          task_type?: string | null
          title?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          category?: string | null
          company?: string | null
          company_id?: string | null
          completed?: boolean | null
          completed_at?: string | null
          contact_email?: string | null
          contact_id?: string | null
          contact_name?: string | null
          created_at?: string | null
          created_by?: string | null
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          google_etag?: string | null
          google_list_id?: string | null
          google_position?: string | null
          google_task_id?: string | null
          id?: string | null
          last_synced_at?: string | null
          meeting_action_item_id?: string | null
          meeting_id?: string | null
          metadata?: Json | null
          notes?: string | null
          owner_id?: string | null
          parent_task_id?: string | null
          primary_google_list_id?: string | null
          priority?: string | null
          source?: string | null
          status?: string | null
          sync_status?: string | null
          synced_to_lists?: Json | null
          task_type?: string | null
          title?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      team_members: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["member_role"] | null
          team_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["member_role"] | null
          team_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["member_role"] | null
          team_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "activities_with_profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "deal_activities_with_profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_meeting_analytics"
            referencedColumns: ["user_id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      topic_aggregation_queue: {
        Row: {
          attempts: number
          created_at: string
          error_message: string | null
          id: string
          meeting_id: string
          processed_at: string | null
          status: string
          topic_index: number
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          id?: string
          meeting_id: string
          processed_at?: string | null
          status?: string
          topic_index: number
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          id?: string
          meeting_id?: string
          processed_at?: string | null
          status?: string
          topic_index?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topic_aggregation_queue_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_events: {
        Row: {
          created_at: string | null
          event_subtype: string | null
          event_type: string
          id: string
          metadata: Json | null
          org_id: string
          quantity: number
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_subtype?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          org_id: string
          quantity?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_subtype?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          org_id?: string
          quantity?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_ai_feature_settings: {
        Row: {
          created_at: string | null
          feature_key: string
          id: string
          is_enabled: boolean | null
          max_tokens: number | null
          model: string
          provider: string
          temperature: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          feature_key: string
          id?: string
          is_enabled?: boolean | null
          max_tokens?: number | null
          model: string
          provider: string
          temperature?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          feature_key?: string
          id?: string
          is_enabled?: boolean | null
          max_tokens?: number | null
          model?: string
          provider?: string
          temperature?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_automation_rules: {
        Row: {
          action_config: Json | null
          action_type: string
          avg_execution_time_ms: number | null
          canvas_data: Json | null
          clerk_org_id: string | null
          created_at: string | null
          execution_count: number | null
          execution_order: number | null
          failure_count: number | null
          id: string
          is_active: boolean | null
          last_error_message: string | null
          last_execution_at: string | null
          last_execution_status: string | null
          priority_level: number | null
          rule_description: string | null
          rule_name: string
          success_count: number | null
          success_rate: number | null
          template_id: string | null
          trigger_conditions: Json | null
          trigger_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          action_config?: Json | null
          action_type: string
          avg_execution_time_ms?: number | null
          canvas_data?: Json | null
          clerk_org_id?: string | null
          created_at?: string | null
          execution_count?: number | null
          execution_order?: number | null
          failure_count?: number | null
          id?: string
          is_active?: boolean | null
          last_error_message?: string | null
          last_execution_at?: string | null
          last_execution_status?: string | null
          priority_level?: number | null
          rule_description?: string | null
          rule_name: string
          success_count?: number | null
          success_rate?: number | null
          template_id?: string | null
          trigger_conditions?: Json | null
          trigger_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          action_config?: Json | null
          action_type?: string
          avg_execution_time_ms?: number | null
          canvas_data?: Json | null
          clerk_org_id?: string | null
          created_at?: string | null
          execution_count?: number | null
          execution_order?: number | null
          failure_count?: number | null
          id?: string
          is_active?: boolean | null
          last_error_message?: string | null
          last_execution_at?: string | null
          last_execution_status?: string | null
          priority_level?: number | null
          rule_description?: string | null
          rule_name?: string
          success_count?: number | null
          success_rate?: number | null
          template_id?: string | null
          trigger_conditions?: Json | null
          trigger_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_coaching_preferences: {
        Row: {
          bad_example_meeting_ids: string[] | null
          bad_examples: string | null
          coaching_framework: string
          created_at: string | null
          custom_instructions: string | null
          evaluation_criteria: Json | null
          focus_areas: string[] | null
          good_example_meeting_ids: string[] | null
          good_examples: string | null
          id: string
          is_active: boolean | null
          rating_scale: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          bad_example_meeting_ids?: string[] | null
          bad_examples?: string | null
          coaching_framework?: string
          created_at?: string | null
          custom_instructions?: string | null
          evaluation_criteria?: Json | null
          focus_areas?: string[] | null
          good_example_meeting_ids?: string[] | null
          good_examples?: string | null
          id?: string
          is_active?: boolean | null
          rating_scale?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          bad_example_meeting_ids?: string[] | null
          bad_examples?: string | null
          coaching_framework?: string
          created_at?: string | null
          custom_instructions?: string | null
          evaluation_criteria?: Json | null
          focus_areas?: string[] | null
          good_example_meeting_ids?: string[] | null
          good_examples?: string | null
          id?: string
          is_active?: boolean | null
          rating_scale?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_file_search_stores: {
        Row: {
          created_at: string | null
          display_name: string | null
          error_message: string | null
          id: string
          last_sync_at: string | null
          status: string | null
          store_name: string
          total_files: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          error_message?: string | null
          id?: string
          last_sync_at?: string | null
          status?: string | null
          store_name: string
          total_files?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          error_message?: string | null
          id?: string
          last_sync_at?: string | null
          status?: string | null
          store_name?: string
          total_files?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_notifications: {
        Row: {
          action_text: string | null
          action_url: string | null
          created_at: string | null
          dismissed_at: string | null
          expires_at: string | null
          id: string
          is_read: boolean | null
          message: string
          metadata: Json | null
          org_id: string | null
          read_at: string | null
          scheduled_for: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_text?: string | null
          action_url?: string | null
          created_at?: string | null
          dismissed_at?: string | null
          expires_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          metadata?: Json | null
          org_id?: string | null
          read_at?: string | null
          scheduled_for?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          action_text?: string | null
          action_url?: string | null
          created_at?: string | null
          dismissed_at?: string | null
          expires_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          metadata?: Json | null
          org_id?: string | null
          read_at?: string | null
          scheduled_for?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_onboarding_progress: {
        Row: {
          created_at: string | null
          fathom_connected: boolean | null
          features_discovered: Json | null
          first_meeting_synced: boolean | null
          first_proposal_generated: boolean | null
          id: string
          onboarding_completed_at: string | null
          onboarding_step: string | null
          skipped_onboarding: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          fathom_connected?: boolean | null
          features_discovered?: Json | null
          first_meeting_synced?: boolean | null
          first_proposal_generated?: boolean | null
          id?: string
          onboarding_completed_at?: string | null
          onboarding_step?: string | null
          skipped_onboarding?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          fathom_connected?: boolean | null
          features_discovered?: Json | null
          first_meeting_synced?: boolean | null
          first_proposal_generated?: boolean | null
          id?: string
          onboarding_completed_at?: string | null
          onboarding_step?: string | null
          skipped_onboarding?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          is_admin: boolean | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name?: string | null
          id?: string
          is_admin?: boolean | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_admin?: boolean | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          ai_provider_keys: Json | null
          created_at: string | null
          id: string
          preferences: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ai_provider_keys?: Json | null
          created_at?: string | null
          id?: string
          preferences?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ai_provider_keys?: Json | null
          created_at?: string | null
          id?: string
          preferences?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_sync_status: {
        Row: {
          calendar_last_synced_at: string | null
          calendar_sync_token: string | null
          created_at: string | null
          email_last_synced_at: string | null
          email_sync_token: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          calendar_last_synced_at?: string | null
          calendar_sync_token?: string | null
          created_at?: string | null
          email_last_synced_at?: string | null
          email_sync_token?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          calendar_last_synced_at?: string | null
          calendar_sync_token?: string | null
          created_at?: string | null
          email_last_synced_at?: string | null
          email_sync_token?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_tone_settings: {
        Row: {
          brand_voice_description: string | null
          content_type: string
          created_at: string
          cta_style: string | null
          emoji_usage: string
          formality_level: number
          id: string
          include_cta: boolean | null
          max_length_override: number | null
          preferred_keywords: string[] | null
          sample_phrases: string[] | null
          tone_style: string
          updated_at: string
          user_id: string
          words_to_avoid: string[] | null
        }
        Insert: {
          brand_voice_description?: string | null
          content_type: string
          created_at?: string
          cta_style?: string | null
          emoji_usage?: string
          formality_level?: number
          id?: string
          include_cta?: boolean | null
          max_length_override?: number | null
          preferred_keywords?: string[] | null
          sample_phrases?: string[] | null
          tone_style?: string
          updated_at?: string
          user_id: string
          words_to_avoid?: string[] | null
        }
        Update: {
          brand_voice_description?: string | null
          content_type?: string
          created_at?: string
          cta_style?: string | null
          emoji_usage?: string
          formality_level?: number
          id?: string
          include_cta?: boolean | null
          max_length_override?: number | null
          preferred_keywords?: string[] | null
          sample_phrases?: string[] | null
          tone_style?: string
          updated_at?: string
          user_id?: string
          words_to_avoid?: string[] | null
        }
        Relationships: []
      }
      user_writing_styles: {
        Row: {
          created_at: string | null
          examples: string[] | null
          id: string
          is_default: boolean | null
          name: string
          source: string | null
          source_email_count: number | null
          style_metadata: Json | null
          tone_description: string
          trained_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          examples?: string[] | null
          id?: string
          is_default?: boolean | null
          name: string
          source?: string | null
          source_email_count?: number | null
          style_metadata?: Json | null
          tone_description: string
          trained_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          examples?: string[] | null
          id?: string
          is_default?: boolean | null
          name?: string
          source?: string | null
          source_email_count?: number | null
          style_metadata?: Json | null
          tone_description?: string
          trained_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      variable_storage: {
        Row: {
          created_at: string | null
          execution_id: string | null
          expires_at: string | null
          id: string
          key: string
          scope: string
          ttl_seconds: number | null
          updated_at: string | null
          value: Json
          workflow_id: string | null
        }
        Insert: {
          created_at?: string | null
          execution_id?: string | null
          expires_at?: string | null
          id?: string
          key: string
          scope: string
          ttl_seconds?: number | null
          updated_at?: string | null
          value: Json
          workflow_id?: string | null
        }
        Update: {
          created_at?: string | null
          execution_id?: string | null
          expires_at?: string | null
          id?: string
          key?: string
          scope?: string
          ttl_seconds?: number | null
          updated_at?: string | null
          value?: Json
          workflow_id?: string | null
        }
        Relationships: []
      }
      waitlist_admin_actions: {
        Row: {
          action_details: Json | null
          action_type: string
          admin_user_id: string
          created_at: string | null
          id: string
          new_value: Json | null
          notes: string | null
          previous_value: Json | null
          waitlist_entry_id: string
        }
        Insert: {
          action_details?: Json | null
          action_type: string
          admin_user_id: string
          created_at?: string | null
          id?: string
          new_value?: Json | null
          notes?: string | null
          previous_value?: Json | null
          waitlist_entry_id: string
        }
        Update: {
          action_details?: Json | null
          action_type?: string
          admin_user_id?: string
          created_at?: string | null
          id?: string
          new_value?: Json | null
          notes?: string | null
          previous_value?: Json | null
          waitlist_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_admin_actions_waitlist_entry_id_fkey"
            columns: ["waitlist_entry_id"]
            isOneToOne: false
            referencedRelation: "meetings_waitlist"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_email_invites: {
        Row: {
          converted_at: string | null
          created_at: string | null
          email: string
          error_message: string | null
          id: string
          invite_status: string | null
          sent_at: string | null
          updated_at: string | null
          waitlist_entry_id: string
        }
        Insert: {
          converted_at?: string | null
          created_at?: string | null
          email: string
          error_message?: string | null
          id?: string
          invite_status?: string | null
          sent_at?: string | null
          updated_at?: string | null
          waitlist_entry_id: string
        }
        Update: {
          converted_at?: string | null
          created_at?: string | null
          email?: string
          error_message?: string | null
          id?: string
          invite_status?: string | null
          sent_at?: string | null
          updated_at?: string | null
          waitlist_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_email_invites_waitlist_entry_id_fkey"
            columns: ["waitlist_entry_id"]
            isOneToOne: false
            referencedRelation: "meetings_waitlist"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_email_templates: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          email_body: string
          id: string
          is_active: boolean | null
          is_default: boolean | null
          subject_line: string
          template_name: string
          template_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          email_body: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          subject_line: string
          template_name: string
          template_type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          email_body?: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          subject_line?: string
          template_name?: string
          template_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_email_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "activities_with_profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "waitlist_email_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "deal_activities_with_profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "waitlist_email_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_email_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_meeting_analytics"
            referencedColumns: ["user_id"]
          },
        ]
      }
      waitlist_onboarding_progress: {
        Row: {
          account_created_at: string | null
          completed_steps: number | null
          completion_percentage: number | null
          created_at: string | null
          crm_integrated_at: string | null
          first_meeting_synced_at: string | null
          id: string
          meeting_intelligence_used_at: string | null
          profile_completed_at: string | null
          team_invited_at: string | null
          total_steps: number
          updated_at: string | null
          user_id: string
          waitlist_entry_id: string | null
        }
        Insert: {
          account_created_at?: string | null
          completed_steps?: number | null
          completion_percentage?: number | null
          created_at?: string | null
          crm_integrated_at?: string | null
          first_meeting_synced_at?: string | null
          id?: string
          meeting_intelligence_used_at?: string | null
          profile_completed_at?: string | null
          team_invited_at?: string | null
          total_steps?: number
          updated_at?: string | null
          user_id: string
          waitlist_entry_id?: string | null
        }
        Update: {
          account_created_at?: string | null
          completed_steps?: number | null
          completion_percentage?: number | null
          created_at?: string | null
          crm_integrated_at?: string | null
          first_meeting_synced_at?: string | null
          id?: string
          meeting_intelligence_used_at?: string | null
          profile_completed_at?: string | null
          team_invited_at?: string | null
          total_steps?: number
          updated_at?: string | null
          user_id?: string
          waitlist_entry_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_onboarding_progress_waitlist_entry_id_fkey"
            columns: ["waitlist_entry_id"]
            isOneToOne: false
            referencedRelation: "meetings_waitlist"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_shares: {
        Row: {
          id: string
          platform: string
          referral_clicked: boolean | null
          referral_converted: boolean | null
          shared_at: string | null
          waitlist_entry_id: string
        }
        Insert: {
          id?: string
          platform: string
          referral_clicked?: boolean | null
          referral_converted?: boolean | null
          shared_at?: string | null
          waitlist_entry_id: string
        }
        Update: {
          id?: string
          platform?: string
          referral_clicked?: boolean | null
          referral_converted?: boolean | null
          shared_at?: string | null
          waitlist_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_shares_waitlist_entry_id_fkey"
            columns: ["waitlist_entry_id"]
            isOneToOne: false
            referencedRelation: "meetings_waitlist"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_mirror_config: {
        Row: {
          created_at: string | null
          filter_rules: Json | null
          id: string
          is_active: boolean | null
          mirror_percentage: number | null
          source_environment: string
          target_environment: string
          updated_at: string | null
          workflow_id: string
        }
        Insert: {
          created_at?: string | null
          filter_rules?: Json | null
          id?: string
          is_active?: boolean | null
          mirror_percentage?: number | null
          source_environment: string
          target_environment: string
          updated_at?: string | null
          workflow_id: string
        }
        Update: {
          created_at?: string | null
          filter_rules?: Json | null
          id?: string
          is_active?: boolean | null
          mirror_percentage?: number | null
          source_environment?: string
          target_environment?: string
          updated_at?: string | null
          workflow_id?: string
        }
        Relationships: []
      }
      workflow_batch_windows: {
        Row: {
          created_at: string | null
          current_batch: Json | null
          current_count: number | null
          current_size: number | null
          id: string
          node_id: string
          window_closes_at: string | null
          window_size: number
          window_started_at: string | null
          window_type: string | null
          workflow_id: string
        }
        Insert: {
          created_at?: string | null
          current_batch?: Json | null
          current_count?: number | null
          current_size?: number | null
          id?: string
          node_id: string
          window_closes_at?: string | null
          window_size: number
          window_started_at?: string | null
          window_type?: string | null
          workflow_id: string
        }
        Update: {
          created_at?: string | null
          current_batch?: Json | null
          current_count?: number | null
          current_size?: number | null
          id?: string
          node_id?: string
          window_closes_at?: string | null
          window_size?: number
          window_started_at?: string | null
          window_type?: string | null
          workflow_id?: string
        }
        Relationships: []
      }
      workflow_circuit_breakers: {
        Row: {
          created_at: string | null
          failure_count: number | null
          failure_threshold: number | null
          id: string
          last_failure_at: string | null
          node_id: string
          opens_at: string | null
          state: string | null
          success_count: number | null
          success_threshold: number | null
          timeout_seconds: number | null
          updated_at: string | null
          workflow_id: string | null
        }
        Insert: {
          created_at?: string | null
          failure_count?: number | null
          failure_threshold?: number | null
          id?: string
          last_failure_at?: string | null
          node_id: string
          opens_at?: string | null
          state?: string | null
          success_count?: number | null
          success_threshold?: number | null
          timeout_seconds?: number | null
          updated_at?: string | null
          workflow_id?: string | null
        }
        Update: {
          created_at?: string | null
          failure_count?: number | null
          failure_threshold?: number | null
          id?: string
          last_failure_at?: string | null
          node_id?: string
          opens_at?: string | null
          state?: string | null
          success_count?: number | null
          success_threshold?: number | null
          timeout_seconds?: number | null
          updated_at?: string | null
          workflow_id?: string | null
        }
        Relationships: []
      }
      workflow_contracts: {
        Row: {
          created_at: string | null
          id: string
          input_schema: Json
          is_current: boolean | null
          node_id: string
          node_type: string
          output_schema: Json
          updated_at: string | null
          version: number | null
          workflow_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          input_schema?: Json
          is_current?: boolean | null
          node_id: string
          node_type: string
          output_schema?: Json
          updated_at?: string | null
          version?: number | null
          workflow_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          input_schema?: Json
          is_current?: boolean | null
          node_id?: string
          node_type?: string
          output_schema?: Json
          updated_at?: string | null
          version?: number | null
          workflow_id?: string
        }
        Relationships: []
      }
      workflow_dead_letter_queue: {
        Row: {
          created_at: string | null
          error_count: number | null
          error_message: string | null
          execution_id: string | null
          id: string
          max_retries: number | null
          next_retry_at: string | null
          resolved_at: string | null
          status: string | null
          trigger_data: Json | null
          workflow_id: string
        }
        Insert: {
          created_at?: string | null
          error_count?: number | null
          error_message?: string | null
          execution_id?: string | null
          id?: string
          max_retries?: number | null
          next_retry_at?: string | null
          resolved_at?: string | null
          status?: string | null
          trigger_data?: Json | null
          workflow_id: string
        }
        Update: {
          created_at?: string | null
          error_count?: number | null
          error_message?: string | null
          execution_id?: string | null
          id?: string
          max_retries?: number | null
          next_retry_at?: string | null
          resolved_at?: string | null
          status?: string | null
          trigger_data?: Json | null
          workflow_id?: string
        }
        Relationships: []
      }
      workflow_environment_promotions: {
        Row: {
          changes_diff: Json | null
          from_environment: string
          id: string
          promoted_at: string | null
          promoted_by: string | null
          rollback_data: Json | null
          status: string | null
          to_environment: string
          workflow_id: string
        }
        Insert: {
          changes_diff?: Json | null
          from_environment: string
          id?: string
          promoted_at?: string | null
          promoted_by?: string | null
          rollback_data?: Json | null
          status?: string | null
          to_environment: string
          workflow_id: string
        }
        Update: {
          changes_diff?: Json | null
          from_environment?: string
          id?: string
          promoted_at?: string | null
          promoted_by?: string | null
          rollback_data?: Json | null
          status?: string | null
          to_environment?: string
          workflow_id?: string
        }
        Relationships: []
      }
      workflow_environments: {
        Row: {
          config: Json | null
          created_at: string | null
          environment: string
          id: string
          is_active: boolean | null
          rate_limits: Json | null
          secrets: Json | null
          updated_at: string | null
          variables: Json | null
          webhook_urls: Json | null
          workflow_id: string
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          environment: string
          id?: string
          is_active?: boolean | null
          rate_limits?: Json | null
          secrets?: Json | null
          updated_at?: string | null
          variables?: Json | null
          webhook_urls?: Json | null
          workflow_id: string
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          environment?: string
          id?: string
          is_active?: boolean | null
          rate_limits?: Json | null
          secrets?: Json | null
          updated_at?: string | null
          variables?: Json | null
          webhook_urls?: Json | null
          workflow_id?: string
        }
        Relationships: []
      }
      workflow_executions: {
        Row: {
          action_results: Json | null
          clerk_org_id: string | null
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          execution_status: string
          id: string
          started_at: string | null
          trigger_data: Json | null
          trigger_type: string
          updated_at: string | null
          user_id: string
          workflow_id: string
        }
        Insert: {
          action_results?: Json | null
          clerk_org_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          execution_status?: string
          id?: string
          started_at?: string | null
          trigger_data?: Json | null
          trigger_type: string
          updated_at?: string | null
          user_id: string
          workflow_id: string
        }
        Update: {
          action_results?: Json | null
          clerk_org_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          execution_status?: string
          id?: string
          started_at?: string | null
          trigger_data?: Json | null
          trigger_type?: string
          updated_at?: string | null
          user_id?: string
          workflow_id?: string
        }
        Relationships: []
      }
      workflow_forms: {
        Row: {
          config: Json
          created_at: string | null
          created_by: string | null
          form_id: string
          id: string
          is_test: boolean | null
          updated_at: string | null
          workflow_id: string | null
        }
        Insert: {
          config?: Json
          created_at?: string | null
          created_by?: string | null
          form_id: string
          id?: string
          is_test?: boolean | null
          updated_at?: string | null
          workflow_id?: string | null
        }
        Update: {
          config?: Json
          created_at?: string | null
          created_by?: string | null
          form_id?: string
          id?: string
          is_test?: boolean | null
          updated_at?: string | null
          workflow_id?: string | null
        }
        Relationships: []
      }
      workflow_idempotency_keys: {
        Row: {
          created_at: string | null
          execution_id: string | null
          expires_at: string | null
          id: string
          idempotency_key: string
          result: Json | null
          status: string | null
          workflow_id: string
        }
        Insert: {
          created_at?: string | null
          execution_id?: string | null
          expires_at?: string | null
          id?: string
          idempotency_key: string
          result?: Json | null
          status?: string | null
          workflow_id: string
        }
        Update: {
          created_at?: string | null
          execution_id?: string | null
          expires_at?: string | null
          id?: string
          idempotency_key?: string
          result?: Json | null
          status?: string | null
          workflow_id?: string
        }
        Relationships: []
      }
      workflow_mcp_logs: {
        Row: {
          duration_ms: number | null
          error_message: string | null
          executed_at: string | null
          id: string
          mcp_server: string
          operation: string
          params: Json | null
          result: Json | null
          status: string | null
          user_id: string
          workflow_id: string | null
        }
        Insert: {
          duration_ms?: number | null
          error_message?: string | null
          executed_at?: string | null
          id?: string
          mcp_server: string
          operation: string
          params?: Json | null
          result?: Json | null
          status?: string | null
          user_id: string
          workflow_id?: string | null
        }
        Update: {
          duration_ms?: number | null
          error_message?: string | null
          executed_at?: string | null
          id?: string
          mcp_server?: string
          operation?: string
          params?: Json | null
          result?: Json | null
          status?: string | null
          user_id?: string
          workflow_id?: string | null
        }
        Relationships: []
      }
      workflow_rate_limits: {
        Row: {
          burst_size: number | null
          created_at: string | null
          current_tokens: number | null
          id: string
          last_refill_at: string | null
          limit_key: string
          node_id: string | null
          requests_per_hour: number | null
          requests_per_minute: number | null
          requests_per_second: number | null
          workflow_id: string | null
        }
        Insert: {
          burst_size?: number | null
          created_at?: string | null
          current_tokens?: number | null
          id?: string
          last_refill_at?: string | null
          limit_key: string
          node_id?: string | null
          requests_per_hour?: number | null
          requests_per_minute?: number | null
          requests_per_second?: number | null
          workflow_id?: string | null
        }
        Update: {
          burst_size?: number | null
          created_at?: string | null
          current_tokens?: number | null
          id?: string
          last_refill_at?: string | null
          limit_key?: string
          node_id?: string | null
          requests_per_hour?: number | null
          requests_per_minute?: number | null
          requests_per_second?: number | null
          workflow_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      activities_with_profile: {
        Row: {
          amount: number | null
          auto_matched: boolean | null
          avatar_url: string | null
          clerk_org_id: string | null
          client_name: string | null
          company_id: string | null
          contact_id: string | null
          contact_identifier: string | null
          contact_identifier_type: string | null
          created_at: string | null
          date: string | null
          deal_id: string | null
          details: string | null
          execution_order: number | null
          id: string | null
          is_processed: boolean | null
          is_rebooking: boolean | null
          is_self_generated: boolean | null
          is_split: boolean | null
          meeting_id: string | null
          next_actions_count: number | null
          next_actions_generated_at: string | null
          original_activity_id: string | null
          outbound_type: string | null
          owner_id: string | null
          priority: string | null
          profile_avatar_url: string | null
          profile_full_name: string | null
          profile_id: string | null
          proposal_date: string | null
          quantity: number | null
          sale_date: string | null
          sales_rep: string | null
          savvycal_booking_id: string | null
          savvycal_link_id: string | null
          split_percentage: number | null
          status: string | null
          subject: string | null
          type: string | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_original_activity_id_fkey"
            columns: ["original_activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_original_activity_id_fkey"
            columns: ["original_activity_id"]
            isOneToOne: false
            referencedRelation: "activities_with_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_activities_company_id"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_activities_contact_id"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events_with_contacts: {
        Row: {
          ai_generated: boolean | null
          ai_suggested_time: boolean | null
          all_day: boolean | null
          attendees_count: number | null
          busy_status: string | null
          calendar_id: string | null
          clerk_org_id: string | null
          color: string | null
          company_domain: string | null
          company_id: string | null
          company_name: string | null
          contact_email: string | null
          contact_id: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          creator_email: string | null
          deal_id: string | null
          description: string | null
          end_time: string | null
          etag: string | null
          external_id: string | null
          external_updated_at: string | null
          hangout_link: string | null
          html_link: string | null
          id: string | null
          location: string | null
          mcp_connection_id: string | null
          meeting_id: string | null
          meeting_prep: Json | null
          meeting_provider: string | null
          meeting_url: string | null
          org_id: string | null
          organizer_email: string | null
          original_start_time: string | null
          raw_data: Json | null
          recurrence_id: string | null
          recurrence_rule: string | null
          reminders: Json | null
          response_status: string | null
          start_time: string | null
          status: string | null
          sync_error: string | null
          sync_status: string | null
          synced_at: string | null
          title: string | null
          transparency: string | null
          updated_at: string | null
          user_id: string | null
          visibility: string | null
          workflow_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendar_calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_mcp_connection_id_fkey"
            columns: ["mcp_connection_id"]
            isOneToOne: false
            referencedRelation: "mcp_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      client_churn_analytics: {
        Row: {
          churn_date: string | null
          churn_reason: string | null
          churn_status: string | null
          company_name: string | null
          days_until_final_billing: number | null
          final_billing_date: string | null
          id: string | null
          notice_given_date: string | null
          remaining_revenue_estimate: number | null
          status: Database["public"]["Enums"]["client_status"] | null
          subscription_amount: number | null
        }
        Insert: {
          churn_date?: string | null
          churn_reason?: string | null
          churn_status?: never
          company_name?: string | null
          days_until_final_billing?: never
          final_billing_date?: string | null
          id?: string | null
          notice_given_date?: string | null
          remaining_revenue_estimate?: never
          status?: Database["public"]["Enums"]["client_status"] | null
          subscription_amount?: number | null
        }
        Update: {
          churn_date?: string | null
          churn_reason?: string | null
          churn_status?: never
          company_name?: string | null
          days_until_final_billing?: never
          final_billing_date?: string | null
          id?: string | null
          notice_given_date?: string | null
          remaining_revenue_estimate?: never
          status?: Database["public"]["Enums"]["client_status"] | null
          subscription_amount?: number | null
        }
        Relationships: []
      }
      deal_activities_with_profile: {
        Row: {
          activity_type: string | null
          completed: boolean | null
          contact_email: string | null
          created_at: string | null
          deal_id: string | null
          due_date: string | null
          id: string | null
          is_matched: boolean | null
          notes: string | null
          profile_avatar_url: string | null
          profile_full_name: string | null
          profile_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_migration_review_details: {
        Row: {
          deal_id: string | null
          deal_name: string | null
          deal_value: number | null
          flagged_at: string | null
          original_company: string | null
          original_contact_email: string | null
          original_contact_name: string | null
          owner_email: string | null
          owner_id: string | null
          reason: string | null
          resolution_notes: string | null
          resolved_at: string | null
          review_id: string | null
          status: string | null
          suggested_company_id: string | null
          suggested_company_name: string | null
          suggested_contact_id: string | null
          suggested_contact_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_migration_reviews_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_migration_reviews_suggested_company_id_fkey"
            columns: ["suggested_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_migration_reviews_suggested_contact_id_fkey"
            columns: ["suggested_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_splits_with_users: {
        Row: {
          amount: number | null
          clerk_org_id: string | null
          created_at: string | null
          deal_id: string | null
          deal_name: string | null
          deal_owner_id: string | null
          deal_value: number | null
          email: string | null
          first_name: string | null
          full_name: string | null
          id: string | null
          last_name: string | null
          notes: string | null
          percentage: number | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_splits_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_splits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "activities_with_profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "deal_splits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "deal_activities_with_profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "deal_splits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_splits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_meeting_analytics"
            referencedColumns: ["user_id"]
          },
        ]
      }
      lead_source_summary: {
        Row: {
          campaign: string | null
          channel: string | null
          converted_leads: number | null
          first_lead_at: string | null
          last_lead_at: string | null
          medium: string | null
          owner_id: string | null
          prepping_leads: number | null
          ready_leads: number | null
          source_id: string | null
          source_key: string | null
          source_name: string | null
          total_leads: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "activities_with_profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "leads_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "deal_activities_with_profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "leads_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "team_meeting_analytics"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "leads_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_counts_by_user: {
        Row: {
          error_notifications: number | null
          first_notification_at: string | null
          info_notifications: number | null
          last_24_hours: number | null
          last_7_days: number | null
          last_hour: number | null
          last_notification_at: string | null
          success_notifications: number | null
          total_notifications: number | null
          unread_notifications: number | null
          user_email: string | null
          user_id: string | null
          warning_notifications: number | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "activities_with_profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "deal_activities_with_profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_meeting_analytics"
            referencedColumns: ["user_id"]
          },
        ]
      }
      notification_flood_alerts: {
        Row: {
          alert_level: string | null
          alert_reason: string | null
          error_notifications: number | null
          last_24_hours: number | null
          last_7_days: number | null
          last_hour: number | null
          last_notification_at: string | null
          recommended_action: string | null
          total_notifications: number | null
          unread_notifications: number | null
          user_email: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "activities_with_profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "deal_activities_with_profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_meeting_analytics"
            referencedColumns: ["user_id"]
          },
        ]
      }
      notification_rate_limit_status: {
        Row: {
          count_last_24_hours: number | null
          count_last_hour: number | null
          daily_percent_used: number | null
          daily_remaining: number | null
          hourly_percent_used: number | null
          hourly_remaining: number | null
          last_notification_attempt: string | null
          limit_status: string | null
          notification_type: string | null
          user_email: string | null
          user_id: string | null
        }
        Relationships: []
      }
      notification_type_breakdown: {
        Row: {
          affected_users: number | null
          category: string | null
          entity_type: string | null
          first_created_at: string | null
          last_24_hours_count: number | null
          last_7_days_count: number | null
          last_created_at: string | null
          last_hour_count: number | null
          notification_type: string | null
          recent_titles_sample: string | null
          total_count: number | null
          unread_count: number | null
        }
        Relationships: []
      }
      recent_notification_activity: {
        Row: {
          category: string | null
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          hours_ago: number | null
          id: string | null
          notifications_in_same_hour: number | null
          read: boolean | null
          title: string | null
          type: string | null
          user_email: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "activities_with_profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "deal_activities_with_profile"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "team_meeting_analytics"
            referencedColumns: ["user_id"]
          },
        ]
      }
      team_meeting_analytics: {
        Row: {
          avg_coach_rating: number | null
          avg_sentiment: number | null
          avg_talk_time: number | null
          email: string | null
          first_meeting_date: string | null
          full_name: string | null
          last_meeting_date: string | null
          negative_meetings: number | null
          org_id: string | null
          positive_meetings: number | null
          total_duration_minutes: number | null
          total_meetings: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_task_list_configs: {
        Row: {
          auto_create_in_list: boolean | null
          created_at: string | null
          display_order: number | null
          google_list_id: string | null
          id: string | null
          is_primary: boolean | null
          list_title: string | null
          list_type: string | null
          priority_description: string | null
          priority_filter: string[] | null
          status_filter: string[] | null
          sync_direction: string | null
          sync_enabled: boolean | null
          task_categories: string[] | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          auto_create_in_list?: boolean | null
          created_at?: string | null
          display_order?: number | null
          google_list_id?: string | null
          id?: string | null
          is_primary?: boolean | null
          list_title?: string | null
          list_type?: never
          priority_description?: never
          priority_filter?: string[] | null
          status_filter?: string[] | null
          sync_direction?: string | null
          sync_enabled?: boolean | null
          task_categories?: string[] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          auto_create_in_list?: boolean | null
          created_at?: string | null
          display_order?: number | null
          google_list_id?: string | null
          id?: string | null
          is_primary?: boolean | null
          list_title?: string | null
          list_type?: never
          priority_description?: never
          priority_filter?: string[] | null
          status_filter?: string[] | null
          sync_direction?: string | null
          sync_enabled?: boolean | null
          task_categories?: string[] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      v_failed_transcript_retries: {
        Row: {
          attempt_count: number | null
          completed_at: string | null
          created_at: string | null
          fathom_recording_id: string | null
          id: string | null
          last_error: string | null
          max_attempts: number | null
          meeting_id: string | null
          meeting_title: string | null
          minutes_since_last_update: number | null
          recording_id: string | null
          updated_at: string | null
          user_email: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fathom_transcript_retry_jobs_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      v_pending_transcript_retries: {
        Row: {
          attempt_count: number | null
          created_at: string | null
          fathom_recording_id: string | null
          id: string | null
          last_error: string | null
          max_attempts: number | null
          meeting_id: string | null
          meeting_title: string | null
          minutes_until_retry: number | null
          next_retry_at: string | null
          recording_id: string | null
          retry_status: string | null
          updated_at: string | null
          user_email: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fathom_transcript_retry_jobs_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      v_transcript_retry_stats: {
        Row: {
          avg_attempts_to_complete: number | null
          completed_count: number | null
          failed_count: number | null
          max_attempts_made: number | null
          pending_count: number | null
          processing_count: number | null
          ready_to_retry: number | null
          unique_meetings_with_retries: number | null
          unique_users_with_retries: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_next_action_suggestion: {
        Args: { p_suggestion_id: string; p_task_data?: Json }
        Returns: string
      }
      accept_org_invitation: {
        Args: { p_token: string }
        Returns: {
          error_message: string
          org_id: string
          org_name: string
          role: string
          success: boolean
        }[]
      }
      aggregate_company_meeting_insights: {
        Args: { p_company_id: string }
        Returns: undefined
      }
      aggregate_contact_meeting_insights: {
        Args: { p_contact_id: string }
        Returns: undefined
      }
      analyze_action_item_with_ai: {
        Args: { p_action_item_id: string }
        Returns: Json
      }
      apply_ai_analysis_to_task: {
        Args: {
          p_action_item_id: string
          p_confidence_score: number
          p_ideal_deadline: string
          p_reasoning: string
          p_task_type: string
        }
        Returns: boolean
      }
      approve_pipeline_recommendation: {
        Args: {
          p_notes?: string
          p_recommendation_id: string
          p_reviewed_by: string
        }
        Returns: boolean
      }
      auto_apply_pipeline_recommendations: { Args: never; Returns: number }
      auto_churn_expired_clients: { Args: never; Returns: number }
      backfill_next_actions_for_meetings: {
        Args: { p_limit?: number; p_min_date?: string }
        Returns: Json
      }
      bulk_grant_waitlist_access: {
        Args: {
          p_admin_notes?: string
          p_admin_user_id: string
          p_entry_ids: string[]
        }
        Returns: Json
      }
      calculate_activity_points: {
        Args: {
          activity_type: Database["public"]["Enums"]["activity_type"]
          amount?: number
        }
        Returns: number
      }
      calculate_activity_trend: {
        Args: {
          activity_type: Database["public"]["Enums"]["activity_type"]
          end_date: string
          start_date: string
          user_id: string
        }
        Returns: number
      }
      calculate_contact_engagement_score: {
        Args: {
          p_avg_sentiment: number
          p_days_since_last_meeting: number
          p_total_meetings: number
        }
        Returns: number
      }
      calculate_deal_annual_value: {
        Args: { p_monthly_mrr: number; p_one_off_revenue: number }
        Returns: number
      }
      calculate_deal_total_value: {
        Args: { p_monthly_mrr: number; p_one_off_revenue: number }
        Returns: number
      }
      calculate_meeting_content_costs: {
        Args: { p_meeting_id: string }
        Returns: {
          content_cost_cents: number
          topics_cost_cents: number
          total_cost_cents: number
          total_tokens: number
        }[]
      }
      calculate_seat_overage: {
        Args: { p_subscription_id: string }
        Returns: {
          active_seats: number
          included_seats: number
          overage_amount_cents: number
          overage_seats: number
        }[]
      }
      calculate_sentiment_trend: {
        Args: { p_company_id: string; p_contact_id?: string }
        Returns: number
      }
      calculate_split_amount: {
        Args: { p_deal_id: string; p_percentage: number }
        Returns: number
      }
      calculate_token_cost: {
        Args: {
          p_input_tokens: number
          p_model: string
          p_output_tokens: number
          p_provider: string
        }
        Returns: number
      }
      calculate_topic_relevance_score: {
        Args: { p_frequency_score: number; p_recency_score: number }
        Returns: number
      }
      calculate_win_rate: {
        Args: { end_date: string; start_date: string; user_id: string }
        Returns: number
      }
      call_suggest_next_actions_async: {
        Args: {
          p_activity_id: string
          p_activity_type: string
          p_user_id: string
        }
        Returns: undefined
      }
      can_user_access_meeting_action_item: {
        Args: { p_action_item_id: string; p_user_id?: string }
        Returns: boolean
      }
      check_notification_floods: {
        Args: { p_alert_threshold?: string }
        Returns: Json
      }
      check_rate_limit: {
        Args: { key_hash_val: string }
        Returns: {
          allowed: boolean
          current_usage: number
          limit_value: number
        }[]
      }
      cleanup_expired_fathom_oauth_states: { Args: never; Returns: undefined }
      cleanup_expired_google_oauth_states: { Args: never; Returns: undefined }
      cleanup_expired_google_tokens: { Args: never; Returns: undefined }
      cleanup_notification_rate_limits: { Args: never; Returns: number }
      cleanup_old_cron_logs: { Args: never; Returns: undefined }
      cleanup_old_notifications: { Args: never; Returns: undefined }
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      cleanup_old_relationship_health_history: {
        Args: { days_to_keep_hourly?: number }
        Returns: number
      }
      clear_audit_context: { Args: never; Returns: undefined }
      complete_transcript_retry_job: {
        Args: { p_meeting_id: string }
        Returns: undefined
      }
      create_api_key: {
        Args: {
          expires_days?: number
          key_name: string
          permissions_json?: Json
          rate_limit_val?: number
          user_uuid?: string
        }
        Returns: {
          api_key: string
          key_hash: string
          key_id: string
        }[]
      }
      create_clerk_user_mapping: {
        Args: {
          p_clerk_user_id: string
          p_email: string
          p_supabase_user_id: string
        }
        Returns: boolean
      }
      create_org_admin_notification: {
        Args: {
          p_action_text?: string
          p_action_url?: string
          p_message: string
          p_metadata?: Json
          p_org_id: string
          p_title: string
          p_type: string
        }
        Returns: string[]
      }
      create_profile_for_clerk_user: {
        Args: {
          p_clerk_user_id: string
          p_email: string
          p_first_name?: string
          p_full_name?: string
          p_last_name?: string
        }
        Returns: string
      }
      create_task_creation_notification: {
        Args: {
          p_meeting_id: string
          p_meeting_title: string
          p_task_count: number
          p_task_ids: string[]
          p_user_id: string
        }
        Returns: string
      }
      create_task_notification: {
        Args: {
          p_action_url?: string
          p_message: string
          p_task_id: string
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: string
      }
      current_user_id: { Args: never; Returns: string }
      current_user_orgs: {
        Args: { p_user_id: string }
        Returns: {
          org_id: string
        }[]
      }
      custom_auth_uid: { Args: never; Returns: string }
      dismiss_next_action_suggestion: {
        Args: { p_feedback?: string; p_suggestion_id: string }
        Returns: boolean
      }
      enqueue_transcript_retry: {
        Args: {
          p_initial_attempt_count?: number
          p_meeting_id: string
          p_recording_id: string
          p_user_id: string
        }
        Returns: string
      }
      execute_automation_action: {
        Args: {
          rule: Database["public"]["Tables"]["user_automation_rules"]["Row"]
          trigger_data: Json
          user_id: string
        }
        Returns: Json
      }
      expire_old_recommendations: { Args: never; Returns: number }
      find_orgs_by_email_domain: {
        Args: { p_domain: string; p_user_id: string }
        Returns: {
          id: string
          member_count: number
          name: string
        }[]
      }
      generate_api_key:
        | { Args: never; Returns: string }
        | { Args: { prefix?: string }; Returns: string }
      generate_pipeline_recommendation_from_meeting: {
        Args: { p_meeting_id: string; p_user_id: string }
        Returns: string
      }
      generate_referral_code: { Args: never; Returns: string }
      get_active_fathom_integration: {
        Args: { p_user_id: string }
        Returns: {
          access_token: string
          fathom_user_email: string
          fathom_user_id: string
          id: string
          last_sync_at: string
          refresh_token: string
          scopes: string[]
          token_expires_at: string
          user_id: string
        }[]
      }
      get_active_interventions: {
        Args: { user_id_param: string }
        Returns: {
          ai_recommendation_score: number | null
          click_count: number | null
          clicked_at: string | null
          company_id: string | null
          contact_id: string | null
          context_trigger: string
          created_at: string | null
          days_since_last_contact: number | null
          deal_id: string | null
          delivered_at: string | null
          first_open_at: string | null
          health_score_at_send: number | null
          id: string
          intervention_body: string
          intervention_channel: string
          metadata: Json | null
          open_count: number | null
          opened_at: string | null
          outcome: string | null
          outcome_notes: string | null
          personalization_data: Json | null
          recovered_at: string | null
          relationship_health_id: string
          replied_at: string | null
          response_text: string | null
          response_type: string | null
          sent_at: string | null
          status: string
          subject_line: string | null
          suggested_reply: string | null
          template_id: string | null
          template_type: string
          updated_at: string | null
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "interventions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_activity_summary: {
        Args: { end_date: string; start_date: string; user_id: string }
        Returns: {
          activity_type: string
          count: number
          points: number
          trend: number
        }[]
      }
      get_audit_history: {
        Args: { p_limit?: number; p_record_id: string; p_table_name: string }
        Returns: {
          action: string
          audit_id: string
          changed_at: string
          changed_by: string
          changed_fields: string[]
          new_value: Json
          old_value: Json
        }[]
      }
      get_auth_provider: { Args: never; Returns: string }
      get_avg_health_change_per_day: {
        Args: { days?: number; relationship_health_id_param: string }
        Returns: number
      }
      get_avg_response_time: {
        Args: { contact_id_param: string }
        Returns: number
      }
      get_calendar_events_in_range: {
        Args: {
          p_calendar_ids?: string[]
          p_end_date: string
          p_start_date: string
          p_user_id: string
        }
        Returns: {
          all_day: boolean
          attendees_count: number
          calendar_id: string
          color: string
          company_id: string
          company_name: string
          contact_id: string
          contact_name: string
          creator_email: string
          description: string
          end_time: string
          external_id: string
          html_link: string
          id: string
          location: string
          meeting_url: string
          organizer_email: string
          raw_data: Json
          start_time: string
          status: string
          sync_status: string
          title: string
        }[]
      }
      get_changed_fields: {
        Args: { new_data: Json; old_data: Json }
        Returns: string[]
      }
      get_clerk_org_id: { Args: never; Returns: string }
      get_clerk_user_id: { Args: never; Returns: string }
      get_coaching_reference_meetings: {
        Args: {
          p_bad_meeting_ids?: string[]
          p_good_meeting_ids?: string[]
          p_user_id: string
        }
        Returns: Json
      }
      get_communication_frequency: {
        Args: { contact_id_param: string; days?: number }
        Returns: number
      }
      get_contact_note_stats: {
        Args: { target_contact_id: string }
        Returns: {
          last_note_date: string
          pinned_notes: number
          recent_notes: number
          total_notes: number
        }[]
      }
      get_content_with_topics: {
        Args: { p_content_id: string }
        Returns: {
          content: string
          content_id: string
          content_type: string
          title: string
          topics: Json
        }[]
      }
      get_current_audit_context: {
        Args: never
        Returns: {
          impersonated_user_id: string
          is_impersonating: boolean
          original_user_id: string
        }[]
      }
      get_current_cost_rate: {
        Args: { p_model: string; p_provider: string }
        Returns: {
          input_cost_per_million: number
          output_cost_per_million: number
        }[]
      }
      get_days_since_last_contact: {
        Args: { contact_id_param: string }
        Returns: number
      }
      get_days_until_churn: {
        Args: { final_billing_date: string }
        Returns: number
      }
      get_deal_note_stats: {
        Args: { target_deal_id: string }
        Returns: {
          last_note_date: string
          pinned_notes: number
          recent_notes: number
          total_notes: number
        }[]
      }
      get_default_waitlist_email_template: {
        Args: { p_template_type: string }
        Returns: {
          created_at: string | null
          created_by: string | null
          description: string | null
          email_body: string
          id: string
          is_active: boolean | null
          is_default: boolean | null
          subject_line: string
          template_name: string
          template_type: string
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "waitlist_email_templates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_email_open_rate: {
        Args: { contact_id_param: string; days?: number }
        Returns: number
      }
      get_field_history: {
        Args: {
          p_field_name: string
          p_limit?: number
          p_record_id: string
          p_table_name: string
        }
        Returns: {
          changed_at: string
          changed_by: string
          new_value: string
          old_value: string
        }[]
      }
      get_free_tier_plan: {
        Args: never
        Returns: {
          features: Json
          id: string
          max_meetings_per_month: number
          max_users: number
          name: string
          slug: string
        }[]
      }
      get_global_topics_filtered: {
        Args: {
          p_company_ids?: string[]
          p_contact_ids?: string[]
          p_date_from?: string
          p_date_to?: string
          p_limit?: number
          p_offset?: number
          p_search_query?: string
          p_sort_by?: string
          p_user_id: string
        }
        Returns: {
          canonical_description: string
          canonical_title: string
          companies: string[]
          contacts: string[]
          first_seen_at: string
          id: string
          last_seen_at: string
          meeting_count: number
          relevance_score: number
          source_count: number
        }[]
      }
      get_global_topics_stats: {
        Args: { p_user_id: string }
        Returns: {
          avg_sources_per_topic: number
          newest_topic_date: string
          oldest_topic_date: string
          total_companies: number
          total_contacts: number
          total_meetings: number
          total_topics: number
        }[]
      }
      get_google_access_token: { Args: { p_user_id: string }; Returns: string }
      get_health_score_trend: {
        Args: { days?: number; relationship_health_id_param: string }
        Returns: {
          date: string
          score: number
          status: string
        }[]
      }
      get_highest_ghost_signal_severity: {
        Args: { relationship_health_id_param: string }
        Returns: string
      }
      get_intervention_success_rate: {
        Args: { user_id_param: string }
        Returns: {
          recovery_rate_percent: number
          response_rate_percent: number
          total_recovered: number
          total_replied: number
          total_sent: number
        }[]
      }
      get_last_communication_date: {
        Args: { contact_id_param: string }
        Returns: string
      }
      get_last_response_date: {
        Args: { contact_id_param: string }
        Returns: string
      }
      get_latest_content: {
        Args: { p_content_type: string; p_meeting_id: string }
        Returns: {
          content: string
          created_at: string
          id: string
          title: string
          version: number
        }[]
      }
      get_meeting_index_status: {
        Args: { p_user_id: string }
        Returns: {
          failed_count: number
          indexed_count: number
          last_indexed_at: string
          pending_count: number
          total_meetings: number
        }[]
      }
      get_meeting_index_status_v2: {
        Args: { p_requesting_user_id: string; p_target_user_id?: string }
        Returns: {
          failed_count: number
          indexed_count: number
          last_indexed_at: string
          pending_count: number
          total_meetings: number
        }[]
      }
      get_meeting_retry_status: {
        Args: { p_meeting_id: string }
        Returns: {
          attempt_count: number
          has_transcript: boolean
          last_error: string
          last_transcript_fetch_at: string
          max_attempts: number
          meeting_id: string
          next_retry_at: string
          retry_job_status: string
          transcript_fetch_attempts: number
        }[]
      }
      get_my_google_integration: {
        Args: never
        Returns: {
          created_at: string
          email: string
          expires_at: string
          id: string
          is_active: boolean
          scopes: string
          updated_at: string
          user_id: string
        }[]
      }
      get_next_proposal_job: {
        Args: never
        Returns: {
          action: string
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          input_data: Json
          max_retries: number | null
          output_content: string | null
          output_usage: Json | null
          retry_count: number | null
          started_at: string | null
          status: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "proposal_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_notification_health_summary: { Args: never; Returns: Json }
      get_or_create_sync_status: {
        Args: { p_user_id: string }
        Returns: {
          id: string
          last_full_sync_at: string
          last_incremental_sync_at: string
          selected_list_id: string
          selected_list_title: string
          sync_status: string
          user_id: string
        }[]
      }
      get_org_file_search_store: { Args: { p_org_id: string }; Returns: string }
      get_org_limits: {
        Args: { p_org_id: string }
        Returns: {
          max_ai_tokens: number
          max_meetings: number
          max_storage_mb: number
          max_users: number
        }[]
      }
      get_org_meeting_index_status: {
        Args: { p_org_id: string; p_target_user_id?: string }
        Returns: {
          failed_count: number
          indexed_count: number
          last_indexed_at: string
          pending_count: number
          total_meetings: number
        }[]
      }
      get_org_plan_features: { Args: { p_org_id: string }; Returns: Json }
      get_org_role: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: string
      }
      get_org_subscription_details: {
        Args: { p_org_id: string }
        Returns: {
          billing_cycle: string
          cancel_at_period_end: boolean
          currency: string
          current_period_end: string
          current_period_start: string
          features: Json
          included_seats: number
          max_meetings_per_month: number
          max_users: number
          meeting_retention_months: number
          per_seat_price: number
          plan_id: string
          plan_name: string
          plan_slug: string
          price_monthly: number
          price_yearly: number
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          subscription_id: string
          trial_ends_at: string
        }[]
      }
      get_org_team_members: {
        Args: { p_org_id: string }
        Returns: {
          email: string
          full_name: string
          indexed_count: number
          meeting_count: number
          user_id: string
        }[]
      }
      get_pending_aggregation_count: {
        Args: { p_user_id: string }
        Returns: number
      }
      get_pending_ai_analysis: {
        Args: never
        Returns: {
          action_item_id: string
          category: string
          deadline_at: string
          meeting_summary: string
          meeting_title: string
          priority: string
          task_id: string
          title: string
        }[]
      }
      get_pending_suggestions_count: {
        Args: { p_user_id?: string }
        Returns: number
      }
      get_pending_transcript_retry_jobs: {
        Args: { p_batch_size?: number }
        Returns: {
          attempt_count: number
          id: string
          max_attempts: number
          meeting_id: string
          next_retry_at: string
          recording_id: string
          user_id: string
        }[]
      }
      get_profile_for_current_user: {
        Args: never
        Returns: {
          auth_provider: string | null
          avatar_url: string | null
          clerk_user_id: string | null
          created_at: string | null
          email: string
          first_name: string | null
          id: string
          is_admin: boolean | null
          last_login_at: string | null
          last_name: string | null
          stage: string | null
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_public_subscription_plans: {
        Args: never
        Returns: {
          badge_text: string
          cta_text: string
          cta_url: string
          currency: string
          description: string
          display_order: number
          features: Json
          highlight_features: string[]
          id: string
          included_seats: number
          is_free_tier: boolean
          max_ai_tokens_per_month: number
          max_meetings_per_month: number
          max_storage_mb: number
          max_users: number
          meeting_retention_months: number
          name: string
          per_seat_price: number
          price_monthly: number
          price_yearly: number
          slug: string
          trial_days: number
        }[]
      }
      get_response_rate: {
        Args: { contact_id_param: string; days?: number }
        Returns: number
      }
      get_sentiment_trend: {
        Args: { contact_id_param: string }
        Returns: string
      }
      get_share_stats: {
        Args: { entry_id: string }
        Returns: {
          clicks: number
          conversion_rate: number
          conversions: number
          copy_shares: number
          email_shares: number
          linkedin_shares: number
          total_shares: number
          twitter_shares: number
        }[]
      }
      get_status_change_count: {
        Args: { days?: number; relationship_health_id_param: string }
        Returns: number
      }
      get_stuck_waitlist_onboarding_users: {
        Args: never
        Returns: {
          completed_steps: number
          completion_percentage: number
          days_since_created: number
          email: string
          last_step_completed: string
          last_step_date: string
          name: string
          user_id: string
        }[]
      }
      get_supabase_id_for_clerk_user: {
        Args: { p_clerk_user_id: string }
        Returns: string
      }
      get_system_config: { Args: { p_key: string }; Returns: string }
      get_task_depth: { Args: { task_id: string }; Returns: number }
      get_task_target_lists: {
        Args: { p_category?: string; p_priority: string; p_user_id: string }
        Returns: {
          config_id: string
          google_list_id: string
          list_title: string
        }[]
      }
      get_team_members_with_connected_accounts: {
        Args: never
        Returns: {
          email: string
          full_name: string
          indexed_count: number
          meeting_count: number
          user_id: string
        }[]
      }
      get_team_members_with_meetings: {
        Args: never
        Returns: {
          email: string
          full_name: string
          indexed_count: number
          meeting_count: number
          user_id: string
        }[]
      }
      get_topic_sources_with_details: {
        Args: { p_global_topic_id: string; p_limit?: number; p_offset?: number }
        Returns: {
          company_name: string
          contact_name: string
          fathom_url: string
          meeting_date: string
          meeting_id: string
          meeting_title: string
          similarity_score: number
          timestamp_seconds: number
          topic_description: string
          topic_title: string
        }[]
      }
      get_trial_status: {
        Args: { p_org_id: string }
        Returns: {
          days_remaining: number
          has_payment_method: boolean
          is_trialing: boolean
          trial_ends_at: string
          trial_start_at: string
        }[]
      }
      get_unanswered_outbound_count: {
        Args: { contact_id_param: string; days?: number }
        Returns: number
      }
      get_unread_notification_count: { Args: never; Returns: number }
      get_unread_sentiment_alert_count: { Args: never; Returns: number }
      get_unresolved_ghost_signals_count: {
        Args: { relationship_health_id_param: string }
        Returns: number
      }
      get_user_api_keys: {
        Args: { p_user_id: string }
        Returns: {
          created_at: string
          expires_at: string
          id: string
          is_active: boolean
          key_preview: string
          last_used: string
          name: string
          permissions: Json
          rate_limit: number
          usage_count: number
        }[]
      }
      get_user_feature_model_config: {
        Args: { p_feature_key: string; p_user_id: string }
        Returns: {
          is_enabled: boolean
          max_tokens: number
          model: string
          provider: string
          temperature: number
        }[]
      }
      get_user_google_integration: {
        Args: { p_user_id: string }
        Returns: {
          access_token: string
          clerk_org_id: string | null
          created_at: string | null
          email: string
          expires_at: string | null
          id: string
          is_active: boolean | null
          refresh_token: string | null
          scopes: string
          updated_at: string | null
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "google_integrations"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_user_id_from_activity: {
        Args: { p_activity_id: string; p_activity_type: string }
        Returns: string
      }
      get_user_id_from_email: { Args: { email_input: string }; Returns: string }
      get_user_org_id: { Args: { p_user_id: string }; Returns: string }
      get_user_org_ids: { Args: { p_user_id: string }; Returns: string[] }
      get_user_org_role: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: string
      }
      get_user_timezone_from_calendar: {
        Args: { p_user_id: string }
        Returns: string
      }
      get_user_uuid_from_clerk: { Args: never; Returns: string }
      get_users_with_targets: {
        Args: never
        Returns: {
          avatar_url: string
          created_at: string
          email: string
          first_name: string
          id: string
          is_admin: boolean
          last_name: string
          last_sign_in_at: string
          stage: string
          targets: Json
        }[]
      }
      get_waitlist_analytics: { Args: never; Returns: Json }
      get_waitlist_onboarding_analytics: { Args: never; Returns: Json }
      has_notification_flood: { Args: never; Returns: boolean }
      hash_api_key: { Args: { key_text: string }; Returns: string }
      increment_proposal_views: {
        Args: { p_share_token: string }
        Returns: undefined
      }
      increment_source_count: { Args: { topic_id: string }; Returns: number }
      is_admin: { Args: never; Returns: boolean }
      is_clerk_admin: { Args: never; Returns: boolean }
      is_clerk_authenticated: { Args: never; Returns: boolean }
      is_internal_assignee: { Args: { email_input: string }; Returns: boolean }
      is_org_member: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { p_user_id: string }; Returns: boolean }
      is_task_from_meeting: { Args: { p_task_id: string }; Returns: boolean }
      is_user_admin: { Args: { user_id: string }; Returns: boolean }
      link_profile_to_clerk_user: {
        Args: { p_clerk_user_id: string; p_profile_id: string }
        Returns: boolean
      }
      log_api_request: {
        Args: {
          p_api_key_id: string
          p_body: Json
          p_endpoint: string
          p_headers: Json
          p_method: string
          p_response_body: Json
          p_status_code: number
          p_user_id: string
        }
        Returns: undefined
      }
      map_deal_activity_to_main_activity: {
        Args: { deal_activity_type: string }
        Returns: string
      }
      mark_all_notifications_read: { Args: never; Returns: number }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: boolean
      }
      mark_sentiment_alert_read: {
        Args: { p_alert_id: string }
        Returns: undefined
      }
      mark_waitlist_onboarding_step: {
        Args: { p_step: string; p_user_id: string }
        Returns: boolean
      }
      meeting_needs_transcript_retry: {
        Args: { meeting_row: Database["public"]["Tables"]["meetings"]["Row"] }
        Returns: boolean
      }
      merge_global_topics: {
        Args: { p_source_topic_id: string; p_target_topic_id: string }
        Returns: boolean
      }
      migrate_deal_entities: {
        Args: { deal_record: Record<string, unknown> }
        Returns: Json
      }
      migrate_existing_list_configs: { Args: never; Returns: undefined }
      notify_overdue_tasks: { Args: never; Returns: Json }
      notify_upcoming_task_deadlines: { Args: never; Returns: Json }
      org_has_feature: {
        Args: { p_feature_key: string; p_org_id: string }
        Returns: boolean
      }
      reanalyze_action_items_with_ai: {
        Args: { p_meeting_id?: string }
        Returns: Json
      }
      record_usage_event: {
        Args: {
          p_event_subtype?: string
          p_event_type: string
          p_metadata?: Json
          p_org_id: string
          p_quantity?: number
          p_user_id: string
        }
        Returns: string
      }
      refresh_deal_health_scores: {
        Args: { p_max_age_hours?: number; p_user_id: string }
        Returns: {
          deal_id: string
          health_score: number
          health_status: string
          updated: boolean
        }[]
      }
      refresh_relationship_health_scores: {
        Args: { p_max_age_hours?: number; p_user_id: string }
        Returns: {
          contact_id: string
          health_score: number
          health_status: string
          updated: boolean
        }[]
      }
      regenerate_next_actions_for_activity: {
        Args: { p_activity_id: string; p_activity_type: string }
        Returns: Json
      }
      reject_pipeline_recommendation: {
        Args: {
          p_notes?: string
          p_recommendation_id: string
          p_reviewed_by: string
        }
        Returns: boolean
      }
      rename_user_organization: {
        Args: { p_new_name: string }
        Returns: {
          error_message: string
          org_id: string
          org_name: string
          success: boolean
        }[]
      }
      resend_waitlist_magic_link: {
        Args: { p_admin_user_id: string; p_entry_id: string }
        Returns: Json
      }
      resolve_deal_migration_review: {
        Args: {
          p_company_id: string
          p_contact_id: string
          p_notes?: string
          p_resolved_by: string
          p_review_id: string
        }
        Returns: boolean
      }
      retry_roadmap_sync: {
        Args: { suggestion_id_param: string }
        Returns: undefined
      }
      search_meetings_by_owner: {
        Args: {
          p_company_id?: string
          p_date_from?: string
          p_date_to?: string
          p_has_action_items?: boolean
          p_limit?: number
          p_owner_user_id?: string
          p_sentiment?: string
        }
        Returns: {
          company_name: string
          has_action_items: boolean
          meeting_date: string
          meeting_id: string
          owner_name: string
          owner_user_id: string
          sentiment_score: number
          title: string
        }[]
      }
      set_audit_context: {
        Args: {
          p_impersonated_user_id?: string
          p_is_impersonating?: boolean
          p_original_user_id?: string
        }
        Returns: undefined
      }
      set_system_config: {
        Args: { p_description?: string; p_key: string; p_value: string }
        Returns: undefined
      }
      should_create_notification: {
        Args: {
          p_max_per_day?: number
          p_max_per_hour?: number
          p_notification_type: string
          p_user_id: string
        }
        Returns: boolean
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      sync_action_item_to_task: {
        Args: { action_item_id: string }
        Returns: string
      }
      sync_playwright_test_user: { Args: never; Returns: undefined }
      sync_task_to_action_item: {
        Args: { task_id_input: string }
        Returns: string
      }
      toggle_topic_archive: {
        Args: { p_archive: boolean; p_topic_id: string }
        Returns: boolean
      }
      trigger_all_task_notifications: { Args: never; Returns: Json }
      trigger_fathom_hourly_sync: { Args: never; Returns: undefined }
      update_template_performance: {
        Args: {
          clicked?: boolean
          opened?: boolean
          recovered?: boolean
          replied?: boolean
          response_time_hours?: number
          template_id_param: string
        }
        Returns: undefined
      }
      update_user_timezone: {
        Args: { p_timezone: string; p_user_id: string }
        Returns: undefined
      }
      user_org_ids: { Args: { p_user_id: string }; Returns: string[] }
      user_shares_org_with: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      validate_api_key:
        | {
            Args: { params: Json }
            Returns: {
              is_active: boolean
              is_expired: boolean
              is_valid: boolean
              permissions: string[]
              rate_limit: number
              user_id: string
            }[]
          }
        | {
            Args: { key_text: string }
            Returns: {
              is_active: boolean
              is_expired: boolean
              is_valid: boolean
              permissions: Json
              rate_limit: number
              user_id: string
            }[]
          }
      validate_api_key_simple: {
        Args: { key_text: string }
        Returns: {
          is_active: boolean
          is_expired: boolean
          is_valid: boolean
          permissions: Json
          rate_limit: number
          user_id: string
        }[]
      }
    }
    Enums: {
      activity_priority: "low" | "medium" | "high"
      activity_status: "pending" | "completed" | "cancelled" | "no_show"
      activity_type:
        | "outbound"
        | "meeting"
        | "proposal"
        | "sale"
        | "fathom_meeting"
      client_status:
        | "active"
        | "churned"
        | "paused"
        | "signed"
        | "deposit_paid"
        | "notice_given"
      member_role: "member" | "leader" | "admin"
      waitlist_status: "pending" | "released" | "declined" | "converted"
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
      activity_priority: ["low", "medium", "high"],
      activity_status: ["pending", "completed", "cancelled", "no_show"],
      activity_type: [
        "outbound",
        "meeting",
        "proposal",
        "sale",
        "fathom_meeting",
      ],
      client_status: [
        "active",
        "churned",
        "paused",
        "signed",
        "deposit_paid",
        "notice_given",
      ],
      member_role: ["member", "leader", "admin"],
      waitlist_status: ["pending", "released", "declined", "converted"],
    },
  },
} as const
