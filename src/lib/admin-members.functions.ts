import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Supa = any;

async function requireAdmin(supabase: Supa) {
  const { data, error } = await supabase.rpc("is_admin");
  if (error || data !== true) {
    throw new Error("Forbidden: admin access required");
  }
}

// ---------- Classes ----------

export const adminListClasses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase);
    const { data, error } = await context.supabase
      .from("class_sessions")
      .select("id, title, starts_at, live_url, replay_url")
      .order("starts_at", { ascending: false });
    if (error) return { error: "load_failed" as const };
    return { classes: data ?? [] };
  });

const classSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1),
  startsAt: z.string().min(1),
  liveUrl: z.string().url().or(z.literal("")).optional(),
  replayUrl: z.string().url().or(z.literal("")).optional(),
});

export const adminSaveClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => classSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase);
    const row = {
      title: data.title,
      starts_at: new Date(data.startsAt).toISOString(),
      live_url: data.liveUrl || null,
      replay_url: data.replayUrl || null,
    };
    const query = data.id
      ? context.supabase.from("class_sessions").update(row).eq("id", data.id)
      : context.supabase.from("class_sessions").insert(row);
    const { error } = await query;
    if (error) return { error: "save_failed" as const };
    return { ok: true as const };
  });

export const adminDeleteClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase);
    const { error } = await context.supabase.from("class_sessions").delete().eq("id", data.id);
    if (error) return { error: "delete_failed" as const };
    return { ok: true as const };
  });

// ---------- Foundations ----------

export const adminListFoundations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase);
    const { data, error } = await context.supabase
      .from("foundations_items")
      .select("id, title, description, media_url, sort_order, active")
      .order("sort_order", { ascending: true });
    if (error) return { error: "load_failed" as const };
    return { items: data ?? [] };
  });

const foundationsSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  mediaUrl: z.string().url(),
  sortOrder: z.number().int().min(0),
  active: z.boolean(),
});

export const adminSaveFoundationsItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => foundationsSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase);
    const row = {
      title: data.title,
      description: data.description || null,
      media_url: data.mediaUrl,
      sort_order: data.sortOrder,
      active: data.active,
    };
    const query = data.id
      ? context.supabase.from("foundations_items").update(row).eq("id", data.id)
      : context.supabase.from("foundations_items").insert(row);
    const { error } = await query;
    if (error) return { error: "save_failed" as const };
    return { ok: true as const };
  });

export const adminDeleteFoundationsItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase);
    const { error } = await context.supabase.from("foundations_items").delete().eq("id", data.id);
    if (error) return { error: "delete_failed" as const };
    return { ok: true as const };
  });

// ---------- Session slots & bookings ----------

export const adminListSlots = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase);
    const [{ data: slots }, { data: bookings }] = await Promise.all([
      context.supabase
        .from("session_slots")
        .select("id, starts_at")
        .order("starts_at", { ascending: true }),
      context.supabase
        .from("session_bookings")
        .select("id, slot_id, email, full_name, status, recording_url, created_at")
        .order("created_at", { ascending: false }),
    ]);
    return { slots: slots ?? [], bookings: bookings ?? [] };
  });

export const adminAddSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ startsAt: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase);
    const { error } = await context.supabase
      .from("session_slots")
      .insert({ starts_at: new Date(data.startsAt).toISOString() });
    if (error) return { error: error.code === "23505" ? ("duplicate" as const) : ("save_failed" as const) };
    return { ok: true as const };
  });

export const adminDeleteSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase);
    const { error } = await context.supabase.from("session_slots").delete().eq("id", data.id);
    if (error) return { error: "delete_failed" as const };
    return { ok: true as const };
  });

const bookingUpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["booked", "completed", "canceled"]).optional(),
  recordingUrl: z.string().url().or(z.literal("")).optional(),
});

export const adminUpdateBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => bookingUpdateSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase);
    const row: { status?: string; recording_url?: string | null } = {};
    if (data.status) row.status = data.status;
    if (data.recordingUrl !== undefined) row.recording_url = data.recordingUrl || null;
    const { error } = await context.supabase
      .from("session_bookings")
      .update(row)
      .eq("id", data.id);
    if (error) return { error: "save_failed" as const };
    return { ok: true as const };
  });

// ---------- Portfolios ----------

export const adminListPortfolios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase);
    const { data, error } = await context.supabase
      .from("portfolio_submissions")
      .select(
        "id, email, full_name, status, feedback, initial_sample_url, final_sample_url, creation_url, reflection, created_at",
      )
      .order("created_at", { ascending: false });
    if (error) return { error: "load_failed" as const };
    return { portfolios: data ?? [] };
  });

const reviewSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["submitted", "in_review", "approved", "returned"]),
  feedback: z.string().max(5000).optional(),
});

export const adminReviewPortfolio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => reviewSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase);
    const { error } = await context.supabase
      .from("portfolio_submissions")
      .update({ status: data.status, feedback: data.feedback || null })
      .eq("id", data.id);
    if (error) return { error: "save_failed" as const };
    return { ok: true as const };
  });
