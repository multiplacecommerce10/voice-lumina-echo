import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { profileSchema, profileAnswers, profileFromAnswers, type EnrollmentProfile } from "@/lib/enrollment-profile";
import { getRequest } from "@tanstack/react-start/server";
import { assertDiagnosticOrigin } from "./private-diagnostic-rules";
import { LEGAL_VERSIONS } from "./legal";
import { consentIsCurrent } from "./paypal-admission";

function checkOrigin() { const request = getRequest(); assertDiagnosticOrigin(request.headers.get("origin"), new URL(request.url).origin, request.headers.get("sec-fetch-site")); }

const captureLeadSchema = z.object({
  profile: profileSchema,
  resumeCode: z.string().regex(/^[A-Z2-9]{6,40}$/).optional(),
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().min(4).max(40),
  planIntended: z.string().trim().max(120).optional().nullable(),
  utms: z
    .object({
      utm_source: z.string().max(200).optional(),
      utm_medium: z.string().max(200).optional(),
      utm_campaign: z.string().max(200).optional(),
      utm_term: z.string().max(200).optional(),
      utm_content: z.string().max(200).optional(),
      gclid: z.string().max(200).optional(),
      fbclid: z.string().max(200).optional(),
    })
    .partial()
    .optional(),
  landingUrl: z.string().max(500).optional().nullable(),
  referrer: z.string().max(500).optional().nullable(),
  // Record of the legal acknowledgements given before payment.
  consent: z
    .object({
      termsVersion: z.string().max(40).optional(),
      privacyVersion: z.string().max(40).optional(),
      refundVersion: z.string().max(40).optional(),
      acceptedAt: z.string().max(40).optional(),
      immediateAccessAt: z.string().max(40).optional(),
      marketingOptIn: z.boolean().optional(),
    })
    .optional(),
}).refine((value) => value.fullName === value.profile.fullName && value.email.toLowerCase() === value.profile.email.toLowerCase() && value.phone === value.profile.phone, "Contact details must match the student profile.");

export const captureLead = createServerFn({ method: "POST" })
  .validator((input: unknown) => captureLeadSchema.parse(input))
  .handler(async ({ data }): Promise<{ leadId: string; resumeCode: string } | { error: string }> => {
    checkOrigin();
    if (!data.consent || !consentIsCurrent(data.consent as any, LEGAL_VERSIONS, Date.now()) || !data.consent.immediateAccessAt || !Number.isFinite(Date.parse(data.consent.immediateAccessAt))) return { error: "Please accept the current terms, privacy notice and access statement before continuing." };
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { newResumeCode } = await import("@/lib/resume-code.server");
      const utms = data.utms ?? {};
      const resumeCode = newResumeCode();
      const values = {
        full_name: data.fullName,
        email: data.email.toLowerCase(),
        phone: data.phone,
        plan_intended: data.planIntended ?? null,
        answers: { ...profileAnswers(data.profile), legal_consent: data.consent },
      };
      if (data.resumeCode) {
        const { data: existing } = await supabaseAdmin.from("leads").select("id, status, answers, resume_code, email").eq("resume_code", data.resumeCode).maybeSingle();
        if (!existing || !["captured", "checkout_started", "abandoned"].includes(existing.status ?? "")) return { error: "This enrollment can no longer be resumed." };
        if (existing.email?.toLowerCase() !== data.email.toLowerCase()) return { error: "This enrollment link belongs to a different email address." };
        const oldAnswers = z.record(z.string(), z.unknown()).safeParse(existing.answers);
        const { error: updateError } = await supabaseAdmin.from("leads").update({ ...values, answers: { ...(oldAnswers.success ? oldAnswers.data : {}), ...values.answers } }).eq("id", existing.id).in("status", ["captured", "checkout_started", "abandoned"]);
        if (updateError) return { error: "Could not save your details. Please try again." };
        return { leadId: existing.id, resumeCode: data.resumeCode };
      }
      const { data: row, error } = await supabaseAdmin
        .from("leads")
        .insert({
          full_name: data.fullName,
          email: data.email.toLowerCase(),
          phone: data.phone ?? null,
          plan_intended: data.planIntended ?? null,
          status: "captured",
          resume_code: resumeCode,
          utm_source: utms.utm_source ?? null,
          utm_medium: utms.utm_medium ?? null,
          utm_campaign: utms.utm_campaign ?? null,
          utm_term: utms.utm_term ?? null,
          utm_content: utms.utm_content ?? null,
          gclid: utms.gclid ?? null,
          fbclid: utms.fbclid ?? null,
          landing_url: data.landingUrl ?? null,
          referrer: data.referrer ?? null,
          answers: values.answers,
        })
        .select("id, resume_code")
        .single();
      if (error) {
        console.error("[captureLead] insert failed:", error.message);
        return { error: "Could not save lead. Please try again." };
      }
      return { leadId: row.id as string, resumeCode: (row.resume_code as string) ?? resumeCode };
    } catch (e) {
      console.error("[captureLead] unexpected:", e);
      return { error: "Unexpected error capturing lead." };
    }
  });

const resumeSchema = z.object({ code: z.string().trim().toUpperCase().regex(/^[A-Z2-9]{6,40}$/) });

/**
 * Resolves a recovery-email resume code back into the exact point the lead
 * stopped at: their contact details and the plan they had selected.
 */
export const resumeLead = createServerFn({ method: "POST" })
  .validator((input: unknown) => resumeSchema.parse(input))
  .handler(
    async ({
      data,
    }): Promise<
      | {
          leadId: string;
          fullName: string | null;
          email: string | null;
          phone: string | null;
          planIntended: string | null;
          status: string | null;
          profile: Partial<EnrollmentProfile>;
        }
      | { error: string }
    > => {
      checkOrigin();
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: row, error } = await supabaseAdmin
          .from("leads")
          .select("id, full_name, email, phone, plan_intended, status, answers")
          .eq("resume_code", data.code.toUpperCase())
          .maybeSingle();
        if (error || !row) return { error: "We could not find that enrollment link." };
        if (!["captured", "checkout_started", "abandoned"].includes(row.status ?? "")) return { error: "This enrollment can no longer be resumed." };
        return {
          profile: profileFromAnswers({ fullName: row.full_name, email: row.email, phone: row.phone }, row.answers),
          leadId: row.id as string,
          fullName: row.full_name as string | null,
          email: row.email as string | null,
          phone: row.phone as string | null,
          planIntended: row.plan_intended as string | null,
          status: row.status as string | null,
        };
      } catch (e) {
        console.error("[resumeLead] unexpected:", e);
        return { error: "Unexpected error restoring your enrollment." };
      }
    },
  );

