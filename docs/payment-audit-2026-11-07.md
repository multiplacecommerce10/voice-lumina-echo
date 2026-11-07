# Payment safety audit — 2026-11-07

## Scope and safety

Owner authorization: inspect and correct existing payment code; preserve automatically renewing subscriptions charged for the full selected 1/3/6-month period up front. No publication, financial live tests, customer subscription changes, refunds, real email sends, new secrets or catalog changes were performed. API calls were OAuth authentication and GET reads; endpoint probes were unsigned `{}` only. No valid synthetic events were sent to a hosted endpoint. Secrets/tokens and customer data are excluded from this report.

Inspected `AGENTS.md`, current payment modules, tests, deployed endpoint responses and configured secret names. Source baseline: `82dbef3`. Today's evidence below is separate from historical reports.

## Evidence collected today (UTC)

### Runtime configuration — 03:25:08

All eleven server settings were present both in the secret listing and execution environment:

- `STRIPE_LIVE_API_KEY`, `STRIPE_SANDBOX_API_KEY`, `LOVABLE_API_KEY`.
- `PAYMENTS_LIVE_WEBHOOK_SECRET`, `PAYMENTS_SANDBOX_WEBHOOK_SECRET`.
- `PAYPAL_LIVE_CLIENT_ID`, `PAYPAL_LIVE_CLIENT_SECRET`, `PAYPAL_LIVE_WEBHOOK_ID`.
- `PAYPAL_SANDBOX_CLIENT_ID`, `PAYPAL_SANDBOX_CLIENT_SECRET`, `PAYPAL_SANDBOX_WEBHOOK_ID`.

`VITE_PAYMENTS_CLIENT_TOKEN` is a public build setting, not a listed secret: development classified as **pk_test**, production as **pk_live**. No key value was printed. This confirms local build configuration, not the exact token embedded in an independently published deployment.

### Stripe Live — GET reads, 03:28:10

Six prices returned active, `livemode=true`, USD, `type=recurring`, monthly intervals with count 1/3/6 matching the catalog. No prices were created or edited.

| Tier | Months per full charge/renewal | USD | Lookup key |
|---|---:|---:|---|
| Live | 1 | 147.00 | live_sub_1m_v1 |
| Live | 3 | 418.95 | live_sub_3m_v1 |
| Live | 6 | 793.80 | live_sub_6m_v1 |
| Complete | 1 | 197.00 | complete_sub_1m_v1 |
| Complete | 3 | 561.45 | complete_sub_3m_v1 |
| Complete | 6 | 1063.80 | complete_sub_6m_v1 |

Two webhook registrations returned **enabled**, both version **2025-03-31.basil**:

- App: `https://project--dbe22066-d05e-4f22-8001-7d583efc712e.lovable.app/api/public/payments/webhook?env=live`.
- Lovable payment analytics: `https://api.lovable.dev/projects/dbe22066-d05e-4f22-8001-7d583efc712e/payments-webhook/live`.

Both retained unchanged: these have separate app-state/analytics responsibilities, not evidence of duplication. Existing SDK `stripe@22.3.0` / API `2026-06-24.dahlia` pairing also retained. Source already supports subscription-item periods with pre-item fallback; endpoint payload versions must not be blindly changed to the outgoing SDK version.

### PayPal — 03:25:08–03:25:12

Live and sandbox OAuth both returned **200**. GET of all **12 plans** returned **200/ACTIVE**. Each has one regular billing cycle, USD amount equal to the table above, `MONTH` count 1/3/6, and `total_cycles=0` (unlimited automatic renewals). IDs match `src/lib/paypal-plans.ts` in their respective isolated environments; no live ID is reused in sandbox.

Both configured webhook records returned **200**:

- Live: `https://consciousvoice.tecendosom.com/api/public/paypal/webhook/live`.
- Sandbox: `https://project--dbe22066-d05e-4f22-8001-7d583efc712e-dev.lovable.app/api/public/paypal/webhook/sandbox`.

Both include these 13 events: `BILLING.SUBSCRIPTION.CREATED`, `ACTIVATED`, `UPDATED`, `RE-ACTIVATED`, `CANCELLED`, `EXPIRED`, `SUSPENDED`, `PAYMENT.FAILED`; `PAYMENT.SALE.COMPLETED`, `PENDING`, `DENIED`, `REFUNDED`, `REVERSED` (prefixes apply to each grouped item).

