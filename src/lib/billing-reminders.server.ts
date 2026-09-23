// Persists subscription billing state and sends "next charge" reminders to
// Taskade a few days before each monthly debit.
import type { BillingSummary } from "@/lib/billing-summary.server";

// Days before the next charge when a reminder should go out.
export const REMINDER_OFFSETS_DAYS = [7, 3, 1];

export async function upsertSubscriptionBilling(params: {
  billing: BillingSummary;
  environment: "sandbox" | "live";
  leadId?: string | null;
  email?: string | null;
  fullName?: string | null;
  checkoutSessionId?: string | null;
}) {
  const { billing } = params;
  if (!billing.is_subscription || !billing.stripe_subscription_id) return;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("subscription_billing").upsert(
      {
        lead_id: params.leadId ?? null,
        email: params.email ?? null,
        full_name: params.fullName ?? null,
        environment: params.environment,
        stripe_subscription_id: billing.stripe_subscription_id,
        stripe_customer_id: billing.stripe_customer_id,
        stripe_session_id: params.checkoutSessionId ?? null,
        plan_name: billing.plan_name,
        tier: billing.tier,
        price_lookup_key: billing.price_lookup_key,
        interval: billing.interval,
        duration_months: billing.duration_months,
        amount_per_cycle: billing.amount_per_cycle,
        amount_per_cycle_formatted: billing.amount_per_cycle_formatted,
        total_commitment: billing.total_commitment,
        currency: billing.currency,
        status: billing.subscription_status,
        started_at: billing.started_at,
        next_charge_at: billing.next_charge_at,
        cancel_at_period_end: billing.cancel_at_period_end,
        card_last4: billing.card_last4,
        billing_schedule: billing.billing_schedule,
        membership_url: billing.membership_url,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "stripe_subscription_id" },
    );
  } catch (e) {
    console.warn("[billing-reminders] upsert failed:", e);
  }
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

type BillingRow = Record<string, any>;

/**
 * Builds the personalized `subscription.renewal_reminder` payload for a
 * subscription row. Shared by the sweep and by the admin email preview.
 */
export function buildReminderPayload(row: BillingRow, offset: number, remaining: number) {
  const nextCharge = row.next_charge_at as string;
  const schedule = (row.billing_schedule as { month: number; date: string }[] | null) ?? [];
  const paidMonths = schedule.filter((s) => new Date(s.date).getTime() <= Date.now()).length;
  const totalMonths = (row.duration_months as number | null) ?? schedule.length ?? null;
  const nextChargeFormatted = (() => {
    try {
      return new Intl.DateTimeFormat("en-US", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(nextCharge));
    } catch {
      return String(nextCharge).slice(0, 10);
    }
  })();

  const fullName = (row.full_name as string | null) ?? null;
  const firstName = fullName?.trim().split(/\s+/)[0] ?? null;
  const displayName = firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1) : null;
  const greeting = displayName ? `Hi ${displayName},` : "Hi there,";
  const planLabel =
    (row.plan_name as string | null) ?? (row.tier as string | null) ?? "your Conscious Voice plan";
  const amountLabel = (row.amount_per_cycle_formatted as string | null) ?? "your monthly amount";
  const daysLeft = Math.max(0, remaining);
  const whenLabel = daysLeft === 0 ? "today" : daysLeft === 1 ? "tomorrow" : `in ${daysLeft} days`;
  const monthsRemaining = totalMonths != null ? Math.max(0, totalMonths - paidMonths) : null;
  const progressLine =
    totalMonths != null
      ? `You're on month ${Math.min(totalMonths, paidMonths + 1)} of ${totalMonths}${
          monthsRemaining != null ? ` — ${monthsRemaining} to go` : ""
        }.`
      : null;
  const cardLine = row.card_last4 ? ` on your card ending ${row.card_last4}` : "";
  const emailSubject = `${displayName ? `${displayName}, y` : "Y"}our ${planLabel} renews ${whenLabel}`;
  const emailPreheader = `${amountLabel} on ${nextChargeFormatted}${cardLine}.`;
  const emailIntro = `${greeting} it's a joy to keep singing with you. Your ${planLabel} renews ${whenLabel}, on ${nextChargeFormatted}, with the usual ${amountLabel}${cardLine}.`;
  const emailSignoff = "With warmth, Cuca Medina — Conscious Voice";
  const paragraphs = [
    emailIntro,
    progressLine,
    "Nothing to do on your side — the charge happens automatically and your access continues without interruption.",
    "If you'd like to update your card, review your schedule or ask anything, just reply to this email and we'll take care of you.",
    emailSignoff,
  ].filter(Boolean) as string[];
  const emailBody = paragraphs.join("\n\n");

  return {
    preview: {
      subject: emailSubject,
      preheader: emailPreheader,
      greeting,
      paragraphs,
      signoff: emailSignoff,
      ctaLabel: "View my membership",
      ctaUrl: (row.membership_url as string | null) ?? null,
      to: (row.email as string | null) ?? null,
      studentName: displayName,
      planLabel,
      amountLabel,
      nextChargeFormatted,
      daysLeft,
      offset,
    },
    payload: {
      event: "subscription.renewal_reminder" as const,
      environment: row.environment as "sandbox" | "live",
      lead_id: (row.lead_id as string | null) ?? null,
      email: (row.email as string | null) ?? null,
      full_name: fullName,
      plan: (row.plan_name as string | null) ?? null,
      status: (row.status as string | null) ?? null,
      currency: (row.currency as string | null) ?? null,
      extra: {
        language: "en",
        language_name: "English",
        locale: "en-US",
        email_language_instruction:
          "Write this reminder entirely in English (US). Do not use Portuguese.",
        email_tone_instruction:
          "Warm, personal and encouraging — address the student by first name, celebrate their progress in the course and keep it short and reassuring.",
        student_first_name: displayName,
        student_full_name: fullName,
        student_email: (row.email as string | null) ?? null,
        greeting,
        email_subject: emailSubject,
        email_preheader: emailPreheader,
        email_intro: emailIntro,
        email_body: emailBody,
        email_progress_line: progressLine,
        email_signoff: emailSignoff,
        cta_label: "View my membership",
        cta_url: row.membership_url,
        charge_when_label: whenLabel,
        reminder_offset_days: offset,
        billing_days_until_next_charge: daysLeft,
        billing_next_charge_at: nextCharge,
        billing_next_charge_at_formatted: nextChargeFormatted,
        billing_amount_per_cycle: row.amount_per_cycle,
        billing_amount_per_cycle_formatted: row.amount_per_cycle_formatted,
        billing_currency: row.currency,
        billing_plan_name: row.plan_name,
        billing_plan_label: planLabel,
        billing_tier: row.tier,
        billing_interval: row.interval,
        billing_duration_months: totalMonths,
        billing_months_paid: paidMonths,
        billing_months_remaining: monthsRemaining,
        billing_total_commitment: row.total_commitment,
        billing_schedule: schedule,
        billing_card_last4: row.card_last4,
        billing_subscription_status: row.status,
        membership_url: row.membership_url,
        stripe_subscription_id: row.stripe_subscription_id,
        billing_summary_text: `Your next monthly charge of ${amountLabel} is scheduled for ${nextChargeFormatted} (${whenLabel})${cardLine}.`,
      } as Record<string, unknown>,
    },
  };
}

