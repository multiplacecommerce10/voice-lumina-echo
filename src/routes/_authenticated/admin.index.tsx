import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Admin overview | The Power of Conscious Voice" },
      { name: "description", content: "Admin overview and team access for The Power of Conscious Voice." },
      { property: "og:title", content: "Admin overview | The Power of Conscious Voice" },
      { property: "og:description", content: "Admin overview and team access." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminOverview,
});

function AdminOverview() {
  const [team, setTeam] = useState<{ email: string; created_at: string }[]>([]);
  const [me, setMe] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    setMe((u.user?.email ?? "").toLowerCase());
    const { data, error } = await supabase.from("admin_emails").select("email, created_at").order("created_at");
    if (error) setError("Could not load the team.");
    else setTeam(data ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const value = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return setError("Enter a valid email.");
    const { error } = await supabase.from("admin_emails").insert({ email: value });
    if (error) return setError("Could not add this email (it may already be on the team).");
    setEmail("");
    void load();
  }

  async function remove(value: string) {
    if (!confirm(`Remove ${value} from the admin team?`)) return;
    const { error } = await supabase.from("admin_emails").delete().eq("email", value);
    if (error) return setError("Could not remove this email.");
    void load();
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-semibold text-foreground">Admin team</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        People listed here can sign in on this site (email, Google or Microsoft) and use every admin page.
        They must sign in with exactly this email.
      </p>

      {error && (
        <p className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <form onSubmit={add} className="mt-6 flex flex-wrap gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="teammate@example.com"
          className="min-w-64 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
        />
        <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Add to team</button>
      </form>

      <ul className="mt-6 divide-y divide-border rounded-xl border border-border bg-card">
        {team.map((m) => (
          <li key={m.email} className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-foreground">
              {m.email} {m.email === me && <span className="text-muted-foreground">(you)</span>}
            </span>
            {m.email !== me && (
              <button onClick={() => remove(m.email)} className="text-destructive hover:underline">
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
