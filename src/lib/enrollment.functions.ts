import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { profileSchema } from "@/lib/enrollment-profile";
import { enrollmentTimezone } from "./enrollment-projection";
import { getRequest } from "@tanstack/react-start/server";
import { assertDiagnosticOrigin } from "./private-diagnostic-rules";
import { COURSE_START_UTC, formatClassInTimeZone } from "@/lib/course-schedule";
import {
  COURSE_MODEL,
  TIER_BENEFITS,
  resolveEntitlements,
  type Tier,
} from "@/lib/entitlements";


const enrollmentSchema = z.object({
  requestId: z.string().uuid(),
  fullName: z.string().trim().min(2).max(120),
  birthDate: z.string().trim().min(4).max(20),
  city: z.string().trim().min(1).max(120),
  country: z.string().trim().min(1).max(120),
  address: z.string().trim().max(300).optional().default(""),
  phone: z.string().trim().min(4).max(40),
  email: z.string().trim().email().max(160),
  profession: z.string().trim().max(160).optional().default(""),
  musicLevel: z.string().trim().min(1).max(80),
  academicExperience: z.string().trim().max(2000).optional().default(""),
  musicalPreferences: z.string().trim().max(2000).optional().default(""),
  motivation: z.string().trim().max(2000).optional().default(""),
  plan: z.string().trim().max(120).optional().default(""),
  attribution: z.string().trim().max(1000).optional().default(""),
  utmSource: z.string().trim().max(200).optional().default(""),
  utmMedium: z.string().trim().max(200).optional().default(""),
  utmCampaign: z.string().trim().max(200).optional().default(""),
  utmTerm: z.string().trim().max(200).optional().default(""),
  utmContent: z.string().trim().max(200).optional().default(""),
  utmId: z.string().trim().max(200).optional().default(""),
  gclid: z.string().trim().max(200).optional().default(""),
  fbclid: z.string().trim().max(200).optional().default(""),
  landingUrl: z.string().trim().max(500).optional().default(""),
  referrer: z.string().trim().max(500).optional().default(""),
  timezone: z.string().trim().max(80).optional().default(""),
}).extend(profileSchema.shape);

export type EnrollmentInput = z.infer<typeof enrollmentSchema>;