### Unsigned endpoint probes — 03:25:13–03:25:14; app Stripe URL 03:28:20

Every request was POST `{}` without signature, `Content-Type: application/json`. No redirect occurred on the tested URLs.

| Origin | Path (both live and sandbox tested) | HTTP | Response content type / body |
|---|---|---:|---|
| consciousvoice.tecendosom.com | /api/public/paypal/webhook/{environment} | 401 | text/plain;charset=UTF-8 / Invalid signature |
| project--dbe22066-d05e-4f22-8001-7d583efc712e-dev.lovable.app | /api/public/paypal/webhook/{environment} | 401 | text/plain;charset=UTF-8 / Invalid signature |
| consciousvoice.tecendosom.com | /api/public/payments/webhook?env={environment} | 400 | text/plain;charset=UTF-8 / Invalid signature |
| project--dbe22066-d05e-4f22-8001-7d583efc712e-dev.lovable.app | /api/public/payments/webhook?env={environment} | 400 | text/plain;charset=UTF-8 / Invalid signature |
| project--dbe22066-d05e-4f22-8001-7d583efc712e.lovable.app | /api/public/payments/webhook?env=live | 400 | text/plain;charset=UTF-8 / Invalid signature |

No 404/HTML or 503 was observed. Stripe deliberately uses 400 and PayPal 401 for unsigned calls. These prove routing/rejection only, **not successful signed payment processing**. The existing Stripe handler records inbound audit failures, so its unsigned probes may append diagnostic audit records; they do not grant access or change customer subscriptions.

### GitHub — current connection differs from earlier zero-repository finding

Existing **Priscila's GitHub API** connection is accessible and linked to the project. `/user/repos` returned HTTP 200 with three repositories, including `https://github.com/multiplacecommerce10/voice-lumina-echo` (other visible repositories: Hostinger-projects and Loveaboe-projects).

This verifies API visibility, **not the project Git-sync linkage/status**. Local remotes are platform storage, not a GitHub URL. No tool available in this session exposes authoritative Git-sync status. Confirm this exact repository under Project settings → Git; no reconnect was attempted. This request's local commit saves the code but is not proof of successful GitHub delivery.

## Corrections and reproduction

Before changes, local fixtures reproduced all three inappropriate access grants: live active row without period end, sandbox active row without courtesy, and live grace row without grace end. A locally signed fixture with `t=NaN` and live event in sandbox was accepted by the previous verifier. After changes the same reproduction rejected all four. Fixtures never reached a hosted webhook.

- `src/lib/checkout-validation.ts`: exact catalog validation for active recurring price, lookup key, USD minor-unit amount and month/count; shared approved-only admission/current consent predicates reused from PayPal.
- `src/lib/payments.functions.ts`: real UUID lead required, server lookup of lead/email/admission, fail closed on lookup error or missing approval/current consent before Stripe session creation; verified lead email replaces client-provided recipient. Automatic full-period renewal remains unchanged. Current lookup keys now resolve tier in `getSubscriptionSummary`.
- `src/lib/stripe.server.ts`: finite numeric timestamp/5-minute skew check, SDK async secure signature verifier with SubtleCrypto, strict event `livemode`/environment match before returning the event.
- `src/lib/subscription-state.server.ts`: `evaluateAccess.active` delegates to `isMembershipActive`; bounded live/courtesy rule now matches the migration SQL. Explicit courtesy remains eligible only until its valid deadline. `refund_review` no longer bypasses the SQL rule.
- Existing contract fixtures now specify valid dates and explicit courtesy/live eligibility. Two old Taskade assertions were stale before this work; updated to assert the decommissioned delivery is not called, without changing delivery code. PayPal missing-config test now isolates the missing webhook setting rather than depending on actual live settings being absent.

No migration, student record, approval decision, billing terms, provider credentials or email template was changed.

## Tests executed

