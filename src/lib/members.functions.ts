import { isMembershipActive } from "@/lib/membership-access";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Membership = {
  tier: "live" | "complete" | null;
  accessStatus: string;
  enrolledAt: string | null;
  currentPeriodEnd: string | null;
  paidActiveMonths: number;
  fullName: string | null;
  graceExpiresAt?: string | null;
};

export type ClassSession = {
  id: string;
  title: string;
  startsAt: string;
  liveUrl: string | null;
  replayUrl: string | null;
};

export type FoundationsItem = {
  id: string;
  title: string;
  description: string | null;
  mediaUrl: string;
  sortOrder: number;
};

export type SessionSlot = {
  id: string;
  startsAt: string;
  booked: boolean;
};

export type Booking = {
  id: string;
  slotId: string;
  startsAt: string;
  status: string;
  recordingUrl: string | null;
};

export type Portfolio = {
  id: string;
  status: string;
  feedback: string | null;
  initialSampleUrl: string;
  finalSampleUrl: string;
  creationUrl: string;
  reflection: string;
  createdAt: string;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
type Supa = any;

function isActive(m: Membership | null): boolean {
  // Decided at load time by the shared date-bounded rule (live rows or explicit courtesy only).
  return !!m && (m as Membership & { accessActive?: boolean }).accessActive === true;
}

async function loadMembership(
  supabase: Supa,
): Promise<{ email: string; membership: Membership | null } | null> {
  const { data: userData } = await supabase.auth.getUser();
  const email = userData?.user?.email?.toLowerCase();
  if (!email) return null;
  const { data: rows } = await supabase
    .from("member_subscriptions")
    .select("tier, access_status, student_enrolled_at, current_period_end, paid_active_months, full_name, grace_expires_at, environment, courtesy_access")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(20);
  const now = Date.now();
  // Sandbox rows never count unless explicitly flagged as courtesy access.
  const eligible = ((rows ?? []) as any[]).filter((r) => r.environment === "live" || r.courtesy_access === true);
  const data = eligible.find((r) => isMembershipActive(r, now)) ?? eligible[0] ?? null;
  if (!data) return { email, membership: null };
  const membership = {
    tier: data.tier === "complete" ? "complete" : data.tier === "live" ? "live" : null,
    accessStatus: data.access_status ?? "pending",
    enrolledAt: data.student_enrolled_at,
    currentPeriodEnd: data.current_period_end,
    paidActiveMonths: data.paid_active_months ?? 0,
    fullName: data.full_name,
    graceExpiresAt: data.grace_expires_at ?? null,
    accessActive: isMembershipActive(data, now),
  } as Membership & { accessActive: boolean };
  return { email, membership };
}

/** Membership card for the signed-in student (null membership = not enrolled). */
export const getMyMembership = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const result = await loadMembership(context.supabase);
    if (!result) return { error: "not_signed_in" as const };
    return { email: result.email, membership: result.membership, active: isActive(result.membership) };
  });

/**
 * Weekly classes. Replays are only exposed to Complete-tier students and only
 * for classes on/after their own enrollment date (never the historical archive).
 */
export const getClasses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const result = await loadMembership(context.supabase);
    if (!result) return { error: "not_signed_in" as const };
    if (!isActive(result.membership)) return { active: false as const, classes: [] as ClassSession[] };

    const { data, error } = await context.supabase
      .from("class_sessions")
      .select("id, title, starts_at, live_url, replay_url")
      .order("starts_at", { ascending: true });
    if (error) return { error: "load_failed" as const };

    const m = result.membership!;
    const enrolledAt = m.enrolledAt ? new Date(m.enrolledAt).getTime() : null;
    const classes: ClassSession[] = (data ?? []).map((row: Supa) => {
      const startsAt = row.starts_at as string;
      const canSeeReplay =
        m.tier === "complete" && enrolledAt !== null && new Date(startsAt).getTime() >= enrolledAt;
      return {
        id: row.id,
        title: row.title,
        startsAt,
        liveUrl: row.live_url,
        replayUrl: canSeeReplay ? row.replay_url : null,
      };
    });
    return { active: true as const, tier: m.tier, classes };
  });

/** Method Foundations recorded library — available to every active student. */
export const getFoundations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const result = await loadMembership(context.supabase);
    if (!result) return { error: "not_signed_in" as const };
    if (!isActive(result.membership)) return { active: false as const, items: [] as FoundationsItem[] };

    const { data, error } = await context.supabase
      .from("foundations_items")
      .select("id, title, description, media_url, sort_order")
      .eq("active", true)
      .order("sort_order", { ascending: true });
    if (error) return { error: "load_failed" as const };

    const items: FoundationsItem[] = (data ?? []).map((row: Supa) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      mediaUrl: row.media_url,
      sortOrder: row.sort_order,
    }));
    return { active: true as const, items };
  });

