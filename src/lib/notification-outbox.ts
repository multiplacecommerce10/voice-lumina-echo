/**
 * Durable, idempotent notification outbox (pure core, I/O injected).
 *
 * Flow: the lifecycle reducer writes `pending_notifications` into the
 * subscription row in the SAME optimistic-concurrency write as the state
 * change. `drainPendingNotifications` copies them into the outbox (unique
 * dedupe_key → ON CONFLICT DO NOTHING) and only then removes them from the
 * row. `processOutbox` delivers due rows with retry/backoff. A crash at any
 * point leaves the notification either in the row or in the outbox — never lost,
 * never duplicated. Sandbox rows are recorded but NEVER sent.
 */
import type { PendingNotification, PayPalStateRepo } from "@/lib/paypal-lifecycle";

export type OutboxKind =
  | "welcome_confirmation"
  | "account_access"
  | "renewal_receipt"
  | "payment_failed_initial"
  | "grace_notice"
  | "access_suspended_notice"
  | "cancellation_scheduled_notice"
  | "refund_review";

export type OutboxInsert = {
  dedupe_key: string;
  environment: "sandbox" | "live";
  provider: string;
  kind: OutboxKind;
  subscription_id: string;
  recipient: string | null;
};

export type OutboxRow = OutboxInsert & { id: string; attempts: number };

/** Expands lifecycle notifications into deliverable outbox rows (one email per row). */
export function expandNotification(
  n: PendingNotification,
  base: Omit<OutboxInsert, "dedupe_key" | "kind">,
): OutboxInsert[] {
  if (n.kind === "welcome_and_access") {
    return [
      { ...base, dedupe_key: `${base.environment}:${n.key}:confirmation`, kind: "welcome_confirmation" },
      { ...base, dedupe_key: `${base.environment}:${n.key}:account`, kind: "account_access" },
    ];
  }
  return [{ ...base, dedupe_key: `${base.environment}:${n.key}`, kind: n.kind }];
}

export async function drainPendingNotifications(params: {
  repo: PayPalStateRepo;
  env: "sandbox" | "live";
  subscriptionId: string;
  /** Must be idempotent on dedupe_key (insert … on conflict do nothing). Throws on failure. */
  insert: (rows: OutboxInsert[]) => Promise<void>;
}): Promise<number> {
  for (let i = 0; i < 10; i++) {
    const loaded = await params.repo.load(params.subscriptionId);
    const pending = loaded?.state.pending_notifications ?? [];
    if (!loaded || pending.length === 0) return 0;
    const rows = pending.flatMap((n) =>
      expandNotification(n, {
        environment: params.env,
        provider: "paypal",
        subscription_id: params.subscriptionId,
        recipient: loaded.state.email,
      }),
    );
    await params.insert(rows);
    const keys = new Set(pending.map((p) => p.key));
    const next = {
      ...loaded.state,
      pending_notifications: (loaded.state.pending_notifications ?? []).filter((p) => !keys.has(p.key)),
    };
    if (await params.repo.save(params.subscriptionId, loaded.version, next)) return rows.length;
  }
  throw new Error("outbox drain: concurrent update retries exhausted");
}

export interface OutboxStore {
  /** Atomically leases due rows (status pending/failed, lease expired). */
  claimDue(now: number, limit: number): Promise<OutboxRow[]>;
  markSent(id: string, now: number): Promise<void>;
  markSkipped(id: string, status: "skipped_sandbox" | "recorded", now: number): Promise<void>;
  markFailed(id: string, error: string, nextAttemptAt: number | null, now: number): Promise<void>;
}

export const OUTBOX_MAX_ATTEMPTS = 8;

export function backoffMs(attempts: number): number {
  return Math.min(6 * 3600_000, 5 * 60_000 * 2 ** Math.max(0, attempts - 1));
}

export async function processOutbox(params: {
  store: OutboxStore;
  deliver: (row: OutboxRow) => Promise<void>;
  now: () => number;
  limit?: number;
}): Promise<{ sent: number; skipped: number; failed: number }> {
  const out = { sent: 0, skipped: 0, failed: 0 };
  const rows = await params.store.claimDue(params.now(), params.limit ?? 20);
  for (const row of rows) {
    if (row.environment !== "live") {
      await params.store.markSkipped(row.id, "skipped_sandbox", params.now());
      out.skipped++;
      continue;
    }
    if (row.kind === "refund_review") {
      // Internal: recorded for human review, no student email.
      await params.store.markSkipped(row.id, "recorded", params.now());
      out.skipped++;
      continue;
    }
    try {
      await params.deliver(row);
      await params.store.markSent(row.id, params.now());
      out.sent++;
    } catch (e) {
      const attempts = row.attempts + 1;
      const next = attempts >= OUTBOX_MAX_ATTEMPTS ? null : params.now() + backoffMs(attempts);
      await params.store.markFailed(row.id, e instanceof Error ? e.message : String(e), next, params.now());
      out.failed++;
    }
  }
  return out;
}
