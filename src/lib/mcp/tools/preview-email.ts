import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { buildConfirmationEmail, DEFAULT_MEMBERSHIP_URL } from "@/lib/confirmation-email";
import { buildAccessCredentialsEmail } from "@/lib/access-credentials-email";
import { buildRecoveryEmail } from "@/lib/recovery-email";

const COURSE_START = "Tuesday, September 1, 2026";

export default defineTool({
  name: "preview_email",
  title: "Preview a student email",
  description:
    "Generate the exact subject and body of one of the student emails (welcome/enrollment confirmation, member-area access credentials, or abandoned-checkout recovery) for review. Generates text only — it never sends anything.",
  inputSchema: {
    kind: z
      .enum(["welcome", "credentials", "recovery"])
      .describe("Which email to render."),
    full_name: z.string().trim().min(1).describe("Recipient full name."),
    tier: z.enum(["live", "complete"]).default("complete").describe("Enrollment tier."),
    duration_months: z
      .number()
      .int()
      .min(1)
      .max(12)
      .default(6)
      .describe("Plan duration in months."),
    plan_intended: z
      .string()
      .trim()
      .nullable()
      .default(null)
      .describe("Optional plan key such as complete__6m, used by the recovery email."),
    resume_code: z
      .string()
      .trim()
      .nullable()
      .default(null)
      .describe("Optional resume code, used by the recovery email link."),
    is_renewal: z
      .boolean()
      .default(false)
      .describe("Welcome email only: render the renewal variant instead of first enrollment."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ kind, full_name, tier, duration_months, plan_intended, resume_code, is_renewal }) => {
    if (kind === "credentials") {
      const draft = buildAccessCredentialsEmail({
        fullName: full_name,
        membershipUrl: DEFAULT_MEMBERSHIP_URL,
        tier,
      });

      const payload = {
        kind,
        subject: draft.subject,
        body_text: draft.bodyText,
        body_html: draft.bodyHtml,
      };
      return {
        content: [{ type: "text", text: `${draft.subject}\n\n${draft.bodyText}` }],
        structuredContent: payload,
      };
    }

    if (kind === "recovery") {
      const draft = buildRecoveryEmail({
        leadId: "preview-lead",
        fullName: full_name,
        planIntended: plan_intended ?? `${tier}__${duration_months}m`,
        resumeCode: resume_code,
      });
      const payload = {
        kind,
        subject: draft.subject,
        body_text: draft.bodyText,
        body_html: draft.bodyHtml,
      };
      return {
        content: [{ type: "text", text: `${draft.subject}\n\n${draft.bodyText}` }],
        structuredContent: payload,
      };
    }

    const draft = buildConfirmationEmail({
      fullName: full_name,
      email: null,
      planIntended: plan_intended ?? `${tier}__${duration_months}m`,
      tier,
      durationMonths: duration_months,
      totalFormatted: null,
      amountPerCycleFormatted: null,
      isRecurring: false,
      isRenewal: is_renewal,
      billingIntervalMonths: duration_months,
      nextChargeAtFormatted: null,
      courseStartFormatted: COURSE_START,
      nextClassFormatted: COURSE_START,
      membershipUrl: DEFAULT_MEMBERSHIP_URL,
    });
    const payload = {
      kind,
      is_renewal: draft.isRenewal,
      subject: draft.subject,
      body_text: draft.bodyText,
      body_html: draft.bodyHtml,
    };
    return {
      content: [{ type: "text", text: `${draft.subject}\n\n${draft.bodyText}` }],
      structuredContent: payload,
    };
  },
});
