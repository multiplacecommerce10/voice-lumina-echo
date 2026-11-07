import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { EnrollmentForm } from "@/components/EnrollmentForm";
import { Button } from "@/components/ui/button";
import { readPrivateInvitation, startPrivateDiagnostic, returnPrivatePayPal, readPrivateStripe } from "@/lib/private-diagnostic.functions";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { DIAGNOSTIC_LABEL } from "@/lib/payment-diagnostic";
import { PRIVATE_DIAGNOSTIC_VERSION } from "@/lib/private-diagnostic-rules";
import type { EnrollmentProfile } from "@/lib/enrollment-profile";
import logo from "@/assets/tecendo-som-logo.png";
import { TicketCheck } from "lucide-react";

export const Route = createFileRoute("/private-payment")({
  validateSearch: (s: Record<string, unknown>) => ({ attempt: typeof s.attempt === "string" ? s.attempt : "", stripe_attempt: typeof s.stripe_attempt === "string" ? s.stripe_attempt : "", state: typeof s.state === "string" ? s.state : "", token: typeof s.token === "string" ? s.token : "", cancelled: s.cancelled === "1" }),
  head: () => ({ meta: [
    { title: "Private payer test | Tecendo Som" }, { name: "description", content: "Private single-payment diagnostic. No course enrollment or access." },
    { property: "og:title", content: "Private payer test | Tecendo Som" }, { property: "og:description", content: "Private single-payment diagnostic. No course enrollment or access." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex,nofollow,noarchive" }, { name: "referrer", content: "no-referrer" },
  ] }), component: PrivatePayment,
});
function PrivatePayment() {
  const search = Route.useSearch();
  const read = useServerFn(readPrivateInvitation), start = useServerFn(startPrivateDiagnostic), returned = useServerFn(returnPrivatePayPal);
  const readStripe = useServerFn(readPrivateStripe);
  const [stripeAttempt, setStripeAttempt] = useState(""), [clientSecret, setClientSecret] = useState<string | null>(null);
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
    if (search.stripe_attempt) { setStripeAttempt(search.stripe_attempt); sessionStorage.setItem("private-diagnostic-stripe", search.stripe_attempt); history.replaceState(null, "", window.location.pathname); }
    else if (!search.attempt) setStripeAttempt(sessionStorage.getItem("private-diagnostic-stripe") ?? "");
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
  useEffect(() => { if (!token || !stripeAttempt || !invite?.valid) return;
    readStripe({ data: { token, attempt: stripeAttempt } }).then(r => { if ("error" in r) setError(r.error); else { setPayment({ status: r.status }); setClientSecret(r.clientSecret); } }).catch(() => setError("Stripe verification pending."));
  }, [token, stripeAttempt, invite?.valid]);
  let liveStripe = false; try { liveStripe = getStripeEnvironment() === "live"; } catch { /* fail closed */ }
  async function choose(provider: "stripe" | "paypal") {
    if (!profile || !consent || busy) return; setBusy(true); setError("");
    try { const result = await start({ data: { token, profile, consent: true, provider } });
      if ("error" in result) setError(result.error); else if (result.approvalUrl) window.location.assign(result.approvalUrl); else { setPayment({ status: result.status }); if (result.provider === "stripe") { setStripeAttempt(result.id); sessionStorage.setItem("private-diagnostic-stripe", result.id); setClientSecret(result.clientSecret); } }
    } catch { setError("Unable to open this test payment. Do not create another order."); } finally { setBusy(false); }
  }
  async function pay() {
    if (!returnInput || busy || !payment?.approved) return; setBusy(true); setError("");
    try { const result = await returned({ data: { token, ...returnInput, action: "capture", confirm: true } }); if ("error" in result) setError(result.error ?? "Payment verification unavailable"); else setPayment(result); }
    catch { setError("Payment verification pending. Do not submit another payment."); } finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-3xl px-5 py-10" data-diagnostic-version={PRIVATE_DIAGNOSTIC_VERSION}>
    <img src={logo} alt="Tecendo Som" className="h-16 w-16 object-contain mb-5" />
    {!invite?.valid && <h1 className="font-display text-3xl text-foreground">Private payment invitation</h1>}
    {!token ? <p role="alert" className="mt-8">A private invitation is required.</p> : !invite ? <p className="mt-8">Checking invitation…</p> : !invite.valid ? <p role="alert" className="mt-8">{invite.error}</p> : <>
      <article aria-label="Private guest offer" data-offer-version="private-guest-card-v1" className="relative overflow-hidden rounded-lg border border-secondary bg-card p-5 sm:p-7 text-card-foreground">
        <div className="absolute inset-x-0 top-0 h-1 bg-secondary" aria-hidden="true" />
        <div className="mb-4 flex items-center gap-3 text-secondary"><TicketCheck className="h-6 w-6 shrink-0" aria-hidden="true" /><span className="text-sm font-semibold">Private guest · Tecendo Som</span></div>
        <h1 className="font-display text-3xl break-words tracking-normal">{DIAGNOSTIC_LABEL}</h1>
        <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1"><span className="font-display text-5xl tracking-normal">US$ 1</span><span className="text-sm text-muted-foreground">One payment per provider · No renewal</span></div>
        <p className="mt-5 text-muted-foreground">You are the payer. Tecendo Som receives one real US$1 payment per selected provider. No course access, enrollment, account creation or course emails. Provider receipts and processing fees may apply; your total is US$1.</p>
        <p className="mt-5 border-t border-border pt-4 text-sm text-muted-foreground">This invitation expires {new Date(invite.expiresAt ?? "").toLocaleString()}.</p>
      </article>
      {error && <p role="alert" className="my-5 text-destructive">{error}</p>}
      {stripeAttempt ? <section className="mt-8 border-t border-border pt-6"><h2 className="text-xl">Stripe — {DIAGNOSTIC_LABEL}</h2>
        {payment?.status === "paid" ? <p className="my-4">US$1 payment confirmed. No course access was granted.</p> : clientSecret && liveStripe ? <EmbeddedCheckoutProvider stripe={getStripe()} options={{ clientSecret }}><EmbeddedCheckout /></EmbeddedCheckoutProvider> : <p className="my-4">{payment?.status === "expired" ? "Checkout expired. No payment confirmed." : "Payment verification pending."}</p>}
        <Button className="mt-5" variant="outline" onClick={() => { setStripeAttempt(""); sessionStorage.removeItem("private-diagnostic-stripe"); setClientSecret(null); setPayment(null); read({ data: { token } }).then(setInvite); }}>Other provider</Button>
      </section> : returnInput ? <section className="mt-8 border-t border-border pt-6"><h2 className="text-xl">PayPal payment confirmation</h2>
        <p className="my-4">{payment?.status === "paid" ? "US$1 payment confirmed. No course access was granted." : payment?.status === "cancelled" ? "Payment cancelled. No payment was confirmed." : payment?.approved ? "PayPal approval verified. Confirm the real US$1 payment to Tecendo Som below." : "Payment is not confirmed. Awaiting verification."}</p>
        {payment?.approved && <Button disabled={busy} onClick={pay}>{busy ? "Verifying…" : "Pay US$1"}</Button>}
        <Button className="mt-5" variant="outline" onClick={() => { setReturnInput(null); sessionStorage.removeItem("private-diagnostic-return"); setPayment(null); read({ data: { token } }).then(setInvite); }}>Other provider</Button>
      </section> : !profile ? <div className="mt-8"><EnrollmentForm embedded diagnostic onComplete={setProfile} /></div> : <section className="mt-8 border-t border-border pt-6">
        <h2 className="text-xl">Choose your test payment</h2>
        <label className="flex items-start gap-3 my-5"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /><span>I authorize one real US$1 diagnostic payment to Tecendo Som for each provider I choose. This is not admission or access to the course. My form answers are not saved.</span></label>
        <div className="flex flex-wrap gap-4"><Button disabled={busy || !consent || !liveStripe || invite.attempts?.some(a => a.provider === "stripe" && ["paid", "cancelled", "failed", "expired"].includes(a.status))} onClick={() => choose("stripe")}>Continue to Stripe — US$1</Button><Button disabled={busy || !consent || invite.attempts?.some(a => a.provider === "paypal" && ["paid", "cancelled", "failed", "expired"].includes(a.status))} onClick={() => choose("paypal")}>{busy ? "Preparing…" : "Continue to PayPal — US$1"}</Button></div>
        <p className="mt-5 text-sm text-muted-foreground">{invite.taxNotice}{!liveStripe && " Live Stripe checkout is available on the published site only."}</p>
        <ul className="mt-5 text-sm">{invite.attempts?.map(a => <li key={a.id}>{a.provider}: {a.status}</li>)}</ul>
      </section>}
    </>}
  </main>;
}