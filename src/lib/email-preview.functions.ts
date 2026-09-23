import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Renders the exact recovery email for a lead WITHOUT sending anything. */
export const previewRecoveryEmail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        leadId: z.string().uuid().optional(),
        email: z.string().trim().email().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { LEAD_SELECT } = await import("@/lib/lead-recovery.server");
    const { buildRecoveryEmail, auditRecoveryEmail } = await import("@/lib/recovery-email");

    let query = supabaseAdmin.from("leads").select(LEAD_SELECT).limit(1);
    if (data.leadId) query = query.eq("id", data.leadId);
    else if (data.email) query = query.eq("email", data.email);
    else return { ok: false as const, error: "Provide a lead id or an email." };

    const { data: lead, error } = await query.maybeSingle();
    if (error) return { ok: false as const, error: error.message };
    if (!lead) return { ok: false as const, error: "Lead not found." };

    const draft = buildRecoveryEmail({
      leadId: lead.id as string,
      fullName: lead.full_name as string | null,
      planIntended: lead.plan_intended as string | null,
      resumeCode: lead.resume_code as string | null,
    });
    const issues = auditRecoveryEmail(draft, lead.email as string | null);

    return {
      ok: true as const,
      error: null,
      lead: {
        id: lead.id,
        full_name: lead.full_name,
        email: lead.email,
        plan_intended: lead.plan_intended,
        status: lead.status,
        resume_code: lead.resume_code,
        recovery_attempts: lead.recovery_attempts,
        recovery_email_sent_at: lead.recovery_email_sent_at,
      },
      draft,
      issues,
      blocking: issues.some((i) => i.level === "error"),
    };
  });

/** Sends the reviewed recovery email. Requires the exact subject seen in the preview. */
export const approveAndSendRecoveryEmail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        leadId: z.string().uuid(),
        approvedSubject: z.string().min(1),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { LEAD_SELECT, sendRecoveryEmail } = await import("@/lib/lead-recovery.server");
    const { buildRecoveryEmail, auditRecoveryEmail } = await import("@/lib/recovery-email");

    const { data: lead, error } = await supabaseAdmin
      .from("leads")
      .select(LEAD_SELECT)
      .eq("id", data.leadId)
      .maybeSingle();
    if (error || !lead) return { ok: false as const, error: error?.message ?? "Lead not found." };

    const draft = buildRecoveryEmail({
      leadId: lead.id as string,
      fullName: lead.full_name as string | null,
      planIntended: lead.plan_intended as string | null,
      resumeCode: lead.resume_code as string | null,
    });

    if (draft.subject !== data.approvedSubject) {
      return { ok: false as const, error: "The email changed since your preview. Refresh and review again." };
    }
    const issues = auditRecoveryEmail(draft, lead.email as string | null);
    if (issues.some((i) => i.level === "error")) {
      return { ok: false as const, error: `Blocked by checks: ${issues.map((i) => i.message).join(" ")}` };
    }

    const sent = await sendRecoveryEmail(lead as never, "manual_reviewed_send");
    return { ok: sent, error: sent ? null : "Webhook rejected the payload." };
  });
