export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Database type definitions for Supabase
// Includes: meetings, meeting_contacts, meeting_action_items, meeting_attendees, proposal_templates, proposals, system_config, tasks, user_onboarding_progress, contacts, companies
// Updated: 2025-12-11 - Added user_onboarding_progress, meeting_attendees, contacts, companies table definitions
export interface Database {
  __InternalSupabase: {
    PostgrestVersion: "12"
  }
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
          timezone: string | null
          week_starts_on: number | null
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
          timezone?: string | null
          week_starts_on?: number | null
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
          timezone?: string | null
          week_starts_on?: number | null
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
      savvycal_link_mappings: {
        Row: {
          id: string
          link_id: string
          source_name: string
          channel: string
          medium: string | null
          description: string | null
          default_owner_email: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          link_id: string
          source_name: string
          channel?: string
          medium?: string | null
          description?: string | null
          default_owner_email?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          link_id?: string
          source_name?: string
          channel?: string
          medium?: string | null
          description?: string | null
          default_owner_email?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      booking_sources: {
        Row: {
          id: string
          name: string
          api_name: string
          description: string | null
          category: string | null
          icon: string | null
          color: string | null
          is_active: boolean
          sort_order: number
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          api_name: string
          description?: string | null
          category?: string | null
          icon?: string | null
          color?: string | null
          is_active?: boolean
          sort_order?: number
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          api_name?: string
          description?: string | null
          category?: string | null
          icon?: string | null
          color?: string | null
          is_active?: boolean
          sort_order?: number
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      savvycal_source_mappings: {
        Row: {
          id: string
          link_id: string
          source: string
          source_id: string | null
          meeting_link: string | null
          private_link: string | null
          notes: string | null
          created_by: string | null
          org_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          link_id: string
          source: string
          source_id?: string | null
          meeting_link?: string | null
          private_link?: string | null
          notes?: string | null
          created_by?: string | null
          org_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          link_id?: string
          source?: string
          source_id?: string | null
          meeting_link?: string | null
          private_link?: string | null
          notes?: string | null
          created_by?: string | null
          org_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
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
      meetings: {
        Row: {
          id: string
          fathom_recording_id: string
          title: string | null
          share_url: string | null
          calls_url: string | null
          meeting_start: string | null
          meeting_end: string | null
          duration_minutes: number | null
          owner_user_id: string | null
          owner_email: string | null
          team_name: string | null
          company_id: string | null
          primary_contact_id: string | null
          summary: string | null
          transcript_doc_url: string | null
          transcript_text: string | null
          sentiment_score: number | null
          sentiment_reasoning: string | null
          coach_rating: number | null
          coach_summary: string | null
          talk_time_rep_pct: number | null
          talk_time_customer_pct: number | null
          talk_time_judgement: 'good' | 'high' | 'low' | null
          fathom_embed_url: string | null
          ai_training_metadata: Json | null
          fathom_created_at: string | null
          transcript_language: string | null
          calendar_invitees_type: 'all_internal' | 'one_or_more_external' | null
          fathom_user_id: string | null
          thumbnail_url: string | null
          meeting_type: 'discovery' | 'demo' | 'negotiation' | 'closing' | 'follow_up' | 'general' | null
          classification_confidence: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          fathom_recording_id: string
          title?: string | null
          share_url?: string | null
          calls_url?: string | null
          meeting_start?: string | null
          meeting_end?: string | null
          duration_minutes?: number | null
          owner_user_id?: string | null
          owner_email?: string | null
          team_name?: string | null
          company_id?: string | null
          primary_contact_id?: string | null
          summary?: string | null
          transcript_doc_url?: string | null
          transcript_text?: string | null
          sentiment_score?: number | null
          sentiment_reasoning?: string | null
          coach_rating?: number | null
          coach_summary?: string | null
          talk_time_rep_pct?: number | null
          talk_time_customer_pct?: number | null
          talk_time_judgement?: 'good' | 'high' | 'low' | null
          fathom_embed_url?: string | null
          ai_training_metadata?: Json | null
          fathom_created_at?: string | null
          transcript_language?: string | null
          calendar_invitees_type?: 'all_internal' | 'one_or_more_external' | null
          fathom_user_id?: string | null
          thumbnail_url?: string | null
          meeting_type?: 'discovery' | 'demo' | 'negotiation' | 'closing' | 'follow_up' | 'general' | null
          classification_confidence?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          fathom_recording_id?: string
          title?: string | null
          share_url?: string | null
          calls_url?: string | null
          meeting_start?: string | null
          meeting_end?: string | null
          duration_minutes?: number | null
          owner_user_id?: string | null
          owner_email?: string | null
          team_name?: string | null
          company_id?: string | null
          primary_contact_id?: string | null
          summary?: string | null
          transcript_doc_url?: string | null
          transcript_text?: string | null
          sentiment_score?: number | null
          sentiment_reasoning?: string | null
          coach_rating?: number | null
          coach_summary?: string | null
          talk_time_rep_pct?: number | null
          talk_time_customer_pct?: number | null
          talk_time_judgement?: 'good' | 'high' | 'low' | null
          fathom_embed_url?: string | null
          ai_training_metadata?: Json | null
          fathom_created_at?: string | null
          transcript_language?: string | null
          calendar_invitees_type?: 'all_internal' | 'one_or_more_external' | null
          fathom_user_id?: string | null
          thumbnail_url?: string | null
          meeting_type?: 'discovery' | 'demo' | 'negotiation' | 'closing' | 'follow_up' | 'general' | null
          classification_confidence?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_owner_user_id_fkey"
            columns: ["owner_user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_company_id_fkey"
            columns: ["company_id"]
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          }
        ]
      }
      meeting_contacts: {
        Row: {
          id: string
          meeting_id: string
          contact_id: string
          is_primary: boolean
          role: string | null
          created_at: string
        }
        Insert: {
          id?: string
          meeting_id: string
          contact_id: string
          is_primary?: boolean
          role?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          meeting_id?: string
          contact_id?: string
          is_primary?: boolean
          role?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_contacts_meeting_id_fkey"
            columns: ["meeting_id"]
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_contacts_contact_id_fkey"
            columns: ["contact_id"]
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          }
        ]
      }
      meeting_action_items: {
        Row: {
          id: string
          meeting_id: string
          title: string
          assignee_name: string | null
          assignee_email: string | null
          priority: 'low' | 'medium' | 'high' | 'urgent' | null
          category: string | null
          deadline_at: string | null
          completed: boolean
          ai_generated: boolean | null
          ai_confidence: number | null
          timestamp_seconds: number | null
          playback_url: string | null
          task_id: string | null
          synced_to_task: boolean | null
          sync_status: 'pending' | 'synced' | 'failed' | 'excluded' | null
          sync_error: string | null
          synced_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          meeting_id: string
          title: string
          assignee_name?: string | null
          assignee_email?: string | null
          priority?: 'low' | 'medium' | 'high' | 'urgent' | null
          category?: string | null
          deadline_at?: string | null
          completed?: boolean
          ai_generated?: boolean | null
          ai_confidence?: number | null
          timestamp_seconds?: number | null
          playback_url?: string | null
          task_id?: string | null
          synced_to_task?: boolean | null
          sync_status?: 'pending' | 'synced' | 'failed' | 'excluded' | null
          sync_error?: string | null
          synced_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          meeting_id?: string
          title?: string
          assignee_name?: string | null
          assignee_email?: string | null
          priority?: 'low' | 'medium' | 'high' | 'urgent' | null
          category?: string | null
          deadline_at?: string | null
          completed?: boolean
          ai_generated?: boolean | null
          ai_confidence?: number | null
          timestamp_seconds?: number | null
          playback_url?: string | null
          task_id?: string | null
          synced_to_task?: boolean | null
          sync_status?: 'pending' | 'synced' | 'failed' | 'excluded' | null
          sync_error?: string | null
          synced_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_action_items_meeting_id_fkey"
            columns: ["meeting_id"]
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_action_items_task_id_fkey"
            columns: ["task_id"]
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          }
        ]
      }
      proposal_templates: {
        Row: {
          id: string
          name: string
          type: 'goals' | 'sow' | 'proposal' | 'design_system'
          content: string
          is_default: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          type: 'goals' | 'sow' | 'proposal' | 'design_system'
          content: string
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          type?: 'goals' | 'sow' | 'proposal' | 'design_system'
          content?: string
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      proposals: {
        Row: {
          id: string
          user_id: string
          meeting_id: string | null
          contact_id: string | null
          type: 'goals' | 'sow' | 'proposal'
          status: 'draft' | 'generated' | 'approved' | 'sent'
          content: string
          title: string | null
          share_token: string | null
          password_hash: string | null
          is_public: boolean | null
          share_views: number | null
          last_viewed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          meeting_id?: string | null
          contact_id?: string | null
          type: 'goals' | 'sow' | 'proposal'
          status?: 'draft' | 'generated' | 'approved' | 'sent'
          content: string
          title?: string | null
          share_token?: string | null
          password_hash?: string | null
          is_public?: boolean | null
          share_views?: number | null
          last_viewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          meeting_id?: string | null
          contact_id?: string | null
          type?: 'goals' | 'sow' | 'proposal'
          status?: 'draft' | 'generated' | 'approved' | 'sent'
          content?: string
          title?: string | null
          share_token?: string | null
          password_hash?: string | null
          is_public?: boolean | null
          share_views?: number | null
          last_viewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposals_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_meeting_id_fkey"
            columns: ["meeting_id"]
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_contact_id_fkey"
            columns: ["contact_id"]
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          }
        ]
      }
      system_config: {
        Row: {
          key: string
          value: string
          description: string | null
          updated_at: string
        }
        Insert: {
          key: string
          value: string
          description?: string | null
          updated_at?: string
        }
        Update: {
          key?: string
          value?: string
          description?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          id: string
          title: string
          description: string | null
          notes: string | null
          due_date: string | null
          completed: boolean
          completed_at: string | null
          priority: 'low' | 'medium' | 'high' | 'urgent'
          status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'overdue'
          task_type: 'call' | 'email' | 'meeting' | 'follow_up' | 'proposal' | 'demo' | 'general'
          assigned_to: string
          created_by: string
          deal_id: string | null
          company_id: string | null
          contact_id: string | null
          contact_email: string | null
          contact_name: string | null
          company: string | null
          meeting_id: string | null
          meeting_action_item_id: string | null
          category: string | null
          source: string | null
          metadata: Json | null
          suggestion_id: string | null
          action_item_id: string | null
          org_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          notes?: string | null
          due_date?: string | null
          completed?: boolean
          completed_at?: string | null
          priority?: 'low' | 'medium' | 'high' | 'urgent'
          status?: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'overdue'
          task_type?: 'call' | 'email' | 'meeting' | 'follow_up' | 'proposal' | 'demo' | 'general'
          assigned_to: string
          created_by: string
          deal_id?: string | null
          company_id?: string | null
          contact_id?: string | null
          contact_email?: string | null
          contact_name?: string | null
          company?: string | null
          meeting_id?: string | null
          meeting_action_item_id?: string | null
          category?: string | null
          source?: string | null
          metadata?: Json | null
          suggestion_id?: string | null
          action_item_id?: string | null
          org_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          notes?: string | null
          due_date?: string | null
          completed?: boolean
          completed_at?: string | null
          priority?: 'low' | 'medium' | 'high' | 'urgent'
          status?: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'overdue'
          task_type?: 'call' | 'email' | 'meeting' | 'follow_up' | 'proposal' | 'demo' | 'general'
          assigned_to?: string
          created_by?: string
          deal_id?: string | null
          company_id?: string | null
          contact_id?: string | null
          contact_email?: string | null
          contact_name?: string | null
          company?: string | null
          meeting_id?: string | null
          meeting_action_item_id?: string | null
          category?: string | null
          source?: string | null
          metadata?: Json | null
          suggestion_id?: string | null
          action_item_id?: string | null
          org_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_deal_id_fkey"
            columns: ["deal_id"]
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_company_id_fkey"
            columns: ["company_id"]
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_meeting_id_fkey"
            columns: ["meeting_id"]
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_meeting_action_item_id_fkey"
            columns: ["meeting_action_item_id"]
            referencedRelation: "meeting_action_items"
            referencedColumns: ["id"]
          }
        ]
      }
      user_onboarding_progress: {
        Row: {
          id: string
          user_id: string
          onboarding_step: 'welcome' | 'org_setup' | 'team_invite' | 'fathom_connect' | 'sync' | 'complete'
          onboarding_completed_at: string | null
          skipped_onboarding: boolean
          fathom_connected: boolean
          first_meeting_synced: boolean
          first_proposal_generated: boolean
          first_summary_viewed: boolean
          first_summary_viewed_at: string | null
          activation_completed_at: string | null
          features_discovered: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          onboarding_step?: 'welcome' | 'org_setup' | 'team_invite' | 'fathom_connect' | 'sync' | 'complete'
          onboarding_completed_at?: string | null
          skipped_onboarding?: boolean
          fathom_connected?: boolean
          first_meeting_synced?: boolean
          first_proposal_generated?: boolean
          first_summary_viewed?: boolean
          first_summary_viewed_at?: string | null
          activation_completed_at?: string | null
          features_discovered?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          onboarding_step?: 'welcome' | 'org_setup' | 'team_invite' | 'fathom_connect' | 'sync' | 'complete'
          onboarding_completed_at?: string | null
          skipped_onboarding?: boolean
          fathom_connected?: boolean
          first_meeting_synced?: boolean
          first_proposal_generated?: boolean
          first_summary_viewed?: boolean
          first_summary_viewed_at?: string | null
          activation_completed_at?: string | null
          features_discovered?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_onboarding_progress_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      meeting_attendees: {
        Row: {
          id: string
          meeting_id: string
          name: string
          email: string | null
          is_external: boolean
          role: string | null
          created_at: string
        }
        Insert: {
          id?: string
          meeting_id: string
          name: string
          email?: string | null
          is_external?: boolean
          role?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          meeting_id?: string
          name?: string
          email?: string | null
          is_external?: boolean
          role?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_attendees_meeting_id_fkey"
            columns: ["meeting_id"]
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          }
        ]
      }
      contacts: {
        Row: {
          id: string
          email: string
          first_name: string | null
          last_name: string | null
          full_name: string | null
          phone: string | null
          title: string | null
          company: string | null
          company_id: string | null
          owner_id: string | null
          linkedin_url: string | null
          source: string | null
          is_primary: boolean | null
          engagement_level: string | null
          health_score: number | null
          first_seen_at: string | null
          last_interaction_at: string | null
          last_ai_analysis: string | null
          total_meetings_count: number | null
          clerk_org_id: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          email: string
          first_name?: string | null
          last_name?: string | null
          full_name?: string | null
          phone?: string | null
          title?: string | null
          company?: string | null
          company_id?: string | null
          owner_id?: string | null
          linkedin_url?: string | null
          source?: string | null
          is_primary?: boolean | null
          engagement_level?: string | null
          health_score?: number | null
          first_seen_at?: string | null
          last_interaction_at?: string | null
          last_ai_analysis?: string | null
          total_meetings_count?: number | null
          clerk_org_id?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          email?: string
          first_name?: string | null
          last_name?: string | null
          full_name?: string | null
          phone?: string | null
          title?: string | null
          company?: string | null
          company_id?: string | null
          owner_id?: string | null
          linkedin_url?: string | null
          source?: string | null
          is_primary?: boolean | null
          engagement_level?: string | null
          health_score?: number | null
          first_seen_at?: string | null
          last_interaction_at?: string | null
          last_ai_analysis?: string | null
          total_meetings_count?: number | null
          clerk_org_id?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_contacts_company_id"
            columns: ["company_id"]
            referencedRelation: "companies"
            referencedColumns: ["id"]
          }
        ]
      }
      companies: {
        Row: {
          id: string
          name: string
          owner_id: string
          domain: string | null
          website: string | null
          phone: string | null
          address: string | null
          industry: string | null
          size: string | null
          description: string | null
          linkedin_url: string | null
          source: string | null
          first_seen_at: string | null
          clerk_org_id: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          owner_id: string
          domain?: string | null
          website?: string | null
          phone?: string | null
          address?: string | null
          industry?: string | null
          size?: string | null
          description?: string | null
          linkedin_url?: string | null
          source?: string | null
          first_seen_at?: string | null
          clerk_org_id?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          owner_id?: string
          domain?: string | null
          website?: string | null
          phone?: string | null
          address?: string | null
          industry?: string | null
          size?: string | null
          description?: string | null
          linkedin_url?: string | null
          source?: string | null
          first_seen_at?: string | null
          clerk_org_id?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_owner_id_fkey"
            columns: ["owner_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      google_integrations: {
        Row: {
          id: string
          user_id: string
          email: string
          access_token: string
          refresh_token: string | null
          expires_at: string | null
          scopes: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          email: string
          access_token: string
          refresh_token?: string | null
          expires_at?: string | null
          scopes: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          email?: string
          access_token?: string
          refresh_token?: string | null
          expires_at?: string | null
          scopes?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      google_calendars: {
        Row: {
          id: string
          integration_id: string
          calendar_id: string
          name: string
          description: string | null
          time_zone: string | null
          color_id: string | null
          is_primary: boolean | null
          access_role: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          integration_id: string
          calendar_id: string
          name: string
          description?: string | null
          time_zone?: string | null
          color_id?: string | null
          is_primary?: boolean | null
          access_role?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          integration_id?: string
          calendar_id?: string
          name?: string
          description?: string | null
          time_zone?: string | null
          color_id?: string | null
          is_primary?: boolean | null
          access_role?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_calendars_integration_id_fkey"
            columns: ["integration_id"]
            referencedRelation: "google_integrations"
            referencedColumns: ["id"]
          }
        ]
      }
      google_email_labels: {
        Row: {
          id: string
          integration_id: string
          label_id: string
          name: string
          type: string | null
          message_list_visibility: string | null
          label_list_visibility: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          integration_id: string
          label_id: string
          name: string
          type?: string | null
          message_list_visibility?: string | null
          label_list_visibility?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          integration_id?: string
          label_id?: string
          name?: string
          type?: string | null
          message_list_visibility?: string | null
          label_list_visibility?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_email_labels_integration_id_fkey"
            columns: ["integration_id"]
            referencedRelation: "google_integrations"
            referencedColumns: ["id"]
          }
        ]
      }
      google_drive_folders: {
        Row: {
          id: string
          integration_id: string
          folder_id: string
          name: string
          path: string | null
          parent_id: string | null
          mime_type: string | null
          web_view_link: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          integration_id: string
          folder_id: string
          name: string
          path?: string | null
          parent_id?: string | null
          mime_type?: string | null
          web_view_link?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          integration_id?: string
          folder_id?: string
          name?: string
          path?: string | null
          parent_id?: string | null
          mime_type?: string | null
          web_view_link?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_drive_folders_integration_id_fkey"
            columns: ["integration_id"]
            referencedRelation: "google_integrations"
            referencedColumns: ["id"]
          }
        ]
      }
      // Add other tables as needed
      
      // Email Categorization Tables (Fyxer-style)
      email_categorizations: {
        Row: {
          id: string
          user_id: string
          org_id: string | null
          external_id: string
          thread_id: string | null
          direction: 'inbound' | 'outbound'
          received_at: string | null
          category: 'to_respond' | 'fyi' | 'marketing' | 'calendar_related' | 'automated' | 'uncategorized'
          category_confidence: number | null
          signals: Json
          source: 'ai' | 'rules' | 'label_map' | 'user_override'
          communication_event_id: string | null
          gmail_label_applied: boolean
          gmail_label_applied_at: string | null
          processed_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          org_id?: string | null
          external_id: string
          thread_id?: string | null
          direction: 'inbound' | 'outbound'
          received_at?: string | null
          category: 'to_respond' | 'fyi' | 'marketing' | 'calendar_related' | 'automated' | 'uncategorized'
          category_confidence?: number | null
          signals?: Json
          source: 'ai' | 'rules' | 'label_map' | 'user_override'
          communication_event_id?: string | null
          gmail_label_applied?: boolean
          gmail_label_applied_at?: string | null
          processed_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          org_id?: string | null
          external_id?: string
          thread_id?: string | null
          direction?: 'inbound' | 'outbound'
          received_at?: string | null
          category?: 'to_respond' | 'fyi' | 'marketing' | 'calendar_related' | 'automated' | 'uncategorized'
          category_confidence?: number | null
          signals?: Json
          source?: 'ai' | 'rules' | 'label_map' | 'user_override'
          communication_event_id?: string | null
          gmail_label_applied?: boolean
          gmail_label_applied_at?: string | null
          processed_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      gmail_label_mappings: {
        Row: {
          id: string
          user_id: string
          org_id: string | null
          category_key: 'to_respond' | 'fyi' | 'marketing' | 'calendar_related' | 'automated'
          gmail_label_id: string
          gmail_label_name: string
          is_sixty_managed: boolean
          sync_direction: 'gmail_to_sixty' | 'sixty_to_gmail' | 'bidirectional' | 'none'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          org_id?: string | null
          category_key: 'to_respond' | 'fyi' | 'marketing' | 'calendar_related' | 'automated'
          gmail_label_id: string
          gmail_label_name: string
          is_sixty_managed?: boolean
          sync_direction: 'gmail_to_sixty' | 'sixty_to_gmail' | 'bidirectional' | 'none'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          org_id?: string | null
          category_key?: 'to_respond' | 'fyi' | 'marketing' | 'calendar_related' | 'automated'
          gmail_label_id?: string
          gmail_label_name?: string
          is_sixty_managed?: boolean
          sync_direction?: 'gmail_to_sixty' | 'sixty_to_gmail' | 'bidirectional' | 'none'
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      org_email_categorization_settings: {
        Row: {
          id: string
          org_id: string
          is_enabled: boolean
          label_mode: 'mode_a_internal_only' | 'mode_b_use_existing' | 'mode_c_sync_labels'
          archive_non_actionable: boolean
          use_ai_categorization: boolean
          use_rules_categorization: boolean
          enabled_categories: string[]
          created_at: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          org_id: string
          is_enabled?: boolean
          label_mode?: 'mode_a_internal_only' | 'mode_b_use_existing' | 'mode_c_sync_labels'
          archive_non_actionable?: boolean
          use_ai_categorization?: boolean
          use_rules_categorization?: boolean
          enabled_categories?: string[]
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          is_enabled?: boolean
          label_mode?: 'mode_a_internal_only' | 'mode_b_use_existing' | 'mode_c_sync_labels'
          archive_non_actionable?: boolean
          use_ai_categorization?: boolean
          use_rules_categorization?: boolean
          enabled_categories?: string[]
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
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
        Relationships: []
      }
      lead_source_summary: {
        Row: {
          source_name: string | null
          channel: string | null
          owner_id: string | null
          total_leads: number | null
          new_leads: number | null
          prepping_leads: number | null
          ready_leads: number | null
          converted_leads: number | null
          cancelled_leads: number | null
          sql_stage: number | null
          opportunity_stage: number | null
          verbal_stage: number | null
          signed_stage: number | null
          lost_stage: number | null
          total_one_off_revenue: number | null
          total_monthly_revenue: number | null
          total_ltv: number | null
          first_lead_at: string | null
          last_lead_at: string | null
          conversion_rate: number | null
          win_rate: number | null
        }
        Relationships: []
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
      get_my_google_integration: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          user_id: string
          email: string
          expires_at: string | null
          scopes: string
          is_active: boolean
          created_at: string
          updated_at: string
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
