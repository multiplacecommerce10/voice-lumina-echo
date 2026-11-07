import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type ModelMessage, type UIMessage } from "ai";
import type { Database } from "@/integrations/supabase/types";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "@/lib/ai/run-id";

const SAFETY = `
Shared rules for every specialist:
- Reply in polished US English unless the student writes in another language; then mirror her language.
- Warm, artistic, precise and pedagogical, in the spirit of Cuca Medina's method. Use markdown with short sections when helpful.
- You are an educational companion, not a clinician. Never diagnose, never give medical or speech-therapy treatment, and never promise guaranteed results. If the student mentions pain, hoarseness lasting more than two weeks, loss of voice or other health concerns, kindly recommend seeing a laryngologist or speech-language pathologist.
- Encourage the student to bring deeper questions to her live class or individual session with Cuca Medina.
- Stay within your specialty; if a question belongs to another specialist (Vocal Proprioception, Style Physiology & Crossover Singing, Vocal Self-Knowledge & Mindset), say so gently and still give a brief helpful pointer.`;

function textOf(m: UIMessage | undefined) {
  return (m?.parts ?? []).map((p) => (p.type === "text" ? p.text : "")).join("").trim();
}

export const Route = createFileRoute("/api/member-assistant")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!token) return new Response("Please sign in.", { status: 401 });

        const url = process.env.SUPABASE_URL!;
        const pub = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const supabase = createClient<Database>(url, pub, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });
        const { data: claims } = await supabase.auth.getClaims(token);
        const userId = claims?.claims?.sub;
        if (!userId) return new Response("Please sign in.", { status: 401 });

        const [{ data: active }, { data: admin }] = await Promise.all([
          supabase.rpc("has_active_membership"),
          supabase.rpc("is_admin"),
        ]);
        if (!active && !admin) {
          return new Response("The assistant opens once your enrollment is active.", { status: 403 });
        }

        const body = (await request.json()) as { persona?: string; messages?: UIMessage[] };
        const personaKey = String(body.persona ?? "");
        const lastUser = [...(body.messages ?? [])].reverse().find((m) => m.role === "user");
        const text = textOf(lastUser).slice(0, 4000);
        if (!personaKey || !text) return new Response("A message is required.", { status: 400 });

        const { data: persona } = await supabase
          .from("assistant_personas")
          .select("key, title, instructions, knowledge")
          .eq("key", personaKey)
          .maybeSingle();
        if (!persona) return new Response("Unknown assistant.", { status: 404 });

        const { error: insErr } = await supabase
          .from("assistant_messages")
          .insert({ user_id: userId, persona_key: personaKey, role: "user", content: text });
        if (insErr) {
          console.error("[assistant] save user message failed", insErr);
          return new Response("Could not save your message.", { status: 500 });
        }

        const { data: history } = await supabase
          .from("assistant_messages")
          .select("role, content")
          .eq("user_id", userId)
          .eq("persona_key", personaKey)
          .order("created_at", { ascending: true })
          .limit(60);
        const messages: ModelMessage[] = (history ?? []).map((m) =>
          m.role === "assistant"
            ? { role: "assistant", content: m.content }
            : { role: "user", content: m.content },
        );

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("AI is not configured.", { status: 500 });
        const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
        const provider = createOpenAI({
          baseURL: "https://ai.gateway.lovable.dev/v1",
          apiKey: key,
          headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
          fetch: runIdFetch.fetch,
        });

        const result = streamText({
          model: provider.responses("openai/gpt-6-astra"),
          instructions: `${persona.instructions}\n${persona.knowledge ? `\nCourse knowledge base (use it to ground your answers, citing concepts naturally):\n${persona.knowledge}\n` : ""}\n${SAFETY}`,
          messages,
          abortSignal: request.signal,
          providerOptions: {
            openai: {
              forceReasoning: true,
              reasoningEffort: "low",
              reasoningSummary: "auto",
              store: false,
              include: ["reasoning.encrypted_content"],
            },
          },
          onFinish: async ({ text: answer }) => {
            if (!answer.trim()) return;
            const { error } = await supabase
              .from("assistant_messages")
              .insert({ user_id: userId, persona_key: personaKey, role: "assistant", content: answer });
            if (error) console.error("[assistant] save answer failed", error);
          },
        } as Parameters<typeof streamText>[0]);

        return withLovableAiGatewayRunIdHeader(result.toUIMessageStreamResponse(), runIdFetch);
      },
    },
  },
});
