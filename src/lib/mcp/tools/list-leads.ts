import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_leads",
  title: "List leads and abandoned checkouts",
  description:
    "List people who submitted the enrollment form, including abandoned checkouts and recovery-email history. Requires an admin account.",
  inputSchema: {
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(25)
      .describe("How many leads to return, newest first."),
    status: z
      .string()
      .trim()
      .nullable()
      .default(null)
      .describe(
        "Optional status filter, for example: new, checkout_started, abandoned, paid, checkout_completed.",
      ),
    email: z
      .string()
      .trim()
      .nullable()
      .default(null)
      .describe("Optional: only return the lead with this email."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, status, email }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("leads")
      .select(
        "id, created_at, updated_at, full_name, email, phone, plan_intended, status, source, resume_code, checkout_started_at, abandoned_at, abandon_reason, recovery_attempts, recovery_email_sent_at, utm_source, utm_medium, utm_campaign",
      )
      .order("created_at", { ascending: false })
      .limit(limit);
    if (status) query = query.eq("status", status);
    if (email) query = query.eq("email", email.toLowerCase());

    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    const rows = (data ?? []).map((row) => ({
      id: String(row.id),
      created_at: row.created_at ?? null,
      updated_at: row.updated_at ?? null,
      full_name: row.full_name ?? null,
      email: row.email ?? null,
      phone: row.phone ?? null,
      plan_intended: row.plan_intended ?? null,
      status: row.status ?? null,
      source: row.source ?? null,
      resume_code: row.resume_code ?? null,
      checkout_started_at: row.checkout_started_at ?? null,
      abandoned_at: row.abandoned_at ?? null,
      abandon_reason: row.abandon_reason ?? null,
      recovery_attempts: row.recovery_attempts ?? null,
      recovery_email_sent_at: row.recovery_email_sent_at ?? null,
      utm_source: row.utm_source ?? null,
      utm_medium: row.utm_medium ?? null,
      utm_campaign: row.utm_campaign ?? null,
    }));
    return {
      content: [
        {
          type: "text",
          text: rows.length ? JSON.stringify(rows, null, 2) : "No leads matched this query.",
        },
      ],
      structuredContent: { count: rows.length, leads: rows },
    };
  },
});
