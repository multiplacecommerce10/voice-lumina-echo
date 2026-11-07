# PayPal integration — hardening report (review of 8a60f6a)

Date: 2026-10-21. Status: **preview only, not published, no charge made, no email sent, no PayPal panel changes.**
PayPal checkout stays hidden until all three secrets of an environment exist (`paypalConfig(env).complete`).

## Blockers fixed

| # | Finding | Fix | Files |
|---|---------|-----|-------|
| 1 | `runPayPalEffect` reset existing users' passwords | Removed entirely. New account: `createUser` **without password** + one-time recovery link (`generateLink type=recovery` → `/reset-password`). Existing account: "password has not been changed", sign in or "Forgot password?". No password ever in email. | `paypal-state.server.ts`, `paypal-emails.ts` |
| 2 | Intent `custom_id` reusable by several subscriptions | `bindIntent`: `UPDATE … WHERE paypal_subscription_id IS NULL` (first subscription wins), called from `registerPayPalApproval` **and** the webhook, whichever arrives first. `validateBinding` rejects `intent_not_bound` / `intent_bound_to_other_subscription`. | `paypal-state.server.ts`, `paypal.functions.ts`, `paypal-lifecycle.ts`, webhook |
| 3 | Old FAILURE after a later successful payment reopened grace/suspended | Failure/suspension events with occurrence ≤ last paid or < current period start → `stale_failure_ignored`. Ordered by PayPal occurrence time, not delivery. | `paypal-lifecycle.ts` |
| 4 | Period from webhook `create_time` / `max(prevEnd, paidAt)` | Periods = `addMonthsUtc(anchor, months·n)` with anchor = PayPal subscription `start_time` (`period_anchor_at`). Sale facts (amount, currency, state, billing_agreement_id, time) re-fetched from `GET /v1/payments/sale/{id}`; mismatch → `rejected:sale_not_confirmed`. | `paypal.server.ts`, `paypal-lifecycle.ts`, webhook |
| 5 | Access ignored `current_period_end` and environment | One rule `isMembershipActive` + SQL `has_active_membership()`: `environment='live' OR courtesy_access`, `active` only while `current_period_end > now()`, grace only while `grace_expires_at > now()`. Used by RLS, member server functions and `paypalHasAccess`. Stripe `evaluateAccess` also bounded by period end. | migration `0010_paypal_hardening.sql`, `membership-access.ts`, `members.functions.ts`, `subscription-state.server.ts` |
| 6 | `/membership` Stripe-only | `/membership?provider=paypal` shows PayPal management (Automatic payments), never calls Stripe. Stripe summary/portal validators accept only `cs_…` ids, so an `I-…` id can never reach Stripe. | `membership.tsx`, `PayPalSubscribeButton.tsx` |
| 7 | Emails inline after save; errors swallowed; `finishEvent` unchecked | Durable outbox: reducer writes `pending_notifications` in the same CAS write as the state → drained into `notification_outbox` (unique `dedupe_key`, insert-ignore) → delivered with lease, backoff, max 8 attempts (`dead`). Event marked processed only after the drain; `finishEvent`/`claimEvent`/`loadIntent` throw on DB error (PayPal redelivers). **Sandbox rows are marked `skipped_sandbox`, never sent.** | `notification-outbox.ts`, `paypal-state.server.ts`, webhook, reconciler |
| 7b | Admission / consent | Checkout requires the lead's recorded human decision `admission_status='approved'` (new "Approve admission" in Admin → Enrollments, refuses when 30 live students are active) and consent matching current `LEGAL_VERSIONS`, accepted < 24h. Intent snapshots the approval; reducer rejects `admission_not_approved`. | `paypal-admission.ts`, `admin-admission.functions.ts`, `admin.enrollments.tsx` |
| 8 | Grace/suspension/cancellation only logged | Persisted notifications (`grace_notice`, `access_suspended_notice`, `cancellation_scheduled_notice`, `payment_failed_initial`) with PayPal-specific emails; refunds recorded for human review (no student email). | `paypal-emails.ts`, `paypal-lifecycle.ts` |

