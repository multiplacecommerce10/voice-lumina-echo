import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, Plus, Trash2, X } from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputFooter,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";

type Thread = { id: string; title: string; messages: UIMessage[] };

const newThread = (): Thread => ({
  id: crypto.randomUUID(),
  title: "New chat",
  messages: [],
});

function ChatWindow({
  thread,
  onPersist,
}: {
  thread: Thread;
  onPersist: (id: string, messages: UIMessage[], title?: string) => void;
}) {
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat" }), []);
  const { messages, sendMessage, status } = useChat({
    id: thread.id,
    messages: thread.messages,
    transport,
  });
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [thread.id]);

  useEffect(() => {
    if (messages.length === 0) return;
    const firstUser = messages.find((m) => m.role === "user");
    const title = firstUser
      ? firstUser.parts
          .map((p) => (p.type === "text" ? p.text : ""))
          .join(" ")
          .slice(0, 40) || "Chat"
      : thread.title;
    onPersist(thread.id, messages, title);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, status]);

  const handleSubmit = async () => {
    const text = input.trim();
    if (!text || status === "submitted" || status === "streaming") return;
    setInput("");
    await sendMessage({ text });
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const isLoading = status === "submitted" || status === "streaming";

  return (
    <div className="flex h-full flex-col">
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              <p className="font-medium text-foreground/80">
                Hi ✦ I'm Rohny, your course assistant.
              </p>
              <p className="mt-2">
                Ask me about class format, dates, the approach, scholarships, payment…
              </p>
            </div>
          )}
          {messages.map((m) => (
            <Message key={m.id} from={m.role}>
              <MessageContent>
                {m.parts.map((part, i) => {
                  if (part.type === "text") {
                    return m.role === "assistant" ? (
                      <MessageResponse key={i}>{part.text}</MessageResponse>
                    ) : (
                      <span key={i} className="whitespace-pre-wrap">{part.text}</span>
                    );
                  }
                  return null;
                })}
              </MessageContent>
            </Message>
          ))}
          {status === "submitted" && (
            <Message from="assistant">
              <MessageContent>
                <Shimmer>Thinking…</Shimmer>
              </MessageContent>
            </Message>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="border-t border-border/40 p-3">
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputTextarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about the course…"
          />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} disabled={!input.trim() || isLoading} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}

export function CourseChatAgent() {
  const [open, setOpen] = useState(false);
  const [threads, setThreads] = useState<Thread[]>(() => [newThread()]);
  const [activeId, setActiveId] = useState<string>(() => threads[0].id);

  const active = threads.find((t) => t.id === activeId) ?? threads[0];

  const persist = (id: string, messages: UIMessage[], title?: string) => {
    setThreads((prev) =>
      prev.map((t) => (t.id === id ? { ...t, messages, title: title ?? t.title } : t)),
    );
  };

  const createThread = () => {
    const t = newThread();
    setThreads((prev) => [t, ...prev]);
    setActiveId(t.id);
  };

  const deleteThread = (id: string) => {
    setThreads((prev) => {
      const remaining = prev.filter((t) => t.id !== id);
      if (remaining.length === 0) {
        const t = newThread();
        setActiveId(t.id);
        return [t];
      }
      if (id === activeId) setActiveId(remaining[0].id);
      return remaining;
    });
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open course chat"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-[oklch(0.65_0.20_45)] px-5 py-3 text-primary-foreground font-semibold shadow-glow-gold hover:scale-[1.03] transition-transform"
        >
          <MessageCircle className="h-5 w-5" />
          <span className="hidden sm:inline">Course questions</span>
        </button>
      )}
      {open && (
        <div className="fixed inset-x-2 bottom-2 z-50 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[680px] max-w-[calc(100vw-1rem)]">
          <div className="glass-card flex h-[78vh] sm:h-[600px] flex-col overflow-hidden rounded-2xl border border-border/40 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-primary">
                  Rohny
                </p>
                <p className="text-sm text-foreground/80">Ask your questions ✦</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close chat"
                className="rounded-full p-2 text-muted-foreground hover:bg-muted/30 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-1 min-h-0">
              <aside className="hidden sm:flex w-44 flex-col border-r border-border/40 bg-background/30">
                <button
                  onClick={createThread}
                  className="m-2 flex items-center justify-center gap-1.5 rounded-lg border border-border/50 bg-background/40 px-2 py-1.5 text-xs text-foreground/80 hover:bg-primary/10 hover:text-primary transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> New chat
                </button>
                <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
                  {threads.map((t) => (
                    <div
                      key={t.id}
                      className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs cursor-pointer transition-colors ${
                        t.id === activeId
                          ? "bg-primary/15 text-primary"
                          : "text-foreground/70 hover:bg-muted/30"
                      }`}
                      onClick={() => setActiveId(t.id)}
                    >
                      <span className="flex-1 truncate">{t.title || "Chat"}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteThread(t.id);
                        }}
                        aria-label="Delete chat"
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </aside>
              <div className="flex-1 min-w-0">
                <ChatWindow key={active.id} thread={active} onPersist={persist} />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
