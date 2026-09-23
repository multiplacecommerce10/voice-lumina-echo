import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_enrollments",
  title: "List enrollments",
  description:
    "List enrolled students of The Power of Conscious Voice with tier, duration, access status and billing period. Requires an admin account.",
  inputSchema: {
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(25)
      .describe("How many enrollments to return, newest first."),
    email: z
      .string()
      .trim()
      .nullable()
      .default(null)
      .describe("Optional: only return enrollments for this student email."),
    access_status: z
      .enum(["active", "grace", "expired", "any"])
      .default("any")
      .describe("Optional access-status filter."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, email, access_status }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("member_subscriptions")
      .select(
        "id, email, full_name, tier, duration_months, status, access_status, environment, price_lookup_key, current_period_start, current_period_end, grace_expires_at, paid_active_months, paid_invoice_count, cancel_at_period_end, student_enrolled_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(limit);
    if (email) query = query.eq("email", email.toLowerCase());
    if (access_status !== "any") query = query.eq("access_status", access_status);

    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    const rows = (data ?? []).map((row) => ({
      id: String(row.id),
      email: row.email ?? null,
      full_name: row.full_name ?? null,
      tier: row.tier ?? null,
      duration_months: row.duration_months ?? null,
      status: row.status ?? null,
      access_status: row.access_status ?? null,
      environment: row.environment ?? null,
      price_lookup_key: row.price_lookup_key ?? null,
      current_period_start: row.current_period_start ?? null,
      current_period_end: row.current_period_end ?? null,
      grace_expires_at: row.grace_expires_at ?? null,
      paid_active_months: row.paid_active_months ?? null,
      paid_invoice_count: row.paid_invoice_count ?? null,
      cancel_at_period_end: row.cancel_at_period_end ?? null,
      student_enrolled_at: row.student_enrolled_at ?? null,
      created_at: row.created_at ?? null,
    }));
    return {
      content: [
        {
          type: "text",
          text: rows.length
            ? JSON.stringify(rows, null, 2)
            : "No enrollments matched this query.",
        },
      ],
      structuredContent: { count: rows.length, enrollments: rows },
    };
  },
});
