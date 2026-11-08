import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { EnrollmentForm } from "@/components/EnrollmentForm";
import { Button } from "@/components/ui/button";
import { readPrivateInvitation, savePrivateDiagnosticForm, startPrivateDiagnostic, returnPrivatePayPal, readPrivateStripe } from "@/lib/private-diagnostic.functions";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { DIAGNOSTIC_DISPLAY_LABEL } from "@/lib/payment-diagnostic";
import { PRIVATE_DIAGNOSTIC_VERSION, PRIVATE_BRL_VERSION, PRIVATE_BRL2_VERSION } from "@/lib/private-diagnostic-rules";
import type { EnrollmentProfile } from "@/lib/enrollment-profile";
import logo from "@/assets/tecendo-som-logo.png";
import { TicketCheck } from "lucide-react";

export const Route = createFileRoute("/private-payment")({
  validateSearch: (s: Record<string, unknown>) => ({ attempt: typeof s.attempt === "string" ? s.attempt : "", stripe_attempt: typeof s.stripe_attempt === "string" ? s.stripe_attempt : "", state: typeof s.state === "string" ? s.state : "", token: typeof s.token === "string" ? s.token : "", cancelled: s.cancelled === "1" }),
  head: () => ({ meta: [
    { title: "Private payer test | Tecendo Som" }, { name: "description", content: "Private one-time special guest payment with a 7-day courtesy access." },
    { property: "og:title", content: "Private payer test | Tecendo Som" }, { property: "og:description", content: "Private one-time special guest payment with a 7-day courtesy access." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex,nofollow,noarchive" }, { name: "referrer", content: "no-referrer" },
  ] }), component: PrivatePayment,
});
function PrivatePayment() {
  const [token, setToken] = useState("");
  const routeHash = useRouterState({ select: state => state.location.hash });
  useEffect(() => {
    function refresh() {
      const fragment = new URLSearchParams((window.location.hash || routeHash || "").replace(/^#/, "")).get("invite");
      const previous = sessionStorage.getItem("private-diagnostic-invite") || "";
      const value = fragment ?? previous;
      if (fragment !== null) {
        if (fragment !== previous) {
          sessionStorage.removeItem("private-diagnostic-stripe");
          sessionStorage.removeItem("private-diagnostic-return");
        }
        sessionStorage.setItem("private-diagnostic-invite", value);
        history.replaceState(null, "", window.location.pathname + (fragment !== previous ? "" : window.location.search));
      }
      setToken(value);
    }
    refresh(); window.addEventListener("hashchange", refresh);
    return () => window.removeEventListener("hashchange", refresh);
  }, [routeHash]);
  return <PrivatePaymentSession key={token} token={token} />;
}
function PrivatePaymentSession({ token }: { token: string }) {
  const search = Route.useSearch();
  const read = useServerFn(readPrivateInvitation), start = useServerFn(startPrivateDiagnostic), returned = useServerFn(returnPrivatePayPal);
  const saveForm = useServerFn(savePrivateDiagnosticForm);
  const readStripe = useServerFn(readPrivateStripe);
  const [stripeAttempt, setStripeAttempt] = useState(""), [clientSecret, setClientSecret] = useState<string | null>(null);
  const [profile, setProfile] = useState<EnrollmentProfile | null>(null);
  const [invite, setInvite] = useState<Awaited<ReturnType<typeof readPrivateInvitation>> | null>(null);
  const [consent, setConsent] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [payment, setPayment] = useState<{ status?: string; approved?: boolean } | null>(null);
  const [returnInput, setReturnInput] = useState<{ attempt: string; state: string; order: string } | null>(null);
  useEffect(() => {
    if (!token) return;
    const storageKey = (kind: string) => `private-diagnostic-${kind}:${token}`;
    if (search.stripe_attempt && window.location.search) { setStripeAttempt(search.stripe_attempt); sessionStorage.setItem(storageKey("stripe"), search.stripe_attempt); history.replaceState(null, "", window.location.pathname); }
    else if (!search.attempt) setStripeAttempt(sessionStorage.getItem(storageKey("stripe")) ?? "");
    if (search.attempt && search.state && search.token && window.location.search) {
      const input = { attempt: search.attempt, state: search.state, order: search.token };
      sessionStorage.setItem(storageKey("return"), JSON.stringify(input));
      setReturnInput(input);
      history.replaceState(null, "", window.location.pathname);
    } else { try { const saved = sessionStorage.getItem(storageKey("return")); if (saved) setReturnInput(JSON.parse(saved)); } catch { /* no return */ } }
  }, []);
  useEffect(() => { if (!token) return;
    let active = true;
    read({ data: { token } }).then(r => { if (active) setInvite(r); }).catch(() => { if (active) setInvite({ valid: false, error: "Invitation verification is temporarily unavailable. Please try again." }); });
    return () => { active = false; };
  }, [token]);
  useEffect(() => { if (!token || !returnInput || !invite?.valid) return;
    returned({ data: { token, ...returnInput, action: search.cancelled ? "cancel" : "read", confirm: false } }).then(r => { if ("error" in r) setError(r.error ?? "Payment verification unavailable"); else setPayment(r); }).catch(() => setError("Payment verification unavailable."));
  }, [token, returnInput, invite?.valid]);
  useEffect(() => { if (!token || !stripeAttempt || !invite?.valid) return;
    readStripe({ data: { token, attempt: stripeAttempt } }).then(r => { if ("error" in r) setError(r.error); else { setPayment({ status: r.status }); setClientSecret(r.clientSecret); } }).catch(() => setError("Stripe verification pending."));
  }, [token, stripeAttempt, invite?.valid]);
  let liveStripe = false; try { liveStripe = getStripeEnvironment() === "live"; } catch { /* fail closed */ }
  const brl = invite?.valid && invite.currency === "brl";
  const amountLabel = brl ? (invite.amountMinor === 200 ? "R$ 2" : "R$ 1") : "US$ 1";
  async function choose(provider: "stripe" | "paypal") {
    if (!profile || !consent || busy || (brl && provider === "paypal")) return; setBusy(true); setError("");
    try { const result = await start({ data: { token, profile, consent: true, provider } });
      if ("error" in result) setError(result.error); else if (result.approvalUrl) window.location.assign(result.approvalUrl); else { setPayment({ status: result.status }); if (result.provider === "stripe") { setStripeAttempt(result.id); sessionStorage.setItem(`private-diagnostic-stripe:${token}`, result.id); setClientSecret(result.clientSecret); } }
    } catch { setError("Unable to open this test payment. Do not create another order."); } finally { setBusy(false); }
  }
  async function pay() {
    if (!returnInput || busy || !payment?.approved) return; setBusy(true); setError("");
    try { const result = await returned({ data: { token, ...returnInput, action: "capture", confirm: true } }); if ("error" in result) setError(result.error ?? "Payment verification unavailable"); else setPayment(result); }
    catch { setError("Payment verification pending. Do not submit another payment."); } finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-3xl px-5 py-10" data-private-offer-layout="concise-v1" data-private-brl-version={PRIVATE_BRL_VERSION} data-private-brl2-version={PRIVATE_BRL2_VERSION} data-diagnostic-amount-minor={invite?.valid ? invite.amountMinor : undefined} data-diagnostic-currency={invite?.valid ? invite.currency : undefined} data-diagnostic-version={PRIVATE_DIAGNOSTIC_VERSION} data-diagnostic-form-storage="private-full-profile-v1" data-diagnostic-form-saved={profile ? "true" : "false"}>
    <img src={logo} alt="Tecendo Som" className="h-16 w-16 object-contain mb-5" />
    {!invite?.valid && <h1 className="font-display text-3xl text-foreground">Private payment invitation</h1>}
    {!token ? <p role="alert" className="mt-8">A private invitation is required.</p> : !invite ? <p className="mt-8">Checking invitation…</p> : !invite.valid ? <p role="alert" className="mt-8">{invite.error}</p> : <>
      <article aria-label="Private guest offer" data-offer-version="private-guest-card-v1" className="relative overflow-hidden rounded-lg border border-secondary bg-card p-5 sm:p-7 text-card-foreground">
        <div className="absolute inset-x-0 top-0 h-1 bg-secondary" aria-hidden="true" />
        <div className="mb-4 flex items-center gap-3 text-secondary"><TicketCheck className="h-6 w-6 shrink-0" aria-hidden="true" /><span className="text-sm font-semibold">PRIVATE INVITATION</span></div>
        <h1 className="font-display text-3xl break-words tracking-normal">{DIAGNOSTIC_DISPLAY_LABEL}</h1>
        <div className="mt-5 space-y-2"><p className="font-display text-5xl tracking-normal">{amountLabel}</p><p className="text-sm leading-relaxed text-muted-foreground">{brl ? "One-time Stripe payment" : "One-time payment per provider"} · No renewal</p></div>
        <p className="mt-5 text-base leading-relaxed">Enjoy 7 days of Complete access after your first confirmed payment.</p>
        <ul className="mt-4 space-y-2 text-sm leading-relaxed text-muted-foreground">
          <li>Welcome and access instructions go to the email in your form.</li>
          {!brl && <li>Testing a second provider will not extend your access.</li>}
        </ul>
        <div className="mt-5 space-y-2 border-t border-border pt-4 text-sm leading-relaxed text-muted-foreground">
          <p>Payment to Tecendo Som</p>
          {invite.expiresAt && <p>Invitation valid until <time dateTime={invite.expiresAt}>{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(invite.expiresAt))}</time>.</p>}
          <p>{brl ? "Brazilian-issued cards are charged in BRL for this private test" : "Your bank may apply currency conversion fees."}</p>
        </div>
      </article>
      {error && <p role="alert" className="my-5 text-destructive">{error}</p>}
      {stripeAttempt ? <section className="mt-8 border-t border-border pt-6"><h2 className="text-xl">Stripe — {DIAGNOSTIC_DISPLAY_LABEL}</h2>
        {payment?.status === "paid" ? <p className="my-4">{amountLabel} payment confirmed. Your 7-day courtesy access and welcome emails are on the way.</p> : clientSecret && liveStripe ? <EmbeddedCheckoutProvider stripe={getStripe()} options={{ clientSecret }}><EmbeddedCheckout /></EmbeddedCheckoutProvider> : <p className="my-4">{payment?.status === "expired" ? "Checkout expired. No payment confirmed." : "Payment verification pending."}</p>}
        {!brl && <Button className="mt-5" variant="outline" onClick={() => { setStripeAttempt(""); sessionStorage.removeItem(`private-diagnostic-stripe:${token}`); setClientSecret(null); setPayment(null); read({ data: { token } }).then(setInvite); }}>Other provider</Button>}
      </section> : returnInput ? <section className="mt-8 border-t border-border pt-6"><h2 className="text-xl">PayPal payment confirmation</h2>
        <p className="my-4">{payment?.status === "paid" ? `${amountLabel} payment confirmed. Your 7-day courtesy access and welcome emails are on the way.` : payment?.status === "cancelled" ? "Payment cancelled. No payment was confirmed." : payment?.approved ? "PayPal approval verified. Confirm the real US$1 payment to Tecendo Som below." : "Payment is not confirmed. Awaiting verification."}</p>
        {payment?.approved && <Button disabled={busy} onClick={pay}>{busy ? "Verifying…" : "Pay US$1"}</Button>}
        <Button className="mt-5" variant="outline" onClick={() => { setReturnInput(null); sessionStorage.removeItem(`private-diagnostic-return:${token}`); setPayment(null); read({ data: { token } }).then(setInvite); }}>Other provider</Button>
      </section> : !profile ? <div className="mt-8"><h2 className="mb-5 text-xl font-display">Your details</h2><EnrollmentForm embedded diagnostic onComplete={async values => {
        const result = await saveForm({ data: { token, profile: values, consent: true } });
        if ("error" in result) throw new Error(result.error);
        setProfile(values);
      }} /></div> : <section className="mt-8 border-t border-border pt-6">
        <h2 className="text-xl">Choose your test payment</h2>
        <label className="flex items-start gap-3 my-5 text-sm leading-relaxed"><input className="mt-1 shrink-0" type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /><span>I authorize a one-time {amountLabel} payment to Tecendo Som {brl ? "through Stripe" : "through the provider I select"}. No automatic renewal.</span></label>
        <div className="flex flex-wrap gap-4"><Button disabled={busy || !consent || !liveStripe || invite.attempts?.some(a => a.provider === "stripe" && ["paid", "cancelled", "failed", "expired"].includes(a.status))} onClick={() => choose("stripe")}>Continue to Stripe — {amountLabel}</Button>{!brl && <Button disabled={busy || !consent || invite.attempts?.some(a => a.provider === "paypal" && ["paid", "cancelled", "failed", "expired"].includes(a.status))} onClick={() => choose("paypal")}>{busy ? "Preparing…" : "Continue to PayPal — US$1"}</Button>}</div>
        {!liveStripe && <p className="mt-5 text-sm text-muted-foreground">Live Stripe checkout is available on the published site only.</p>}
        <ul className="mt-5 text-sm">{invite.attempts?.map(a => <li key={a.id}>{a.provider}: {a.status}</li>)}</ul>
      </section>}
    </>}
  </main>;
}