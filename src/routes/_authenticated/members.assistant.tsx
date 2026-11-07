import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { Trash2, Waves, Activity, Compass } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputTextarea, PromptInputSubmit, PromptInputFooter } from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";

export const Route = createFileRoute("/_authenticated/members/assistant")({
  head: () => ({ meta: [{ title: "Voice Assistant — The Power of Conscious Voice" }, { name: "robots", content: "noindex" }] }),
  component: AssistantPage,
});

type Persona = { key: string; title: string; subtitle: string | null };
const ICONS: Record<string, typeof Waves> = { proprioception: Waves, crossover: Activity, mindset: Compass };

function AssistantPage() {
  const [personas, setPersonas] = useState<Persona[] | null>(null);
  const [active, setActive] = useState<string>("");
  const [history, setHistory] = useState<UIMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void supabase.from("assistant_personas").select("key, title, subtitle").order("sort_order").then(({ data, error }) => {
      if (error || !data?.length) { setError("The Voice Assistant opens once your enrollment is active."); setPersonas([]); return; }
      setPersonas(data); setActive(data[0].key);
    });
  }, []);

  useEffect(() => {
    if (!active) return;
    setHistory(null);
    void supabase.from("assistant_messages").select("id, role, content").eq("persona_key", active).order("created_at").then(({ data }) => {
      setHistory((data ?? []).map((m) => ({ id: m.id, role: m.role as "user" | "assistant", parts: [{ type: "text", text: m.content }] })));
    });
  }, [active]);

  const clear = async () => {
    if (!confirm("Clear this conversation? This cannot be undone.")) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("assistant_messages").delete().eq("persona_key", active).eq("user_id", u.user.id);
    setHistory([]);
  };

  if (!personas) return <p className="p-10 text-sm text-muted-foreground">Loading…</p>;
  if (error) return <main className="mx-auto max-w-lg p-10 text-center"><h1 className="text-2xl font-semibold text-foreground">Access not active</h1><p className="mt-2 text-sm text-muted-foreground">{error}</p></main>;

  const current = personas.find((p) => p.key === active);
  return (
    <main className="mx-auto max-w-6xl p-4 md:p-8">
      <h1 className="text-2xl font-semibold text-foreground">Voice Assistant</h1>
      <p className="mt-1 text-sm text-muted-foreground">Three specialist companions for your study between classes. Educational guidance only — not a medical or speech-therapy service.</p>
      <div className="mt-6 grid gap-4 md:grid-cols-[260px_1fr]">
        <div className="flex gap-2 overflow-x-auto md:flex-col">
          {personas.map((p) => {
            const Icon = ICONS[p.key] ?? Waves;
            return (
              <button key={p.key} onClick={() => setActive(p.key)}
                className={`flex min-w-[200px] items-start gap-3 rounded-xl border p-3 text-left transition-colors ${p.key === active ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-muted"}`}>
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <span><span className="block text-sm font-medium text-foreground">{p.title}</span>{p.subtitle && <span className="block text-xs text-muted-foreground">{p.subtitle}</span>}</span>
              </button>
            );
          })}
        </div>
        <section className="flex h-[70vh] flex-col overflow-hidden rounded-xl border border-border bg-card">
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-medium text-foreground">{current?.title}</p>
            <button onClick={clear} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /> Clear conversation</button>
          </header>
          {history ? <ChatWindow key={active} persona={active} title={current?.title ?? ""} initial={history} /> : <p className="p-6 text-sm text-muted-foreground">Loading conversation…</p>}
        </section>
      </div>
    </main>
  );
}

function ChatWindow({ persona, title, initial }: { persona: string; title: string; initial: UIMessage[] }) {
  const transport = useMemo(() => new DefaultChatTransport({
    api: "/api/member-assistant",
    body: { persona },
    headers: async (): Promise<Record<string, string>> => {
      const { data } = await supabase.auth.getSession();
      const t = data.session?.access_token;
      return t ? { Authorization: `Bearer ${t}` } : {};
    },
  }), [persona]);
  const { messages, sendMessage, status, error } = useChat({ id: `assistant-${persona}`, messages: initial, transport });
  const [input, setInput] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { ref.current?.focus(); }, [status]);
  const busy = status === "submitted" || status === "streaming";

  return (
    <>
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted-foreground">Ask your first question about <span className="text-foreground">{title}</span>.</p>}
          {messages.map((m) => (
            <Message key={m.id} from={m.role}>
              <MessageContent>
                {m.parts.map((p, i) => p.type === "text" ? (m.role === "assistant" ? <MessageResponse key={i}>{p.text}</MessageResponse> : <span key={i} className="whitespace-pre-wrap">{p.text}</span>) : null)}
              </MessageContent>
            </Message>
          ))}
          {status === "submitted" && <Message from="assistant"><MessageContent><Shimmer>Listening…</Shimmer></MessageContent></Message>}
          {error && <p className="px-4 text-sm text-destructive">{error.message || "Something went wrong. Please try again."}</p>}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="border-t border-border p-3">
        <PromptInput onSubmit={async () => { const t = input.trim(); if (!t || busy) return; setInput(""); await sendMessage({ text: t }); }}>
          <PromptInputTextarea ref={ref} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type your question…" aria-label="Your question" />
          <PromptInputFooter className="justify-end"><PromptInputSubmit status={status} disabled={!input.trim() || busy} /></PromptInputFooter>
        </PromptInput>
      </div>
    </>
  );
}
