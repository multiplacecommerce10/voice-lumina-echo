import { z } from "zod";
export const scholarshipSchema = z.object({
  requestId: z.string().uuid(),
  privacyConsent: z.literal(true),
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160).transform(v => v.toLowerCase()),
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