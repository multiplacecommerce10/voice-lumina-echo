import { test, expect, mock } from "bun:test";
let outboxRuns = 0;
mock.module("../src/lib/paypal-state.server", () => ({ runOutbox: async () => { outboxRuns++; return {}; } }));
const { recordDiagnosticProfile, afterDiagnosticPaid, withCourtesyNote, COURTESY_NOTE, EXISTING_ACCESS_NOTE, resolveCourtesyTarget } = await import("../src/lib/private-diagnostic-grant.server");

function db(result: string | Error, bound?: string) {
  const calls: any[] = [];
  let stored: string | undefined = bound;
  return { calls, from: (t: string) => ({ upsert: (row: any, opts: any) => { calls.push({ t, row, opts }); stored ??= row.email; return { error: null }; },
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { email: stored }, error: null }) }) }) }),
    rpc: async (name: string, args: any) => { calls.push({ name, args }); return result instanceof Error ? { data: null, error: result } : { data: result, error: null }; } };
}

test("profile stored once per invitation, first submission wins, email lowercased", async () => {
  const d = db("x");
  await recordDiagnosticProfile(d, "inv", { fullName: " Ana ", email: " Ana@Ex.COM " });
  expect(d.calls[0]).toEqual({ t: "payment_diagnostic_grants", row: { invite_id: "inv", email: "ana@ex.com", full_name: "Ana" }, opts: { onConflict: "invite_id", ignoreDuplicates: true } });
});

test("grant is keyed by invitation, not provider; emails only drained when granted", async () => {
  outboxRuns = 0;
  for (const r of ["granted", "existing", "already"]) { const d = db(r); expect(await afterDiagnosticPaid(d, "inv")).toBe(r); expect(d.calls[0]).toEqual({ name: "grant_diagnostic_courtesy", args: { p_invite: "inv" } }); }
  expect(outboxRuns).toBe(3);
  for (const r of ["not_paid", "no_profile"]) expect(await afterDiagnosticPaid(db(r), "inv")).toBe(r);
  expect(outboxRuns).toBe(3);
});

test("grant failure never breaks payment recording", async () => {
  expect(await afterDiagnosticPaid(db(new Error("down")), "inv")).toBe("error");
});

test("recipient is immutable: a different form email for the same invitation is rejected", async () => {
  await expect(recordDiagnosticProfile(db("x", "mom@ex.com"), "inv", { fullName: "A", email: "other@ex.com" })).rejects.toThrow(/different email/);
  await recordDiagnosticProfile(db("x", "mom@ex.com"), "inv", { fullName: "A", email: "MOM@ex.com" });
});

test("welcome copy states US$1, Complete 7 days, no renewal — never a recurring receipt", async () => {
  const { buildConfirmationEmail } = await import("../src/lib/confirmation-email");
  const d = withCourtesyNote(buildConfirmationEmail({ fullName: "Ana", email: "a@ex.com", planIntended: null, tier: "complete", durationMonths: null,
    totalFormatted: "US$ 1.00", amountPerCycleFormatted: null, isRecurring: false, isRenewal: false, billingIntervalMonths: null,
    nextChargeAtFormatted: null, courseStartFormatted: "x", nextClassFormatted: "y", membershipUrl: "https://consciousvoice.tecendosom.com/members" } as any));
  for (const b of [d.bodyText, d.bodyHtml]) { expect(b).toContain(COURTESY_NOTE); expect(b).not.toMatch(/197|renews|month commitment/); }
  expect(COURTESY_NOTE).toMatch(/US\$ 1\.00.*Complete.*7 days.*no automatic renewal/);
});

function grantDb(grant: any, member: any) {
  return { from: (t: string) => ({ select: () => { const q: any = { eq: () => q, maybeSingle: async () => ({ data: t === "payment_diagnostic_grants" ? grant : member, error: null }) }; return q; } }) };
}
const row = (sub: string) => ({ id: "1", attempts: 0, dedupe_key: "k", environment: "live", provider: "courtesy", kind: "welcome_confirmation", subscription_id: sub, recipient: "payer@other.com" } as any);

test("recipient comes from the form grant, never the provider/outbox payer email", async () => {
  const t = await resolveCourtesyTarget(grantDb({ email: "Mom@Ex.com", full_name: "M", granted_at: "x", existing_access: false }, { provider: "courtesy", courtesy_access: true }), row("diag:inv"));
  expect(t).toEqual({ to: "mom@ex.com", fullName: "M", existing: false });
});

test("existing Complete: emails still delivered once, with no-extension copy and no courtesy row required", async () => {
  const t = await resolveCourtesyTarget(grantDb({ email: "mom@ex.com", full_name: "M", granted_at: "x", existing_access: true }, null), row("diag:inv"));
  expect(t.existing).toBe(true);
  expect(EXISTING_ACCESS_NOTE).toMatch(/does not add, extend or change/);
  expect(EXISTING_ACCESS_NOTE).not.toMatch(/7 days/);
});

test("no send before grant or without the courtesy row", async () => {
  await expect(resolveCourtesyTarget(grantDb({ email: "a@b.c", granted_at: null }, null), row("diag:inv"))).rejects.toThrow();
  await expect(resolveCourtesyTarget(grantDb({ email: "a@b.c", granted_at: "x", existing_access: false }, null), row("diag:inv"))).rejects.toThrow();
  await expect(resolveCourtesyTarget(grantDb({}, null), row("I-PAYPAL"))).rejects.toThrow();
});