- `bun test scripts/payment-safety.test.ts`: **43 pass**, zero failures (exact six amounts/cycles, divergence rejection, admission/consent, access/date/courtesy parity, locally signed Stripe fixtures).
- `bun test scripts/checkout-handler.test.ts`: **10 pass**, zero failures. Real server handlers use RPC/provider/database mocks; invalid lead/price/consent never calls session creation or lead update; valid mock preserves renewal and verified email; current tiers resolve.
- `bun scripts/checkout-catalog-test.ts`: **45 assertions pass**.
- `bun scripts/webhook-contract-test.ts`: **135 assertions pass**; baseline had two obsolete Taskade assertions failing before edits.
- `bun scripts/paypal-lifecycle-test.ts`: **195 assertions pass**, including `paypal-hardening-test.ts` imported runner. Standalone hardening file merely exports its runner and is not a separate executed suite.
- `bunx --package @typescript/native-preview tsgo --noEmit`: clean.
- Automatic preview diagnostics: latest observed **build OK**, 03:27:47 UTC; no manual build invoked.
- `git diff --check`: clean.

## Limitations and concrete next steps

1. **Database access resumed — owner-confirmed evidence at 04:29:21 UTC.** Earlier read failures remain historical evidence, not the current status. After access through Edge, the owner reported successful external `SELECT 1 AS connection_ok`, inspected deployed `has_active_membership()` and confirmed live OR explicit courtesy access, active with a valid future period end, and grace/past_due_grace with a future grace deadline. Reported aggregates: six PayPal sandbox pending rows without period end (unpaid, expected); three Stripe sandbox active rows, two with courtesy access and one with an expired period; no live rows. These are owner-supplied read results, not fresh reads independently executed in this snapshot task. Row status alone does not grant access: the shared code/SQL predicate still evaluates environment, courtesy and deadlines. No rows, dates, approvals or subscriptions were modified.
2. **No buyer E2E executed.** Historical sandbox reports created plans/approval links, but buyer approval and signed-payment fulfillment were not proven. Today's OAuth/GET/probes do not close that gap. Next: authorized sandbox Personal buyer approval of a fresh, approved test lead/intent, with real email delivery disabled, then verify received signed event, persisted lifecycle, idempotency and no live membership grant.
3. **Admission is intentionally fail-closed.** New captured leads do not automatically become approved. Confirm an owner-reviewed admission exists before checkout; no pedagogical decision was inferred or changed.
4. **Production still has pre-correction code.** This request did not publish. After SQL/state verification and sandbox E2E, obtain explicit publication authorization; then recheck production rejection and approved checkout with non-financial validation only.
5. **Git sync is not established by the available evidence.** At 04:31 UTC the existing GitHub API connection returned the requested public repository and only `main`, at `38eb31edd51f17e29e2d895bc3e3158b3414fa7f`; local HEAD was `23931c7`, containing audit commit `8d1ea55`. Local remotes are platform storage and the remote tree does not contain the current audit files. Authoritative UI sync status is unavailable; no reconnect or permission change was attempted. The owner authorized a reversible API snapshot on `audit/payment-safety-2026-11-07`, parented to the existing remote commit, without modifying `main` or publishing.
6. Existing Stripe email delivery path remains inline Hostinger calls in the legacy webhook, unlike the durable PayPal outbox. No valid events/email delivery were exercised and this path was not changed in this focused request. A separate safe migration/contract review is needed before claiming durable notification parity across providers.

Historical claims that live secrets were missing are superseded by today's presence/API results; historical claims of sandbox readiness do not establish buyer E2E completion.

## Sanitized GitHub snapshot — November 7

The backup contains tracked project source/configuration and app assets, not a database export. Environment files with values, repository metadata, private `.lovable`/workspace metadata, dependencies, caches/build outputs, sandbox approval-token documentation and historical send scripts are excluded. Personal admin seed literals and historical personal contact references are removed only from the exported copy; local application code and deployed data remain unchanged. The exported admin migration retains its schema/policies but does not seed personal identities; restoring administrative access requires an explicit owner-approved allowlist setup.

Before upload, inspect every staged path and scan staged text for credential patterns, known non-public environment secret values, approval/resume tokens and personal contact literals without printing values. Public course contact addresses and synthetic example-domain test addresses are retained. Reuse matching remote blobs; create new blobs/tree/commit through the existing gateway connection. The snapshot tree omits excluded remote files as well, but preserves the remote history through its parent commit: old historical contents are not erased by this backup. Verification must GET the final branch and compare Git blob SHA-1 hashes for `checkout-validation.ts`, `stripe.server.ts` and this report. No runtime source changed in this task, so the audit's previously executed tests remain applicable; no new payment or email execution is authorized.