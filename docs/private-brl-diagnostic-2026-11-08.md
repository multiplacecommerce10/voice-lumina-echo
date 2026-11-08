# Separate private BRL diagnostic

- Existing USD invitations, provider objects and six recurring course plans are unchanged. PayPal remains USD only.
- New BRL invitations are Stripe-only, one-time 100 BRL minor units, no FX or automatic tax. Exact isolated product: `conscious_voice_private_guest_brl`; price lookup key: `conscious_voice_private_guest_brl1`.
- Invitation currency/amount/provider scope and attempt currency/amount are immutable. Reservation locks the invitation and copies the offer; a trigger also rejects mismatched direct writes. No client-selected currency or amount is accepted.
- Signed webhook classification distinguishes the BRL marker; fulfillment retrieves the bound Stripe session and verifies live mode, marker, attempt, object relationship, exact amount/currency, payment mode and tax/discount facts. Metadata alone cannot grant access. Pending sessions never grant.
- Courtesy still begins at the first confirmed payment, lasts seven days, is deduplicated by invitation, and preserves existing memberships/passwords. All twelve answers remain service-only with existing consent and immutable recipient. Welcome confirmation uses the invitation's actual currency; outbox and recovery remain unchanged.
- Explicit anonymous/authenticated grants on legacy diagnostic evidence tables were revoked after the rollback fixture detected them. Existing service-only RLS already restricted reads; explicit revokes now provide the additional required barrier.
- Verification: 61 mock tests pass across five isolated runs, including BRL/USD paid and pending flows, amount/currency/mode/session/marker rejection, PayPal guard, race/idempotency, signed/unsigned webhook gates, storage and courtesy retries. A rolled-back hosted fixture verifies immutable offers, USD PayPal preservation, all-answer roundtrip, unpaid isolation, exact seven-day courtesy and two deduplicated outbox entries; no delivery worker is invoked.
- No actual checkout session, order, charge, capture, user or email is created during verification. Invitation tokens and personal data must not enter source, documentation or the audit branch.

Publication marker: `data-private-brl-version="private-guest-brl1-bound-v1-20261108"`. Layout remains `concise-v1`.

Additional regressions: 10 checkout-handler tests, all catalog assertions and 195 PayPal lifecycle checks pass. Automatic compilation reports build OK. Browser fixtures verify BRL/USD cards and mock-save consent/provider selection; no real save or checkout is performed.

Deployment gate remains unresolved: publication requested twice, but final custom-domain reads still lack the BRL marker and Stripe live price lookup returns no BRL price. Stripe live onboarding itself is complete. No new invitation has been created; issuance must wait for both deployed-code and catalog confirmation. Audit snapshot f7381f25e0448f53531b7d381defd6d84b37606d contains 18 verified files, main unchanged.