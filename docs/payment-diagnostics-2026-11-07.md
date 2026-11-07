# USD 1 live diagnostic preparation — November 7, 2026

## Changes and safety evidence

Stripe signature/environment verification remains mandatory and unchanged. Exact marker `payment_diagnostic=conscious_voice_usd1_v1` on signed checkout/payment_intent/charge events enters an audit-only branch before event persistence, lifecycle, lead updates, account work, email or Make forwarding. Live USD/100-minor-unit facts and no subscription/course identity are required; a marked mismatch is audited and rejected. Unmarked events retain normal processing. Session and PaymentIntent must both carry the marker when a diagnostic session is created.

Reproduction against the real webhook with local signed fixtures: baseline 3 pass / 7 fail, including existing-user password mutation. After correction: 11 pass / 0 fail, 77 assertions. Tests spy on actual handler dependencies and include unsigned/forged rejection, signed diagnostic isolation, ordinary-event processing, existing-account preservation and new-account secure links. No hosted synthetic signed event, real email or account mutation was executed.

Stripe access preparation now checks existing users, never sets/resets a password, and creates new users without a password. Only an account created by that event receives a generated choose-password link; existing users receive ordinary sign-in/forgot-password guidance through the existing safe-access builder. This reuses a provider-neutral builder currently named `buildPayPalAccountAccessEmail`.

Regression results: payment-safety 43 tests; checkout-handler 10 tests; checkout catalog and webhook contract suites pass; PayPal lifecycle 195 assertions pass. Requested `tsgo --noEmit` passes; automatic preview reports build OK. Basic security checks found no issues; deep code analysis was not run.

## Stripe checkout limitation and permitted alternative

The platform requires `ui_mode=embedded_page`; a hosted redirect checkout requested in the brief is not supported by the mandated integration. No hosted session will be created as a workaround. A private `/admin/payment-diagnostic?session_id=…` page can instead retrieve a pre-created embedded USD 1 session after authenticated `is_admin()` verification. It cannot create a session or charge anything; only the final provider-controlled Pay button charges. No secret is returned in chat or URLs.

Browser verification: visitor redirects to login. The owner's available minted session is not on the administrative allowlist and sees Access restricted. No permission was changed. Thus actual administrative embedded checkout remains unverified and creation of a live Stripe session is deferred rather than providing an unusable link. A currently authorized administrator must sign in before this flow can be verified; do not add privileges automatically.

## PayPal one-time order

A future diagnostic order uses `intent=CAPTURE`, one purchase unit, USD `1.00`, label `The Power of Conscious Voice — diagnostic payment USD 1`, diagnostic custom_id, no subscription, shipping, saved payment method or course intent. Existing subscription webhook ignores `PAYMENT.CAPTURE.*` after signature verification, before state/outbox processing; no webhook registration changes are needed. Returns point to `/admin/payment-diagnostic`, not membership/checkout fulfillment.

Approval is not capture. After the owner approves, a separately authorized executor must call `/v2/checkout/orders/{order_id}/capture`; no automatic capture executor was added in this task. No capture, confirmation, stored payment method, customer charge or automatic refund is authorized here. Use a fixed attempt-specific PayPal-Request-Id and verify the returned order before exposing its approval URL.

## What this test does not establish

One-time USD 1 transactions do not validate recurring renewal, grace, enrollment, course entitlements or replay eligibility. Provider receipts/notifications and transaction fees may occur. Course catalog prices, subscription configuration and existing customer subscriptions remain unchanged. Existing Stripe ordinary-email delivery remains inline; durable outbox parity is outside this diagnostic change.

## Preparation outcomes — 04:44 UTC

Local code commit: `c77eea7`. GitHub code commit: `73adf03c3965d0a984e5004dfca49aac940a7300` on `audit/payment-safety-2026-11-07`, parent `88bc377f736af7cec6361622079fe0493fe639b9`. Ten changed/new files were individually verified by GET and blob hashes; prior snapshot files were preserved, with 310 files after additions; main remains `38eb31edd51f17e29e2d895bc3e3158b3414fa7f`. Webhook blob hash: `47b8ecc07524ca84f2e0540b0fc92ae5a55698ac`; diagnostic helper: `0ca90390a94ef3554a3d672577e3f745e15ac0f2`; safe account helper: `f9971f9510cf309ae759e5f45aaee1bdcf327c33`.

Publication was scheduled once after tests/basic checks. Single post-request verification at 04:44:27–32 UTC: homepage 200; unsigned PayPal live 401 Invalid signature; unsigned Stripe live 400 Invalid signature. However homepage still served `index-CMHnOlGa.js`, SHA-256 `75268d9aa1c1cf86c7e2214b98a8d24baac74b65fa1a1e7749201a4a233d7ab0`, without the diagnostic route fingerprint. This is the same static asset observed before publication; the corrected deployment is not yet confirmed and no further publication was attempted. Endpoint signature rejection alone does not prove the new isolation branch is deployed. Stripe financial creation is additionally blocked until that deployment can be verified, aside from the supported-checkout/admin restrictions above.

Exactly one PayPal LIVE order was created and re-read: `33F772518X630333V`, `PAYER_ACTION_REQUIRED`, `intent=CAPTURE`, one purchase unit USD `1.00`, exact diagnostic custom_id, no subscription. Idempotency request ID `cv-usd1-20261107-prepare-attempt-1`. Approval URL returned privately in chat; no credentials or approval links are stored in repository documentation. No approval or capture was executed. Owner approval must precede a separately authorized capture call; returning to the site does not capture payment. No Stripe session/product/price/customer was created, and no charge, account mutation or real email was executed by these checks.