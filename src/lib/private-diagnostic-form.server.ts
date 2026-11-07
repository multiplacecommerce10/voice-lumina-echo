import { profileSchema, type EnrollmentProfile } from "./enrollment-profile";
import { diagnosticSaveSchema, PRIVATE_DIAGNOSTIC_VERSION } from "./private-diagnostic-rules";

export function normalizedDiagnosticProfile(profile: EnrollmentProfile) {
  const parsed = profileSchema.parse(profile);
  return { ...parsed, email: parsed.email.toLowerCase() };
}

/** Dedicated storage boundary: no provider, account, delivery or grant actions. */
export async function saveDiagnosticForm(db: any, input: unknown, hash: (token: string) => Promise<string>) {
  const data = diagnosticSaveSchema.parse(input);
  const profile = normalizedDiagnosticProfile(data.profile);
  const result = await db.rpc("save_private_diagnostic_form", {
    p_hash: await hash(data.token), p_answers: profile, p_version: PRIVATE_DIAGNOSTIC_VERSION,
  });
  if (result.error) throw new Error("Your answers could not be saved. Please retry; no payment was started.");
  if (result.data === "invalid_invitation") throw new Error("Invalid, revoked or expired private invitation.");
  if (result.data === "email_mismatch") throw new Error("This invitation is already linked to a different email address.");
  if (result.data === "profile_locked") throw new Error("This invitation already has saved details. They cannot be replaced.");
  if (result.data !== "saved") throw new Error("Your answers could not be saved. Please check your consent and retry.");
  return { saved: true as const, version: PRIVATE_DIAGNOSTIC_VERSION };
}

/** Checkout can only consume the exact saved profile under current storage consent. */
export async function requireSavedDiagnosticForm(db: any, inviteId: string, profile: EnrollmentProfile) {
  const expected = normalizedDiagnosticProfile(profile);
  const { data, error } = await db.from("payment_diagnostic_grants")
    .select("email,form_answers,form_saved_at,consent_version,consent_at").eq("invite_id", inviteId).maybeSingle();
  if (error) throw new Error("Saved answers are temporarily unavailable. No payment was started.");
  if (!data?.form_saved_at || !data.consent_at || data.consent_version !== PRIVATE_DIAGNOSTIC_VERSION || !data.form_answers)
    throw new Error("Save the private enrollment form with storage consent first.");
  if (data.email !== expected.email || Object.entries(expected).some(([key, value]) => data.form_answers[key] !== value))
    throw new Error("The payment details do not match this invitation's saved form.");
}