import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

function safeNext(next: string | undefined): string {
  if (!next) return "/";
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

export const Route = createFileRoute("/login")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    next: typeof search.next === "string" ? search.next : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in | The Power of Conscious Voice" },
      {
        name: "description",
        content:
          "Sign in to your Conscious Voice account to manage your enrollment and connected assistants.",
      },
      { property: "og:title", content: "Sign in | The Power of Conscious Voice" },
      {
        property: "og:description",
        content: "Sign in to your Conscious Voice account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { next } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    const target = safeNext(next);
    if (target.startsWith("/.lovable/")) {
      window.location.href = target;
      return;
    }
    void navigate({ to: target });
  }

  async function signUp() {
    setBusy(true);
    setError(null);
    setNotice(null);
    const redirectTo = new URL(safeNext(next), window.location.origin).toString();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectTo },
    });
    setBusy(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    setNotice("Check your inbox to confirm your address, then sign in here.");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-lg">
        <h1 className="text-2xl font-semibold text-foreground">Sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The Power of Conscious Voice — Tecendo Som
        </p>
        <form className="mt-6 space-y-4" onSubmit={signIn}>
          <div className="space-y-1">
            <label className="text-sm text-foreground" htmlFor="login-email">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-foreground" htmlFor="login-password">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Please wait…" : "Sign in"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={signUp}
            className="w-full rounded-md border border-border px-4 py-2 text-sm text-foreground disabled:opacity-60"
          >
            Create an account
          </button>
        </form>
      </div>
    </main>
  );
}
