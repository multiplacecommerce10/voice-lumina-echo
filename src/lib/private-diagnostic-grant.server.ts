// Owner-authorized courtesy for the private US$1 invitation: once ANY provider's
// diagnostic payment is confirmed paid, grant one 7-day Complete courtesy per
// invitation (never recurring, never a subscription) and queue welcome + account
// access emails once through the durable outbox. Existing members are untouched.
import type { OutboxRow } from "./notification-outbox";

export const COURTESY_PROVIDER = "courtesy";

/** Stores minimal name/email once per invitation (first submission wins). */
export async function recordDiagnosticProfile(db: any, inviteId: string, profile: { fullName: string; email: string }, consentVersion: string) {
  if (!consentVersion) throw new Error("Consent is required");
  // Only name, normalized email and the consent version/time are stored; no other profile answers.
  const { error } = await db.from("payment_diagnostic_grants").upsert(
    { invite_id: inviteId, email: profile.email.trim().toLowerCase(), full_name: profile.fullName.trim(), consent_version: consentVersion, consent_at: new Date().toISOString() },
    { onConflict: "invite_id", ignoreDuplicates: true },
  );
  if (error) throw new Error("Unable to record private enrollment");
  // Recipient is immutable once bound: a different email cannot replace it.
  const { data, error: readErr } = await db.from("payment_diagnostic_grants").select("email").eq("invite_id", inviteId).maybeSingle();
  if (readErr || !data) throw new Error("Unable to record private enrollment");
  if (data.email !== profile.email.trim().toLowerCase()) {
    throw new Error("This invitation is already linked to a different email address.");
  }
}

export const COURTESY_NOTE =
  "Special guest access: a one-time US$ 1.00 payment unlocks the Complete tier for 7 days from your confirmed payment. This is not a subscription and there is no automatic renewal or further charge.";

/** Adds the truthful courtesy terms to the normal welcome email. */
export function withCourtesyNote<T extends { bodyHtml: string; bodyText: string }>(draft: T, note: string = COURTESY_NOTE): T {
  const anchor = "Please keep this message as confirmation of your enrollment.";
  if (!draft.bodyText.includes(anchor) || !draft.bodyHtml.includes(anchor)) throw new Error("welcome template changed");
  return { ...draft, bodyText: draft.bodyText.replace(anchor, `${note}\n\n${anchor}`), bodyHtml: draft.bodyHtml.replace(anchor, `${note}</p>\n<p style="margin:0 0 18px;">${anchor}`) };
}

/** Never throws: payment recording must not depend on courtesy delivery. */
export async function afterDiagnosticPaid(db: any, inviteId: string) {
  try {
    const { data, error } = await db.rpc("grant_diagnostic_courtesy", { p_invite: inviteId });
    if (error) throw error;
    if (data === "granted" || data === "existing" || data === "already") {
      const { runOutbox } = await import("./paypal-state.server");
      await runOutbox();
    }
    return data as string;
  } catch (e) {
    console.error("[private-diagnostic] courtesy grant pending:", e instanceof Error ? e.message : "error");
    return "error";
  }
}

/**
 * Durable retry: grants every paid invitation whose grant is still missing (e.g. the inline RPC failed
 * after the provider confirmed payment), then drains due outbox rows. Called by the 5-minute scheduled sweep.
 * Idempotent: grant_diagnostic_courtesy and outbox dedupe keys make replays harmless.
 */
export async function reconcileDiagnosticGrants(db: any, drain?: () => Promise<unknown>) {
  const { data, error } = await db.rpc("pending_diagnostic_grants");
  if (error) throw new Error("Unable to list pending courtesy grants");
  const results: Record<string, number> = {};
  for (const id of (data ?? []) as string[]) {
    const r = await db.rpc("grant_diagnostic_courtesy", { p_invite: id });
    const k = r.error ? "error" : String(r.data);
    results[k] = (results[k] ?? 0) + 1;
  }
  if (drain) await drain(); else { const { runOutbox } = await import("./paypal-state.server"); await runOutbox(); }
  return results;
}

/** Resolves who/what to email from the invitation grant (form email), never from provider payer data. */
export async function resolveCourtesyTarget(db: any, row: OutboxRow) {
  const sub = row.subscription_id ?? "";
  if (!sub.startsWith("diag:")) throw new Error("not a courtesy notification");
  const { data: g, error } = await db.from("payment_diagnostic_grants")
    .select("email, full_name, granted_at, existing_access").eq("invite_id", sub.slice(5)).maybeSingle();
  if (error || !g || !g.granted_at) throw new Error("courtesy grant missing");
  if (!g.existing_access) {
    const { data: s } = await db.from("member_subscriptions").select("provider, courtesy_access")
      .eq("stripe_subscription_id", sub).eq("environment", "live").maybeSingle();
    if (!s || s.provider !== COURTESY_PROVIDER || s.courtesy_access !== true) throw new Error("courtesy row missing");
  }
  return { to: String(g.email).toLowerCase(), fullName: g.full_name as string | null, existing: g.existing_access === true };
}

export const EXISTING_ACCESS_NOTE =
  "Special guest payment: your one-time US$ 1.00 payment is confirmed. You already have Complete access, which continues exactly as before — this payment does not add, extend or change your access period, and there is no automatic renewal or further charge.";

export async function deliverCourtesy(row: OutboxRow): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const t = await resolveCourtesyTarget(supabaseAdmin, row);
  const to = t.to; const s = { full_name: t.fullName };
  let draft: { subject: string; bodyHtml: string; bodyText: string };
  if (row.kind === "welcome_confirmation") {
    const { buildConfirmationEmail } = await import("./confirmation-email");
    const { EMAIL_BRAND } = await import("./email-branding");
    const { COURSE_START_UTC, formatClassInTimeZone, getNextClassAfter } = await import("./course-schedule");
    draft = withCourtesyNote(buildConfirmationEmail({
      fullName: s.full_name, email: to, planIntended: null, tier: "complete", durationMonths: null,
      totalFormatted: "US$ 1.00 — Special guest (one-time, no renewal)", amountPerCycleFormatted: null,
      isRecurring: false, isRenewal: false, billingIntervalMonths: null, nextChargeAtFormatted: null,
      courseStartFormatted: formatClassInTimeZone(COURSE_START_UTC, "UTC").full,
      nextClassFormatted: formatClassInTimeZone(getNextClassAfter(new Date()), "UTC").full,
      membershipUrl: EMAIL_BRAND.membershipUrl,
    }), t.existing ? EXISTING_ACCESS_NOTE : COURTESY_NOTE);
  } else if (row.kind === "account_access") {
    const { prepareStripeAccountAccess } = await import("./stripe-account-access.server");
    // Existing accounts keep their password; only a newly created account gets a choose-password link.
    draft = await prepareStripeAccountAccess(supabaseAdmin.auth.admin, { email: to, fullName: s.full_name, eventId: row.dedupe_key });
  } else throw new Error("unsupported courtesy notification");
  const { sendHostingerMail } = await import("./hostinger-mail.server");
  const r = await sendHostingerMail("subscription", { to, subject: draft.subject, html: draft.bodyHtml, text: draft.bodyText });
  if (!r.ok) throw new Error(`mail send failed: HTTP ${r.status}`);
}
