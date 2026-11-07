import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const scholarshipSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().max(40).optional().default(""),
  city: z.string().trim().min(1).max(120),
  country: z.string().trim().min(1).max(120),
  voiceJourney: z.string().trim().min(10).max(2000),
  goals: z.string().trim().min(10).max(2000),
  whyScholarship: z.string().trim().min(10).max(2000),
  utmSource: z.string().trim().max(200).optional().default(""),
  utmMedium: z.string().trim().max(200).optional().default(""),
  utmCampaign: z.string().trim().max(200).optional().default(""),
  landingUrl: z.string().trim().max(500).optional().default(""),
  referrer: z.string().trim().max(500).optional().default(""),
});

/**
 * Records a Global Solidarity Scholarship application as a lead. The first
 * three applications are flagged as free-seat candidates; every application
 * still requires Cuca Medina's human review before any seat is granted.
 * Submitting never grants access.
 */
export const submitScholarshipApplication = createServerFn({ method: "POST" })
  .validator((input: unknown) => scholarshipSchema.parse(input))
  .handler(async ({ data }): Promise<{ success: true; freeSeatCandidate: boolean } | { error: string }> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { count } = await supabaseAdmin
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("source", "scholarship_application");

      const position = (count ?? 0) + 1;
      const freeSeatCandidate = position <= 3;

      const { data: inserted, error } = await supabaseAdmin.from("leads").insert({
        full_name: data.fullName,
        email: data.email.toLowerCase(),
        phone: data.phone || null,
        plan_intended: "Global Solidarity Scholarship",
        status: "captured",
        source: "scholarship_application",
        utm_source: data.utmSource || null,
        utm_medium: data.utmMedium || null,
        utm_campaign: data.utmCampaign || null,
        landing_url: data.landingUrl || null,
        referrer: data.referrer || null,
        answers: {
          city: data.city,
          country: data.country,
          voice_journey: data.voiceJourney,
          goals: data.goals,
          why_scholarship: data.whyScholarship,
          application_position: position,
          free_seat_candidate: freeSeatCandidate,
          submitted_at: new Date().toISOString(),
        },
      }).select("id").single();

      if (error) {
        console.error("[submitScholarshipApplication] insert failed:", error.message);
        return { error: "Could not save your application. Please try again." };
      }

      // Send the branded "Application Received" confirmation directly via
      // Hostinger Agentic Mail (scholarship mailbox). Taskade was
      // decommissioned. A delivery failure is logged but never blocks the
      // applicant.
      try {
        const { buildScholarshipApplicationEmail } = await import("@/lib/scholarship-email");
        const mail = buildScholarshipApplicationEmail(data.fullName);
        const to = data.email.toLowerCase();
        const { sendHostingerMail } = await import("@/lib/hostinger-mail.server");
        const sent = await sendHostingerMail("scholarship", {
          to,
          subject: mail.subject,
          html: mail.bodyHtml,
          text: mail.bodyText,
        });
        if (!sent.ok) {
          console.error("[submitScholarshipApplication] hostinger send failed:", sent.status, sent.message);
        }
      } catch (e) {
        console.error("[submitScholarshipApplication] confirmation send failed:", e);
      }

      return { success: true, freeSeatCandidate };
    } catch (e) {
      console.error("[submitScholarshipApplication] unexpected:", e);
      return { error: "Unexpected error. Please try again." };
    }
  });
