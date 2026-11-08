import type { EnrollmentProfile } from "./enrollment-profile";
import { getAccessToken, PAYPAL_API_BASE } from "./paypal.server";
import { assertPayPalOrder, invitationValid, PAYPAL_DIAGNOSTIC_PAYEE, DIAGNOSTIC_ORIGIN, diagnosticOffer } from "./private-diagnostic-rules";
import { createStripeClient } from "./stripe.server";
import { buildIntegrationIdentifier } from "./payments-helpers";

function assertPrivateStripeSession(session: any, attempt: any) {
  const offer = diagnosticOffer(attempt, "stripe");
  if ((attempt.provider_id && session.id !== attempt.provider_id) || session.livemode !== true || session.metadata?.payment_diagnostic !== offer.marker || session.metadata?.diagnostic_attempt !== attempt.id || session.mode !== "payment" || session.subscription || session.amount_total !== offer.amount || session.currency !== offer.currency || session.ui_mode !== "embedded_page" || session.automatic_tax?.enabled === true || (session.total_details?.amount_tax ?? 0) !== 0 || (session.total_details?.amount_discount ?? 0) !== 0 || session.metadata?.lead_id || session.metadata?.tier || session.metadata?.package) throw new Error("Private Stripe payment facts invalid");
}
async function stripeResult(db: any, attempt: any, stripe = createStripeClient("live")) {
  const session = await stripe.checkout.sessions.retrieve(attempt.provider_id);
  assertPrivateStripeSession(session, attempt);
  const status = session.payment_status === "paid" ? "paid" : session.status === "expired" ? "expired" : session.status === "complete" ? "pending" : "open";
  await save(db, attempt.id, { status, ...(status === "paid" ? { paid_at: attempt.paid_at ?? new Date().toISOString() } : {}) });
  if (status === "paid") await paidHook(db, attempt.invite_id);
  return { id: attempt.id, provider: "stripe", status, approvalUrl: null, clientSecret: status === "open" ? session.client_secret : null };
}

