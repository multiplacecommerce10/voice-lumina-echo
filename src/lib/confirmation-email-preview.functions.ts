import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { buildConfirmationEmail, auditConfirmationEmail } from "@/lib/confirmation-email";
import { formatClassInTimeZone, getNextClassAfter, COURSE_START_UTC } from "@/lib/course-schedule";
import { SUBSCRIPTION_CATALOG } from "@/lib/subscription-catalog";
import { LEAD_SELECT } from "@/lib/lead-recovery.server";

const LEAD_QUERY_SELECT =
  "id, full_name, email, phone, plan_intended, status, answers";

function formatUsd(amount: number | null): string | null {
  if (amount == null) return null;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

/** Renders the exact confirmation/receipt email for a lead WITHOUT sending anything. */
export const previewConfirmationEmail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        leadId: z.string().uuid().optional(),
        email: z.string().trim().email().optional(),
        isRenewal: z.boolean().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = supabaseAdmin.from("leads").select(LEAD_QUERY_SELECT).limit(1);
    if (data.leadId) query = query.eq("id", data.leadId);
    else if (data.email) query = query.eq("email", data.email);
    else return { ok: false as const, error: "Provide a lead id or an email." };

    const { data: lead, error: leadError } = await query.maybeSingle();
    if (leadError) return { ok: false as const, error: leadError.message };
    if (!lead) return { ok: false as const, error: "Lead not found." };

    const { data: sub, error: subError } = await supabaseAdmin
      .from("member_subscriptions")
      .select("*")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (subError) return { ok: false as const, error: subError.message };

    const timezone =
      ((lead.answers as { timezone?: string } | null)?.timezone as string) ?? "UTC";
    const courseStartLocal = formatClassInTimeZone(COURSE_START_UTC, timezone);
    const nextClassLocal = formatClassInTimeZone(getNextClassAfter(new Date()), timezone);

    const planIntended =
      (lead.plan_intended as string | null) ??
      (sub?.price_lookup_key as string | null) ??
      null;
    const tier =
      (sub?.tier as "live" | "complete" | null) ??
      (planIntended?.startsWith("live_") ? "live" : planIntended ? "complete" : null);
    const durationMonths =
      (sub?.duration_months as number | null) ??
      (planIntended?.match(/_(\d+)m(?:_v\d+)?$/) ? Number(planIntended.match(/_(\d+)m(?:_v\d+)?$/)![1]) : null);

    let totalFormatted: string | null = null;
    if (tier && durationMonths && tier in SUBSCRIPTION_CATALOG && durationMonths in SUBSCRIPTION_CATALOG[tier as "live" | "complete"]) {
      totalFormatted = formatUsd(SUBSCRIPTION_CATALOG[tier as "live" | "complete"][durationMonths as 1 | 3 | 6].amountUsd);
    }
    if (!totalFormatted && sub?.price_lookup_key) {
      const m = sub.price_lookup_key.match(/_(\d+)m(?:_v\d+)?$/);
      if (m) {
        const months = Number(m[1]);
        const t = sub.price_lookup_key.startsWith("live_") ? "live" : "complete";
        if (t in SUBSCRIPTION_CATALOG && months in SUBSCRIPTION_CATALOG[t]) {
          totalFormatted = formatUsd(SUBSCRIPTION_CATALOG[t][months as 1 | 3 | 6].amountUsd);
        }
      }
    }

    const draftInput = {
      fullName: (lead.full_name as string | null) ?? (sub?.full_name as string | null) ?? null,
      email: (lead.email as string | null) ?? (sub?.email as string | null) ?? null,
      planIntended,
      tier,
      durationMonths,
      totalFormatted,
      amountPerCycleFormatted: totalFormatted,
      isRecurring: !!sub,
      isRenewal: data.isRenewal ?? false,
      billingIntervalMonths: durationMonths,
      nextChargeAtFormatted: (sub?.current_period_end as string | null) ?? null,
      courseStartFormatted: courseStartLocal.full,
      nextClassFormatted: nextClassLocal.full,
      membershipUrl: "https://consciousvoice.tecendosom.com/membership",
    };

    const draft = buildConfirmationEmail(draftInput);
    const issues = auditConfirmationEmail(draft, draftInput.email);

    return {
      ok: true as const,
      error: null,
      lead: {
        id: lead.id,
        full_name: lead.full_name,
        email: lead.email,
        plan_intended: lead.plan_intended,
        status: lead.status,
      },
      subscription: sub
        ? {
            id: sub.id,
            stripe_subscription_id: sub.stripe_subscription_id,
            tier: sub.tier,
            duration_months: sub.duration_months,
            access_status: sub.access_status,
            current_period_end: sub.current_period_end,
          }
        : null,
      draft,
      issues,
      blocking: issues.some((i) => i.level === "error"),
    };
  });
