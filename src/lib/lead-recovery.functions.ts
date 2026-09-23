import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const idSchema = z.object({
  leadId: z.string().uuid(),
  reason: z.string().trim().max(120).optional().default("closed_checkout"),
});

/** Marks that the person reached the payment step. */
export const markCheckoutStarted = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ leadId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("leads")
        .update({ status: "checkout_started", checkout_started_at: new Date().toISOString() })
        .eq("id", data.leadId)
        .neq("status", "paid");
    } catch (e) {
      console.error("[markCheckoutStarted]", e);
    }
    return { success: true as const };
  });

/**
 * Called when the person leaves the checkout without paying.
 * Keeps the lead, flags it as abandoned and triggers the recovery email.
 */
export const markCheckoutAbandoned = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => idSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { LEAD_SELECT, sendRecoveryEmail, isLeadAlreadyPaid } = await import(
        "@/lib/lead-recovery.server"
      );

      const { data: lead, error } = await supabaseAdmin
        .from("leads")
        .select(LEAD_SELECT)
        .eq("id", data.leadId)
        .maybeSingle();

      if (error || !lead) return { success: false as const, reason: "lead_not_found" };
      // Verifies with Stripe too: the success redirect fires "pagehide" before
      // the webhook lands, so the stored status alone is not enough.
      if (await isLeadAlreadyPaid(lead)) {
        return { success: false as const, reason: "already_paid" };
      }
      if (lead.recovery_email_sent_at) return { success: true as const, alreadySent: true };

      await supabaseAdmin
        .from("leads")
        .update({
          status: "abandoned",
          abandoned_at: new Date().toISOString(),
          abandon_reason: data.reason,
        })
        .eq("id", data.leadId);

      const sent = await sendRecoveryEmail(lead, data.reason);
      return { success: true as const, recoveryEmailSent: sent };
    } catch (e) {
      console.error("[markCheckoutAbandoned]", e);
      return { success: false as const, reason: "unexpected_error" };
    }
  });
