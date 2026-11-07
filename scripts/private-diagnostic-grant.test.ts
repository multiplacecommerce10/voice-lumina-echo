import { test, expect, mock } from "bun:test";
let outboxRuns = 0;
mock.module("../src/lib/paypal-state.server", () => ({ runOutbox: async () => { outboxRuns++; return {}; } }));
const { recordDiagnosticProfile, afterDiagnosticPaid, withCourtesyNote, COURTESY_NOTE } = await import("../src/lib/private-diagnostic-grant.server");

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
  for (const r of ["granted", "already"]) { const d = db(r); expect(await afterDiagnosticPaid(d, "inv")).toBe(r); expect(d.calls[0]).toEqual({ name: "grant_diagnostic_courtesy", args: { p_invite: "inv" } }); }
  expect(outboxRuns).toBe(2);
  for (const r of ["existing", "not_paid", "no_profile"]) expect(await afterDiagnosticPaid(db(r), "inv")).toBe(r);
  expect(outboxRuns).toBe(2);
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
