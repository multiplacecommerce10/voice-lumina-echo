# Private post-form USD 1 payer diagnostic

The mother is the payer; Tecendo Som is the merchant. This is not course admission. No pedagogical approval, account creation, membership, course emails, marketing or abandoned-cart recovery runs in this path. The private diagnostic product/one-time price was registered in the managed test catalog for publication sync; no checkout sessions, PayPal orders or captures were created during implementation of this update.

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

## Stripe tax: owner-authorized diagnostic update at 05:14 UTC
At implementation time the connected live account returned country **BR**, charges_enabled true, and HTTP **400** for both `/v1/tax/settings` and `/v1/tax/registrations`: “Stripe Tax isn't yet supported for your country.”

The owner explicitly authorized this private USD 1 test **without automatic tax calculation**. No automatic_tax, registrations, tax code/exemption decision or fee above USD 1 was configured. This authorization resolves the diagnostic creation blocker only, not legal tax obligations or normal course tax handling.

The exact private offer name is **Convidado especial — US$ 1**, independent of `payment_diagnostic=conscious_voice_usd1_v1`. It is used in the private screen, Stripe product and PaymentIntent description and PayPal purchase-unit description. Product sync key `conscious_voice_private_guest` and one-time price lookup key `conscious_voice_private_guest_usd1` are separate from all course keys. Quantity is fixed at one. No recurring plan or publicly linked checkout was added.

After shared form validation, explicit consent and Stripe choice, the server validates the separate product/one-time USD 100 catalog facts, then creates one embedded live payment session with inclusive tax behavior, no automatic tax, no customer creation, no subscription or course lead/tier/package metadata. Session and PaymentIntent carry the marker plus diagnostic attempt id. Expiration is fixed to the reservation's one-hour window, provider idempotency key is stable, and retries reuse the same session. The raw client secret is returned only to the valid invited browser, never in logs, docs or GitHub. After payment, a token-bound read verifies Stripe facts before showing paid. No payment is performed by tooling.

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

### Update checks
- Owner-authorized no-automatic-tax implementation: 14 focused mocks passed, 102 assertions, including exact USD 100 amount/quantity, payment mode, no tax automation/customer/subscription, duplicate/concurrent session protection and independent diagnostic metadata. Browser check covers fictitious form and consent only; no provider choice is clicked by tools.
- Historical blocked/publication evidence above remains historical, not proof of this newer version. Publication and live version checks are recorded separately after the authorized update.
- Updated code local commit `2766f87`, GitHub backup `dd61871be536f95f008111b06f5dced26f216ba8`; all nine updated blobs verified by GET, main unchanged. Server blob `91f6886f44ea17edaac46b99c87854cd24b58b37`, private route `45091a1a1e7999a6ba4ebb158a6244a0b8c7dd92`.
- Post-request live checks: homepage and private invitation page HTTP 200, shared form rendered with valid invitation, PayPal unsigned 401 and Stripe unsigned 400, SELECT 1 succeeded. Live catalog read found one active diagnostic price: one_time USD 100. No provider creation/capture action was invoked.
- Important version limit: published DOM still identified `private-payer-v1-20261107`, not the updated `private-payer-v2-no-auto-tax-20261107`. This proves the previous invitation route is now published, **not** that the newly enabled Stripe/name update finished deploying. Publication was requested once for this update; no repeated deploy was issued.