/** Offset that would be used for a given number of remaining days. */
export function pickReminderOffset(remaining: number): number {
  return (
    REMINDER_OFFSETS_DAYS.slice()
      .sort((a, b) => b - a)
      .find((o) => remaining <= o) ?? Math.max(...REMINDER_OFFSETS_DAYS)
  );
}


export type ReminderSweepResult = {
  scanned: number;
  sent: number;
  skipped: number;
  failures: number;
  details: { subscription: string; days: number; ok: boolean }[];
};

export async function runBillingReminderSweep(options?: {
  dryRun?: boolean;
}): Promise<ReminderSweepResult> {
  const result: ReminderSweepResult = {
    scanned: 0,
    sent: 0,
    skipped: 0,
    failures: 0,
    details: [],
  };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const maxOffset = Math.max(...REMINDER_OFFSETS_DAYS);
  const horizon = new Date(Date.now() + (maxOffset + 1) * 86400000).toISOString();

  const { data: rows, error } = await supabaseAdmin
    .from("subscription_billing")
    .select("*")
    .not("next_charge_at", "is", null)
    .gte("next_charge_at", new Date().toISOString())
    .lte("next_charge_at", horizon)
    .in("status", ["active", "trialing", "past_due"])
    .eq("cancel_at_period_end", false);

  if (error) {
    console.error("[billing-reminders] query failed:", error);
    return result;
  }

  const { forwardToTaskade } = await import("@/lib/taskade.server");

  for (const row of rows ?? []) {
    result.scanned++;
    const nextCharge = row.next_charge_at as string;
    const remaining = daysUntil(nextCharge);

    // Pick the tightest offset that this row has reached but not yet used.
    const offset = REMINDER_OFFSETS_DAYS
      .slice()
      .sort((a, b) => b - a)
      .find((o) => remaining <= o);

    if (offset == null) {
      result.skipped++;
      continue;
    }

    const sameCycle =
      row.last_reminder_charge_at &&
      new Date(row.last_reminder_charge_at as string).getTime() ===
        new Date(nextCharge).getTime();
    if (sameCycle && (row.last_reminder_offset_days as number | null) != null &&
        (row.last_reminder_offset_days as number) <= offset) {
      result.skipped++;
      continue;
    }

    const built = buildReminderPayload(row, offset, remaining);
    const forward = await forwardToTaskade({
      ...built.payload,
      extra: { ...built.payload.extra, ...(options?.dryRun ? { dry_run: true } : {}) },
    });



    result.details.push({
      subscription: row.stripe_subscription_id as string,
      days: offset,
      ok: forward.ok,
    });

    if (forward.ok) {
      result.sent++;
      if (!options?.dryRun) {
        await supabaseAdmin
          .from("subscription_billing")
          .update({
            last_reminder_sent_at: new Date().toISOString(),
            last_reminder_offset_days: offset,
            last_reminder_charge_at: nextCharge,
          })
          .eq("stripe_subscription_id", row.stripe_subscription_id);
      }
    } else {
      result.failures++;
    }
  }

  return result;
}
