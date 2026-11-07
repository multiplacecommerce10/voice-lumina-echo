# Private post-form USD 1 payer diagnostic

The mother is the payer; Tecendo Som is the merchant. This is not course admission. No pedagogical approval, account creation, membership, course emails, marketing or abandoned-cart recovery runs in this path. No new provider objects or captures were created during implementation.

## Private access and data
- `/private-payment` requires a 256-bit invitation supplied in the URL fragment, removed from the address after loading and held in same-origin session storage for PayPal return. Tokens never appear in this report, source or GitHub.
- Database stores SHA-256 invitation hash, expiry and revocation only. Invitations expire in 24 hours and can be revoked by setting `revoked_at` through the privileged backend. They confer no admin rights.
- The exact shared enrollment fields and schema are reused. All answers are validated in memory, not stored in any table or browser profile cache, and never submitted to normal leads.
- Service-only tables and RPCs have explicit grants, RLS, no anon/authenticated access. Each invitation/provider has one unique reserved attempt. Atomic creation/capture claims and stable provider idempotency keys prevent concurrent duplicates. A failed creation can only retry the same key within one hour; no indefinite recreation.
- Minimal state: consent version/time, validation time, provider/order identifiers, status and reconciliation evidence. No payer PII retained by the app. Invitation/return state can be removed after expiry; provider payment evidence should be retained only as needed for reconciliation. No automated financial-evidence deletion was introduced.

## PayPal
- A new live CAPTURE order for exactly USD 1.00 is created only after the valid form, consent and payer click. The previously prepared order is not reused or captured.
- Approval returns to the site; it is not a payment. The separate **Pay US$1** button sends a same-origin, token/state/order-bound capture request. Tools never trigger this button or capture endpoint.
- Before and after capture, GET verifies intent, one purchase unit, exact USD amount, bound reference/custom marker and the merchant verified from the existing live account. A pending capture is never paid; only COMPLETED order + COMPLETED exact capture is paid. Cancelled attempts cannot capture.
- Current subscription webhook remains unchanged. PAYMENT.CAPTURE events do not enter subscription state, emails or membership. Diagnostic receipt is verified directly through the PayPal API.

## Stripe tax: concrete blocker
At implementation time the connected live account returned country **BR**, charges_enabled true, and HTTP **400** for both `/v1/tax/settings` and `/v1/tax/registrations`: “Stripe Tax isn't yet supported for your country.”

No automatic_tax, registrations, tax code/exemption decision or fee above USD 1 was configured. Requested tax collection is unresolved, so the private Stripe button and server creation action are blocked before reserving/creating a session. Existing embedded checkout remains intact; implementing an active private Stripe session requires the owner's resolved tax treatment. No dormant bypass/session-creation switch exists.

Signed Stripe diagnostic events still audit before course lifecycle. Linked diagnostic events additionally verify their stored session/PaymentIntent relation through Stripe, exact USD 100 minor units and payment mode before atomically updating diagnostic status/event deduplication. Unmarked events retain the normal course flow. Legacy unlinked diagnostics remain audit-only.

## Checks and limits
- Shared-form validation, expired/revoked invitation, origin/CSRF, incorrect provider facts, return binding, cancellation, pending capture, repeat/concurrent creation/capture tested with mocks. Database reservation tested with five concurrent requests: exactly one diagnostic attempt, then revoked; no provider calls.
- Real browser: invitation required, invalid form rejected, valid fictitious form + consent enabled PayPal and kept Stripe blocked; no checkout button was pressed. Desktop/mobile fit checked.
- Real live buyer approval/capture is intentionally untested and awaits the mother. This single-payment diagnostic does **not** test subscriptions, renewal, grace, admission or enrollment. Provider receipts and fees may occur; payer total remains USD 1.
- Basic security scan reported no issues; deep analysis was not run.

## Delivery evidence
- Local implementation commit: `c45fc90`. Existing GitHub backup branch updated without changing main at `38f34c93dd6d8c7bc52570edae5a712320730200`; all 18 changed/new files returned exact staged blob hashes by GET.
- Verified blobs: private server `a41c0b8026a1df5fd349bbd7b037d6b53d47a32d`; private route `547357a9a0f2589b1b01ec3b1ad075abd0de92ca`.
- Final new mocks: 13 passed / 83 assertions; signed webhook safety: 11 passed / 77 assertions; payment safety 43 passed; checkout handler 10 passed; PayPal lifecycle/hardening 195 passed; catalog/contract scripts passed. Requested typecheck clean and automatic build OK.
- One 24-hour private invitation generated; no financial objects associated with it. A separate revoked synthetic invitation verified database concurrency only.
- Publication requested once. Subsequent live check: homepage 200, unsigned PayPal live 401, unsigned Stripe live 400, but `/private-payment` still 404 and the invited form did not render. Therefore the corrected deployment is **not confirmed**, and the invitation must not yet be represented as a working published payment link. No retry publication was issued.
- Database SELECT 1 succeeded; all three diagnostic tables have RLS enabled. No existing course records modified.