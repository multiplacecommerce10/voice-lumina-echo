import { createFileRoute } from '@tanstack/react-router'
// Opt-out endpoint used by the unsubscribe link in the recovery email.
// The caller must present the lead's own resume code; without a matching
// code nothing is ever marked. Opted-out leads are excluded from all
// future recovery sweeps because their status leaves the recoverable set.

async function handleUnsubscribe({ request }: { request: Request }) {
  try {
    const body = (await request.json().catch(() => null)) as
      | { leadId?: unknown; code?: unknown }
      | null;
    const leadId = typeof body?.leadId === "string" ? body.leadId.trim() : "";
    const code = typeof body?.code === "string" ? body.code.trim() : "";
    if (!leadId || !code) {
      return Response.json({ error: "invalid_request" }, { status: 400 });
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: lead, error } = await supabaseAdmin
      .from("leads")
      .select("id, resume_code, status")
      .eq("id", leadId)
      .maybeSingle();

    if (error) return Response.json({ error: "lookup_failed" }, { status: 500 });
    if (!lead) return Response.json({ error: "not_found" }, { status: 404 });

    // Only the person holding the exact recovery link can opt out.
    if (!lead.resume_code || lead.resume_code !== code) {
      return Response.json({ error: "invalid_code" }, { status: 403 });
    }

    const handled = ["paid", "checkout_completed", "opted_out"];
    if (handled.includes(lead.status)) {
      return Response.json({ ok: true, already: true });
    }

    const { error: updateError } = await supabaseAdmin
      .from("leads")
      .update({ status: "opted_out" })
      .eq("id", leadId);
    if (updateError) return Response.json({ error: "update_failed" }, { status: 500 });

    return Response.json({ ok: true });
  } catch (e) {
    console.error("[unsubscribe]", e);
    return Response.json({ error: "unexpected_error" }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/leads/unsubscribe")({
  server: {
    handlers: {
      POST: handleUnsubscribe,
    },
  },
});