### Courtesy sandbox access (documented)
Existing owner-authorized sandbox seats (`courtesy_…` and `manual_test_…` ids: Historical test recipient, `redacted-contact@example.com`) were flagged `courtesy_access = true` and keep access until their `current_period_end` (13 and 12 Nov 2026). Any other sandbox row (e.g. `stripe-sandbox-test@example.com`) no longer grants access.

### Not changed
Stripe/Wise flows and prices, USD amounts, refund terms, legal identity, secrets, PayPal panel. Stripe still does not check the new admission flag (outside this scope; flag for decision).

## Test evidence (executed 2026-10-21 in the sandbox)

All below are **SIMULATED** (in-memory repositories, mocked PayPal HTTP, no network, no email). **No real sandbox E2E and no live E2E were executed** — impossible without PayPal secrets and sandbox plans.

```
$ bun run scripts/paypal-lifecycle-test.ts
paypal lifecycle: 177 passed, 0 failed        (125 previous + 52 new in scripts/paypal-hardening-test.ts)

$ bun run scripts/checkout-catalog-test.ts     → ALL CATALOG TESTS PASSED
$ bun run scripts/pending-enrollments-test.ts  → PASS
$ bunx tsgo --noEmit                           → no errors
$ bun run scripts/webhook-contract-test.ts     → 2 CONTRACT TEST FAILURE(S)
```

New tests cover: no `updateUserById`/no password in emails [1]; bound-to-other / unbound / concurrent bind with 5 racers, exactly one winner [2]; stale failure after recovery, stale suspension, late cancellation after/within period [3]; Jan 31→Feb 28→Mar 31→Apr 30, leap Feb 29, 3-month Nov 30, late (+5 d) and early (−2 d) renewals, order-independent renewals, sale facts override [4]; live-only, courtesy, expired period without scheduler, grace boundary, reconcile never extends canceled, SQL text [5]; PayPal branch in /membership, Stripe validators [6]; crash between outbox insert and state save, no duplicates, backoff retry, exactly-once delivery, sandbox never sends, admission/consent [7]; persisted grace/suspension/cancel notices without duplicates [8].
Concurrency of `bindIntent` is modelled in memory; its atomicity in production relies on Postgres row-level `UPDATE … WHERE paypal_subscription_id IS NULL` (not exercised against the live database).

### The two contract failures are pre-existing
Ran the same test on the tree of commit `e6ce5cd` (parent of 8a60f6a, via `git archive`): identical output, `diff` empty:
```
FAIL  stripe webhook still forwards to Taskade unconditionally
FAIL  enrollment still forwards to Taskade unconditionally
```
They assert Taskade forwarding, which the owner disabled before the PayPal work.

## Endpoints (verified by real HTTP POST today)

| Env | URL | Result now |
|-----|-----|-----------|
| sandbox | `https://project--dbe22066-d05e-4f22-8001-7d583efc712e-dev.lovable.app/api/public/paypal/webhook/sandbox` | **503 "Not configured"** — route reachable, waits for secrets |
| live | `https://consciousvoice.tecendosom.com/api/public/paypal/webhook/live` | 404 — exists only after an authorized publish |

(`id-preview--…` returns 401 to external callers, so it must not be given to PayPal.)

## Required secrets (exact names; add in Project Settings → Secrets, never in chat)

- Live: `PAYPAL_LIVE_CLIENT_ID`, `PAYPAL_LIVE_CLIENT_SECRET`, `PAYPAL_LIVE_WEBHOOK_ID`
- Sandbox: `PAYPAL_SANDBOX_CLIENT_ID`, `PAYPAL_SANDBOX_CLIENT_SECRET`, `PAYPAL_SANDBOX_WEBHOOK_ID`
- Sandbox also needs six sandbox plan ids added to `PAYPAL_PLANS.sandbox` (live ids are rejected in sandbox).

## Panel findings (owner) and what will need specific authorization later
Live "Default App" uses the previous client id, **Subscriptions unchecked, no Live Webhooks**; sandbox "Default Application" also without Subscriptions/Webhooks. Nothing was enabled. When authorized: enable Subscriptions on the chosen app, create a webhook to the URL above subscribed to the events in `PAYPAL_HANDLED_EVENTS`, and copy its Webhook ID into the matching secret.

