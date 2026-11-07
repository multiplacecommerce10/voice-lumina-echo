# Roadmap — Email notifications (Taskade unified flow)

## Current request — USD 1 live diagnostics (November 7, 2026)
- [x] Isolate signed Stripe diagnostic events and remove existing-account password resets; mocked safety tests, regressions and requested typecheck pass.
- [x] Save ten safe changed/new files to the existing backup branch and verify remote hashes; publish requested once after checks.
- [x] Single verification: homepage 200, unsigned PayPal 401 / Stripe 400. One PayPal order 33F772518X630333V prepared/re-read at USD 1.00, no capture.
- [ ] Confirm corrected deployment — post-request static asset is still the pre-change fingerprint. Stripe session blocked until deployment confirmation and authorized admin session; hosted redirect checkout is not supported by the integration.

## Current request — Reversible GitHub snapshot (November 7, 2026)
- [x] Inspect local state and existing GitHub repository without reconnecting or changing main.
- [x] Record owner-confirmed database recovery and aggregate reads, separating data state from access rules.
- [x] Audit/export 304 sanitized files; backup branch audit/payment-safety-2026-11-07 saved at 88bc377f736af7cec6361622079fe0493fe639b9. GET verified all manifest hashes plus checkout-validation.ts, stripe.server.ts and report against local bytes; main unchanged.
- [ ] Publication deferred to the next authorized stage; do not publish during this snapshot task.

## Current request — Payment safety audit (November 7, 2026)
- [x] Inspect AGENTS.md, current code, runtime secret presence, PayPal OAuth/plans/webhooks and unsigned endpoints.
- [x] Correct Stripe catalog/admission/consent/signature validation, summary tier resolution and membership evaluator parity.
- [x] Run focused mocked tests, relevant regression suites and requested typecheck; record today's evidence and GitHub limitations in docs/payment-audit-2026-11-07.md.
- [x] Owner confirmed database recovery at 04:29:21 UTC, deployed membership SQL and aggregate access state; no records modified.
- [ ] Sandbox buyer E2E remains blocked by owner approval/account; no publication, live financial tests or real emails authorized.

## Current request — Resume PayPal configuration (Oct 21, 23:41 UTC)
- [x] Inspect configured secret names only: PAYPAL_SANDBOX_CLIENT_ID exists; sandbox secret and webhook ID are missing; live credentials are missing.
- [x] Recheck the documented sandbox endpoint: HTTP 503 "Not configured"; endpoint is reachable.
- [x] Collect PAYPAL_SANDBOX_CLIENT_SECRET through the secure form; existing client ID preserved.
- [x] Reopen PAYPAL_SANDBOX_CLIENT_SECRET securely after the reported field mix-up; replacement saved. PayPal authentication validity remains unverified.
- [x] Sandbox webhook ID saved; endpoint now returns 401 "Invalid signature" (configured, rejects unsigned).
- [x] Six real sandbox plans created via API and wired into PAYPAL_PLANS.sandbox (docs/paypal-sandbox-validation.md); 195 simulated tests pass.
- [x] Six sandbox subscriptions created (APPROVAL_PENDING), each bound to a real app intent; links in docs/paypal-sandbox-checkouts.md.
- [ ] Execute sandbox E2E with a sandbox buyer account (owner approves the six links); no real charge or publication authorized.

## Current request — Missing abandoned-cart test
- [x] Confirm the recent test was marked abandoned and recovery delivery was accepted; no repeat sends or status changes.
- [x] Fix the admin pending-enrollment query to include checkout leads whose source is NULL.
- [x] Query regression test passes; existing Historical test recipient test is visible as abandoned in the signed-in admin page; automatic build OK.
- [ ] Publish this panel correction — requires explicit owner approval.

## Current request — Preview failure investigation
- [x] Reproduce the current lesson with the injected member session; placeholder and 52 flashcards load without runtime or HTTP errors.
- [x] Inspect SQLite daemon logs and hosted build diagnostics; identify historical missing optimized dependency chunk and successful latest hosted build.
- [x] Include the two dependencies discovered mid-request in startup optimization to prevent the observed reload/cache failure.
- [x] Verify the preview after the configuration update: automatic build OK at 00:55:17 UTC, authenticated lesson and flashcard navigation pass with no HTTP/runtime errors or mid-request dependency reload.

## Current request — Course and scholarship login branding
- [x] Confirm Historical test recipient's existing Complete courtesy membership through November 13 and stored structure: six modules, eleven lessons, thirteen materials.
- [x] Give the course login its own course branding; reserve scholarship branding for the post-selection flow.
- [x] Verify both login banners, password visibility, signed-out course redirect and successful build; no permission changes or publishing.
- [x] Verify the course signed in as Historical test recipient — six modules, eleven lesson cards and the Module 2 video placeholder rendered; existing credentials remain unchanged.
- [x] Request authorized publication of the normal course login and catalog; basic security checks found no issues (deep code analysis not run).
- [x] Send Historical test recipient one corrected direct course link via Hostinger (204), preserving his password and explaining the pending publication; no other emails resent.
- [ ] Confirm the official catalog after deployment completes — latest post-request check still returned 404; publication completion is outside this turn's control.

## Current request — Further voice scholarship (October 13, second batch)
- [x] Analyze ten uploaded sources, including focused methods/results/limitations from the 259-page MRI thesis; map verified original summaries to the three specialists.
- [x] Append cited knowledge without overwriting approved material; read-back confirms earlier supplements preserved. Exclude uncertain figures, quotations and medical prescriptions.
- [x] Verify saved knowledge and complete source-grounded replies in the signed-in chats, reloaded to confirm persistence; provide fontes-voz-segunda-remessa-13-outubro.md. No publishing or original-document redistribution.

