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
      leads: {
        Row: {
          abandon_reason: string | null
          abandoned_at: string | null
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
      member_subscriptions: {
        Row: {
          access_status: string
          cancel_at_period_end: boolean
          canceled_at: string | null
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
          price_lookup_key: string | null
          processed_invoice_ids: string[]
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
          price_lookup_key?: string | null
          processed_invoice_ids?: string[]
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
          price_lookup_key?: string | null
          processed_invoice_ids?: string[]
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
      is_admin: { Args: never; Returns: boolean }
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
