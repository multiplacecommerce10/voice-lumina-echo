import { createServerFn } from "@tanstack/react-start";
import { forwardToTaskade } from "./taskade.server";
import { FICTITIOUS_MARKER, markFictitious } from "@/lib/fictitious";

// Dry-run test: forwards a payload with `dry_run` flag set — no real webhook call.
export const sendTaskadeDryRun = createServerFn({ method: "POST" })
  .inputValidator((data: { payload: Record<string, unknown> }) => data)
  .handler(async ({ data }) => {
    const payload = data.payload as Parameters<typeof forwardToTaskade>[0];
    const result = await forwardToTaskade(
      markFictitious({
        ...payload,
        extra: { ...(payload.extra ?? {}), dry_run: true },
      }),
    );
    return result;
  });

// LIVE test: forwards the payload directly to the real Taskade webhook.
// Always tagged as a fictitious member so Taskade can filter and we can purge.
export const sendTaskadeLive = createServerFn({ method: "POST" })
  .inputValidator((data: { payload: Record<string, unknown> }) => data)
  .handler(async ({ data }) => {
    const payload = data.payload as Parameters<typeof forwardToTaskade>[0];
    const extra = { ...(payload.extra ?? {}) } as Record<string, unknown>;
    delete extra.dry_run;
    const result = await forwardToTaskade(
      markFictitious({
        ...payload,
        extra: { ...extra, ...FICTITIOUS_MARKER, force_live: true, source: "debug_page_live_test" },
      }),
    );
    return result;
  });

