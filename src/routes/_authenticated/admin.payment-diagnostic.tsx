import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { readDiagnosticCheckout } from "@/lib/diagnostic-checkout.functions";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";

export const Route = createFileRoute("/_authenticated/admin/payment-diagnostic")({
  validateSearch: (s: Record<string, unknown>) => ({ session_id: typeof s.session_id === "string" ? s.session_id : "" }),
  head: () => ({ meta: [
    { title: "Diagnostic payment | The Power of Conscious Voice" },
    { name: "description", content: "Private payment diagnostic for the Conscious Voice administrator." },
    { property: "og:title", content: "Diagnostic payment | The Power of Conscious Voice" },
    { property: "og:description", content: "Private payment diagnostic for the Conscious Voice administrator." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  component: DiagnosticPayment,
});
function DiagnosticPayment() {
  const { session_id } = Route.useSearch();
  const [result, setResult] = useState<{ clientSecret?: string | null; status?: string | null; error?: string } | null>(null);
  useEffect(() => { let active = true;
    if (!session_id) { setResult({ error: "No diagnostic checkout selected." }); return; }
    readDiagnosticCheckout({ data: { sessionId: session_id } }).then(r => { if (active) setResult(r); })
      .catch(() => { if (active) setResult({ error: "Unable to open this private checkout." }); });
    return () => { active = false; };
  }, [session_id]);
  let live = false;
  try { live = getStripeEnvironment() === "live"; } catch { /* fail closed */ }
  return <main className="mx-auto max-w-3xl px-4 py-8">
    <h1 className="text-2xl font-semibold text-foreground">The Power of Conscious Voice — diagnostic payment USD 1</h1>
    <div className="mt-6">
      {!result ? <p>Loading…</p> : result.error ? <p role="alert">{result.error}</p> :
        result.status === "complete" ? <p>Payment completed.</p> : !live ? <p>Open this payment on the published site.</p> :
        result.clientSecret ? <EmbeddedCheckoutProvider stripe={getStripe()} options={{ clientSecret: result.clientSecret }}><EmbeddedCheckout /></EmbeddedCheckoutProvider> : <p>This checkout is no longer open.</p>}
    </div>
    <Link to="/admin" className="mt-6 inline-block text-primary">Back to administration</Link>
  </main>;
}