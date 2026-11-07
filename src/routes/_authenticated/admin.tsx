import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Overview & team" },
  { to: "/admin/programs", label: "Scholarship programs" },
  { to: "/admin/applications", label: "Applications" },
  { to: "/admin/enrollments", label: "Enrollments & payments" },
  { to: "/admin/course", label: "Course & assistant" },
  { to: "/admin/classes", label: "Classes" },
  { to: "/admin/foundations", label: "Foundations" },
  { to: "/admin/slots", label: "Session slots" },
  { to: "/admin/portfolios", label: "Portfolios" },
] as const;

function AdminLayout() {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    void supabase.rpc("is_admin").then(({ data }) => setAllowed(data === true));
  }, []);

  if (allowed === null) {
    return <p className="p-10 text-sm text-muted-foreground">Checking access…</p>;
  }
  if (!allowed) {
    return (
      <main className="mx-auto max-w-lg p-10 text-center">
        <h1 className="text-2xl font-semibold text-foreground">Access restricted</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This account is not on the admin team. Ask an administrator to add your email.
        </p>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl flex-wrap gap-2 px-4 py-3">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: true }}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
              activeProps={{ className: "rounded-md px-3 py-1.5 text-sm bg-primary/15 text-primary" }}
            >
              {item.label}
            </Link>
          ))}
          <button
            className="ml-auto rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.replace("/login");
            }}
          >
            Sign out
          </button>
        </div>
      </nav>
      <Outlet />
    </div>
  );
}
