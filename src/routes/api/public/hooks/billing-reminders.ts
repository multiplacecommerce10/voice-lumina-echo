import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/billing-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        const expected =
          process.env["SUPABASE_ANON_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
        if (!apikey || !expected || apikey !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        let dryRun = false;
        try {
          const body = (await request.json()) as { dry_run?: boolean };
          dryRun = body?.dry_run === true;
        } catch {
          // empty body is fine
        }

        const { runBillingReminderSweep } = await import("@/lib/billing-reminders.server");
        const result = await runBillingReminderSweep({ dryRun });
        return Response.json({ ok: true, ...result });
      },
    },
  },
});
