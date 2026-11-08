import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { assertDiagnosticOrigin, diagnosticSaveSchema, diagnosticFormSchema, invitationTokenSchema, PRIVATE_DIAGNOSTIC_VERSION, diagnosticOffer } from "./private-diagnostic-rules";

function checkOrigin() { const req = getRequest(); assertDiagnosticOrigin(req.headers.get("origin"), new URL(req.url).origin, req.headers.get("sec-fetch-site")); }
export const readPrivateInvitation = createServerFn({ method: "POST" }).inputValidator(z.object({ token: invitationTokenSchema })).handler(async ({ data }) => {
  checkOrigin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { diagnosticInvite } = await import("./private-diagnostic.server");
  try {
    const invite = await diagnosticInvite(supabaseAdmin, data.token);
    const { data: attempts, error } = await supabaseAdmin.from("payment_diagnostic_attempts").select("id,provider,status").eq("invite_id", invite.id);
    if (error) throw new Error("Unable to read test status");
    const offer = diagnosticOffer(invite);
    return { valid: true, expiresAt: invite.expires_at, attempts: attempts ?? [], currency: offer.currency, stripeOnly: offer.stripeOnly, taxNotice: "Automatic tax calculation is off for this private test, as authorized by the owner. This does not establish a tax exemption.", version: PRIVATE_DIAGNOSTIC_VERSION };
  } catch (error) { return { valid: false, error: error instanceof Error && error.message === "Invalid, revoked or expired invitation" ? "Invalid, revoked or expired private invitation." : "Invitation verification is temporarily unavailable. Please try again." }; }
});
export const savePrivateDiagnosticForm = createServerFn({ method: "POST" }).inputValidator(diagnosticSaveSchema).handler(async ({ data }) => {
  checkOrigin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { hashDiagnosticToken } = await import("./private-diagnostic.server");
  const { saveDiagnosticForm } = await import("./private-diagnostic-form.server");
  try { return await saveDiagnosticForm(supabaseAdmin, data, hashDiagnosticToken); }
  catch (error) { return { error: error instanceof Error ? error.message : "Your answers could not be saved. No payment was started." }; }
});
export const startPrivateDiagnostic = createServerFn({ method: "POST" }).inputValidator(diagnosticFormSchema).handler(async ({ data }) => {
  checkOrigin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { diagnosticStart } = await import("./private-diagnostic.server");
  try { return await diagnosticStart(supabaseAdmin, data.token, data.provider, data.profile); }
  catch (error) { return { error: error instanceof Error ? error.message : "Private payment unavailable" }; }
});
export const returnPrivatePayPal = createServerFn({ method: "POST" }).inputValidator(z.object({ token: invitationTokenSchema, attempt: z.string().uuid(), state: invitationTokenSchema, order: z.string().regex(/^[A-Z0-9]{10,30}$/), action: z.enum(["read", "cancel", "capture"]), confirm: z.boolean().default(false) }).refine(v => v.action !== "capture" || v.confirm === true, "Explicit payment confirmation required")).handler(async ({ data }) => {
  checkOrigin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { diagnosticPayPalReturn } = await import("./private-diagnostic.server");
  try { return await diagnosticPayPalReturn(supabaseAdmin, data); }
  catch (error) { return { error: error instanceof Error ? error.message : "Unable to verify payment" }; }
});
export const readPrivateStripe = createServerFn({ method: "POST" }).inputValidator(z.object({ token: invitationTokenSchema, attempt: z.string().uuid() })).handler(async ({ data }) => {
  checkOrigin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { diagnosticStripeRead } = await import("./private-diagnostic.server");
  try { return await diagnosticStripeRead(supabaseAdmin, data.token, data.attempt); }
  catch { return { error: "Unable to verify this private Stripe checkout." }; }
});