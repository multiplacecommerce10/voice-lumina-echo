import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createCheckoutSession, type PackageConsent } from "@/lib/payments.functions";
import { ensureUtmsCaptured, getAttributionContext } from "@/lib/utm";

interface Props {
  priceId: string;
  customerEmail?: string;
  returnUrl?: string;
  leadId?: string;
  consent?: PackageConsent;
}

export function StripeEmbeddedCheckout({
  priceId,
  customerEmail,
  returnUrl,
  leadId,
  consent,
}: Props) {
  const fetchClientSecret = async (): Promise<string> => {
    ensureUtmsCaptured();
    // Empty unless the visitor allowed analytics/marketing.
    const { utms, landingUrl, referrer } = getAttributionContext();
    const result = await createCheckoutSession({
      data: {
        priceId,
        customerEmail,
        returnUrl:
          returnUrl || `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
        environment: getStripeEnvironment(),
        utms,
        landingUrl,
        referrer,
        leadId,
        consent,
      },
    });
    if ("error" in result) throw new Error(result.error);
    if (!result.clientSecret) throw new Error("Stripe did not return a client secret");
    return result.clientSecret;
  };

  return (
    <div id="checkout">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
