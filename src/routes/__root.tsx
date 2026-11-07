import {
  Outlet,
  Link,
  createRootRoute,
  HeadContent,
  Scripts,
  ClientOnly,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, lazy, Suspense, Component } from "react";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { PreviewCacheToggle } from "@/components/PreviewCacheToggle";

// Browser-only: the chat renderer pulls in very large libraries that must not
// be bundled into the server build. The import retries on transient network
// failures and falls back to a page reload once when a new deploy has
// replaced the old chunk files.
async function loadChat(attempt = 0): Promise<{ default: React.ComponentType }> {
  try {
    const m = await import("@/components/CourseChatAgent");
    return { default: m.CourseChatAgent };
  } catch (err) {
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      return loadChat(attempt + 1);
    }
    const KEY = "chat-chunk-reloaded";
    if (typeof window !== "undefined" && !sessionStorage.getItem(KEY)) {
      sessionStorage.setItem(KEY, "1");
      window.location.reload();
    }
    throw err;
  }
}
const CourseChatAgent = lazy(() => loadChat());

class ChatBoundary extends Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("[chat] failed to load", error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import { captureUtms } from "@/lib/utm";
import { CONSENT_EVENT } from "@/lib/consent";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "google-site-verification", content: "aUkiNxbR5q7nqGN8Qd5gVB62ALZAe6rz1XREjbKsul0" },
      { name: "author", content: "Tecendo Som" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
    ],

    scripts: [
      // Google Analytics is intentionally NOT loaded here. It is injected at
      // runtime by src/lib/consent.ts only after the visitor allows analytics.
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const privateDiagnostic = useRouterState({ select: state => state.location.pathname === "/private-payment" });
  useEffect(() => {
    if (privateDiagnostic) return;
    // captureUtms() is a no-op until analytics/marketing consent is given.
    captureUtms();
    const onConsentChange = () => captureUtms();
    window.addEventListener(CONSENT_EVENT, onConsentChange);
    return () => window.removeEventListener(CONSENT_EVENT, onConsentChange);
  }, [privateDiagnostic]);
  useScrollReveal();

  return (
    <>
      {!privateDiagnostic && <PaymentTestModeBanner />}
      <Outlet />
      {!privateDiagnostic && <ClientOnly fallback={null}>
        <ChatBoundary>
          <Suspense fallback={null}>
            <CourseChatAgent />
          </Suspense>
        </ChatBoundary>
      </ClientOnly>}
      {!privateDiagnostic && <PreviewCacheToggle />}
      <Toaster />
      {!privateDiagnostic && <CookieConsentBanner />}
    </>
  );
}
