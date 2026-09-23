# Roadmap — Email notifications (Taskade unified flow)

Two distinct emails, branched by Taskade on `payment_status` / `enrollment_status`:

- [x] **Recovery email** (lead não finalizou) — `unpaid` / `incomplete` — enviado e validado (Tayyab, tentativa 7, HTTP 200)
- [ ] **Confirmation email** (aluno inscrito/pago) — `paid` / `completed` — testar ramo pago no Taskade
  - [ ] Preview/proofread do email de confirmação (/debug/confirmation-email)
  - [ ] Teste do ramo pago no Taskade (payload `paid`/`completed`)
  - [ ] Checkout sandbox completo end-to-end
  - [x] Teste do ramo pago no Taskade — Tayyab Azeem (Lahore/PK), Complete 6 meses, HTTP 200
