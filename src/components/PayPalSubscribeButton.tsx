import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getStripeEnvironment } from "@/lib/stripe";
import type { PackageConsent } from "@/lib/payments.functions";
import {
  getPayPalCheckoutConfig,
  preparePayPalSubscription,
  registerPayPalApproval,
} from "@/lib/paypal.functions";

// The SDK's onApprove only REPORTS approval. Access is granted exclusively by
// the server after a verified PAYMENT.SALE.COMPLETED webhook.

let sdkPromise: Promise<void> | null = null;
let sdkClientId: string | null = null;

function loadPayPalSdk(clientId: string): Promise<void> {
  if (sdkPromise && sdkClientId === clientId) return sdkPromise;
  sdkClientId = clientId;
  sdkPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&vault=true&intent=subscription&locale=en_US`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      sdkPromise = null;
      reject(new Error("PayPal SDK failed to load"));
    };
    document.body.appendChild(script);
  });
  return sdkPromise;
}

type Status =
  | { kind: "hidden" }
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "confirming" }
  | { kind: "error"; message: string };

export function PayPalSubscribeButton(props: {
  tier: "live" | "complete";
  durationMonths: 1 | 3 | 6;
  leadId: string;
  consent?: PackageConsent;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>({ kind: "hidden" });
  const getConfig = useServerFn(getPayPalCheckoutConfig);
  const prepare = useServerFn(preparePayPalSubscription);
  const register = useServerFn(registerPayPalApproval);

  useEffect(() => {
    let cancelled = false;
    let buttons: any = null;
    let environment: "sandbox" | "live";
    try {
      environment = getStripeEnvironment();
    } catch {
      return;
    }
    const consent = props.consent;
    if (!consent?.termsVersion || !consent.privacyVersion || !consent.acceptedAt) return;

    getConfig({ data: { environment } })
      .then(async (cfg) => {
        if (cancelled || !cfg.available || !cfg.clientId) return;
        setStatus({ kind: "loading" });
        await loadPayPalSdk(cfg.clientId);
        const paypal = (window as any).paypal;
        if (cancelled || !ref.current || !paypal?.Buttons) return;
        let intentId = "";
        buttons = paypal.Buttons({
          style: { shape: "pill", color: "gold", layout: "vertical", label: "subscribe" },
          createSubscription: async (_d: unknown, actions: any) => {
            const r = await prepare({
              data: {
                environment,
                leadId: props.leadId,
                tier: props.tier,
                durationMonths: props.durationMonths,
                consent: consent as Required<Pick<PackageConsent, "termsVersion" | "privacyVersion" | "acceptedAt">> & PackageConsent,
              },
            });
            intentId = r.intentId;
            return actions.subscription.create({ plan_id: r.planId, custom_id: r.intentId });
          },
          onApprove: async (d: { subscriptionID: string }) => {
            setStatus({ kind: "confirming" });
            await register({ data: { environment, intentId, subscriptionId: d.subscriptionID } }).catch(() => {});
          },
          onError: () =>
            setStatus({ kind: "error", message: "Something went wrong with PayPal. Please try again or pay by card." }),
        });
        if (buttons.isEligible && !buttons.isEligible()) {
          setStatus({ kind: "hidden" });
          return;
        }
        await buttons.render(ref.current);
        if (!cancelled) setStatus({ kind: "ready" });
      })
      .catch(() => {
        if (!cancelled) setStatus({ kind: "hidden" });
      });
    return () => {
      cancelled = true;
      try {
        buttons?.close?.();
      } catch {
        /* ignore */
      }
    };
  }, [props.tier, props.durationMonths, props.leadId, props.consent]);

  if (status.kind === "hidden") return null;
  return (
    <div className="mt-4 border-t border-border pt-4 space-y-2">
      <p className="text-xs text-center text-muted-foreground">Or subscribe with PayPal — same price, same renewal terms.</p>
      <div ref={ref} className={status.kind === "confirming" ? "hidden" : ""} />
      {status.kind === "confirming" && (
        <p role="status" className="text-sm text-center text-foreground/90">
          PayPal approved your subscription. We're confirming your payment now — your welcome email and a
          secure member-area access link arrive as soon as it clears.{" "}
          <a href="/membership?provider=paypal" className="text-primary hover:underline">How to manage a PayPal subscription</a>
        </p>
      )}
      {status.kind === "error" && (
        <p role="alert" className="text-xs text-center text-destructive">{status.message}</p>
      )}
    </div>
  );
}
