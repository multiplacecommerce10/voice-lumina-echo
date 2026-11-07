# Concise private invitation presentation

- Preserves logo, existing semantic palette, typography and cyan card border. Uses a display-only Special Guest heading and one price highlight; provider catalog labels and validation are unchanged.
- Storage permission still covers all private answers plus consent before checkout. Payment permission still authorizes a single US$1 payment through the selected provider without renewal. Copy is shortened without changing scope, so the existing server-recorded consent version remains unchanged; no backfill or invalidation is required.
- Existing five mock suites: 51 passing tests, zero failures. Automatic compilation reports build OK; no manual build or typecheck was run.
- Browser fixtures at 320px, 390px and 1280px: no horizontal overflow; storage consent gate retained. A fictitious complete form with intercepted server responses reaches the payment chooser, whose authorization gate remains intact. No real save or provider action occurs.
- Expiry uses the browser's local timezone with explicit timezone abbreviation, month name, year and minute precision; the original ISO timestamp is retained in the time element.
- Audit branch backup covers the three changed source files with full hash readback. Main remains unchanged. Financial records, invitations, stored answers, grants and outbox are untouched.
- Public verification uses the concise-v1 main marker without an invitation; visual verification uses the published assets with a fictitious invitation response only.