export const submitEnrollment = createServerFn({ method: "POST" })
  .validator((input: unknown) => enrollmentSchema.parse(input))
  .handler(async ({ data }) => {
    const request = getRequest();
    assertDiagnosticOrigin(request.headers.get("origin"), new URL(request.url).origin, request.headers.get("sec-fetch-site"));
    data.timezone = enrollmentTimezone(data.timezone);
    const timestamp = new Date().toISOString();

    // 1) Persist the lead first, so the contact + answers are saved even if
    //    the spreadsheet/webhooks fail or the person never pays.
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin.rpc("record_enrollment_intent", { p_request: data.requestId, p_record: {
        full_name: data.fullName,
        email: data.email.toLowerCase(),
        phone: data.phone || null,
        plan_intended: data.plan || null,
        status: "captured",
        source: "enrollment_form",
        utm_source: data.utmSource || null,
        utm_medium: data.utmMedium || null,
        utm_campaign: data.utmCampaign || null,
        utm_term: data.utmTerm || null,
        utm_content: data.utmContent || null,
        utm_id: data.utmId || null,
        gclid: data.gclid || null,
        fbclid: data.fbclid || null,
        landing_url: data.landingUrl || null,
        referrer: data.referrer || null,
        answers: {
          birth_date: data.birthDate,
          address: data.address,
          city: data.city,
          country: data.country,
          music_level: data.musicLevel,
          profession: data.profession,
          academic_experience: data.academicExperience,
          musical_preferences: data.musicalPreferences,
          motivation: data.motivation,
          attribution_summary: data.attribution,
          timezone: data.timezone || null,
          submitted_at: timestamp,
        },
      } });
      if (error) throw new Error("Could not save your enrollment details.");
    } catch (e) {
      throw new Error("Could not save your enrollment details. No enrollment was confirmed; please try again.");
    }

    // The form only records an INTENDED tier. It never grants member access:
    // entitlements are resolved downstream, and only after payment confirms.
    const intendedTier: Tier | null = data.plan
      ? data.plan.toLowerCase().includes("complete") || data.plan.startsWith("complete")
        ? "complete"
        : data.plan.toLowerCase().includes("live")
          ? "live"
          : null
      : null;
    const benefitsPreview = intendedTier
      ? intendedTier === "complete"
        ? [...TIER_BENEFITS.live, ...TIER_BENEFITS.complete]
        : TIER_BENEFITS.live
      : null;

    const studentTz = data.timezone || "UTC";
    const courseStartUtc = formatClassInTimeZone(COURSE_START_UTC, "UTC");
    const courseStartLocal = formatClassInTimeZone(COURSE_START_UTC, studentTz);

    const forwardPayload = {
      event: "enrollment.form_submitted" as const,
      full_name: data.fullName,
      email: data.email,
      phone: data.phone,
      plan: data.plan || null,
      attribution_summary: data.attribution || null,
      utm_source: data.utmSource || null,
      utm_medium: data.utmMedium || null,
      utm_campaign: data.utmCampaign || null,
      utm_term: data.utmTerm || null,
      utm_content: data.utmContent || null,
      gclid: data.gclid || null,
      fbclid: data.fbclid || null,
      landing_url: data.landingUrl || null,
      referrer: data.referrer || null,
      extra: {
        birth_date: data.birthDate,
        address: data.address,
        city: data.city,
        country: data.country,
        music_level: data.musicLevel,
        profession: data.profession,
        academic_experience: data.academicExperience,
        musical_preferences: data.musicalPreferences,
        motivation: data.motivation,
        utm_id: data.utmId || null,
        // Intent only — no access is granted by submitting this form.
        intended_tier: intendedTier,
        intended_tier_benefits_preview: benefitsPreview,
        member_access_granted: false,
        entitlements: null,
        student_enrolled_at: null,
        fulfillment_ready: false,
        access_note:
          "This is an enrollment enquiry, not a confirmed seat. Access, entitlements and (for Complete Course Access) replay eligibility begin only on the student's confirmed enrollment date after payment is confirmed and admission is permitted.",
        entitlement_preview: intendedTier ? resolveEntitlements(intendedTier, null) : null,
        cohort_start_date: COURSE_MODEL.cohort_start_date,
        cohort_max_active_students: COURSE_MODEL.cohort_max_active_students,
        student_timezone: studentTz,
        course_start_at: COURSE_START_UTC.toISOString(),
        course_start_utc_formatted: courseStartUtc.full,
        course_start_local_formatted: courseStartLocal.full,
        course_start_summary_text: `The course starts on ${courseStartLocal.full} (your local time) — ${courseStartUtc.full}.`,
        class_cadence: "Weekly live 90-minute classes, every Monday",
        // All student-facing communication must be written in English.
        language: "en",
        language_name: "English",
        locale: "en-US",
        email_language_instruction:
          "Write this email entirely in English (US). Do not use Portuguese.",
      },

    };

    try {
      // Taskade was decommissioned (tokens/webhooks disabled by the owner).
      // The enrollment data is already persisted in the leads table above and
      // in the Google Sheet; Make stays opt-in via MAKE_FORWARDING_ENABLED="true".
      const { isMakeForwardingEnabled, MAKE_DISABLED_RESULT } = await import(
        "@/lib/make-flag"
      );
      const jobs: Promise<unknown>[] = [];
      if (isMakeForwardingEnabled()) {
        const { forwardToMake } = await import("@/lib/make.server");
        jobs.push(forwardToMake(forwardPayload));
      } else {
        console.log(
          "[submitEnrollment] downstream forwarding:",
          JSON.stringify(MAKE_DISABLED_RESULT),
        );
      }
      await Promise.allSettled(jobs);
    } catch (e) {
      console.warn("[submitEnrollment] optional forwarding unavailable");
    }


    return { success: true as const };
  });
