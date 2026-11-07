import { getAccessToken, PAYPAL_API_BASE } from "./paypal.server";
import { assertPayPalOrder, invitationValid, PAYPAL_DIAGNOSTIC_PAYEE, DIAGNOSTIC_ORIGIN, DIAGNOSTIC_PRICE_KEY } from "./private-diagnostic-rules";
import { PAYMENT_DIAGNOSTIC, DIAGNOSTIC_LABEL } from "./payment-diagnostic";
import { createStripeClient } from "./stripe.server";
import { buildIntegrationIdentifier } from "./payments-helpers";

function assertPrivateStripeSession(session: any, attempt: any) {
  if (session.livemode !== true || session.metadata?.payment_diagnostic !== PAYMENT_DIAGNOSTIC || session.metadata?.diagnostic_attempt !== attempt.id || session.mode !== "payment" || session.subscription || session.amount_total !== 100 || session.currency !== "usd" || session.ui_mode !== "embedded_page" || session.automatic_tax?.enabled === true || (session.total_details?.amount_tax ?? 0) !== 0 || (session.total_details?.amount_discount ?? 0) !== 0 || session.metadata?.lead_id || session.metadata?.tier || session.metadata?.package) throw new Error("Private Stripe payment facts invalid");
}
async function stripeResult(db: any, attempt: any, stripe = createStripeClient("live")) {
  const session = await stripe.checkout.sessions.retrieve(attempt.provider_id);
  assertPrivateStripeSession(session, attempt);
  const status = session.payment_status === "paid" ? "paid" : session.status === "expired" ? "expired" : session.status === "complete" ? "pending" : "open";
  await save(db, attempt.id, { status, ...(status === "paid" ? { paid_at: attempt.paid_at ?? new Date().toISOString() } : {}) });
  return { id: attempt.id, provider: "stripe", status, approvalUrl: null, clientSecret: status === "open" ? session.client_secret : null };
}