// No profile answers, course clients, auth mutation, mail or lifecycle imports here; the
// owner-authorized courtesy grant is isolated in private-diagnostic-grant.server.ts.
async function paidHook(db: any, inviteId: string) { const { afterDiagnosticPaid } = await import("./private-diagnostic-grant.server"); await afterDiagnosticPaid(db, inviteId); }
export async function hashDiagnosticToken(token: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))), n => n.toString(16).padStart(2, "0")).join("");
}
export function newDiagnosticToken() { return Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, "0")).join(""); }
export async function diagnosticInvite(db: any, token: string) {
  const { data, error } = await db.from("payment_diagnostic_invites").select("id,expires_at,revoked_at,currency,amount_minor,stripe_only,paypal_only").eq("token_hash", await hashDiagnosticToken(token)).maybeSingle();
  if (error) throw new Error("Invitation verification is temporarily unavailable.");
  if (!invitationValid(data)) throw new Error("Invalid, revoked or expired invitation");
  diagnosticOffer(data);
  return data as { id: string; expires_at: string; revoked_at: string | null; currency: string; amount_minor: number; stripe_only: boolean; paypal_only: boolean };
}
async function paypal(path: string, method = "GET", body?: unknown, requestId?: string, gateway = false) {
  if (gateway) {
    const connection = process.env["PAYPAL_API_KEY"], projectKey = process.env["LOVABLE_API_KEY"];
    if (!connection || !projectKey) throw new Error("The private BRL PayPal offer is not configured. No payment was created.");
    const response = await fetch(`https://connector-gateway.lovable.dev/paypal${path}`, { method, headers: { Authorization: `Bearer ${projectKey}`, "X-Connection-Api-Key": connection, "Content-Type": "application/json", ...(requestId ? { "PayPal-Request-Id": requestId, Prefer: "return=representation" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!response.ok) { const details = await response.text(); console.error(`PayPal [${response.status}]: ${details}`); throw new Error(`PayPal [${response.status}]: ${details}`); }
    return response.json();
  }
  const token = await getAccessToken("live");
  const response = await fetch(`${PAYPAL_API_BASE.live}${path}`, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(requestId ? { "PayPal-Request-Id": requestId, Prefer: "return=representation" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (!response.ok) throw new Error(`PayPal could not complete this request (HTTP ${response.status}). No new attempt was created.`);
  return response.json();
}
async function save(db: any, id: string, fields: Record<string, unknown>) {
  const { error } = await db.from("payment_diagnostic_attempts").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error("Unable to save payment verification; do not retry with a different order");
}
export async function diagnosticStart(db: any, token: string, provider: "stripe" | "paypal", profile?: EnrollmentProfile) {
  const invite = await diagnosticInvite(db, token);
  const offer = diagnosticOffer(invite, provider);
  if (!profile) throw new Error("Complete the private enrollment form first");
  { const { requireSavedDiagnosticForm } = await import("./private-diagnostic-form.server"); await requireSavedDiagnosticForm(db, invite.id, profile); }
  const { data, error } = await db.rpc("reserve_payment_diagnostic", { p_hash: await hashDiagnosticToken(token), p_provider: provider });
  const attempt = data?.[0];
  if (error || !attempt || attempt.invite_id !== invite.id) throw new Error("Unable to reserve this test");
  if (attempt.provider !== provider || attempt.currency !== invite.currency || attempt.amount_minor !== invite.amount_minor || Boolean(attempt.paypal_only) !== Boolean(invite.paypal_only)) throw new Error("Private payment offer mismatch");
  if (attempt.provider_id) return provider === "stripe" ? stripeResult(db, attempt) : { id: attempt.id, provider, status: attempt.status, approvalUrl: attempt.status === "open" ? attempt.approval_url : null, clientSecret: null };
  if (attempt.status !== "reserved") throw new Error("This provider attempt has already been used");
  const creation = await db.rpc("claim_diagnostic_creation", { p_id: attempt.id, p_invite: invite.id });
  if (creation.error || !creation.data?.length) throw new Error("This payment is being prepared or its creation window expired. Do not start another attempt.");
  if (provider === "stripe") {
    const stripe = createStripeClient("live");
    const prices = await stripe.prices.list({ lookup_keys: [offer.priceKey], active: true, limit: 2 });
    const price = prices.data[0];
    if (prices.data.length !== 1 || !price || price.currency !== offer.currency || price.unit_amount !== offer.amount || price.type !== "one_time" || price.recurring) throw new Error("Private diagnostic catalog is unavailable");
    const productId = typeof price.product === "string" ? price.product : price.product.id;
    const product = await stripe.products.retrieve(productId);
    if (product.deleted || product.name !== offer.productName || product.metadata?.lovable_external_id !== offer.productKey) throw new Error("Private diagnostic product mismatch");
    const metadata = { payment_diagnostic: offer.marker, diagnostic_attempt: attempt.id };
    const expires = Math.min(Math.floor(Date.parse(invite.expires_at) / 1000), Math.floor(Date.parse(attempt.created_at) / 1000) + 3600);
    if (expires < Math.floor(Date.now() / 1000) + 1800) throw new Error("Invitation checkout window has expired");
    const session = await stripe.checkout.sessions.create({ mode: "payment", ui_mode: "embedded_page", integration_identifier: buildIntegrationIdentifier(), line_items: [{ quantity: 1, price_data: { currency: offer.currency, unit_amount: offer.amount, tax_behavior: "inclusive", product: productId } }], metadata, payment_intent_data: { metadata, description: offer.productName }, expires_at: expires, return_url: `${DIAGNOSTIC_ORIGIN}/private-payment?stripe_attempt=${attempt.id}` }, { idempotencyKey: `cv-diag-stripe-${attempt.id}` });
    assertPrivateStripeSession(session, attempt);
    await save(db, attempt.id, { provider_id: session.id, status: "open", capture_lock_until: null });
    return { id: attempt.id, provider, status: "open", approvalUrl: null, clientSecret: session.client_secret };
  }
  // Stable state is derived from an unguessable invitation and attempt; raw state is never persisted.
  const state = await hashDiagnosticToken(`${token}:${attempt.id}:paypal-return`);
  const returnUrl = `${DIAGNOSTIC_ORIGIN}/private-payment?attempt=${attempt.id}&state=${state}`;
  const order = await paypal("/v2/checkout/orders", "POST", { intent: "CAPTURE", purchase_units: [{ reference_id: attempt.id, custom_id: `${offer.marker}:${attempt.id}`, description: offer.productName, payee: { merchant_id: PAYPAL_DIAGNOSTIC_PAYEE }, amount: { currency_code: offer.currency.toUpperCase(), value: (offer.amount / 100).toFixed(2) } }], payment_source: { paypal: { experience_context: { shipping_preference: "NO_SHIPPING", user_action: "CONTINUE", return_url: returnUrl, cancel_url: `${returnUrl}&cancelled=1` } } } }, `cv-diag-create-${attempt.id}`, offer.paypalOnly);
  const bound = { ...attempt, provider_id: order.id, payee_id: PAYPAL_DIAGNOSTIC_PAYEE };
  assertPayPalOrder(order, bound);
  const approvalUrl = order.links?.find((link: any) => link.rel === "payer-action" || link.rel === "approve")?.href;
  if (!approvalUrl || new URL(approvalUrl).origin !== "https://www.paypal.com") throw new Error("PayPal approval unavailable");
  await save(db, attempt.id, { provider_id: order.id, payee_id: PAYPAL_DIAGNOSTIC_PAYEE, approval_url: approvalUrl, return_state_hash: await hashDiagnosticToken(state), status: "open", capture_lock_until: null });
  return { id: attempt.id, provider, status: "open", approvalUrl, clientSecret: null };
}
export async function diagnosticStripeRead(db: any, token: string, id: string) {
  const invite = await diagnosticInvite(db, token);
  const { data: attempt, error } = await db.from("payment_diagnostic_attempts").select("*").eq("id", id).eq("invite_id", invite.id).eq("provider", "stripe").maybeSingle();
  if (error || !attempt?.provider_id) throw new Error("Invalid private Stripe return");
  return stripeResult(db, attempt);
}
export async function diagnosticPayPalReturn(db: any, input: { token: string; attempt: string; state: string; order: string; action: "read" | "cancel" | "capture" }) {
  const invite = await diagnosticInvite(db, input.token);
  diagnosticOffer(invite, "paypal");
  const { data: attempt, error } = await db.from("payment_diagnostic_attempts").select("*").eq("id", input.attempt).eq("invite_id", invite.id).eq("provider", "paypal").maybeSingle();
  if (error || !attempt || attempt.currency !== invite.currency || attempt.amount_minor !== invite.amount_minor || Boolean(attempt.paypal_only) !== Boolean(invite.paypal_only) || input.order !== attempt.provider_id || await hashDiagnosticToken(input.state) !== attempt.return_state_hash) throw new Error("Invalid payment return");
  let order = await paypal(`/v2/checkout/orders/${attempt.provider_id}`, "GET", undefined, undefined, Boolean(attempt.paypal_only));
  let facts = assertPayPalOrder(order, attempt);
  if (facts.paid) { await save(db, attempt.id, { status: "paid", paid_at: attempt.paid_at ?? new Date().toISOString(), capture_id: facts.captureId }); await paidHook(db, attempt.invite_id); return { status: "paid", approved: false }; }
  if (input.action === "cancel") {
    const cancelled = await db.rpc("cancel_diagnostic_attempt", { p_id: attempt.id, p_invite: invite.id });
    if (cancelled.error || cancelled.data !== true) throw new Error("Payment verification in progress");
    return { status: "cancelled", approved: false };
  }
  if (input.action !== "capture") return { status: attempt.status, approved: facts.approved && ["open", "pending"].includes(attempt.status) };
  if (!facts.approved || !["open", "pending", "capturing"].includes(attempt.status)) throw new Error("Payment has not been approved or this attempt is closed");
  const claimed = await db.rpc("claim_diagnostic_capture", { p_id: attempt.id, p_invite: invite.id });
  if (claimed.error || !claimed.data?.length) return { status: "pending", approved: false };
  // This line is reached only by the site's explicit payer confirmation POST.
  await paypal(`/v2/checkout/orders/${attempt.provider_id}/capture`, "POST", {}, `cv-diag-capture-${attempt.id}`, Boolean(attempt.paypal_only));
  order = await paypal(`/v2/checkout/orders/${attempt.provider_id}`, "GET", undefined, undefined, Boolean(attempt.paypal_only));
  facts = assertPayPalOrder(order, attempt);
  await save(db, attempt.id, { status: facts.paid ? "paid" : "pending", ...(facts.paid ? { paid_at: new Date().toISOString(), capture_id: facts.captureId } : {}) });
  if (facts.paid) await paidHook(db, attempt.invite_id);
  return { status: facts.paid ? "paid" : "pending", approved: false };
}
export async function applyPrivateStripeDiagnostic(db: any, event: any) {
  if (event.livemode !== true) throw new Error("Private Stripe event must be live");
  const obj = event.data.object, attemptId = obj.metadata?.diagnostic_attempt;
  if (!attemptId) return; // Legacy audit-only diagnostics remain audit-only.
  if (!/^[a-f0-9-]{36}$/.test(attemptId)) throw new Error("Invalid diagnostic binding");
  const { data: attempt, error } = await db.from("payment_diagnostic_attempts").select("*").eq("id", attemptId).eq("provider", "stripe").maybeSingle();
  if (error || !attempt?.provider_id) throw new Error("Diagnostic binding not available");
  const stripe = createStripeClient("live");
  const session = await stripe.checkout.sessions.retrieve(attempt.provider_id);
  assertPrivateStripeSession(session, attempt);
  const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  const related = event.type.startsWith("checkout.session.") ? obj.id === session.id : event.type.startsWith("payment_intent.") ? obj.id === pi : obj.payment_intent === pi;
  const offer = diagnosticOffer(attempt, "stripe");
  if (!related || obj.metadata?.payment_diagnostic !== offer.marker || obj.currency !== offer.currency || (obj.amount_total ?? obj.amount) !== offer.amount) throw new Error("Diagnostic payment facts invalid");
  const status = event.type === "charge.refunded" && obj.refunded === true ? "refunded" : session.payment_status === "paid" ? "paid" : session.status === "expired" ? "expired" : "pending";
  const result = await db.rpc("apply_diagnostic_stripe_event", { p_event: event.id, p_attempt: attempt.id, p_object: session.id, p_type: event.type, p_status: status });
  if (result.error || result.data !== true) throw new Error("Unable to record diagnostic event");
  if (status === "paid") await paidHook(db, attempt.invite_id);
}

/** Called only after the live PayPal webhook signature has been verified. Never captures. */
export async function applyPrivatePayPalDiagnostic(db: any, event: any, env: string) {
  const resource = event.resource;
  const custom = resource?.custom_id;
  if (typeof custom !== "string" || !/^(conscious_voice_usd1_v1|conscious_voice_paypal_brl2_v1):/.test(custom)) return false;
  if (env !== "live") throw new Error("Private PayPal event must be live");
  const [marker, id] = custom.split(":");
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Invalid diagnostic binding");
  const { data: attempt, error } = await db.from("payment_diagnostic_attempts").select("*").eq("id", id).eq("provider", "paypal").maybeSingle();
  if (error || !attempt?.provider_id) throw new Error("Diagnostic binding unavailable");
  const offer = diagnosticOffer({ ...attempt, stripe_only: false }, "paypal");
  if (marker !== offer.marker || resource.amount?.currency_code !== offer.currency.toUpperCase() || resource.amount?.value !== (offer.amount / 100).toFixed(2) || resource.supplementary_data?.related_ids?.order_id !== attempt.provider_id) throw new Error("Diagnostic PayPal event facts invalid");
  const order = await paypal(`/v2/checkout/orders/${attempt.provider_id}`, "GET", undefined, undefined, Boolean(attempt.paypal_only));
  const facts = assertPayPalOrder(order, attempt);
  if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
    if (!facts.paid || facts.captureId !== resource.id || resource.status !== "COMPLETED") throw new Error("Diagnostic capture not confirmed");
    await save(db, attempt.id, { status: "paid", paid_at: attempt.paid_at ?? new Date().toISOString(), capture_id: facts.captureId });
    await paidHook(db, attempt.invite_id);
  }
  return true;
}