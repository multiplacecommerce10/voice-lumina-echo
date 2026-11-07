import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Env = z.enum(["sandbox", "live"]);

/** Whether PayPal checkout may be shown, plus the publishable client id. */
export const getPayPalCheckoutConfig = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ environment: Env }).parse(d))
  .handler(async ({ data }) => {
    const { paypalConfig } = await import("@/lib/paypal.server");
    const { PAYPAL_PLANS } = await import("@/lib/paypal-plans");
    const cfg = paypalConfig(data.environment);
    const available = cfg.complete && PAYPAL_PLANS[data.environment].length === 6;
    return { available, clientId: available ? cfg.clientId : null };
  });

const ConsentSchema = z.object({
  termsVersion: z.string().min(1).max(40),
  privacyVersion: z.string().min(1).max(40),
  refundVersion: z.string().max(40).optional(),
  acceptedAt: z.string().min(10).max(40),
  immediateAccessAt: z.string().max(40).optional(),
  marketingOptIn: z.boolean().optional(),
});

/** Binds lead + consent + allowlisted plan into a server-side intent (custom_id). */
export const preparePayPalSubscription = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({
        environment: Env,
        leadId: z.string().uuid(),
        tier: z.enum(["live", "complete"]),
        durationMonths: z.union([z.literal(1), z.literal(3), z.literal(6)]),
        consent: ConsentSchema,
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { paypalConfig } = await import("@/lib/paypal.server");
    const { paypalPlanFor } = await import("@/lib/paypal-plans");
    if (!paypalConfig(data.environment).complete) throw new Error("PayPal is not available right now.");
    const plan = paypalPlanFor(data.environment, data.tier, data.durationMonths);
    if (!plan) throw new Error("This plan is not available with PayPal.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: lead } = await supabaseAdmin
      .from("leads")
      .select("id, email, full_name, status, admission_status")
      .eq("id", data.leadId)
      .maybeSingle();
    if (!lead?.email) throw new Error("Please complete your enrollment details first.");
    // Consent must match the CURRENT legal documents and be recent — not arbitrary client data.
    const { LEGAL_VERSIONS } = await import("@/lib/legal");
    const { consentIsCurrent, admissionAllowsCheckout } = await import("@/lib/paypal-admission");
    if (!consentIsCurrent(data.consent, LEGAL_VERSIONS, Date.now())) {
      throw new Error("Please review and accept the current terms before paying.");
    }
    // Rolling admission requires Cuca Medina's recorded human decision on THIS lead.
    if (!admissionAllowsCheckout((lead as any).admission_status)) {
      throw new Error("Enrollment is currently by review. Please request consideration and we will contact you.");
    }
    const { data: intent, error } = await (supabaseAdmin as any)
      .from("paypal_checkout_intents")
      .insert({
        lead_id: lead.id,
        environment: data.environment,
        plan_id: plan.planId,
        tier: plan.tier,
        duration_months: plan.durationMonths,
        amount_usd: Number(plan.amount),
        email: lead.email.toLowerCase(),
        full_name: lead.full_name,
        consent: { ...data.consent, serverValidatedAt: new Date().toISOString() },
        admission_status: "approved",
      })
      .select("id")
      .single();
    if (error || !intent) throw new Error("Could not start PayPal checkout.");
    return { intentId: intent.id as string, planId: plan.planId };
  });

/**
 * Called from the SDK's onApprove. Records the subscription id on the intent
 * after verifying it with PayPal. NEVER grants access — that only happens
 * when the verified PAYMENT.SALE.COMPLETED webhook arrives.
 */
export const registerPayPalApproval = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({
        environment: Env,
        intentId: z.string().uuid(),
        subscriptionId: z.string().regex(/^I-[A-Z0-9]{6,40}$/),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { fetchSubscription } = await import("@/lib/paypal.server");
    const { loadIntent, bindIntent } = await import("@/lib/paypal-state.server");
    const { validateBinding } = await import("@/lib/paypal-lifecycle");
    const sub = await fetchSubscription(data.environment, data.subscriptionId);
    // The subscription must carry THIS intent as custom_id before we bind.
    if (!sub || sub.customId !== data.intentId) return { status: "rejected" as const };
    const bound = await bindIntent(data.environment, data.intentId, sub.id);
    if (bound === "conflict" || bound === "missing") return { status: "rejected" as const };
    const intent = await loadIntent(data.environment, data.intentId);
    const check = validateBinding(data.environment, sub, intent);
    if (!check.ok) return { status: "rejected" as const };
    return { status: "awaiting_payment_confirmation" as const };
  });