// No profile answers, course clients, auth mutation, mail or lifecycle imports here.
export async function hashDiagnosticToken(token: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))), n => n.toString(16).padStart(2, "0")).join("");
}
export function newDiagnosticToken() { return Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, "0")).join(""); }
export async function diagnosticInvite(db: any, token: string) {
  const { data, error } = await db.from("payment_diagnostic_invites").select("id,expires_at,revoked_at").eq("token_hash", await hashDiagnosticToken(token)).maybeSingle();
  if (error || !invitationValid(data)) throw new Error("Invalid, revoked or expired invitation");
  return data as { id: string; expires_at: string; revoked_at: string | null };
}
async function paypal(path: string, method = "GET", body?: unknown, requestId?: string) {
  const token = await getAccessToken("live");
  const response = await fetch(`${PAYPAL_API_BASE.live}${path}`, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(requestId ? { "PayPal-Request-Id": requestId, Prefer: "return=representation" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (!response.ok) throw new Error(`PayPal could not complete this request (HTTP ${response.status}). No new attempt was created.`);
  return response.json();
}
async function save(db: any, id: string, fields: Record<string, unknown>) {
  const { error } = await db.from("payment_diagnostic_attempts").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error("Unable to save payment verification; do not retry with a different order");
}
export async function diagnosticStart(db: any, token: string, provider: "stripe" | "paypal") {
  const invite = await diagnosticInvite(db, token);
  const { data, error } = await db.rpc("reserve_payment_diagnostic", { p_hash: await hashDiagnosticToken(token), p_provider: provider });
  const attempt = data?.[0];
  if (error || !attempt || attempt.invite_id !== invite.id) throw new Error("Unable to reserve this test");
  if (attempt.provider_id) return provider === "stripe" ? stripeResult(db, attempt) : { id: attempt.id, provider, status: attempt.status, approvalUrl: attempt.status === "open" ? attempt.approval_url : null, clientSecret: null };
  if (attempt.status !== "reserved") throw new Error("This provider attempt has already been used");
  const creation = await db.rpc("claim_diagnostic_creation", { p_id: attempt.id, p_invite: invite.id });
  if (creation.error || !creation.data?.length) throw new Error("This payment is being prepared or its creation window expired. Do not start another attempt.");
  if (provider === "stripe") {
    const stripe = createStripeClient("live");
    const prices = await stripe.prices.list({ lookup_keys: [DIAGNOSTIC_PRICE_KEY], active: true, limit: 2 });
    const price = prices.data[0];
    if (prices.data.length !== 1 || !price || price.currency !== "usd" || price.unit_amount !== 100 || price.type !== "one_time" || price.recurring) throw new Error("Private diagnostic catalog is unavailable");
    const productId = typeof price.product === "string" ? price.product : price.product.id;
    const product = await stripe.products.retrieve(productId);
    if (product.deleted || product.name !== DIAGNOSTIC_LABEL || product.metadata?.lovable_external_id !== "conscious_voice_private_guest") throw new Error("Private diagnostic product mismatch");
    const metadata = { payment_diagnostic: PAYMENT_DIAGNOSTIC, diagnostic_attempt: attempt.id };
    const expires = Math.min(Math.floor(Date.parse(invite.expires_at) / 1000), Math.floor(Date.parse(attempt.created_at) / 1000) + 3600);
    if (expires < Math.floor(Date.now() / 1000) + 1800) throw new Error("Invitation checkout window has expired");
    const session = await stripe.checkout.sessions.create({ mode: "payment", ui_mode: "embedded_page", integration_identifier: buildIntegrationIdentifier(), line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: 100, tax_behavior: "inclusive", product: productId } }], metadata, payment_intent_data: { metadata, description: DIAGNOSTIC_LABEL }, expires_at: expires, return_url: `${DIAGNOSTIC_ORIGIN}/private-payment?stripe_attempt=${attempt.id}` }, { idempotencyKey: `cv-diag-stripe-${attempt.id}` });
    assertPrivateStripeSession(session, attempt);
    await save(db, attempt.id, { provider_id: session.id, status: "open", capture_lock_until: null });
    return { id: attempt.id, provider, status: "open", approvalUrl: null, clientSecret: session.client_secret };
  }
  // Stable state is derived from an unguessable invitation and attempt; raw state is never persisted.
  const state = await hashDiagnosticToken(`${token}:${attempt.id}:paypal-return`);
  const returnUrl = `${DIAGNOSTIC_ORIGIN}/private-payment?attempt=${attempt.id}&state=${state}`;
  const order = await paypal("/v2/checkout/orders", "POST", { intent: "CAPTURE", purchase_units: [{ reference_id: attempt.id, custom_id: `${PAYMENT_DIAGNOSTIC}:${attempt.id}`, description: DIAGNOSTIC_LABEL, payee: { merchant_id: PAYPAL_DIAGNOSTIC_PAYEE }, amount: { currency_code: "USD", value: "1.00" } }], payment_source: { paypal: { experience_context: { shipping_preference: "NO_SHIPPING", user_action: "CONTINUE", return_url: returnUrl, cancel_url: `${returnUrl}&cancelled=1` } } } }, `cv-diag-create-${attempt.id}`);
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
  const { data: attempt, error } = await db.from("payment_diagnostic_attempts").select("*").eq("id", input.attempt).eq("invite_id", invite.id).eq("provider", "paypal").maybeSingle();
  if (error || !attempt || input.order !== attempt.provider_id || await hashDiagnosticToken(input.state) !== attempt.return_state_hash) throw new Error("Invalid payment return");
  let order = await paypal(`/v2/checkout/orders/${attempt.provider_id}`);
  let facts = assertPayPalOrder(order, attempt);
  if (facts.paid) { await save(db, attempt.id, { status: "paid", paid_at: attempt.paid_at ?? new Date().toISOString(), capture_id: facts.captureId }); return { status: "paid", approved: false }; }
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
  await paypal(`/v2/checkout/orders/${attempt.provider_id}/capture`, "POST", {}, `cv-diag-capture-${attempt.id}`);
  order = await paypal(`/v2/checkout/orders/${attempt.provider_id}`);
  facts = assertPayPalOrder(order, attempt);
  await save(db, attempt.id, { status: facts.paid ? "paid" : "pending", ...(facts.paid ? { paid_at: new Date().toISOString(), capture_id: facts.captureId } : {}) });
  return { status: facts.paid ? "paid" : "pending", approved: false };
}
export async function applyPrivateStripeDiagnostic(db: any, event: any) {
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
  if (!related || session.metadata?.payment_diagnostic !== PAYMENT_DIAGNOSTIC || session.metadata?.diagnostic_attempt !== attempt.id || session.amount_total !== 100 || session.currency !== "usd" || session.mode !== "payment" || session.subscription) throw new Error("Diagnostic payment facts invalid");
  const status = event.type === "charge.refunded" && obj.refunded === true ? "refunded" : session.payment_status === "paid" ? "paid" : session.status === "expired" ? "expired" : "pending";
  const result = await db.rpc("apply_diagnostic_stripe_event", { p_event: event.id, p_attempt: attempt.id, p_object: session.id, p_type: event.type, p_status: status });
  if (result.error || result.data !== true) throw new Error("Unable to record diagnostic event");
}