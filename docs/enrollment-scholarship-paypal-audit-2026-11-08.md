# Enrollment, Scholarship and private PayPal BRL2 audit — 2026-11-08

## Outcome and boundaries
Partial readiness, not a complete production certification. No existing invitation, courtesy, membership or receipt was deleted/revoked. No real order, checkout session, capture, payment, application, email, account or Taskade message was created by this audit. Database fixtures were rolled back. New PayPal invitation is BLOCKED, not issued.

## Reproduced findings and fixes
| Severity | Evidence / file | Action |
|---|---|---|
| High | `src/lib/enrollment.functions.ts`: lead insert error previously allowed Sheets continuation | Fail closed before external forwarding; Sheets uses RAW to avoid formula interpretation. |
| High | `src/lib/subscription-webhook.server.ts`, `src/lib/subscription-state.server.ts`: canonical invoice-paid path lacked exact current-offer checks | Added `stripe-invoice-validation.ts`: exact USD amount, paid status, environment, subscription, single item/quantity and current catalog. Persisted approved lead, full profile and consent metadata must match before access. Historical keys remain separate, unchanged. |
| Medium | `src/lib/scholarship.functions.ts`: insert and inline receipt could partially fail or duplicate | Stable UUID per form attempt; service-only atomic record plus durable outbox receipt, normalized email, privacy consent and required fields. Submission remains pending, never membership or automatic scholarship approval. |
| Medium | `src/lib/admin-applications.functions.ts`: simultaneous result-link creation could return an unstored token | CAS returns stored winner, including losing caller readback. |
| Medium | `src/lib/leads.functions.ts`: recovery could replace recipient; origin/consent checks missing | Same-origin POST, saved full-profile consent checks, immutable resumed email. |
| Scope addition | `private-diagnostic-rules.ts`, `private-diagnostic.server.ts`, private page and PayPal webhook | Separate immutable PayPal-only BRL200 offer/marker; no retroactive PayPal enablement for Stripe BRL invitations. Exact BRL2.00/payee/order/attempt/state/capture facts; only explicit payer confirmation can capture. New BRL runtime requires managed PayPal connection; existing USD runtime unchanged. |

Migrations 0021–0023 applied; private tables/RPCs remain service-only. New scholarship insert validation also rejects missing/oversized stored fields. No pricing, renewal, refund or admission policy changed.

## Outstanding limitations / blockers
1. **High, PayPal BRL2 activation:** live authentication GET configuration probe succeeded (OAuth HTTP200; webhook GET200), but current webhook does NOT subscribe to PAYMENT.CAPTURE.COMPLETED. Merchant identity read returned401; the expected payee was not independently verified. No connected managed PayPal connection is available. Do not issue an invitation until connection/merchant/BRL receiving capability and capture event delivery are verified. Brazilian Real support is country-restricted; provider documentation alone is not account eligibility proof: https://developer.paypal.com/reports/reference/supported-currencies . No bank refusal is inferred.
2. **High, Stripe durable fulfillment:** `subscription-state.server.ts` still uses read/upsert for counters rather than CAS; concurrent invoices/retries remain a race risk. `api/public/payments/webhook.ts` still sends ordinary Stripe emails inline after state persistence; an email failure can be missed on a duplicate retry. PayPal and courtesy use durable outbox. Not represented as fully resolved.
3. **Medium, official enrollment retry:** Sheets failure after persisted lead can cause duplicate enrollment intent on retry. New ordinary Stripe sessions do not have a stable checkout idempotency key. Recovery update checks errors but not zero-row concurrent status change. These remain documented, not certified.
4. **Medium, public capability actions:** official checkout links rely on lead/session capability identifiers, not an authenticated user/customer metadata.userId association. Exact admission/consent protects access but this is not a complete ownership audit.
5. **Operational, domestic Brazilian cards:** normal six course plans remain USD. The known domestic-card USD restriction is unresolved without owner-approved currency/pricing decisions. No FX or normal BRL plans invented.
6. **Operational, mail:** no Hostinger inbox or actual delivery was tested. New scholarship receipt is queued durably; there is no automatic team notification implementation. No test applicant was approved. Historical Stripe catalog/records were preserved, not newly certified.
7. **DB test environment:** local SQL role cannot invoke private RPCs; privileged tool ran BEGIN/ROLLBACK fixture successfully. Original local BRL regression SQL cannot run under that restricted role; no privileges were widened.

## Verification
- 27 enrollment/scholarship safety tests; 9 new exact Stripe invoice tests; 10 checkout handler tests; 11 new PayPal BRL200 mocks; 21 existing diagnostic tests; 3 Stripe BRL2 tests; 19 saved-profile/courtesy tests passed.
- 43 payment safety tests, 4 PayPal admission tests; 195 PayPal lifecycle checks; catalog and webhook contract suites passed.
- Privileged rolled-back fake fixtures: one scholarship record/outbox per retry, normalized email/pending state/no membership, changed recipient rejected; BRL200 PayPal reservation immutable and unique, Stripe rejected, no anonymous/private RPC execution.
- Browser mock-only:390/1280px PayPal card, approval/read creates no capture, explicit Pay R$2 produces one mocked capture and confirmed UI; no overflow. Scholarship mandatory consent and mocked Application received confirmed. Not actual iOS/Android or real payment/delivery.
- Automatic compilation OK; `git diff --check` clean. Existing leaf metadata retained, index/course and scholarship metadata inspected; no redesign.

## Publication and repository
Authorized publication requested after tests; final domain marker verification is recorded in the completion note. Sanitize backup: source/migrations/tests/report only, no env files, secrets, PII, real invitation tokens or media. Preserve GitHub main at `38eb31edd51f17e29e2d895bc3e3158b3414fa7f`; audit branch only.
