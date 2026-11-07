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