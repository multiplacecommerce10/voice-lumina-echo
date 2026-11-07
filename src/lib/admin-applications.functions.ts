import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ScholarshipApplication = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  plan: string | null;
  status: string;
  decision: "pending" | "accepted" | "rejected";
  freeSeatCandidate: boolean;
  city: string | null;
  country: string | null;
  voiceJourney: string | null;
  goals: string | null;
  whyScholarship: string | null;
  createdAt: string;
};

type LeadRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  plan_intended: string | null;
  status: string | null;
  answers: Record<string, unknown> | null;
  created_at: string;
};

function decisionFromStatus(status: string | null): ScholarshipApplication["decision"] {
  if (status === "scholarship_accepted") return "accepted";
  if (status === "scholarship_rejected") return "rejected";
  return "pending";
}

function toApplication(row: LeadRow): ScholarshipApplication {
  const answers = row.answers ?? {};
  const str = (key: string) => (typeof answers[key] === "string" ? (answers[key] as string) : null);
  return {
    id: row.id,
    fullName: row.full_name ?? "",
    email: row.email ?? "",
    phone: row.phone,
    plan: row.plan_intended,
    status: row.status ?? "",
    decision: decisionFromStatus(row.status),
    freeSeatCandidate: answers.free_seat_candidate === true,
    city: str("city"),
    country: str("country"),
    voiceJourney: str("voice_journey"),
    goals: str("goals"),
    whyScholarship: str("why_scholarship"),
    createdAt: row.created_at,
  };
}

async function requireAdmin(supabase: {
  rpc: (fn: "is_admin") => PromiseLike<{ data: unknown; error: unknown }>;
}) {
  const { data, error } = await supabase.rpc("is_admin");
  if (error || data !== true) {
    throw new Error("Forbidden: admin access required");
  }
}

/**
 * Lists every Global Solidarity Scholarship application for the admin panel.
 * Admin-only: requires a signed-in session whose email is on the admin
 * allowlist; RLS on leads enforces the same rule server-side.
 */
export const listScholarshipApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ applications: ScholarshipApplication[] } | { error: string }> => {
    try {
      await requireAdmin(context.supabase);
      const { data, error } = await context.supabase
        .from("leads")
        .select("id, full_name, email, phone, plan_intended, status, answers, created_at")
        .eq("source", "scholarship_application")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("[listScholarshipApplications] query failed:", error.message);
        return { error: "Could not load applications. Please try again." };
      }
      return { applications: (data as LeadRow[]).map(toApplication) };
    } catch (e) {
      console.error("[listScholarshipApplications] unexpected:", e);
      return { error: e instanceof Error ? e.message : "Unexpected error." };
    }
  });

const decisionSchema = z.object({
  leadId: z.string().uuid(),
  decision: z.enum(["accepted", "rejected", "pending"]),
});

const DECISION_STATUS: Record<z.infer<typeof decisionSchema>["decision"], string> = {
  accepted: "scholarship_accepted",
  rejected: "scholarship_rejected",
  pending: "captured",
};

/**
 * Records Cuca's human review decision on a scholarship application. This
 * only marks the decision — it never grants access or triggers fulfillment.
 */
export const setScholarshipDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => decisionSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ success: true } | { error: string }> => {
    try {
      await requireAdmin(context.supabase);
      const { data: updated, error } = await context.supabase
        .from("leads")
        .update({ status: DECISION_STATUS[data.decision] })
        .eq("id", data.leadId)
        .eq("source", "scholarship_application")
        .select("id");
      if (error) {
        console.error("[setScholarshipDecision] update failed:", error.message);
        return { error: "Could not save the decision. Please try again." };
      }
      if (!updated || updated.length === 0) {
        return { error: "Application not found." };
      }
      return { success: true };
    } catch (e) {
      console.error("[setScholarshipDecision] unexpected:", e);
      return { error: e instanceof Error ? e.message : "Unexpected error." };
    }
  });

/**
 * Returns the personal result-page link for one application, creating its
 * high-entropy token on first use. The token stays stable afterwards so a
 * link already shared with the applicant keeps working. The link only ever
 * shows the review status — it never grants access or triggers fulfillment.
 */
export const createScholarshipResultLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ leadId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ token: string } | { error: string }> => {
    try {
      await requireAdmin(context.supabase);

      const { data: existing, error: fetchError } = await context.supabase
        .from("leads")
        .select("id, scholarship_result_token")
        .eq("id", data.leadId)
        .eq("source", "scholarship_application")
        .maybeSingle();
      if (fetchError) {
        console.error("[createScholarshipResultLink] fetch failed:", fetchError.message);
        return { error: "Could not prepare the result link. Please try again." };
      }
      if (!existing) {
        return { error: "Application not found." };
      }
      if (existing.scholarship_result_token) {
        return { token: existing.scholarship_result_token };
      }

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const token = generateResultToken();
        const { error: updateError } = await context.supabase
          .from("leads")
          .update({ scholarship_result_token: token })
          .eq("id", data.leadId)
          .eq("source", "scholarship_application")
          .is("scholarship_result_token", null);
        if (!updateError) {
          return { token };
        }
        console.error("[createScholarshipResultLink] update failed:", updateError.message);
      }
      return { error: "Could not create the result link. Please try again." };
    } catch (e) {
      console.error("[createScholarshipResultLink] unexpected:", e);
      return { error: e instanceof Error ? e.message : "Unexpected error." };
    }
  });

function generateResultToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
