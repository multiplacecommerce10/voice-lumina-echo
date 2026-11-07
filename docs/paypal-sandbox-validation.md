# PayPal Sandbox Validation — 2026-10-22

Scope authorized by the owner: create/connect the six sandbox plans and run tests.
No publishing, no live changes, no real money, no real emails, no secret values exposed.

## 1. Credential authentication (sandbox)

- `PAYPAL_SANDBOX_CLIENT_ID`, `PAYPAL_SANDBOX_CLIENT_SECRET`, `PAYPAL_SANDBOX_WEBHOOK_ID`: present in the secret store (presence-only check; values never printed).
- OAuth `client_credentials` against `api-m.sandbox.paypal.com`: **HTTP 200, token issued (18 scopes)** — the stored credentials authenticate. The earlier 401 on the empty webhook POST only proved presence; this proves authentication.
- Live secrets (`PAYPAL_LIVE_*`): still absent — expected; live is untouched.

## 2. Sandbox catalog (created via API, idempotent with PayPal-Request-Id)

Product: `PROD-4JU04504SG988094R` — "The Power of Conscious Voice — Sandbox" (SERVICE / EDUCATIONAL_AND_TEXTBOOKS).

Six plans, all revalidated by GET (status ACTIVE, USD, REGULAR tenure, total_cycles 0 = unlimited, no trial/setup fee; 5%/10% discounts already embedded in the amounts):

| Plan | ID | Amount | Cycle |
|---|---|---|---|
| Live 1m | P-11M19538U6046553VNLMYWYI | 147.00 USD | every 1 MONTH |
| Live 3m | P-9G316434YE6629704NLMYWYI | 418.95 USD | every 3 MONTHS |
| Live 6m | P-2FK06868YJ502912MNLMYWYQ | 793.80 USD | every 6 MONTHS |
| Complete 1m | P-8R014182FL7802749NLMYWYY | 197.00 USD | every 1 MONTH |
| Complete 3m | P-6YD011175T774454WNLMYWYY | 561.45 USD | every 3 MONTHS |
| Complete 6m | P-88M85339S80335405NLMYWZA | 1063.80 USD | every 6 MONTHS |

Plan IDs are not secrets. Live IDs were NOT reused. The six IDs were added to `PAYPAL_PLANS.sandbox` in `src/lib/paypal-plans.ts`.

## 3. Webhook registration (read-only API check)

- One webhook registered: id `32M47731C9367703S`
- URL: `https://project--dbe22066-d05e-4f22-8001-7d583efc712e-dev.lovable.app/api/public/paypal/webhook/sandbox`
- All 13 required events subscribed (BILLING.SUBSCRIPTION.{ACTIVATED,CANCELLED,CREATED,EXPIRED,PAYMENT.FAILED,RE-ACTIVATED,SUSPENDED,UPDATED} + PAYMENT.SALE.{COMPLETED,DENIED,PENDING,REFUNDED,REVERSED}).
- External empty POST to the endpoint: **HTTP 401 "Invalid signature"** (text/plain, no redirects) — reaches the PayPal handler, config loads, unsigned deliveries are correctly rejected. Previously 503 "Not configured".
- Note: the webhook URL points at the dev/preview host. Before going live, a live webhook must be registered in the live app pointing at `https://consciousvoice.tecendosom.com/api/public/paypal/webhook/live`, and the preview webhook URL should be updated if the preview host changes.

## 4. Tests executed (simulated, deterministic — no network, no PayPal account, no emails)

- `bun scripts/paypal-lifecycle-test.ts` → **195 passed, 0 failed**. Covers: six plan combinations, activation-alone-grants-nothing, exact amount/currency/plan/payee validation, idempotent duplicates, out-of-order and concurrent events, atomic intent binding, old-failure-after-recovery ignored, period anchoring to contractual start (day-31, February, late/early renewal), initial failure, renewal failure, 7-day grace boundary (before/exactly/after), recovery, cancellation, outbox durability, admission/consent gates, sandbox/live segregation (new: sandbox ids invalid in live and vice versa).
- `bunx tsgo --noEmit` → clean.
- One stale test ("no sandbox plans invented") was updated to assert the six real sandbox IDs and environment segregation.

## 5. Not executed / remaining

- **Real sandbox E2E checkout** (buyer approval in the PayPal sandbox UI): not executed — needs a sandbox buyer account. The six checkouts are prepared in code; approval links can be generated on demand. Only a real sandbox subscription produces genuinely signed webhook deliveries; the PayPal Webhooks Simulator is a mock and cannot pass `verify-webhook-signature` postback.
- **Grace-period test against the real database with controlled clock**: covered by deterministic simulation only; DB-integration variant not run.
- **Live environment**: untouched — no live secrets, no live webhook, no publish.
- Taskade contract tests: 2 failures pre-existing on baseline `e6ce5cd` (Taskade forwarding disabled by the owner); unrelated to PayPal.

## 6. Next steps

1. Owner creates/uses a sandbox **buyer** account (PayPal → Testing Tools → Sandbox Accounts) and approves one test subscription per plan (or a subset) — no real money.
2. Verify signed webhook deliveries arrive (PAYMENT.SALE.COMPLETED etc.) and membership activates in the preview.
3. When ready for go-live: create live secrets, register the live webhook on the production domain, enable Subscriptions on the live app, then publish.
