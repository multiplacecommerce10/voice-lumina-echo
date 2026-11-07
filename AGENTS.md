# Architecture rules

- Build the pending-enrollment list through the shared pending-enrollments query, explicitly including NULL sources; legacy and ordinary checkout leads otherwise disappear under SQL inequality filters.

- Prebundle the router's isServer entry and seroval alongside React/router dependencies at preview startup to avoid mid-request dependency reoptimization and stale chunk failures.

- Course and post-selection scholarship entry routes reuse the same sign-in form and authentication providers; branding never changes membership permissions.

- Keep email header composition and email-safe color tokens in the shared branding builder; individual templates opt into additional banners so common styling remains consistent without changing enrollment behavior.
- Use table cells for email footer logo placement and CDN asset pointers for email imagery; this preserves layout and image availability across mail clients.
- Use the shared enrollment profile schema in client forms and server validators; recovery restores answers into the same profile form before continuing, preventing incomplete profiles from bypassing validation.- Admin pages live under /_authenticated/admin; the layout checks is_admin() and data access relies on admin-only RLS, so team membership is managed via the admin_emails allowlist.
- Transactional emails are sent directly through Hostinger Agentic Mail via src/lib/hostinger-mail.server.ts (one token secret per mailbox); delivery failures are logged and never block enrollment or applications.
- PayPal subscriptions share `member_subscriptions` (provider='paypal'; `stripe_subscription_id` holds the PayPal "I-…" id, `stripe_price_id` the plan id) so membership checks stay provider-agnostic; all PayPal transitions go through the pure reducer in src/lib/paypal-lifecycle.ts with row_version optimistic concurrency, and only a verified PAYMENT.SALE.COMPLETED matching the allowlist (src/lib/paypal-plans.ts), PayPal's own sale record and an intent atomically bound to that subscription grants access.
- Membership access is one date-bounded rule (src/lib/membership-access.ts mirrored by has_active_membership()): live rows or explicit courtesy_access only, active until current_period_end, grace until grace_expires_at; the scheduler never decides access.
- Stripe checkout validates exact recurring catalog facts and the lead's recorded human approval/current legal consent before session creation; both providers reuse the same admission predicates to prevent bypasses.
- Stripe webhook verification uses the SDK async secure verifier with finite timestamps and event/environment parity before processing; preserve the existing SDK/API pairing and both managed endpoints.
- Lifecycle emails go through the durable notification_outbox (pending_notifications written with the state CAS, then drained); never send inline, never send in sandbox, never set or email passwords.