/** Future bookable slots + the student's own bookings. */
export const getSessionData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const result = await loadMembership(context.supabase);
    if (!result) return { error: "not_signed_in" as const };
    if (!isActive(result.membership)) {
      return { active: false as const, slots: [] as SessionSlot[], bookings: [] as Booking[], usedThisCycle: 0 };
    }
    const email = result.email;

    const [{ data: slotRows }, { data: bookingRows }] = await Promise.all([
      context.supabase
        .from("session_slots")
        .select("id, starts_at")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true }),
      context.supabase
        .from("session_bookings")
        .select("id, slot_id, status, recording_url, created_at, session_slots(starts_at)")
        .eq("email", email)
        .order("created_at", { ascending: false }),
    ]);

    const bookings: Booking[] = (bookingRows ?? []).map((row: Supa) => ({
      id: row.id,
      slotId: row.slot_id,
      startsAt: row.session_slots?.starts_at ?? row.created_at,
      status: row.status,
      recordingUrl: row.recording_url,
    }));

    // Slots booked by ANY student must appear taken; RLS hides other students'
    // booking rows, so use the security-definer helper for the full list.
    const { data: takenRows } = await context.supabase.rpc("taken_slot_ids");
    const taken = new Set((takenRows ?? []).map((id: string) => id));

    const slots: SessionSlot[] = (slotRows ?? []).map((row: Supa) => ({
      id: row.id,
      startsAt: row.starts_at,
      booked: taken.has(row.id),
    }));

    const cycleStart = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const usedThisCycle = (bookingRows ?? []).filter(
      (b: Supa) => b.status === "booked" && new Date(b.created_at).getTime() >= cycleStart,
    ).length;

    return { active: true as const, slots, bookings, usedThisCycle };
  });

const bookSchema = z.object({ slotId: z.string().uuid() });

/** Book one individual session — max 2 per active 30-day cycle. */
export const bookSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => bookSchema.parse(input))
  .handler(async ({ data, context }) => {
    const result = await loadMembership(context.supabase);
    if (!result) return { error: "not_signed_in" as const };
    if (!isActive(result.membership)) return { error: "no_active_membership" as const };
    const email = result.email;

    const cycleStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count } = await context.supabase
      .from("session_bookings")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .eq("status", "booked")
      .gte("created_at", cycleStart);
    if ((count ?? 0) >= 2) {
      return { error: "cycle_limit" as const };
    }

    const { error } = await context.supabase.from("session_bookings").insert({
      slot_id: data.slotId,
      email,
      full_name: result.membership?.fullName ?? null,
      status: "booked",
    });
    if (error) {
      // Unique violation on slot_id = someone else took it first.
      return { error: error.code === "23505" ? ("slot_taken" as const) : ("book_failed" as const) };
    }
    return { ok: true as const };
  });

const cancelSchema = z.object({ bookingId: z.string().uuid() });

/** Cancel one of the student's own upcoming bookings. */
export const cancelBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => cancelSchema.parse(input))
  .handler(async ({ data, context }) => {
    const result = await loadMembership(context.supabase);
    if (!result) return { error: "not_signed_in" as const };
    const { error } = await context.supabase
      .from("session_bookings")
      .delete()
      .eq("id", data.bookingId)
      .eq("email", result.email);
    if (error) return { error: "cancel_failed" as const };
    return { ok: true as const };
  });

/** The student's latest portfolio submission, if any. */
export const getMyPortfolio = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const result = await loadMembership(context.supabase);
    if (!result) return { error: "not_signed_in" as const };
    const { data } = await context.supabase
      .from("portfolio_submissions")
      .select("id, status, feedback, initial_sample_url, final_sample_url, creation_url, reflection, created_at")
      .eq("email", result.email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const portfolio: Portfolio | null = data
      ? {
          id: data.id,
          status: data.status,
          feedback: data.feedback,
          initialSampleUrl: data.initial_sample_url,
          finalSampleUrl: data.final_sample_url,
          creationUrl: data.creation_url,
          reflection: data.reflection,
          createdAt: data.created_at,
        }
      : null;
    return {
      active: isActive(result.membership),
      paidActiveMonths: result.membership?.paidActiveMonths ?? 0,
      portfolio,
    };
  });

const portfolioSchema = z.object({
  initialSampleUrl: z.string().url(),
  finalSampleUrl: z.string().url(),
  creationUrl: z.string().url(),
  reflection: z.string().min(1).max(5000),
});

/**
 * Submit (or resubmit after guidance) the Conscious Voice Transformation
 * Portfolio. Eligibility begins after six active months.
 */
export const submitPortfolio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => portfolioSchema.parse(input))
  .handler(async ({ data, context }) => {
    const result = await loadMembership(context.supabase);
    if (!result) return { error: "not_signed_in" as const };
    if (!isActive(result.membership)) return { error: "no_active_membership" as const };
    if ((result.membership?.paidActiveMonths ?? 0) < 6) {
      return { error: "not_eligible_yet" as const };
    }

    const { error } = await context.supabase.from("portfolio_submissions").insert({
      email: result.email,
      full_name: result.membership?.fullName ?? null,
      initial_sample_url: data.initialSampleUrl,
      final_sample_url: data.finalSampleUrl,
      creation_url: data.creationUrl,
      reflection: data.reflection,
      status: "submitted",
    });
    if (error) return { error: "submit_failed" as const };
    return { ok: true as const };
  });
