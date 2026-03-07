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
      users: {
        Row: {
          id: string
          email: string
          full_name: string | null
          company_name: string | null
          role: 'admin' | 'estimator' | 'lead_tech' | 'tech'
          subscription_tier: 'free' | 'starter' | 'pro' | 'enterprise'
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          full_name?: string | null
          company_name?: string | null
          role?: 'admin' | 'estimator' | 'lead_tech' | 'tech'
          subscription_tier?: 'free' | 'starter' | 'pro' | 'enterprise'
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          company_name?: string | null
          role?: 'admin' | 'estimator' | 'lead_tech' | 'tech'
          subscription_tier?: 'free' | 'starter' | 'pro' | 'enterprise'
          avatar_url?: string | null
          updated_at?: string
        }
      }
      jobs: {
        Row: {
          id: string
          user_id: string
          claim_number: string | null
          insured_name: string
          insured_phone: string | null
          insured_email: string | null
          property_address: string
          property_city: string | null
          property_postal_code: string | null
          loss_date: string | null
          loss_category: number | null
          loss_class: number | null
          job_type: 'water_loss' | 'fire_loss' | 'mold' | 'large_loss' | 'other'
          status: 'new' | 'dispatched' | 'active' | 'review' | 'closed' | 'draft'
          current_step: number
          insurer_name: string | null
          adjuster_name: string | null
          adjuster_email: string | null
          adjuster_phone: string | null
          lead_tech_id: string | null
          notes: string | null
          gps_lat: number | null
          gps_lng: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          claim_number?: string | null
          insured_name: string
          insured_phone?: string | null
          insured_email?: string | null
          property_address: string
          property_city?: string | null
          property_postal_code?: string | null
          loss_date?: string | null
          loss_category?: number | null
          loss_class?: number | null
          job_type?: 'water_loss' | 'fire_loss' | 'mold' | 'large_loss' | 'other'
          status?: 'new' | 'dispatched' | 'active' | 'review' | 'closed' | 'draft'
          current_step?: number
          insurer_name?: string | null
          adjuster_name?: string | null
          adjuster_email?: string | null
          adjuster_phone?: string | null
          lead_tech_id?: string | null
          notes?: string | null
          gps_lat?: number | null
          gps_lng?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          claim_number?: string | null
          insured_name?: string
          insured_phone?: string | null
          insured_email?: string | null
          property_address?: string
          property_city?: string | null
          property_postal_code?: string | null
          loss_date?: string | null
          loss_category?: number | null
          loss_class?: number | null
          job_type?: 'water_loss' | 'fire_loss' | 'mold' | 'large_loss' | 'other'
          status?: 'new' | 'dispatched' | 'active' | 'review' | 'closed' | 'draft'
          current_step?: number
          insurer_name?: string | null
          adjuster_name?: string | null
          adjuster_email?: string | null
          adjuster_phone?: string | null
          lead_tech_id?: string | null
          notes?: string | null
          updated_at?: string
        }
      }
      workflow_steps: {
        Row: {
          id: string
          job_id: string
          step_number: number
          step_name: string
          status: 'pending' | 'in_progress' | 'complete' | 'overridden' | 'skipped'
          completed_at: string | null
          completed_by: string | null
          override_reason: string | null
          overridden_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          job_id: string
          step_number: number
          step_name: string
          status?: 'pending' | 'in_progress' | 'complete' | 'overridden' | 'skipped'
          completed_at?: string | null
          completed_by?: string | null
          override_reason?: string | null
          overridden_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          status?: 'pending' | 'in_progress' | 'complete' | 'overridden' | 'skipped'
          completed_at?: string | null
          completed_by?: string | null
          override_reason?: string | null
          overridden_by?: string | null
          updated_at?: string
        }
      }
      rooms: {
        Row: {
          id: string
          job_id: string
          room_name: string
          room_type: string | null
          floor_number: number
          area_sqft: number | null
          created_at: string
        }
        Insert: {
          id?: string
          job_id: string
          room_name: string
          room_type?: string | null
          floor_number?: number
          area_sqft?: number | null
          created_at?: string
        }
        Update: {
          room_name?: string
          room_type?: string | null
          floor_number?: number
          area_sqft?: number | null
        }
      }
      moisture_readings: {
        Row: {
          id: string
          job_id: string
          room_id: string | null
          x_coord: number
          y_coord: number
          material_type: 'wood' | 'drywall' | 'concrete' | 'subfloor' | 'ceiling'
          mc_percent: number
          rh_percent: number | null
          temp_c: number | null
          status: 'green' | 'yellow' | 'red'
          reading_date: string
          visit_day: number
          technician_id: string | null
        }
        Insert: {
          id?: string
          job_id: string
          room_id?: string | null
          x_coord: number
          y_coord: number
          material_type: 'wood' | 'drywall' | 'concrete' | 'subfloor' | 'ceiling'
          mc_percent: number
          rh_percent?: number | null
          temp_c?: number | null
          status?: 'green' | 'yellow' | 'red'
          reading_date?: string
          visit_day?: number
          technician_id?: string | null
        }
        Update: {
          mc_percent?: number
          rh_percent?: number | null
          temp_c?: number | null
          status?: 'green' | 'yellow' | 'red'
          visit_day?: number
        }
      }
      damage_photos: {
        Row: {
          id: string
          job_id: string
          room_id: string | null
          photo_url: string
          annotated_url: string | null
          room_tag: string | null
          damage_tag: 'water' | 'fire' | 'mold' | 'structural' | 'pre_existing' | null
          ai_analysis_json: Json | null
          gps_lat: number | null
          gps_lng: number | null
          technician_id: string | null
          timestamp: string
        }
        Insert: {
          id?: string
          job_id: string
          room_id?: string | null
          photo_url: string
          annotated_url?: string | null
          room_tag?: string | null
          damage_tag?: 'water' | 'fire' | 'mold' | 'structural' | 'pre_existing' | null
          ai_analysis_json?: Json | null
          gps_lat?: number | null
          gps_lng?: number | null
          technician_id?: string | null
          timestamp?: string
        }
        Update: {
          annotated_url?: string | null
          room_tag?: string | null
          damage_tag?: 'water' | 'fire' | 'mold' | 'structural' | 'pre_existing' | null
          ai_analysis_json?: Json | null
        }
      }
      equipment_inventory: {
        Row: {
          id: string
          user_id: string
          qr_code: string
          equipment_type: string
          make: string | null
          model: string | null
          serial_number: string | null
          xact_code: string | null
          rental_rate_per_day: number | null
          status: 'available' | 'deployed' | 'maintenance' | 'retired'
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          qr_code: string
          equipment_type: string
          make?: string | null
          model?: string | null
          serial_number?: string | null
          xact_code?: string | null
          rental_rate_per_day?: number | null
          status?: 'available' | 'deployed' | 'maintenance' | 'retired'
          created_at?: string
        }
        Update: {
          equipment_type?: string
          make?: string | null
          model?: string | null
          status?: 'available' | 'deployed' | 'maintenance' | 'retired'
          rental_rate_per_day?: number | null
        }
      }
      equipment_placements: {
        Row: {
          id: string
          equipment_id: string
          job_id: string
          placed_at: string
          placed_gps: string | null
          removed_at: string | null
          removed_gps: string | null
          total_days: number | null
          rental_cost: number | null
        }
        Insert: {
          id?: string
          equipment_id: string
          job_id: string
          placed_at?: string
          placed_gps?: string | null
          removed_at?: string | null
          removed_gps?: string | null
          total_days?: number | null
          rental_cost?: number | null
        }
        Update: {
          removed_at?: string | null
          removed_gps?: string | null
          total_days?: number | null
          rental_cost?: number | null
        }
      }
      job_logs: {
        Row: {
          id: string
          job_id: string
          user_id: string
          log_type: 'visit' | 'note' | 'system' | 'override'
          visit_date: string | null
          content: Json | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          job_id: string
          user_id: string
          log_type: 'visit' | 'note' | 'system' | 'override'
          visit_date?: string | null
          content?: Json | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          content?: Json | null
          notes?: string | null
        }
      }
      documents: {
        Row: {
          id: string
          job_id: string
          doc_type: 'waf' | 'coc' | 'report_24hr' | 'final_report' | 'invoice' | 'other'
          doc_url: string
          signed_status: 'unsigned' | 'signed' | 'declined'
          signed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          job_id: string
          doc_type: 'waf' | 'coc' | 'report_24hr' | 'final_report' | 'invoice' | 'other'
          doc_url: string
          signed_status?: 'unsigned' | 'signed' | 'declined'
          signed_at?: string | null
          created_at?: string
        }
        Update: {
          signed_status?: 'unsigned' | 'signed' | 'declined'
          signed_at?: string | null
        }
      }
      estimates: {
        Row: {
          id: string
          job_id: string
          ai_draft_json: Json | null
          xactimate_line_items_json: Json | null
          reviewed_by: string | null
          status: 'draft' | 'reviewed' | 'exported'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          job_id: string
          ai_draft_json?: Json | null
          xactimate_line_items_json?: Json | null
          reviewed_by?: string | null
          status?: 'draft' | 'reviewed' | 'exported'
          created_at?: string
          updated_at?: string
        }
        Update: {
          ai_draft_json?: Json | null
          xactimate_line_items_json?: Json | null
          reviewed_by?: string | null
          status?: 'draft' | 'reviewed' | 'exported'
          updated_at?: string
        }
      }
      floor_plans: {
        Row: {
          id: string
          job_id: string
          source: 'ai' | 'manual'
          svg_data: string | null
          rooms: Json | null
          total_area: number | null
          scale: number | null
          created_at: string
        }
        Insert: {
          id?: string
          job_id: string
          source?: 'ai' | 'manual'
          svg_data?: string | null
          rooms?: Json | null
          total_area?: number | null
          scale?: number | null
          created_at?: string
        }
        Update: {
          svg_data?: string | null
          rooms?: Json | null
          total_area?: number | null
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
