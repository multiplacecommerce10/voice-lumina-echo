/**
 * Persistence + side effects for PayPal subscriptions (server-only).
 *
 * PayPal rows live in `member_subscriptions` with provider='paypal' so the
 * member area, has_active_membership() and admin views stay provider-agnostic.
 * For these rows `stripe_subscription_id` holds the PayPal subscription id
 * ("I-…") and `stripe_price_id` holds the PayPal plan id.
 *
 * Emails are NEVER sent inline: state transitions persist notifications that
 * go through the durable outbox (src/lib/notification-outbox.ts).
 */

import type { PayPalEnv } from "@/lib/paypal-plans";
import { reconcilePayPalState, type CheckoutIntent, type PayPalStateRepo, type PayPalSubState } from "@/lib/paypal-lifecycle";
import {
  drainPendingNotifications,
  processOutbox,
  type OutboxInsert,
  type OutboxRow,
  type OutboxStore,
} from "@/lib/notification-outbox";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

const STATE_COLUMNS =
  "access_status,status,tier,duration_months,price_lookup_key,stripe_price_id,current_period_start,current_period_end,cancel_at_period_end,canceled_at,first_payment_failed_at,grace_expires_at,student_enrolled_at,paid_invoice_count,paid_active_months,processed_invoice_ids,processed_event_ids,last_invoice_id,last_invoice_paid_at,lead_id,email,full_name,metadata,period_anchor_at,pending_notifications,row_version,provider";

export function supabasePayPalRepo(env: PayPalEnv): PayPalStateRepo {
  return {
    async load(subscriptionId) {
      const d = await db();
      const { data, error } = await d
        .from("member_subscriptions")
        .select(STATE_COLUMNS)
        .eq("stripe_subscription_id", subscriptionId)
        .eq("environment", env)
        .maybeSingle();
      if (error) throw new Error(`paypal load failed: ${error.message}`);
      if (!data) return null;
      if (data.provider !== "paypal") throw new Error("subscription id belongs to another provider");
      const { row_version, provider: _p, ...state } = data;
      return { state: state as PayPalSubState, version: row_version ?? 0 };
    },
    async save(subscriptionId, expectedVersion, next) {
      const d = await db();
      if (expectedVersion === null) {
        const { error } = await d.from("member_subscriptions").insert({
          ...next,
          stripe_subscription_id: subscriptionId,
          environment: env,
          provider: "paypal",
          courtesy_access: false,
          row_version: 1,
        });
        if (error) {
          if (error.code === "23505") return false; // concurrent insert won
          throw new Error(`paypal insert failed: ${error.message}`);
        }
        return true;
      }
      const { data, error } = await d
        .from("member_subscriptions")
        .update({ ...next, row_version: expectedVersion + 1 })
        .eq("stripe_subscription_id", subscriptionId)
        .eq("environment", env)
        .eq("provider", "paypal")
        .eq("row_version", expectedVersion)
        .select("id");
      if (error) throw new Error(`paypal update failed: ${error.message}`);
      return (data ?? []).length === 1;
    },
  };
}

export async function loadIntent(env: PayPalEnv, intentId: string | null): Promise<CheckoutIntent | null> {
  if (!intentId || !/^[0-9a-f-]{36}$/.test(intentId)) return null;
  const d = await db();
  const { data, error } = await d
    .from("paypal_checkout_intents")
    .select("id, lead_id, environment, plan_id, email, full_name, paypal_subscription_id, admission_status")
    .eq("id", intentId)
    .eq("environment", env)
    .maybeSingle();
  if (error) throw new Error(`paypal intent load failed: ${error.message}`);
  if (!data) return null;
  return {
    id: data.id,
    leadId: data.lead_id,
    environment: data.environment,
    planId: data.plan_id,
    email: data.email,
    fullName: data.full_name,
    boundSubscriptionId: data.paypal_subscription_id ?? null,
    admissionApproved: data.admission_status === "approved",
  };
}

/**
 * Atomically binds an intent to the FIRST subscription that presents it
 * (UPDATE … WHERE paypal_subscription_id IS NULL). Any other subscription
 * reusing the same custom_id is rejected. Used by onApprove AND the webhook,
 * whichever arrives first.
 */
