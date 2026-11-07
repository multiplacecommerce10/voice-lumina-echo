import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "./login";

export const Route = createFileRoute("/scholarship-login")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    next: typeof search.next === "string" ? search.next : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Scholarship sign in — The Power of Conscious Voice" },
      { name: "description", content: "Sign in after your Global Solidarity Scholarship selection to continue your confirmed enrollment." },
      { property: "og:title", content: "Scholarship sign in — The Power of Conscious Voice" },
      { property: "og:description", content: "Your Global Solidarity Scholarship account entry after selection." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ScholarshipLoginPage,
});

function ScholarshipLoginPage() {
  const { next } = Route.useSearch();
  return <LoginPage scholarship next={next} />;
}