## Remaining blockers
1. PayPal secrets per environment (owner).
2. Sandbox plans for real sandbox E2E (owner).
3. Publication of the live endpoint (explicit authorization).
4. Decide whether Stripe should also require the admission approval.

## Configuration resumed — 2026-10-21, 23:41 UTC request
- Name-only secret inventory confirmed `PAYPAL_SANDBOX_CLIENT_ID` already saved. The secure form subsequently confirmed storage of `PAYPAL_SANDBOX_CLIENT_SECRET`; no credential values were shown.
- Rechecked the documented sandbox URL with an empty HTTP POST before requesting the secret: **503 `Not configured`**. The route is accessible, but this is not proof of PayPal signature verification or payment E2E.
- `PAYPAL_SANDBOX_WEBHOOK_ID` and all three live secrets remain missing. Six genuine sandbox plans remain required.
- Subscriptions/webhook changes await specific owner authorization; no PayPal panel options were enabled, no publication, payment or email performed.
- 2026-10-22, 01:05 UTC: owner reports the value last pasted into the Client Secret form may actually be the Client ID. Secure storage confirmation does **not** establish credential validity; correction is required before authenticating to PayPal.
- Reopened the secure update form with explicit Secret → Show guidance; the tool confirmed a replacement was saved. No values were inspected and no PayPal authentication test has yet verified the replacement.

## Sandbox webhook diagnosis — 2026-10-22, 01:40 UTC
Evidence executed (no publication, charge, email, panel change or code change to verification):
- External `POST {}` to the dev URL: **HTTP/2 503**, `text/plain;charset=UTF-8`, body `Not configured`, no redirect (http:// → 301 to https). Trailing slash and missing content-type: same 503. GET/HEAD/PUT/OPTIONS return the HTML app shell (200) — a GET proves nothing.
- `id-preview--…`: 401 `Unauthorized` (platform gate, never give to PayPal). Official domain `/api/public/paypal/webhook/sandbox`: 404 (not published).
- Localhost `POST {}`: **401 `Invalid signature`** → the local runtime sees all three sandbox secrets (presence-only check: `PAYPAL_SANDBOX_CLIENT_ID`, `PAYPAL_SANDBOX_CLIENT_SECRET`, `PAYPAL_SANDBOX_WEBHOOK_ID` present; all three live absent).
- Worker logs (last hour) for the dev URL: every POST → 503 `Not configured`, served by preview build `a0170409`. **No 501 response appears in the logs**; the reported 501/empty body was not reproduced and did not come from this handler.

Confirmed causes:
1. **Client ID and Client Secret are stored in each other's slots.** Read-only OAuth: stored order → `401 invalid_client`; swapped order → `200` token (sandbox host). Live host rejects them (they are sandbox credentials). A local POST with PayPal-style headers returned `500 Verification unavailable` with log `PayPal sandbox OAuth failed: HTTP 401`. Every real signed event would fail until fixed.
2. **The hosted dev build (`a0170409`) predates the saved secrets**, so its runtime sees an incomplete config → 503. Needs a new preview build after the secrets are corrected.

Read-only sandbox account facts (using the corrected order only for this diagnosis): one webhook exists, URL exactly the dev sandbox URL above, its id equals `PAYPAL_SANDBOX_WEBHOOK_ID`, subscribed to all 13 subscription/sale events. **Sandbox billing plans: 0.**

Hypothesis (not confirmed): the 501/empty result came from the PayPal dashboard/Webhooks Simulator rather than our endpoint. Per PayPal docs, simulator events are mock and cannot be validated by `verify-webhook-signature`; once configured, our endpoint will correctly answer **401 Invalid signature** to them. That is expected and must not be bypassed.

Remaining:
1. Owner swaps the two values in Project Settings → Secrets (`PAYPAL_SANDBOX_CLIENT_ID` ← the "Client ID", `PAYPAL_SANDBOX_CLIENT_SECRET` ← the "Secret").
2. New preview build, then re-test: unsigned POST must return 401; OAuth must return 200.
3. Create six sandbox plans (sandbox product, same USD prices/cycles), add ids to `PAYPAL_PLANS.sandbox` — needs owner go-ahead for creating sandbox catalog objects.
4. Real sandbox E2E with a sandbox buyer account (no real money) → genuinely signed events.
