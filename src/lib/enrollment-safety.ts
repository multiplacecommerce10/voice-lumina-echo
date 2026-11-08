import { profileFromAnswers, profileSchema } from "./enrollment-profile";
import { consentIsCurrent } from "./paypal-admission";
import { LEGAL_VERSIONS } from "./legal";

export function assertStoredEnrollment(lead: { full_name?: string | null; email?: string | null; phone?: string | null; answers?: unknown }, consent: unknown, now = Date.now()) {
  const answers = lead.answers as Record<string, unknown> | null;
  if (!profileSchema.safeParse(profileFromAnswers({ fullName: lead.full_name ?? null, email: lead.email ?? null, phone: lead.phone ?? null }, answers)).success) throw new Error("Please complete all student details before paying.");
  const saved = answers?.legal_consent as any;
  const supplied = consent as any;
  if (!saved || !supplied || !consentIsCurrent(saved, LEGAL_VERSIONS, now) || !saved.immediateAccessAt || !Number.isFinite(Date.parse(saved.immediateAccessAt)) || ["termsVersion", "privacyVersion", "refundVersion", "acceptedAt", "immediateAccessAt"].some(key => saved[key] !== supplied[key])) throw new Error("Please save your current legal consent before paying.");
  return saved;
}