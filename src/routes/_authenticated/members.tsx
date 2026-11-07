import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/members")({
  component: MembersLayout,
});

const NAV = [
  { to: "/members", label: "Home" },
  { to: "/members/course", label: "Course" },
  { to: "/members/assistant", label: "Voice Assistant" },
  { to: "/members/classes", label: "Classes & replays" },
  { to: "/members/foundations", label: "Foundations Library" },
  { to: "/members/sessions", label: "Individual sessions" },
  { to: "/members/portfolio", label: "Portfolio & certificate" },
] as const;

function MembersLayout() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-4 py-3">
          <span className="mr-2 text-sm font-semibold text-foreground">
            The Power of Conscious Voice
          </span>
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