export async function bindIntent(env: PayPalEnv, intentId: string, subscriptionId: string): Promise<"bound" | "already_bound" | "conflict" | "missing"> {
  const d = await db();
  const { data, error } = await d
    .from("paypal_checkout_intents")
    .update({ paypal_subscription_id: subscriptionId, bound_at: new Date().toISOString(), status: "approved", updated_at: new Date().toISOString() })
    .eq("id", intentId)
    .eq("environment", env)
    .is("paypal_subscription_id", null)
    .select("id");
  if (error) throw new Error(`paypal intent bind failed: ${error.message}`);
  if ((data ?? []).length === 1) return "bound";
  const { data: cur, error: e2 } = await d
    .from("paypal_checkout_intents")
    .select("paypal_subscription_id")
    .eq("id", intentId)
    .eq("environment", env)
    .maybeSingle();
  if (e2) throw new Error(`paypal intent read failed: ${e2.message}`);
  if (!cur) return "missing";
  return cur.paypal_subscription_id === subscriptionId ? "already_bound" : "conflict";
}

/** Inserts the event row first; returns fresh=false when it was already processed. */
export async function claimEvent(env: PayPalEnv, ev: { eventId: string; eventType: string; subscriptionId: string | null }, payload: unknown) {
  const d = await db();
  const { error } = await d.from("paypal_webhook_events").insert({
    event_id: ev.eventId,
    environment: env,
    event_type: ev.eventType,
    resource_id: ev.subscriptionId,
    subscription_id: ev.subscriptionId,
    transaction_id: null,
    payload: payload as never,
  });
  if (!error) return { fresh: true };
  if (error.code !== "23505") throw new Error(`paypal event insert failed: ${error.message}`);
  const { data, error: e2 } = await d
    .from("paypal_webhook_events")
    .select("processed_at")
    .eq("event_id", ev.eventId)
    .eq("environment", env)
    .maybeSingle();
  if (e2) throw new Error(`paypal event read failed: ${e2.message}`);
  return { fresh: !data?.processed_at };
}

