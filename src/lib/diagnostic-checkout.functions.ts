import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";
import { PAYMENT_DIAGNOSTIC } from "@/lib/payment-diagnostic";

/** Retrieves a pre-created diagnostic checkout; cannot create or charge anything. */
export const readDiagnosticCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { sessionId: string }) => {
    if (!/^cs_live_[A-Za-z0-9]+$/.test(data.sessionId)) throw new Error("Invalid diagnostic session");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { data: allowed, error } = await context.supabase.rpc("is_admin");
    if (error || allowed !== true) throw new Error("Access restricted");
    try {
      const session = await createStripeClient("live").checkout.sessions.retrieve(data.sessionId);
      if (session.metadata?.payment_diagnostic !== PAYMENT_DIAGNOSTIC || session.mode !== "payment" ||
        session.amount_total !== 100 || session.currency !== "usd" || session.ui_mode !== "embedded_page") {
        return { error: "This is not an isolated USD 1 diagnostic checkout." };
      }
      return { clientSecret: session.status === "open" ? session.client_secret : null, status: session.status };
    } catch (e) { return { error: getStripeErrorMessage(e) }; }
  });