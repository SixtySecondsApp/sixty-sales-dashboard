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
      client_status: 'active' | 'churned' | 'paused'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