/** Throws on failure so PayPal redelivers (state + outbox are idempotent). */
export async function finishEvent(env: PayPalEnv, eventId: string, outcome: string, transactionId: string | null) {
  const d = await db();
  const { error } = await d
    .from("paypal_webhook_events")
    .update({ processed_at: new Date().toISOString(), outcome, transaction_id: transactionId })
    .eq("event_id", eventId)
    .eq("environment", env);
  if (error) throw new Error(`paypal event finish failed: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Outbox adapters
// ---------------------------------------------------------------------------

async function insertOutbox(rows: OutboxInsert[]) {
  if (!rows.length) return;
  const d = await db();
  const { error } = await d
    .from("notification_outbox")
    .upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true });
  if (error) throw new Error(`outbox insert failed: ${error.message}`);
}

export function supabaseOutboxStore(): OutboxStore {
  return {
    async claimDue(now, limit) {
      const d = await db();
      const nowIso = new Date(now).toISOString();
      const { data, error } = await d
        .from("notification_outbox")
        .select("id, dedupe_key, environment, provider, kind, subscription_id, recipient, attempts, locked_until, payload")
        .in("status", ["pending", "failed"])
        .lte("next_attempt_at", nowIso)
        .order("created_at")
        .limit(limit);
      if (error) throw new Error(`outbox scan failed: ${error.message}`);
      const leased: OutboxRow[] = [];
      for (const r of data ?? []) {
        if (r.locked_until && Date.parse(r.locked_until) > now) continue;
        let q = d
          .from("notification_outbox")
          .update({ locked_until: new Date(now + 5 * 60_000).toISOString(), updated_at: nowIso })
          .eq("id", r.id)
          .in("status", ["pending", "failed"]);
        q = r.locked_until ? q.eq("locked_until", r.locked_until) : q.is("locked_until", null);
        const { data: got, error: e2 } = await q.select("id");
        if (e2) throw new Error(`outbox lease failed: ${e2.message}`);
        if ((got ?? []).length === 1) leased.push(r as OutboxRow);
      }
      return leased;
    },
    async markSent(id, now) {
      const d = await db();
      const { error } = await d.from("notification_outbox").update({ status: "sent", sent_at: new Date(now).toISOString(), locked_until: null, last_error: null, updated_at: new Date(now).toISOString() }).eq("id", id);
      if (error) throw new Error(`outbox mark sent failed: ${error.message}`);
    },
    async markSkipped(id, status, now) {
      const d = await db();
      const { error } = await d.from("notification_outbox").update({ status, locked_until: null, updated_at: new Date(now).toISOString() }).eq("id", id);
      if (error) throw new Error(`outbox mark skipped failed: ${error.message}`);
    },
    async markFailed(id, err, nextAt, now) {
      const d = await db();
      const { data: cur } = await d.from("notification_outbox").select("attempts").eq("id", id).maybeSingle();
      const { error } = await d
        .from("notification_outbox")
        .update({
          status: nextAt === null ? "dead" : "failed",
          attempts: (cur?.attempts ?? 0) + 1,
          last_error: err.slice(0, 500),
          next_attempt_at: new Date(nextAt ?? now).toISOString(),
          locked_until: null,
          updated_at: new Date(now).toISOString(),
        })
        .eq("id", id);
      if (error) throw new Error(`outbox mark failed failed: ${error.message}`);
    },
  };
}

async function findAuthUser(email: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const found = data?.users?.find((u) => u.email?.toLowerCase() === email);
    if (found) return found;
    if (!data?.users?.length || data.users.length < 100) return null;
  }
  return null;
}

/** Delivers ONE live outbox row. Throws on failure (row is retried). Never sets or emails passwords. */
async function deliverPayPal(row: OutboxRow): Promise<void> {
  const env = row.environment as PayPalEnv;
  const loaded = await supabasePayPalRepo(env).load(row.subscription_id);
  if (!loaded) throw new Error("subscription row missing");
  const s = loaded.state;
  const to = (s.email ?? row.recipient ?? "").toLowerCase();
  if (!to) throw new Error("no recipient");
  const { sendHostingerMail } = await import("@/lib/hostinger-mail.server");
  let draft: { subject: string; bodyHtml: string; bodyText: string };

  if (row.kind === "welcome_confirmation" || row.kind === "renewal_receipt") {
    const { buildConfirmationEmail } = await import("@/lib/confirmation-email");
    const { EMAIL_BRAND } = await import("@/lib/email-branding");
    const { COURSE_START_UTC, formatClassInTimeZone, getNextClassAfter } = await import("@/lib/course-schedule");
    const { SUBSCRIPTION_CATALOG } = await import("@/lib/subscription-catalog");
    const months = (s.duration_months ?? 1) as 1 | 3 | 6;
    const entry = s.tier ? SUBSCRIPTION_CATALOG[s.tier][months] : null;
    const fmt = (n: number) => `US$ ${n.toFixed(2)}`;
    const fmtDate = (iso: string | null) =>
      iso ? new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }) : null;
    draft = buildConfirmationEmail({
      fullName: s.full_name,
      email: to,
      planIntended: s.price_lookup_key,
      tier: s.tier,
      durationMonths: s.duration_months,
      totalFormatted: entry ? fmt(entry.amountUsd) : null,
      amountPerCycleFormatted: entry ? fmt(entry.amountUsd) : null,
      isRecurring: true,
      isRenewal: row.kind === "renewal_receipt",
      billingIntervalMonths: s.duration_months,
      nextChargeAtFormatted: s.cancel_at_period_end ? null : fmtDate(s.current_period_end),
      courseStartFormatted: formatClassInTimeZone(COURSE_START_UTC, "UTC").full,
      nextClassFormatted: formatClassInTimeZone(getNextClassAfter(new Date()), "UTC").full,
      membershipUrl: EMAIL_BRAND.membershipUrl,
    });
  } else if (row.kind === "account_access") {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { buildPayPalAccountAccessEmail } = await import("@/lib/paypal-emails");
    const marker = `paypal:${row.dedupe_key}`;
    let user = await findAuthUser(to);
    let isNew = false;
    if (!user) {
      // No password is set or emailed: the student chooses it via a one-time link.
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: to,
        email_confirm: true,
        user_metadata: { full_name: s.full_name ?? undefined, created_via: marker },
      });
      if (error && !(await findAuthUser(to))) throw error;
      user = data?.user ?? (await findAuthUser(to));
      isNew = true;
    } else if ((user.user_metadata as any)?.created_via === marker) {
      isNew = true; // retry after we created the account: still a new-account email
    }
    let setPasswordUrl: string | null = null;
    if (isNew) {
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: to,
        options: { redirectTo: "https://consciousvoice.tecendosom.com/reset-password" },
      });
      if (error || !data?.properties?.action_link) throw error ?? new Error("no set-password link");
      setPasswordUrl = data.properties.action_link;
    }
    draft = buildPayPalAccountAccessEmail({ fullName: s.full_name, email: to, setPasswordUrl });
  } else {
    const { buildPayPalNoticeEmail } = await import("@/lib/paypal-emails");
    draft = buildPayPalNoticeEmail(row.kind as any, {
      fullName: s.full_name,
      graceExpiresAt: s.grace_expires_at,
      currentPeriodEnd: s.current_period_end,
    });
  }
  const r = await sendHostingerMail("subscription", { to, subject: draft.subject, html: draft.bodyHtml, text: draft.bodyText });
  if (!r.ok) throw new Error(`mail send failed: HTTP ${r.status}`);
}

/** Copies pending notifications into the outbox (throws on failure). */
export async function drainNotifications(env: PayPalEnv, subscriptionId: string) {
  return drainPendingNotifications({ repo: supabasePayPalRepo(env), env, subscriptionId, insert: insertOutbox });
}

/** Delivers due outbox rows. Sandbox rows are recorded as skipped_sandbox and never sent. */
export async function runOutbox(now = () => Date.now()) {
  return processOutbox({
    store: supabaseOutboxStore(),
    deliver: async (row) => {
      if (row.provider === "enrollment_projection" && row.kind === "enrollment_sheet") {
        const { deliverEnrollmentProjection } = await import("./enrollment-projection.server");
        return deliverEnrollmentProjection(row);
      }
      if (row.provider === "scholarship" && row.kind === "scholarship_received") {
        if (!row.recipient || typeof row.payload?.fullName !== "string") throw new Error("Scholarship receipt binding missing");
        const { buildScholarshipApplicationEmail } = await import("./scholarship-email");
        const { sendHostingerMail } = await import("./hostinger-mail.server");
        const mail = buildScholarshipApplicationEmail(row.payload.fullName);
        const sent = await sendHostingerMail("scholarship", { to: row.recipient, subject: mail.subject, html: mail.bodyHtml, text: mail.bodyText });
        if (!sent.ok) throw new Error(`Scholarship receipt delivery failed: HTTP ${sent.status}`);
        return;
      }
      if (row.provider === "courtesy") {
        const { deliverCourtesy } = await import("@/lib/private-diagnostic-grant.server");
        return deliverCourtesy(row);
      }
      return deliverPayPal(row);
    },
    now,
  });
}

/** Scheduler: time-based PayPal transitions + outbox drain/retry. Access itself never depends on this job. */
export async function reconcilePayPalRows(env: PayPalEnv, now = Date.now()) {
  const repo = supabasePayPalRepo(env);
  const d = await db();
  const { data, error } = await d
    .from("member_subscriptions")
    .select("stripe_subscription_id, access_status, pending_notifications")
    .eq("environment", env)
    .eq("provider", "paypal");
  if (error) throw new Error(`paypal reconcile scan failed: ${error.message}`);
  const changed: string[] = [];
  for (const r of (data ?? []) as { stripe_subscription_id: string; access_status: string; pending_notifications: unknown[] }[]) {
    const subId = r.stripe_subscription_id;
    if (r.access_status === "active" || r.access_status === "past_due_grace") {
      for (let i = 0; i < 4; i++) {
        const loaded = await repo.load(subId);
        if (!loaded) break;
        const res = reconcilePayPalState(loaded.state, now, subId);
        if (!res.changed) break;
        if (await repo.save(subId, loaded.version, res.next)) {
          changed.push(subId);
          break;
        }
      }
    }
    await drainNotifications(env, subId);
  }
  const outbox = await runOutbox(() => Date.now());
  return { scanned: (data ?? []).length, changed: changed.length, outbox };
}
