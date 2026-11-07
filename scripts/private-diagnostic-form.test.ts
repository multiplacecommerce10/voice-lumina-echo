import { test, expect } from "bun:test";
import { saveDiagnosticForm, requireSavedDiagnosticForm } from "../src/lib/private-diagnostic-form.server";
import { PRIVATE_DIAGNOSTIC_VERSION } from "../src/lib/private-diagnostic-rules";
const profile = { fullName: "Synthetic Tester", birthDate: "1980-01-01", email: "Tester@example.invalid", phone: "+1 5550100", country: "United States", city: "Fixture City", address: "Synthetic address", profession: "Educator", musicLevel: "Beginner", academicExperience: "None yet", musicalPreferences: "Jazz", motivation: "Fixture only" };
const input = { token: "a".repeat(64), profile, consent: true };
const hash = async () => "synthetic-hash";
function fixture() {
  let row: any = null; let count = 0; let failure = false; let status = "saved";
  const db = {
    async rpc(name: string, args: any) {
      expect(name).toBe("save_private_diagnostic_form"); count++;
      if (failure) return { error: { message: "internal details" }, data: null };
      if (status !== "saved") return { data: status, error: null };
      if (row && row.email !== args.p_answers.email) return { data: "email_mismatch", error: null };
      row ??= { email: args.p_answers.email, form_answers: structuredClone(args.p_answers), consent_version: args.p_version, consent_at: "2026-11-07T11:04:00Z", form_saved_at: "2026-11-07T11:04:00Z" };
      return { data: "saved", error: null };
    },
    from(name: string) { expect(name).toBe("payment_diagnostic_grants"); const q: any = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: row, error: failure ? {} : null }) }; return q; },
  };
  return { db, get row() { return row; }, get count() { return count; }, fail() { failure = true; }, status(s: string) { status = s; } };
}
test("all 12 answers persist normalized and roundtrip before any payment", async () => {
  const f = fixture(); expect(await saveDiagnosticForm(f.db, input, hash)).toEqual({ saved: true, version: PRIVATE_DIAGNOSTIC_VERSION });
  expect(f.row.form_answers).toEqual({ ...profile, email: "tester@example.invalid" });
  expect(Object.keys(f.row.form_answers)).toHaveLength(12);
  await requireSavedDiagnosticForm(f.db, "fixture", profile);
});
test("duplicates are idempotent and preserve saved answers and timestamps", async () => {
  const f = fixture(); await saveDiagnosticForm(f.db, input, hash); const first = structuredClone(f.row);
  await saveDiagnosticForm(f.db, input, hash); expect(f.row).toEqual(first); expect(f.count).toBe(2);
});
test("missing consent and every invalid required field fail before persistence", async () => {
  const f = fixture(); await expect(saveDiagnosticForm(f.db, { ...input, consent: false }, hash)).rejects.toThrow();
  for (const key of Object.keys(profile)) await expect(saveDiagnosticForm(f.db, { ...input, profile: { ...profile, [key]: "" } }, hash)).rejects.toThrow();
  expect(f.count).toBe(0);
});
test("invalid and expired invitations cannot save", async () => {
  const f = fixture(); f.status("invalid_invitation"); await expect(saveDiagnosticForm(f.db, input, hash)).rejects.toThrow(/expired/); expect(f.row).toBeNull();
});
test("recipient cannot change on retry or checkout", async () => {
  const f = fixture(); await saveDiagnosticForm(f.db, input, hash);
  await expect(saveDiagnosticForm(f.db, { ...input, profile: { ...profile, email: "other@example.invalid" } }, hash)).rejects.toThrow(/different email/);
  await expect(requireSavedDiagnosticForm(f.db, "fixture", { ...profile, email: "other@example.invalid" })).rejects.toThrow(/match/);
  expect(f.row.email).toBe("tester@example.invalid");
});
test("DB failure rejects continuation and does not expose internal details", async () => {
  const f = fixture(); f.fail(); await expect(saveDiagnosticForm(f.db, input, hash)).rejects.toThrow(/could not be saved/); expect(f.row).toBeNull();
  await expect(requireSavedDiagnosticForm(f.db, "fixture", profile)).rejects.toThrow(/temporarily unavailable/);
});
test("checkout refuses missing saved form, stale consent and mismatched answers", async () => {
  const f = fixture(); await expect(requireSavedDiagnosticForm(f.db, "fixture", profile)).rejects.toThrow(/consent/);
  await saveDiagnosticForm(f.db, input, hash);
  await expect(requireSavedDiagnosticForm(f.db, "fixture", { ...profile, motivation: "Changed" })).rejects.toThrow(/match/);
  f.row.consent_version = "old"; await expect(requireSavedDiagnosticForm(f.db, "fixture", profile)).rejects.toThrow(/consent/);
});
test("extras never enter stored profile or public response", async () => {
  const f = fixture(); const result = await saveDiagnosticForm(f.db, { ...input, profile: { ...profile, payerEmail: "ignore@example.invalid" } }, hash);
  expect(f.row.form_answers.payerEmail).toBeUndefined(); expect(Object.keys(result).sort()).toEqual(["saved", "version"]);
});