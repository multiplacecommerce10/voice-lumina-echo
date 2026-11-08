/** Persisted reservation survives ambiguous create responses; never rotate an unknown session. */
export async function reserveStripeAttempt(db: any, stripe: any, input: { leadId: string; environment: string; priceId: string; consent: unknown }) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(input.consent)));
  const hash = Array.from(new Uint8Array(bytes), x => x.toString(16).padStart(2, "0")).join("");
  for (let retry = 0; retry < 3; retry++) {
    const { data: attempt, error } = await db.rpc("reserve_stripe_checkout", { p_lead: input.leadId, p_env: input.environment, p_price: input.priceId, p_consent: hash });
    if (error || !attempt) throw new Error("Checkout reservation unavailable; reopen your enrollment link or request assistance.");
    if (!attempt.session_id) return { attempt, session: null };
    const session = await stripe.checkout.sessions.retrieve(attempt.session_id);
    if (session.status === "complete") throw new Error("This enrollment checkout has already been completed.");
    if (session.status === "open") return { attempt, session };
    if (session.status !== "expired") throw new Error("Checkout status could not be confirmed.");
    const { error: closeError } = await db.from("stripe_checkout_attempts").update({ closed_at: new Date().toISOString() }).eq("id", attempt.id).is("closed_at", null);
    if (closeError) throw new Error("Could not close the expired checkout.");
  }
  throw new Error("Checkout is changing; please retry.");
}
