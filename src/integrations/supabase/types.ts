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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_emails: {
        Row: {
          created_at: string
          email: string
        }
        Insert: {
          created_at?: string
          email: string
        }
        Update: {
          created_at?: string
          email?: string
        }
        Relationships: []
      }
      assistant_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          persona_key: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          persona_key: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          persona_key?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_messages_persona_key_fkey"
            columns: ["persona_key"]
            isOneToOne: false
            referencedRelation: "assistant_personas"
            referencedColumns: ["key"]
          },
        ]
      }
      assistant_personas: {
        Row: {
          instructions: string
          key: string
          knowledge: string
          sort_order: number
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          instructions: string
          key: string
          knowledge?: string
          sort_order?: number
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          instructions?: string
          key?: string
          knowledge?: string
          sort_order?: number
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      class_sessions: {
        Row: {
          created_at: string
          id: string
          live_url: string | null
          replay_url: string | null
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          live_url?: string | null
          replay_url?: string | null
          starts_at: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          live_url?: string | null
          replay_url?: string | null
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      course_lessons: {
        Row: {
          active: boolean
          cover_url: string | null
          created_at: string
          description: string | null
          duration_minutes: number | null
          id: string
          module_id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          cover_url?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          module_id: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          cover_url?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          module_id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      course_modules: {
        Row: {
          active: boolean
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      foundations_items: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          media_url: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          media_url: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          media_url?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          abandon_reason: string | null
          abandoned_at: string | null
          admission_decided_at: string | null
          admission_decided_by: string | null
          admission_status: string
          answers: Json | null
          checkout_started_at: string | null
          created_at: string
          email: string
          fbclid: string | null
          full_name: string
          gclid: string | null
          id: string
          landing_url: string | null
          phone: string | null
          plan_intended: string | null
          recovery_attempts: number
          recovery_email_sent_at: string | null
          referrer: string | null
          resume_code: string | null
          scholarship_result_token: string | null
          source: string | null
          status: string
          stripe_session_id: string | null
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_id: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          abandon_reason?: string | null
          abandoned_at?: string | null
          admission_decided_at?: string | null
          admission_decided_by?: string | null
          admission_status?: string
          answers?: Json | null
          checkout_started_at?: string | null
          created_at?: string
          email: string
          fbclid?: string | null
          full_name: string
          gclid?: string | null
          id?: string
          landing_url?: string | null
          phone?: string | null
          plan_intended?: string | null
          recovery_attempts?: number
          recovery_email_sent_at?: string | null
          referrer?: string | null
          resume_code?: string | null
          scholarship_result_token?: string | null
          source?: string | null
          status?: string
          stripe_session_id?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_id?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          abandon_reason?: string | null
          abandoned_at?: string | null
          admission_decided_at?: string | null
          admission_decided_by?: string | null
          admission_status?: string
          answers?: Json | null
          checkout_started_at?: string | null
          created_at?: string
          email?: string
          fbclid?: string | null
          full_name?: string
          gclid?: string | null
          id?: string
          landing_url?: string | null
          phone?: string | null
          plan_intended?: string | null
          recovery_attempts?: number
          recovery_email_sent_at?: string | null
          referrer?: string | null
          resume_code?: string | null
          scholarship_result_token?: string | null
          source?: string | null
          status?: string
          stripe_session_id?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_id?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: []
      }
      lesson_items: {
        Row: {
          created_at: string
          id: string
          kind: string
          lesson_id: string
          slides: Json
          sort_order: number
          storage_path: string | null
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          lesson_id: string
          slides?: Json
          sort_order?: number
          storage_path?: string | null
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          lesson_id?: string
          slides?: Json
          sort_order?: number
          storage_path?: string | null
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_items_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "course_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          completed: boolean
          created_at: string
          id: string
          last_opened_at: string
          lesson_id: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          id?: string
          last_opened_at?: string
          lesson_id: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          id?: string
          last_opened_at?: string
          lesson_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "course_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_payments: {
        Row: {
          amount_usd: number | null
          confirmed_at: string
          confirmed_by: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          lead_id: string | null
          method: string
          notes: string | null
          plan: string | null
          reference: string | null
          term_end: string | null
          term_start: string | null
        }
        Insert: {
          amount_usd?: number | null
          confirmed_at?: string
          confirmed_by?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          lead_id?: string | null
          method?: string
          notes?: string | null
          plan?: string | null
          reference?: string | null
          term_end?: string | null
          term_start?: string | null
        }
        Update: {
          amount_usd?: number | null
          confirmed_at?: string
          confirmed_by?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          lead_id?: string | null
          method?: string
          notes?: string | null
          plan?: string | null
          reference?: string | null
          term_end?: string | null
          term_start?: string | null
        }
        Relationships: []
      }
      member_subscriptions: {
        Row: {
          access_status: string
          cancel_at_period_end: boolean
          canceled_at: string | null
          courtesy_access: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          duration_months: number | null
          email: string | null
          environment: string
          first_payment_failed_at: string | null
          full_name: string | null
          grace_expires_at: string | null
          id: string
          last_invoice_id: string | null
          last_invoice_paid_at: string | null
          last_stripe_event_id: string | null
          lead_id: string | null
          metadata: Json | null
          paid_active_months: number
          paid_invoice_count: number
          pending_notifications: Json
          period_anchor_at: string | null
          price_lookup_key: string | null
          processed_event_ids: string[]
          processed_invoice_ids: string[]
          provider: string
          row_version: number
          status: string | null
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string
          student_enrolled_at: string | null
          tier: string | null
          updated_at: string
        }
        Insert: {
          access_status?: string
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          courtesy_access?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          duration_months?: number | null
          email?: string | null
          environment?: string
          first_payment_failed_at?: string | null
          full_name?: string | null
          grace_expires_at?: string | null
          id?: string
          last_invoice_id?: string | null
          last_invoice_paid_at?: string | null
          last_stripe_event_id?: string | null
          lead_id?: string | null
          metadata?: Json | null
          paid_active_months?: number
          paid_invoice_count?: number
          pending_notifications?: Json
          period_anchor_at?: string | null
          price_lookup_key?: string | null
          processed_event_ids?: string[]
          processed_invoice_ids?: string[]
          provider?: string
          row_version?: number
          status?: string | null
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id: string
          student_enrolled_at?: string | null
          tier?: string | null
          updated_at?: string
        }
        Update: {
          access_status?: string
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          courtesy_access?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          duration_months?: number | null
          email?: string | null
          environment?: string
          first_payment_failed_at?: string | null
          full_name?: string | null
          grace_expires_at?: string | null
          id?: string
          last_invoice_id?: string | null
          last_invoice_paid_at?: string | null
          last_stripe_event_id?: string | null
          lead_id?: string | null
          metadata?: Json | null
          paid_active_months?: number
          paid_invoice_count?: number
          pending_notifications?: Json
          period_anchor_at?: string | null
          price_lookup_key?: string | null
          processed_event_ids?: string[]
          processed_invoice_ids?: string[]
          provider?: string
          row_version?: number
          status?: string | null
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string
          student_enrolled_at?: string | null
          tier?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notification_outbox: {
        Row: {
          attempts: number
          created_at: string
          dedupe_key: string
          environment: string
          id: string
          kind: string
          last_error: string | null
          locked_until: string | null
          next_attempt_at: string
          payload: Json
          provider: string
          recipient: string | null
          sent_at: string | null
          status: string
          subscription_id: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          dedupe_key: string
          environment: string
          id?: string
          kind: string
          last_error?: string | null
          locked_until?: string | null
          next_attempt_at?: string
          payload?: Json
          provider: string
          recipient?: string | null
          sent_at?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          dedupe_key?: string
          environment?: string
          id?: string
          kind?: string
          last_error?: string | null
          locked_until?: string | null
          next_attempt_at?: string
          payload?: Json
          provider?: string
          recipient?: string | null
          sent_at?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payment_diagnostic_attempts: {
        Row: {
          approval_url: string | null
          capture_id: string | null
          capture_lock_until: string | null
          consent_at: string
          consent_version: string
          created_at: string
          id: string
          invite_id: string
          paid_at: string | null
          payee_id: string | null
          profile_validated_at: string
          provider: string
          provider_id: string | null
          return_state_hash: string | null
          status: string
          updated_at: string
        }
        Insert: {
          approval_url?: string | null
          capture_id?: string | null
          capture_lock_until?: string | null
          consent_at?: string
          consent_version?: string
          created_at?: string
          id?: string
          invite_id: string
          paid_at?: string | null
          payee_id?: string | null
          profile_validated_at?: string
          provider: string
          provider_id?: string | null
          return_state_hash?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          approval_url?: string | null
          capture_id?: string | null
          capture_lock_until?: string | null
          consent_at?: string
          consent_version?: string
          created_at?: string
          id?: string
          invite_id?: string
          paid_at?: string | null
          payee_id?: string | null
          profile_validated_at?: string
          provider?: string
          provider_id?: string | null
          return_state_hash?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_diagnostic_attempts_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "payment_diagnostic_invites"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_diagnostic_events: {
        Row: {
          attempt_id: string
          created_at: string
          event_id: string
          event_type: string
        }
        Insert: {
          attempt_id: string
          created_at?: string
          event_id: string
          event_type: string
        }
        Update: {
          attempt_id?: string
          created_at?: string
          event_id?: string
          event_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_diagnostic_events_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "payment_diagnostic_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_diagnostic_grants: {
        Row: {
          access_until: string | null
          created_at: string
          email: string
          existing_access: boolean
          full_name: string | null
          granted_at: string | null
          invite_id: string
          member_subscription_id: string | null
        }
        Insert: {
          access_until?: string | null
          created_at?: string
          email: string
          existing_access?: boolean
          full_name?: string | null
          granted_at?: string | null
          invite_id: string
          member_subscription_id?: string | null
        }
        Update: {
          access_until?: string | null
          created_at?: string
          email?: string
          existing_access?: boolean
          full_name?: string | null
          granted_at?: string | null
          invite_id?: string
          member_subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_diagnostic_grants_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: true
            referencedRelation: "payment_diagnostic_invites"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_diagnostic_invites: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          revoked_at: string | null
          token_hash: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          revoked_at?: string | null
          token_hash: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          revoked_at?: string | null
          token_hash?: string
        }
        Relationships: []
      }
      paypal_checkout_intents: {
        Row: {
          admission_status: string
          amount_usd: number
          bound_at: string | null
          consent: Json
          created_at: string
          duration_months: number
          email: string | null
          environment: string
          full_name: string | null
          id: string
          lead_id: string
          paypal_subscription_id: string | null
          plan_id: string
          status: string
          tier: string
          updated_at: string
        }
        Insert: {
          admission_status?: string
          amount_usd: number
          bound_at?: string | null
          consent: Json
          created_at?: string
          duration_months: number
          email?: string | null
          environment: string
          full_name?: string | null
          id?: string
          lead_id: string
          paypal_subscription_id?: string | null
          plan_id: string
          status?: string
          tier: string
          updated_at?: string
        }
        Update: {
          admission_status?: string
          amount_usd?: number
          bound_at?: string | null
          consent?: Json
          created_at?: string
          duration_months?: number
          email?: string | null
          environment?: string
          full_name?: string | null
          id?: string
          lead_id?: string
          paypal_subscription_id?: string | null
          plan_id?: string
          status?: string
          tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      paypal_webhook_events: {
        Row: {
          environment: string
          event_id: string
          event_type: string
          outcome: string | null
          payload: Json | null
          processed_at: string | null
          received_at: string
          resource_id: string | null
          subscription_id: string | null
          transaction_id: string | null
        }
        Insert: {
          environment: string
          event_id: string
          event_type: string
          outcome?: string | null
          payload?: Json | null
          processed_at?: string | null
          received_at?: string
          resource_id?: string | null
          subscription_id?: string | null
          transaction_id?: string | null
        }
        Update: {
          environment?: string
          event_id?: string
          event_type?: string
          outcome?: string | null
          payload?: Json | null
          processed_at?: string | null
          received_at?: string
          resource_id?: string | null
          subscription_id?: string | null
          transaction_id?: string | null
        }
        Relationships: []
      }
      portfolio_submissions: {
        Row: {
          created_at: string
          creation_url: string
          email: string
          feedback: string | null
          final_sample_url: string
          full_name: string | null
          id: string
          initial_sample_url: string
          reflection: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          creation_url: string
          email: string
          feedback?: string | null
          final_sample_url: string
          full_name?: string | null
          id?: string
          initial_sample_url: string
          reflection: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          creation_url?: string
          email?: string
          feedback?: string | null
          final_sample_url?: string
          full_name?: string | null
          id?: string
          initial_sample_url?: string
          reflection?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      scholarship_programs: {
        Row: {
          active: boolean
          created_at: string
          deadline: string | null
          description: string | null
          discount_percent: number
          id: string
          name: string
          seats: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          deadline?: string | null
          description?: string | null
          discount_percent?: number
          id?: string
          name: string
          seats?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          deadline?: string | null
          description?: string | null
          discount_percent?: number
          id?: string
          name?: string
          seats?: number
          updated_at?: string
        }
        Relationships: []
      }
      session_bookings: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          recording_url: string | null
          slot_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          recording_url?: string | null
          slot_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          recording_url?: string | null
          slot_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_bookings_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: true
            referencedRelation: "session_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      session_slots: {
        Row: {
          created_at: string
          id: string
          starts_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          starts_at: string
        }
        Update: {
          created_at?: string
          id?: string
          starts_at?: string
        }
        Relationships: []
      }
      stripe_webhook_events: {
        Row: {
          amount_total: number | null
          attribution_summary: string | null
          checkout_session_id: string | null
          client_reference_id: string | null
          currency: string | null
          customer_email: string | null
          environment: string
          event_type: string
          fbclid: string | null
          gclid: string | null
          id: string
          landing_url: string | null
          metadata: Json | null
          object_id: string | null
          payment_intent_id: string | null
          raw_event: Json | null
          received_at: string
          referrer: string | null
          status: string | null
          stripe_event_id: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          amount_total?: number | null
          attribution_summary?: string | null
          checkout_session_id?: string | null
          client_reference_id?: string | null
          currency?: string | null
          customer_email?: string | null
          environment: string
          event_type: string
          fbclid?: string | null
          gclid?: string | null
          id?: string
          landing_url?: string | null
          metadata?: Json | null
          object_id?: string | null
          payment_intent_id?: string | null
          raw_event?: Json | null
          received_at?: string
          referrer?: string | null
          status?: string | null
          stripe_event_id: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          amount_total?: number | null
          attribution_summary?: string | null
          checkout_session_id?: string | null
          client_reference_id?: string | null
          currency?: string | null
          customer_email?: string | null
          environment?: string
          event_type?: string
          fbclid?: string | null
          gclid?: string | null
          id?: string
          landing_url?: string | null
          metadata?: Json | null
          object_id?: string | null
          payment_intent_id?: string | null
          raw_event?: Json | null
          received_at?: string
          referrer?: string | null
          status?: string | null
          stripe_event_id?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: []
      }
      subscription_billing: {
        Row: {
          amount_per_cycle: number | null
          amount_per_cycle_formatted: string | null
          billing_schedule: Json | null
          cancel_at_period_end: boolean
          card_last4: string | null
          created_at: string
          currency: string | null
          duration_months: number | null
          email: string | null
          environment: string
          full_name: string | null
          id: string
          interval: string | null
          last_reminder_charge_at: string | null
          last_reminder_offset_days: number | null
          last_reminder_sent_at: string | null
          lead_id: string | null
          membership_url: string | null
          next_charge_at: string | null
          plan_name: string | null
          price_lookup_key: string | null
          started_at: string | null
          status: string | null
          stripe_customer_id: string | null
          stripe_session_id: string | null
          stripe_subscription_id: string
          tier: string | null
          total_commitment: number | null
          updated_at: string
        }
        Insert: {
          amount_per_cycle?: number | null
          amount_per_cycle_formatted?: string | null
          billing_schedule?: Json | null
          cancel_at_period_end?: boolean
          card_last4?: string | null
          created_at?: string
          currency?: string | null
          duration_months?: number | null
          email?: string | null
          environment?: string
          full_name?: string | null
          id?: string
          interval?: string | null
          last_reminder_charge_at?: string | null
          last_reminder_offset_days?: number | null
          last_reminder_sent_at?: string | null
          lead_id?: string | null
          membership_url?: string | null
          next_charge_at?: string | null
          plan_name?: string | null
          price_lookup_key?: string | null
          started_at?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_session_id?: string | null
          stripe_subscription_id: string
          tier?: string | null
          total_commitment?: number | null
          updated_at?: string
        }
        Update: {
          amount_per_cycle?: number | null
          amount_per_cycle_formatted?: string | null
          billing_schedule?: Json | null
          cancel_at_period_end?: boolean
          card_last4?: string | null
          created_at?: string
          currency?: string | null
          duration_months?: number | null
          email?: string | null
          environment?: string
          full_name?: string | null
          id?: string
          interval?: string | null
          last_reminder_charge_at?: string | null
          last_reminder_offset_days?: number | null
          last_reminder_sent_at?: string | null
          lead_id?: string | null
          membership_url?: string | null
          next_charge_at?: string | null
          plan_name?: string | null
          price_lookup_key?: string | null
          started_at?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_session_id?: string | null
          stripe_subscription_id?: string
          tier?: string | null
          total_commitment?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      webhook_audit_log: {
        Row: {
          attempts: number | null
          correlation_id: string | null
          created_at: string
          direction: string
          duration_ms: number | null
          error_reason: string | null
          event: string | null
          flow: string | null
          id: string
          lead_id: string | null
          ok: boolean
          request_payload: Json | null
          response_body: string | null
          response_status: number | null
          target_url: string | null
        }
        Insert: {
          attempts?: number | null
          correlation_id?: string | null
          created_at?: string
          direction?: string
          duration_ms?: number | null
          error_reason?: string | null
          event?: string | null
          flow?: string | null
          id?: string
          lead_id?: string | null
          ok?: boolean
          request_payload?: Json | null
          response_body?: string | null
          response_status?: number | null
          target_url?: string | null
        }
        Update: {
          attempts?: number | null
          correlation_id?: string | null
          created_at?: string
          direction?: string
          duration_ms?: number | null
          error_reason?: string | null
          event?: string | null
          flow?: string | null
          id?: string
          lead_id?: string | null
          ok?: boolean
          request_payload?: Json | null
          response_body?: string | null
          response_status?: number | null
          target_url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_diagnostic_stripe_event: {
        Args: {
          p_attempt: string
          p_event: string
          p_object: string
          p_status: string
          p_type: string
        }
        Returns: boolean
      }
      cancel_diagnostic_attempt: {
        Args: { p_id: string; p_invite: string }
        Returns: boolean
      }
      claim_diagnostic_capture: {
        Args: { p_id: string; p_invite: string }
        Returns: {
          approval_url: string | null
          capture_id: string | null
          capture_lock_until: string | null
          consent_at: string
          consent_version: string
          created_at: string
          id: string
          invite_id: string
          paid_at: string | null
          payee_id: string | null
          profile_validated_at: string
          provider: string
          provider_id: string | null
          return_state_hash: string | null
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "payment_diagnostic_attempts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_diagnostic_creation: {
        Args: { p_id: string; p_invite: string }
        Returns: {
          approval_url: string | null
          capture_id: string | null
          capture_lock_until: string | null
          consent_at: string
          consent_version: string
          created_at: string
          id: string
          invite_id: string
          paid_at: string | null
          payee_id: string | null
          profile_validated_at: string
          provider: string
          provider_id: string | null
          return_state_hash: string | null
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "payment_diagnostic_attempts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      grant_diagnostic_courtesy: { Args: { p_invite: string }; Returns: string }
      has_active_membership: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      reserve_payment_diagnostic: {
        Args: { p_hash: string; p_provider: string }
        Returns: {
          approval_url: string | null
          capture_id: string | null
          capture_lock_until: string | null
          consent_at: string
          consent_version: string
          created_at: string
          id: string
          invite_id: string
          paid_at: string | null
          payee_id: string | null
          profile_validated_at: string
          provider: string
          provider_id: string | null
          return_state_hash: string | null
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "payment_diagnostic_attempts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      taken_slot_ids: { Args: never; Returns: string[] }
    }
    Enums: {
      [_ in never]: never
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
  public: {
    Enums: {},
  },
} as const
