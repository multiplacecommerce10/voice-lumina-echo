import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { assertDiagnosticOrigin, diagnosticFormSchema, invitationTokenSchema, PRIVATE_DIAGNOSTIC_VERSION, DIAGNOSTIC_TAX_NOTICE } from "./private-diagnostic-rules";

function checkOrigin() { const req = getRequest(); assertDiagnosticOrigin(req.headers.get("origin"), new URL(req.url).origin, req.headers.get("sec-fetch-site")); }
export const readPrivateInvitation = createServerFn({ method: "POST" }).inputValidator(z.object({ token: invitationTokenSchema })).handler(async ({ data }) => {
  checkOrigin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { diagnosticInvite } = await import("./private-diagnostic.server");
  try {
    const invite = await diagnosticInvite(supabaseAdmin, data.token);
    const { data: attempts, error } = await supabaseAdmin.from("payment_diagnostic_attempts").select("id,provider,status").eq("invite_id", invite.id);
    if (error) throw new Error("Unable to read test status");
    return { valid: true, expiresAt: invite.expires_at, attempts: attempts ?? [], taxNotice: DIAGNOSTIC_TAX_NOTICE, version: PRIVATE_DIAGNOSTIC_VERSION };
  } catch { return { valid: false, error: "Invalid, revoked or expired private invitation." }; }
});
export const startPrivateDiagnostic = createServerFn({ method: "POST" }).inputValidator(diagnosticFormSchema).handler(async ({ data }) => {
  checkOrigin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { diagnosticStart } = await import("./private-diagnostic.server");
  try { return await diagnosticStart(supabaseAdmin, data.token, data.provider, { fullName: data.profile.fullName, email: data.profile.email }); }
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