## Member area (this project, not Taskade)
- [x] Migration: class_sessions, foundations_items, session_slots, session_bookings, portfolio_submissions + RLS + has_active_membership() + taken_slot_ids()
- [x] Members read own subscription (RLS policy)
- [x] Student pages /members, /members/classes, /members/foundations, /members/sessions, /members/portfolio
- [x] Admin pages /admin/classes, /admin/foundations, /admin/slots, /admin/portfolios
- [x] Build OK; routes verified login-protected in preview
- [ ] Open: content seeding (classes, Foundations items, slots) by admin via the new pages
- [ ] Open: email reminders for booked sessions (phase 2, via Taskade, owner decision)
- [ ] Not published — awaiting explicit owner approval

## Current request — Scholarship result page (public, personal link)
- [x] Migration: `leads.scholarship_result_token` (high-entropy token, unique).
- [x] Admin server fn `createScholarshipResultLink` (stable token per application).
- [x] Public server fn `getScholarshipResult` (token-gated, minimal fields).
- [x] Public page `/scholarships/result` — under review / accepted letter / not selected.
- [x] Admin `/admin/applications`: "Copy result link" per application.
- [ ] Open: how accepted students complete enrollment with the scholarship applied at checkout (owner decision).

## Current request — Recovery and student details
- [x] Remove repeated course/brand text in recovery email; preserve plan box.
- [x] Restore saved profile and plan, highlight missing required fields, and validate all student details on client/server.
- [x] Verify locally using fictitious data only; no sends, webhooks, payments or publishing.

## Current authorized scope — Email visuals only
- [x] Continue the banner background across all email headers and add a subdued scholarship banner to the application receipt; verified locally without sends or publishing.
- [x] Original full course image, small logo, welcome signature and shared footer; three synthetic models validated locally at desktop/mobile widths. No sends, payment tests or publishing. Previous tasks below are deferred outside this authorization.

Two distinct emails, branched by Taskade on `payment_status` / `enrollment_status`:

- [x] **Recovery email** (lead não finalizou) — `unpaid` / `incomplete` — enviado e validado (Historical test recipient, tentativa 7, HTTP 200)
- [ ] **Confirmation email** (aluno inscrito/pago) — `paid` / `completed` — testar ramo pago no Taskade
  - [ ] Preview/proofread do email de confirmação (/debug/confirmation-email)
  - [ ] Teste do ramo pago no Taskade (payload `paid`/`completed`)
  - [ ] Checkout sandbox completo end-to-end
  - [x] Teste do ramo pago no Taskade — Historical test recipient (Lahore/PK), Complete 6 meses, HTTP 200

- [ ] Publicar site e testar chat publicado
- [ ] GitHub: sincronização sem histórico pesado (depende do menu + > GitHub, ação da usuária)

## Issues do GitHub (voice-lumina-echo)
- [x] #7 Stripe: env ausente/inválido agora retorna 400 (comentado no issue). Pendente: conferir destinos no Stripe e teste sandbox ponta a ponta.
- [ ] #6 ENV: auditar variáveis de produção e sandbox
- [ ] #2 Supabase: persistência, acesso e segurança
- [ ] #3 Email: confirmações e lembretes via Taskade
- [ ] #1 Teste E2E (bloqueado por #7, #2, #3)

- [x] Teste único matrícula+credenciais para redacted-contact@example.com (autorizado por Priscila)

- [x] Module 1 renamed: Foundations of Vocal Technique & Proprioception
- [x] Module 2 lesson with video placeholder + 52 NotebookLM flashcards

## Current request — OCR inconsistency audit
- [x] Check all ten new PDFs, including Miller pp. 51–54, prior OCR review and current specialist knowledge; distinguish extraction errors from interpretations.
- [x] Deliver a cited review list in the existing review collection without adding unapproved passages or publishing.
- [x] Remove the two contradictory old infographic summaries; read-back confirms both removed and verified supplements retained.

## Previous request — Additional scholarly sources
- [x] Analyze ten uploaded articles and associate cited pedagogical summaries with each specialist.
- [x] Keep disputed OCR numbers and quotations outside the new active knowledge pending owner review.
- [x] Verify saved knowledge and one source-grounded answer per specialist through the signed-in UI; replies persisted. No publication or source-PDF redistribution.

## PayPal (Oct 21)
- [x] Allowlist 6 live plans, retired IDs history-only, server intent binding lead+consent
- [x] Dedicated webhook /api/public/paypal/webhook/{live|sandbox}, signature verify, idempotency, lifecycle, reconciler, emails
- [x] Simulated tests (125) — scripts/paypal-lifecycle-test.ts
- [x] Review blockers 1–8 fixed (no password resets, atomic intent binding, stale failures, contract calendar, date-bounded live access, provider-aware /membership, durable outbox, persisted notices); 177 simulated tests
- [x] Sandbox webhook diagnosis: CLIENT_ID/SECRET swapped (confirmed by OAuth); hosted dev build predates secrets; webhook registered OK; 501 not from our handler
- [x] Sandbox CLIENT_ID/SECRET replaced by owner; OAuth client_credentials returns 200 (18 scopes)
- [x] 6 sandbox plans created (product PROD-4JU04504SG988094R), validated by GET, wired into code; webhook 32M47731C9367703S confirmed with 13 events
- [ ] BLOCKED (owner): real sandbox E2E with sandbox buyer account → then live setup (secrets, webhook on production domain, publish)
- [ ] BLOCKED: live secrets
- [ ] BLOCKED: owner approval to publish
