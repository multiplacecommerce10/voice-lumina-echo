import { useState, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { submitScholarshipApplication } from "@/lib/scholarship.functions";
import { Button } from "./ui/button";
import { Link } from "@tanstack/react-router";

type Status = "idle" | "submitting" | "success" | "error";

const inputClass =
  "w-full rounded-xl border border-border/60 bg-background/60 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40";

export function ScholarshipForm() {
  const submit = useServerFn(submitScholarshipApplication);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const requestId = useRef<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "submitting") return;
    requestId.current ??= crypto.randomUUID();
    setStatus("submitting");
    setErrorMsg("");
    const form = e.currentTarget;
    const fd = new FormData(form);
    let result: Awaited<ReturnType<typeof submit>>;
    try {
      result = await submit({
        data: {
          requestId: requestId.current,
          privacyConsent: (fd.get("privacyConsent") === "on") as true,
          fullName: String(fd.get("fullName") || ""),
          email: String(fd.get("email") || ""),
          phone: String(fd.get("phone") || ""),
          city: String(fd.get("city") || ""),
          country: String(fd.get("country") || ""),
          voiceJourney: String(fd.get("voiceJourney") || ""),
          goals: String(fd.get("goals") || ""),
          whyScholarship: String(fd.get("whyScholarship") || ""),
          landingUrl: window.location.href,
          referrer: document.referrer || "",
        },
      });
    } catch (err) {
      setStatus("error");
      setErrorMsg(
        "We couldn't send your application. Please check your answers and connection, then try again.",
      );
      return;
    }
    if ("error" in result) {
      setStatus("error");
      setErrorMsg(result.error);
      return;
    }
    setStatus("success");
    form.reset();
  }

  if (status === "success") {
    return (
      <div className="rounded-2xl border border-primary/40 bg-primary/5 p-8 text-center">
        <h3 className="font-display text-2xl text-foreground mb-3">Application received</h3>
        <p className="text-foreground/80 leading-relaxed">
          Thank you for applying. Cuca Medina reviews every application personally, and we will
          reply to your email with the outcome.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="sch-fullName" className="block text-sm font-medium mb-1.5">
            Full name *
          </label>
          <input id="sch-fullName" name="fullName" required maxLength={120} className={inputClass} />
        </div>
        <div>
          <label htmlFor="sch-email" className="block text-sm font-medium mb-1.5">
            Email *
          </label>
          <input
            id="sch-email"
            name="email"
            type="email"
            required
            maxLength={160}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="sch-city" className="block text-sm font-medium mb-1.5">
            City *
          </label>
          <input id="sch-city" name="city" required maxLength={120} className={inputClass} />
        </div>
        <div>
          <label htmlFor="sch-country" className="block text-sm font-medium mb-1.5">
            Country *
          </label>
          <input id="sch-country" name="country" required maxLength={120} className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="sch-phone" className="block text-sm font-medium mb-1.5">
            Phone / WhatsApp (optional)
          </label>
          <input id="sch-phone" name="phone" maxLength={40} className={inputClass} />
        </div>
      </div>

      <div>
        <label htmlFor="sch-voiceJourney" className="block text-sm font-medium mb-1.5">
          Your voice journey so far *
        </label>
        <textarea
          id="sch-voiceJourney"
          name="voiceJourney"
          required
          minLength={10}
          maxLength={2000}
          rows={3}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="sch-goals" className="block text-sm font-medium mb-1.5">
          What you hope to develop in the course *
        </label>
        <textarea
          id="sch-goals"
          name="goals"
          required
          minLength={10}
          maxLength={2000}
          rows={3}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="sch-whyScholarship" className="block text-sm font-medium mb-1.5">
          Why a scholarship would make this possible for you *
        </label>
        <textarea
          id="sch-whyScholarship"
          name="whyScholarship"
          required
          minLength={10}
          maxLength={2000}
          rows={3}
          className={inputClass}
        />
      </div>

      {status === "error" && <p className="text-sm text-destructive">{errorMsg}</p>}
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="privacyConsent" required /><span>I agree to the storage of my application details for pedagogical review and acknowledge the <Link to="/privacy-policy" target="_blank" className="underline">Privacy Policy</Link>.</span></label>
      <Button
        type="submit"
        disabled={status === "submitting"}
        className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-primary text-primary-foreground font-semibold disabled:opacity-60"
      >
        {status === "submitting" ? "Sending…" : "Submit application →"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Submitting an application does not guarantee a seat. Every application is reviewed with care
        by Cuca Medina.
      </p>
    </form>
  );
}
