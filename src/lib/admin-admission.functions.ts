import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Records Cuca Medina's human admission decision on an enrollment lead.
 * Approval only ALLOWS checkout; it never grants access (payment still required)
 * and refuses approval when the cohort already has 30 active live students.
 */
export const setLeadAdmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z.object({ leadId: z.string().uuid(), decision: z.enum(["approved", "declined", "not_reviewed"]) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ success: true } | { error: string }> => {
    const { data: isAdmin, error: e1 } = await context.supabase.rpc("is_admin");
    if (e1 || isAdmin !== true) return { error: "Not authorized." };
    if (data.decision === "approved") {
      const { COURSE_MODEL } = await import("@/lib/entitlements");
      const { count } = await context.supabase
        .from("member_subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("environment", "live")
        .in("access_status", ["active", "past_due_grace"]);
      if ((count ?? 0) >= COURSE_MODEL.cohort_max_active_students) {
        return { error: "The cohort is full (30 active students). Use the waiting list." };
      }
    }
    const { data: rows, error } = await context.supabase
      .from("leads")
      .update({
        admission_status: data.decision,
        admission_decided_at: new Date().toISOString(),
        admission_decided_by: context.claims?.email ?? context.userId,
      } as never)
      .eq("id", data.leadId)
      .select("id");
    if (error) return { error: "Could not save the decision." };
    if (!rows?.length) return { error: "Enrollment not found." };
    return { success: true };
  });
