/**
 * Daily access reconciliation endpoint (not scheduled yet).
 *
 * Marks subscriptions whose 7-day renewal grace window has expired as
 * `suspended`, so access does not silently stay open when Stripe keeps a
 * subscription in `past_due`.
 *
 * Auth: dedicated bearer secret in `PAYMENTS_RECONCILE_SECRET`.
 * The route lives under /api/public/* only so an external scheduler can
 * reach it — every request is authenticated here.
 */

import { createFileRoute } from "@tanstack/react-router";
import type { StripeEnv } from "@/lib/stripe.server";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function handle(request: Request): Promise<Response> {
  const secret = process.env["PAYMENTS_RECONCILE_SECRET"];
  if (!secret) {
    console.error("[reconcile-access] PAYMENTS_RECONCILE_SECRET is not configured");
    return new Response("Not configured", { status: 503 });
  }

  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || !timingSafeEqual(token, secret)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const rawEnv = new URL(request.url).searchParams.get("env") ?? "sandbox";
  if (rawEnv !== "sandbox" && rawEnv !== "live") {
    return new Response("Invalid env", { status: 400 });
  }
  const env: StripeEnv = rawEnv;

  try {
    const { reconcileExpiredGracePeriods } = await import("@/lib/subscription-state.server");
    const result = await reconcileExpiredGracePeriods(env);
    return Response.json({ ok: true, environment: env, ...result });
  } catch (e) {
    console.error("[reconcile-access] failed:", e);
    return new Response("Reconciliation error", { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/payments/reconcile-access")({
  server: {
    handlers: {
      // Mutating endpoint: POST only (no GET).
      POST: ({ request }) => handle(request),
    },
  },
});
