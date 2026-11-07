# Shared birth date usability

- Replaced only the shared enrollment DOB input with native Day/Month/Year selectors; DOM marker `data-birth-date-control="selects-v1"`.
- Hidden `birthDate` preserves YYYY-MM-DD; initial profile and session recovery restore controlled selectors. Existing profile schema and database mapping are unchanged.
- Required controls have visible labels, 44px minimum height, ordered keyboard focus, inline error association and first-select validation/error-summary focus. Impossible selections are retained for validation, not silently rolled forward.
- Seven date contract tests (10 assertions) passed; 44 existing private form/payment/grant/webhook mock tests passed independently (no live effects).
- Chromium checks at 320px, 390px and 1280px confirmed restored leap date, ISO serialization, tap dimensions, keyboard order, invalid/required errors and focus. All server-function requests were intercepted; no real profile was saved and no checkout or email was triggered.
- Automatic build reports OK. Manual build/typecheck is not run under the project's harness rules. No actual iOS/Android device keyboard testing is claimed.
- No invitations, payment rules, accounts, server logic or database changes.