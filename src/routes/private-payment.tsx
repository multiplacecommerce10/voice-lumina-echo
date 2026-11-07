import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { EnrollmentForm } from "@/components/EnrollmentForm";
import { Button } from "@/components/ui/button";
import { readPrivateInvitation, startPrivateDiagnostic, returnPrivatePayPal } from "@/lib/private-diagnostic.functions";
import { PRIVATE_DIAGNOSTIC_VERSION } from "@/lib/private-diagnostic-rules";
import type { EnrollmentProfile } from "@/lib/enrollment-profile";
import logo from "@/assets/tecendo-som-logo.png";

export const Route = createFileRoute("/private-payment")({
  validateSearch: (s: Record<string, unknown>) => ({ attempt: typeof s.attempt === "string" ? s.attempt : "", state: typeof s.state === "string" ? s.state : "", token: typeof s.token === "string" ? s.token : "", cancelled: s.cancelled === "1" }),
  head: () => ({ meta: [
    { title: "Private payer test | Tecendo Som" }, { name: "description", content: "Private single-payment diagnostic. No course enrollment or access." },
    { property: "og:title", content: "Private payer test | Tecendo Som" }, { property: "og:description", content: "Private single-payment diagnostic. No course enrollment or access." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex,nofollow,noarchive" }, { name: "referrer", content: "no-referrer" },
  ] }), component: PrivatePayment,
});
function PrivatePayment() {
  const search = Route.useSearch();
  const read = useServerFn(readPrivateInvitation), start = useServerFn(startPrivateDiagnostic), returned = useServerFn(returnPrivatePayPal);
  const [token, setToken] = useState(""), [profile, setProfile] = useState<EnrollmentProfile | null>(null);
  const [invite, setInvite] = useState<Awaited<ReturnType<typeof readPrivateInvitation>> | null>(null);
  const [consent, setConsent] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [payment, setPayment] = useState<{ status?: string; approved?: boolean } | null>(null);
  const [returnInput, setReturnInput] = useState<{ attempt: string; state: string; order: string } | null>(null);
  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1)).get("invite");
    const value = fragment || sessionStorage.getItem("private-diagnostic-invite") || "";
    if (fragment) { sessionStorage.setItem("private-diagnostic-invite", fragment); history.replaceState(null, "", window.location.pathname + window.location.search); }
    setToken(value);
    if (search.attempt && search.state && search.token) {
      const input = { attempt: search.attempt, state: search.state, order: search.token };
      sessionStorage.setItem("private-diagnostic-return", JSON.stringify(input));
      setReturnInput(input);
      history.replaceState(null, "", window.location.pathname);
    } else { try { const saved = sessionStorage.getItem("private-diagnostic-return"); if (saved) setReturnInput(JSON.parse(saved)); } catch { /* no return */ } }
  }, []);
  useEffect(() => { if (!token) return;
    read({ data: { token } }).then(setInvite).catch(() => setInvite({ valid: false, error: "Invalid, revoked or expired private invitation." }));
  }, [token]);
  useEffect(() => { if (!token || !returnInput || !invite?.valid) return;
    returned({ data: { token, ...returnInput, action: search.cancelled ? "cancel" : "read", confirm: false } }).then(r => { if ("error" in r) setError(r.error ?? "Payment verification unavailable"); else setPayment(r); }).catch(() => setError("Payment verification unavailable."));
  }, [token, returnInput, invite?.valid]);
  async function choose(provider: "stripe" | "paypal") {
    if (!profile || !consent || busy) return; setBusy(true); setError("");
    try { const result = await start({ data: { token, profile, consent: true, provider } });
      if ("error" in result) setError(result.error); else if (result.approvalUrl) window.location.assign(result.approvalUrl); else setPayment({ status: result.status });
    } catch { setError("Unable to open this test payment. Do not create another order."); } finally { setBusy(false); }
  }
  async function pay() {
    if (!returnInput || busy || !payment?.approved) return; setBusy(true); setError("");
    try { const result = await returned({ data: { token, ...returnInput, action: "capture", confirm: true } }); if ("error" in result) setError(result.error ?? "Payment verification unavailable"); else setPayment(result); }
    catch { setError("Payment verification pending. Do not submit another payment."); } finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-3xl px-5 py-10" data-diagnostic-version={PRIVATE_DIAGNOSTIC_VERSION}>
    <img src={logo} alt="Tecendo Som" className="h-16 w-16 object-contain mb-5" />
    <h1 className="font-display text-3xl text-foreground">Tecendo Som — private US$1 payment</h1>
    <p className="mt-4 text-muted-foreground">You are the payer. Tecendo Som receives one real US$1 payment per selected provider. No renewal, course access, enrollment, account creation or course emails. Provider receipts and processing fees may apply; your total is US$1.</p>
    {!token ? <p role="alert" className="mt-8">A private invitation is required.</p> : !invite ? <p className="mt-8">Checking invitation…</p> : !invite.valid ? <p role="alert" className="mt-8">{invite.error}</p> : <>
      <p className="mt-4 text-sm text-muted-foreground">This invitation expires {new Date(invite.expiresAt ?? "").toLocaleString()}.</p>
      {error && <p role="alert" className="my-5 text-destructive">{error}</p>}
      {returnInput ? <section className="mt-8 border-t border-border pt-6"><h2 className="text-xl">PayPal payment confirmation</h2>
        <p className="my-4">{payment?.status === "paid" ? "US$1 payment confirmed. No course access was granted." : payment?.status === "cancelled" ? "Payment cancelled. No payment was confirmed." : payment?.approved ? "PayPal approval verified. Confirm the real US$1 payment to Tecendo Som below." : "Payment is not confirmed. Awaiting verification."}</p>
        {payment?.approved && <Button disabled={busy} onClick={pay}>{busy ? "Verifying…" : "Pay US$1"}</Button>}
      </section> : !profile ? <div className="mt-8"><EnrollmentForm embedded diagnostic onComplete={setProfile} /></div> : <section className="mt-8 border-t border-border pt-6">
        <h2 className="text-xl">Choose your test payment</h2>
        <label className="flex items-start gap-3 my-5"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /><span>I authorize one real US$1 diagnostic payment to Tecendo Som for each provider I choose. This is not admission or access to the course. My form answers are not saved.</span></label>
        <div className="flex flex-wrap gap-4"><Button disabled onClick={() => choose("stripe")}>Stripe — unavailable</Button><Button disabled={busy || !consent || invite.attempts?.some(a => a.provider === "paypal" && ["paid", "cancelled", "failed", "expired"].includes(a.status))} onClick={() => choose("paypal")}>{busy ? "Preparing…" : "Continue to PayPal — US$1"}</Button></div>
        <p className="mt-5 text-sm text-muted-foreground">{invite.stripeBlocked}</p>
        <ul className="mt-5 text-sm">{invite.attempts?.map(a => <li key={a.id}>{a.provider}: {a.status}</li>)}</ul>
      </section>}
    </>}
  </main>;
}