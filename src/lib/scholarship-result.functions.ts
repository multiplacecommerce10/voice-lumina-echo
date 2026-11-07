import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const resultSchema = z.object({
  token: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{32,64}$/i, "Invalid token format"),
});

export type ScholarshipResultOutcome =
  | { found: false }
  | {
      found: true;
      decision: "pending" | "accepted" | "rejected";
      firstName: string;
      fullName: string;
      plan: string;
    };

/**
 * Public lookup behind a high-entropy personal link. The token itself is the
 * only credential: no session is required, and the response exposes the
 * minimum needed for the result letter — never the applicant's email.
 */
export const getScholarshipResult = createServerFn({ method: "POST" })
  .validator((input: unknown) => resultSchema.parse(input))
  .handler(async ({ data }): Promise<ScholarshipResultOutcome> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: row, error } = await supabaseAdmin
        .from("leads")
        .select("full_name, plan_intended, status")
        .eq("scholarship_result_token", data.token.toLowerCase())
        .eq("source", "scholarship_application")
        .maybeSingle();

      if (error) {
        console.error("[getScholarshipResult] lookup failed:", error.message);
        return { found: false };
      }
      if (!row) {
        return { found: false };
      }

      const status = row.status ?? "";
      const decision =
        status === "scholarship_accepted"
          ? "accepted"
          : status === "scholarship_rejected"
            ? "rejected"
            : "pending";

      const fullName = (row.full_name ?? "").trim();
      const firstName = fullName.split(/\s+/)[0] || "there";

      return {
        found: true,
        decision,
        firstName,
        fullName,
        plan: row.plan_intended ?? "Global Solidarity Scholarship",
      };
    } catch (e) {
      console.error("[getScholarshipResult] unexpected:", e);
      return { found: false };
    }
  });
