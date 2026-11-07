# Private guest form storage — v4

Owner authorization supersedes the earlier minimal-profile-only storage restriction.

- All 12 shared enrollment profile fields are saved before payment by the dedicated storage action, with explicit consent and server version/time.
- `payment_diagnostic_grants.form_answers` and `form_saved_at` are private, service-role only. Invitation reads return no answers; provider metadata remains diagnostic identifiers only.
- The atomic save function locks a valid, non-revoked, unexpired invitation and preserves the first saved profile. Same-profile retries are idempotent; a different recipient or changed saved profile is rejected.
- Checkout requires matching saved answers and current consent. Storage errors leave the form in place without opening a provider.
- Saving performs no account creation, email delivery, admission, grant or payment action. Existing seven-day Complete courtesy, paid-only grant and durable retry rules remain unchanged.
- Invitation changes remount the private session; return state is scoped to the invitation. Same-invitation state is retained. Database/network unavailability is not labeled expiration.
- Marker: `private-guest-complete7d-saved-form-v4-20261107`; DOM storage marker: `private-full-profile-v1`.
- No invitations or real tester data belong in this document or the backup branch.

## Verification
- 44 tests passed in four separate groups (8 form storage, 15 diagnostic provider, 10 courtesy/retry, 11 webhook/account safety).
- Real database fixture transaction rolled back: full roundtrip, duplicate save, invalid consent/profile, locked recipient/answers, unpaid isolation, expired/revoked invitations.
- Hosted role checks: RLS enabled; anon/authenticated cannot SELECT or execute the save function; service role can execute. New columns confirmed present.
- Browser with synthetic invitation and mocked RPCs: storage failure retains entered answers and does not advance; retry success shows payment choice without opening providers; a different hash remounts and clears saved/consent/payment state.
- Automatic compilation: build OK. No live invitation was created, revoked, consumed or submitted; no real payment, account or email was created.