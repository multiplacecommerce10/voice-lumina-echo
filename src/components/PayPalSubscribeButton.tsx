import { useEffect, useRef, useState } from "react";

const PAYPAL_CLIENT_ID =
  "BAAQb0hljO42Km-vpTc_Ut77BE8jpmPUkWuMIhghGjCTCncFH1C9T0hNQDN5sywdU3HLl2EU8nBwX22vQM";

const SDK_SRC = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&vault=true&intent=subscription&locale=en_US`;

let sdkPromise: Promise<void> | null = null;

function loadPayPalSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if ((window as any).paypal) return Promise.resolve();
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SDK_SRC}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => {
        sdkPromise = null;
        reject(new Error("PayPal SDK failed to load"));
      });
      return;
    }
    const script = document.createElement("script");
    script.src = SDK_SRC;
    script.setAttribute("data-sdk-integration-source", "button-factory");
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      sdkPromise = null;
      reject(new Error("PayPal SDK failed to load"));
    };
    document.body.appendChild(script);
  });
  return sdkPromise;
}

interface PayPalSubscribeButtonProps {
  planId: string;
  color?: "gold" | "blue" | "silver" | "white" | "black";
}

type Status =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "submitting" }
  | { kind: "approved"; id: string }
  | { kind: "cancelled" }
  | { kind: "error"; message: string };

export function PayPalSubscribeButton({ planId, color = "gold" }: PayPalSubscribeButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let buttonsInstance: any = null;
    setStatus({ kind: "loading" });

    loadPayPalSdk()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        const paypal = (window as any).paypal;
        if (!paypal?.Buttons) {
          setStatus({ kind: "error", message: "PayPal is unavailable right now." });
          return;
        }
        containerRef.current.innerHTML = "";
        buttonsInstance = paypal.Buttons({
          style: { shape: "pill", color, layout: "vertical", label: "subscribe" },
          createSubscription: (_data: any, actions: any) => {
            setStatus({ kind: "submitting" });
            return actions.subscription
              .create({ plan_id: planId })
              .catch((err: unknown) => {
                setStatus({
                  kind: "error",
                  message:
                    err instanceof Error
                      ? err.message
                      : "We couldn't start your subscription. Please try again.",
                });
                throw err;
              });
          },
          onApprove: (data: any) => {
            setStatus({ kind: "approved", id: data.subscriptionID });
          },
          onCancel: () => {
            setStatus({ kind: "cancelled" });
          },
          onError: (err: unknown) => {
            // eslint-disable-next-line no-console
            console.error("PayPal error", err);
            setStatus({
              kind: "error",
              message:
                "Something went wrong with PayPal. Please try again or use another method.",
            });
          },
          onInit: () => {
            setStatus({ kind: "ready" });
          },
        });

        if (!buttonsInstance.isEligible || buttonsInstance.isEligible()) {
          buttonsInstance
            .render(containerRef.current)
            .then(() => {
              // onInit usually fires; fall back to ready in case it doesn't
              setStatus((s) => (s.kind === "loading" ? { kind: "ready" } : s));
            })
            .catch((err: unknown) => {
              if (cancelled) return;
              // eslint-disable-next-line no-console
              console.error(err);
              setStatus({
                kind: "error",
                message: "We couldn't display the PayPal button.",
              });
            });
        } else {
          setStatus({
            kind: "error",
            message: "PayPal is not available for this plan in your region.",
          });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.error(err);
        setStatus({
          kind: "error",
          message: "We couldn't reach PayPal. Check your connection and try again.",
        });
      });

    return () => {
      cancelled = true;
      try {
        buttonsInstance?.close?.();
      } catch {
        // ignore
      }
    };
  }, [planId, color, retryKey]);

  const isOverlay =
    status.kind === "loading" || status.kind === "submitting";

  return (
    <div className="space-y-2">
      <div className="relative min-h-[52px]">
        <div
          ref={containerRef}
          className={`paypal-button-container transition-opacity ${
            status.kind === "error" ? "opacity-40 pointer-events-none" : ""
          } ${isOverlay ? "opacity-60 pointer-events-none" : ""}`}
        />
        {status.kind === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-9 w-full max-w-[220px] rounded-full bg-muted/40 animate-pulse" />
          </div>
        )}
        {status.kind === "submitting" && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <span
              aria-hidden
              className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin"
            />
            <span>Opening secure PayPal checkout…</span>
          </div>
        )}
      </div>

      {status.kind === "approved" && (
        <p
          role="status"
          className="text-xs text-center text-primary"
        >
          ✓ Subscription confirmed. Check your email for next steps.
        </p>
      )}
      {status.kind === "cancelled" && (
        <p
          role="status"
          className="text-xs text-center text-muted-foreground"
        >
          Checkout cancelled — you can try again whenever you're ready.
        </p>
      )}
      {status.kind === "error" && (
        <div
          role="alert"
          className="text-xs text-center text-destructive flex flex-col items-center gap-1"
        >
          <span>{status.message}</span>
          <button
            type="button"
            onClick={() => setRetryKey((k) => k + 1)}
            className="underline underline-offset-2 hover:text-foreground"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
