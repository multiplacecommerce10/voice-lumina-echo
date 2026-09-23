import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  PURGE_CONFIRMATION,
  fictitiousAnswers,
  isFictitiousLead,
} from "@/lib/fictitious";

const LIST_SELECT =
  "id, full_name, email, phone, plan_intended, status, source, answers, created_at, updated_at";

/** Every lead currently flagged (or detected) as a fictitious test member. */
export const listFictitiousLeads = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("leads")
    .select(LIST_SELECT)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) return { ok: false as const, error: error.message, leads: [], total: 0 };

  const all = data ?? [];
  const leads = all.filter((l) => isFictitiousLead(l));
  return {
    ok: true as const,
    error: null,
    leads: leads.map((l) => ({
      id: l.id as string,
      full_name: l.full_name as string | null,
      email: l.email as string | null,
      plan_intended: l.plan_intended as string | null,
      status: l.status as string | null,
      source: l.source as string | null,
      created_at: l.created_at as string,
      explicit:
        Boolean(
          l.answers &&
            typeof l.answers === "object" &&
            !Array.isArray(l.answers) &&
            (l.answers as Record<string, unknown>).is_test === true,
        ),
    })),
    total: all.length,
    fetchedAt: new Date().toISOString(),
  };
});

/** Applies the fictitious chancela to an existing lead (no deletion). */
export const markLeadFictitious = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ leadId: z.string().uuid(), marked: z.boolean().optional().default(true) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("leads")
      .select("id, answers")
      .eq("id", data.leadId)
      .maybeSingle();
    if (error || !row) return { ok: false as const, error: error?.message ?? "lead_not_found" };

    const current =
      row.answers && typeof row.answers === "object" && !Array.isArray(row.answers)
        ? { ...(row.answers as Record<string, unknown>) }
        : {};

    let next: Record<string, unknown>;
    if (data.marked) {
      next = fictitiousAnswers(current);
    } else {
      next = { ...current };
      for (const key of [
        "is_test",
        "test_mode",
        "test_kind",
        "member_type",
        "member_label",
        "delete_before_launch",
        "marked_at",
      ]) {
        delete next[key];
      }
    }

    const { error: upErr } = await supabaseAdmin
      .from("leads")
      .update({ answers: next as never })
      .eq("id", data.leadId);
    if (upErr) return { ok: false as const, error: upErr.message };
    return { ok: true as const, marked: data.marked };
  });

/**
 * Irreversible cleanup before launch. Requires the exact confirmation phrase,
 * and only deletes rows that are flagged/detected as fictitious.
 */
export const purgeFictitiousLeads = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ confirmation: z.string().max(80), dryRun: z.boolean().optional().default(true) }).parse(input),
  )
  .handler(async ({ data }) => {
    if (data.confirmation.trim().toUpperCase() !== PURGE_CONFIRMATION) {
      return { ok: false as const, error: "confirmation_mismatch", deleted: 0, ids: [] };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("leads")
      .select(LIST_SELECT)
      .limit(1000);
    if (error) return { ok: false as const, error: error.message, deleted: 0, ids: [] };

    const targets = (rows ?? []).filter((l) => isFictitiousLead(l));
    const ids = targets.map((l) => l.id as string);

    if (data.dryRun || ids.length === 0) {
      return {
        ok: true as const,
        error: null,
        dryRun: true,
        deleted: 0,
        ids,
        preview: targets.map((l) => ({ id: l.id as string, email: l.email as string | null })),
      };
    }

    const { error: delErr } = await supabaseAdmin.from("leads").delete().in("id", ids);
    if (delErr) return { ok: false as const, error: delErr.message, deleted: 0, ids };

    console.log("[fictitious] purged test leads", JSON.stringify({ count: ids.length }));
    return { ok: true as const, error: null, dryRun: false, deleted: ids.length, ids };
  });
