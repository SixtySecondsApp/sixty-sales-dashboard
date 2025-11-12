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
      deals: {
        Row: {
          id: string
          name: string
          company: string | null
          contact_name: string | null
          contact_email: string | null
          contact_phone: string | null
          value: number
          one_off_revenue: number | null
          monthly_mrr: number | null
          annual_value: number | null
          description: string | null
          stage_id: string
          owner_id: string
          expected_close_date: string | null
          first_billing_date: string | null
          probability: number | null
          status: string | null
          priority: string | null
          deal_size: string | null
          lead_source_type: string | null
          lead_source_channel: string | null
          next_steps: string | null
          created_at: string
          updated_at: string
          stage_changed_at: string | null
        }
        Insert: {
          id?: string
          name: string
          company?: string | null
          contact_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          value: number
          one_off_revenue?: number | null
          monthly_mrr?: number | null
          annual_value?: number | null
          description?: string | null
          stage_id: string
          owner_id: string
          expected_close_date?: string | null
          first_billing_date?: string | null
          probability?: number | null
          status?: string | null
          priority?: string | null
          deal_size?: string | null
          lead_source_type?: string | null
          lead_source_channel?: string | null
          next_steps?: string | null
          created_at?: string
          updated_at?: string
          stage_changed_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          company?: string | null
          contact_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          value?: number
          one_off_revenue?: number | null
          monthly_mrr?: number | null
          annual_value?: number | null
          description?: string | null
          stage_id?: string
          owner_id?: string
          expected_close_date?: string | null
          first_billing_date?: string | null
          probability?: number | null
          status?: string | null
          priority?: string | null
          deal_size?: string | null
          lead_source_type?: string | null
          lead_source_channel?: string | null
          next_steps?: string | null
          created_at?: string
          updated_at?: string
          stage_changed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_owner_id_fkey"
            columns: ["owner_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            referencedRelation: "deal_stages"
            referencedColumns: ["id"]
          }
        ]
      }
      deal_splits: {
        Row: {
          id: string
          deal_id: string
          user_id: string
          percentage: number
          amount: number
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          deal_id: string
          user_id: string
          percentage: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          deal_id?: string
          user_id?: string
          percentage?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_splits_deal_id_fkey"
            columns: ["deal_id"]
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_splits_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      profiles: {
        Row: {
          id: string
          email: string | null
          first_name: string | null
          last_name: string | null
          full_name: string | null
          avatar_url: string | null
          role: string | null
          department: string | null
          stage: string | null
          is_admin: boolean | null
          created_at: string | null
          updated_at: string | null
          username: string | null
          website: string | null
        }
        Insert: {
          id: string
          email?: string | null
          first_name?: string | null
          last_name?: string | null
          full_name?: string | null
          avatar_url?: string | null
          role?: string | null
          department?: string | null
          stage?: string | null
          is_admin?: boolean | null
          created_at?: string | null
          updated_at?: string | null
          username?: string | null
          website?: string | null
        }
        Update: {
          id?: string
          email?: string | null
          first_name?: string | null
          last_name?: string | null
          full_name?: string | null
          avatar_url?: string | null
          role?: string | null
          department?: string | null
          stage?: string | null
          is_admin?: boolean | null
          created_at?: string | null
          updated_at?: string | null
          username?: string | null
          website?: string | null
        }
        Relationships: []
      }
      targets: {
        Row: {
          id: string
          user_id: string | null
          revenue_target: number | null
          outbound_target: number | null
          meetings_target: number | null
          proposal_target: number | null
          start_date: string | null
          end_date: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          revenue_target?: number | null
          outbound_target?: number | null
          meetings_target?: number | null
          proposal_target?: number | null
          start_date?: string | null
          end_date?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          revenue_target?: number | null
          outbound_target?: number | null
          meetings_target?: number | null
          proposal_target?: number | null
          start_date?: string | null
          end_date?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "targets_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      clients: {
        Row: {
          id: string
          company_name: string
          contact_name: string | null
          contact_email: string | null
          subscription_amount: number
          status: 'active' | 'churned' | 'paused'
          deal_id: string | null
          owner_id: string
          subscription_start_date: string | null
          churn_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_name: string
          contact_name?: string | null
          contact_email?: string | null
          subscription_amount?: number
          status?: 'active' | 'churned' | 'paused'
          deal_id?: string | null
          owner_id: string
          subscription_start_date?: string | null
          churn_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_name?: string
          contact_name?: string | null
          contact_email?: string | null
          subscription_amount?: number
          status?: 'active' | 'churned' | 'paused'
          deal_id?: string | null
          owner_id?: string
          subscription_start_date?: string | null
          churn_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_deal_id_fkey"
            columns: ["deal_id"]
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_owner_id_fkey"
            columns: ["owner_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      lead_events: {
        Row: {
          id: string
          lead_id: string | null
          external_source: string
          external_id: string | null
          event_type: string
          payload: Json
          payload_hash: string | null
          external_occured_at: string | null
          received_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          lead_id?: string | null
          external_source?: string
          external_id?: string | null
          event_type: string
          payload: Json
          payload_hash?: string | null
          external_occured_at?: string | null
          received_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          lead_id?: string | null
          external_source?: string
          external_id?: string | null
          event_type?: string
          payload?: Json
          payload_hash?: string | null
          external_occured_at?: string | null
          received_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_events_lead_id_fkey"
            columns: ["lead_id"]
            referencedRelation: "leads"
            referencedColumns: ["id"]
          }
        ]
      }
      lead_prep_notes: {
        Row: {
          id: string
          lead_id: string
          note_type: 'summary' | 'insight' | 'question' | 'task' | 'resource'
          title: string | null
          body: string
          created_by: string | null
          created_at: string
          updated_at: string
          sort_order: number
          is_pinned: boolean
          is_auto_generated: boolean
          metadata: Json | null
        }
        Insert: {
          id?: string
          lead_id: string
          note_type: 'summary' | 'insight' | 'question' | 'task' | 'resource'
          title?: string | null
          body: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
          sort_order?: number
          is_pinned?: boolean
          is_auto_generated?: boolean
          metadata?: Json | null
        }
        Update: {
          id?: string
          lead_id?: string
          note_type?: 'summary' | 'insight' | 'question' | 'task' | 'resource'
          title?: string | null
          body?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
          sort_order?: number
          is_pinned?: boolean
          is_auto_generated?: boolean
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_prep_notes_lead_id_fkey"
            columns: ["lead_id"]
            referencedRelation: "leads"
            referencedColumns: ["id"]
          }
        ]
      }
      lead_sources: {
        Row: {
          id: string
          source_key: string
          name: string
          channel: string | null
          description: string | null
          default_owner_id: string | null
          utm_source: string | null
          utm_medium: string | null
          utm_campaign: string | null
          metadata: Json | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          source_key: string
          name: string
          channel?: string | null
          description?: string | null
          default_owner_id?: string | null
          utm_source?: string | null
          utm_medium?: string | null
          utm_campaign?: string | null
          metadata?: Json | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          source_key?: string
          name?: string
          channel?: string | null
          description?: string | null
          default_owner_id?: string | null
          utm_source?: string | null
          utm_medium?: string | null
          utm_campaign?: string | null
          metadata?: Json | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_sources_default_owner_id_fkey"
            columns: ["default_owner_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      leads: {
        Row: {
          id: string
          external_source: string
          external_id: string | null
          external_occured_at: string | null
          source_id: string | null
          source_channel: string | null
          source_campaign: string | null
          source_medium: string | null
          booking_link_id: string | null
          booking_link_slug: string | null
          booking_link_name: string | null
          booking_scope_slug: string | null
          status: 'new' | 'prepping' | 'ready' | 'converted' | 'archived'
          priority: 'low' | 'normal' | 'high' | 'urgent'
          enrichment_status: 'pending' | 'in_progress' | 'completed' | 'failed'
          enrichment_provider: string | null
          prep_status: 'pending' | 'in_progress' | 'completed' | 'failed'
          prep_summary: string | null
          owner_id: string | null
          created_by: string | null
          converted_deal_id: string | null
          company_id: string | null
          contact_id: string | null
          contact_name: string | null
          contact_first_name: string | null
          contact_last_name: string | null
          contact_email: string | null
          contact_phone: string | null
          contact_timezone: string | null
          contact_marketing_opt_in: boolean | null
          scheduler_email: string | null
          scheduler_name: string | null
          domain: string | null
          meeting_title: string | null
          meeting_description: string | null
          meeting_start: string | null
          meeting_end: string | null
          meeting_duration_minutes: number | null
          meeting_timezone: string | null
          meeting_url: string | null
          conferencing_type: string | null
          conferencing_url: string | null
          attendee_count: number | null
          external_attendee_emails: string[] | null
          utm_source: string | null
          utm_medium: string | null
          utm_campaign: string | null
          utm_term: string | null
          utm_content: string | null
          metadata: Json | null
          first_seen_at: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          external_source?: string
          external_id?: string | null
          external_occured_at?: string | null
          source_id?: string | null
          source_channel?: string | null
          source_campaign?: string | null
          source_medium?: string | null
          booking_link_id?: string | null
          booking_link_slug?: string | null
          booking_link_name?: string | null
          booking_scope_slug?: string | null
          status?: 'new' | 'prepping' | 'ready' | 'converted' | 'archived'
          priority?: 'low' | 'normal' | 'high' | 'urgent'
          enrichment_status?: 'pending' | 'in_progress' | 'completed' | 'failed'
          enrichment_provider?: string | null
          prep_status?: 'pending' | 'in_progress' | 'completed' | 'failed'
          prep_summary?: string | null
          owner_id?: string | null
          created_by?: string | null
          converted_deal_id?: string | null
          company_id?: string | null
          contact_id?: string | null
          contact_name?: string | null
          contact_first_name?: string | null
          contact_last_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          contact_timezone?: string | null
          contact_marketing_opt_in?: boolean | null
          scheduler_email?: string | null
          scheduler_name?: string | null
          domain?: string | null
          meeting_title?: string | null
          meeting_description?: string | null
          meeting_start?: string | null
          meeting_end?: string | null
          meeting_duration_minutes?: number | null
          meeting_timezone?: string | null
          meeting_url?: string | null
          conferencing_type?: string | null
          conferencing_url?: string | null
          attendee_count?: number | null
          external_attendee_emails?: string[] | null
          utm_source?: string | null
          utm_medium?: string | null
          utm_campaign?: string | null
          utm_term?: string | null
          utm_content?: string | null
          metadata?: Json | null
          first_seen_at?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          external_source?: string
          external_id?: string | null
          external_occured_at?: string | null
          source_id?: string | null
          source_channel?: string | null
          source_campaign?: string | null
          source_medium?: string | null
          booking_link_id?: string | null
          booking_link_slug?: string | null
          booking_link_name?: string | null
          booking_scope_slug?: string | null
          status?: 'new' | 'prepping' | 'ready' | 'converted' | 'archived'
          priority?: 'low' | 'normal' | 'high' | 'urgent'
          enrichment_status?: 'pending' | 'in_progress' | 'completed' | 'failed'
          enrichment_provider?: string | null
          prep_status?: 'pending' | 'in_progress' | 'completed' | 'failed'
          prep_summary?: string | null
          owner_id?: string | null
          created_by?: string | null
          converted_deal_id?: string | null
          company_id?: string | null
          contact_id?: string | null
          contact_name?: string | null
          contact_first_name?: string | null
          contact_last_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          contact_timezone?: string | null
          contact_marketing_opt_in?: boolean | null
          scheduler_email?: string | null
          scheduler_name?: string | null
          domain?: string | null
          meeting_title?: string | null
          meeting_description?: string | null
          meeting_start?: string | null
          meeting_end?: string | null
          meeting_duration_minutes?: number | null
          meeting_timezone?: string | null
          meeting_url?: string | null
          conferencing_type?: string | null
          conferencing_url?: string | null
          attendee_count?: number | null
          external_attendee_emails?: string[] | null
          utm_source?: string | null
          utm_medium?: string | null
          utm_campaign?: string | null
          utm_term?: string | null
          utm_content?: string | null
          metadata?: Json | null
          first_seen_at?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_contact_id_fkey"
            columns: ["contact_id"]
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_converted_deal_id_fkey"
            columns: ["converted_deal_id"]
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_owner_id_fkey"
            columns: ["owner_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_source_id_fkey"
            columns: ["source_id"]
            referencedRelation: "lead_sources"
            referencedColumns: ["id"]
          }
        ]
      }
      // Add other tables as needed
    }
    Views: {
      deal_splits_with_users: {
        Row: {
          id: string
          deal_id: string
          user_id: string
          percentage: number
          amount: number
          notes: string | null
          created_at: string
          updated_at: string
          first_name: string | null
          last_name: string | null
          email: string | null
          full_name: string | null
          deal_name: string
          deal_value: number
          deal_owner_id: string
        }
      }
      lead_source_summary: {
        Row: {
          source_id: string | null
          source_key: string | null
          source_name: string | null
          channel: string | null
          medium: string | null
          campaign: string | null
          owner_id: string | null
          total_leads: number | null
          converted_leads: number | null
          ready_leads: number | null
          prepping_leads: number | null
          first_lead_at: string | null
          last_lead_at: string | null
        }
      }
    }
    Functions: {
      get_users_with_targets: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          email: string
          first_name: string | null
          last_name: string | null
          stage: string
          avatar_url: string | null
          is_admin: boolean
          created_at: string
          last_sign_in_at: string | null
          targets: Array<{
            id: string
            user_id: string
            revenue_target: number | null
            outbound_target: number | null
            meetings_target: number | null
            proposal_target: number | null
            start_date: string | null
            end_date: string | null
            created_at: string
            updated_at: string
          }>
        }[]
      }
    }
    Enums: {
      client_status: 'active' | 'subscribed' | 'signed' | 'deposit_paid' | 'churned' | 'paused' | 'notice_given'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
