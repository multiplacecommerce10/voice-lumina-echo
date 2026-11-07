import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import scholarshipBanner from "@/assets/scholarships-banner.png";
import courseBanner from "@/assets/hero-conscious-voice-banner.png.asset.json";
import { Button } from "@/components/ui/button";

function safeNext(next: string | undefined): string {
  if (!next) return "/members";
  if (!next.startsWith("/") || next.startsWith("//")) return "/members";
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
  component: CourseLoginPage,
});

function CourseLoginPage() {
  const { next } = Route.useSearch();
  return <LoginPage next={next} />;
}

export function LoginPage({ next, scholarship = false }: { next?: string; scholarship?: boolean }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  async function signInWithOAuth(provider: "google" | "microsoft") {
    setBusy(true);
    setError(null);
    setNotice(null);
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      setError(result.error.message ?? `Could not sign in with ${provider === "google" ? "Google" : "Microsoft"}. Please try again.`);
      return;
    }
    if (result.redirected) return;
    // Session is set (popup flow in the preview); go to the intended page.
    const target = safeNext(next);
    if (target.startsWith("/.lovable/")) {
      window.location.href = target;
      return;
    }
    void navigate({ to: target });
  }

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

  async function sendPasswordReset() {
    if (!email) {
      setError("Type your email above first, then click Forgot password.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    const redirectTo = new URL("/reset-password", window.location.origin).toString();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setBusy(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setNotice("If an account exists for this email, a reset link is on its way. Open it to choose a new password.");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-md overflow-hidden rounded-lg border border-border bg-card shadow-lg">
        <img
          src={scholarship ? scholarshipBanner : courseBanner.url}
          alt={scholarship ? "The Power of Conscious Voice — Global Solidarity Scholarship" : "The Power of Conscious Voice — with Cuca Medina"}
          className="block h-auto w-full"
        />
        <div className="p-8 pt-6">
        <h1 className="text-2xl font-semibold text-foreground">Sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {scholarship ? "Global Solidarity Scholarship" : "The Power of Conscious Voice"}
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
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 pr-16 text-sm text-foreground"
              />
              <Button variant="ghost"
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </Button>
            </div>
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
          <Button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Please wait…" : "Sign in"}
          </Button>
          <Button variant="ghost"
            type="button"
            disabled={busy}
            onClick={sendPasswordReset}
            className="w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline hover:text-foreground"
          >
            Forgot password?
          </Button>
          <Button variant="outline"
            type="button"
            disabled={busy}
            onClick={signUp}
            className="w-full rounded-md border border-border px-4 py-2 text-sm text-foreground disabled:opacity-60"
          >
            Create an account
          </Button>
          <div className="flex items-center gap-3 pt-1">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button variant="outline"
            type="button"
            disabled={busy}
            onClick={() => signInWithOAuth("google")}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground disabled:opacity-60"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.57 5.57 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82Z" />
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24Z" />
              <path fill="#FBBC05" d="M5.27 14.29A7.2 7.2 0 0 1 4.89 12c0-.8.14-1.57.38-2.29V6.62H1.29a12 12 0 0 0 0 10.76l3.98-3.09Z" />
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42A11.98 11.98 0 0 0 12 0 11.99 11.99 0 0 0 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75Z" />
            </svg>
            Continue with Google
          </Button>
          <Button variant="outline"
            type="button"
            disabled={busy}
            onClick={() => signInWithOAuth("microsoft")}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground disabled:opacity-60"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 23 23" className="h-4 w-4" aria-hidden="true">
              <path fill="#f35325" d="M1 1h10v10H1z" />
              <path fill="#81bc06" d="M12 1h10v10H12z" />
              <path fill="#05a6f0" d="M1 12h10v10H1z" />
              <path fill="#ffba08" d="M12 12h10v10H12z" />
            </svg>
            Continue with Microsoft
          </Button>
        </form>
        </div>
      </div>
    </main>
  );
}
