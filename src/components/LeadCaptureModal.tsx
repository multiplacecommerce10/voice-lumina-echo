import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { EnrollmentForm } from "./EnrollmentForm";
import { PROFILE_STORAGE_KEY, profileSchema, type EnrollmentProfile } from "@/lib/enrollment-profile";
import { Button } from "@/components/ui/button";
import { captureLead } from "@/lib/leads.functions";
import { ensureUtmsCaptured, getAttributionContext } from "@/lib/utm";
import { LEGAL, LEGAL_VERSIONS } from "@/lib/legal";
import type { PackageConsent } from "@/lib/payments.functions";

interface Props {
  initialProfile?: Partial<EnrollmentProfile>;
  resumeCode?: string;
  planLabel: string;
  planIntended: string;
  /** "stripe" = embedded recurring card checkout · "wise" = manual, non-renewing bank transfer */
  method?: "stripe" | "wise";
  onClose: () => void;
  onCaptured: (lead: { leadId: string; email: string; consent: PackageConsent }) => void;
}

export function LeadCaptureModal({
  initialProfile,
  resumeCode,
  planLabel,
  planIntended,
  method = "stripe",
  onClose,
  onCaptured,
}: Props) {
  const capture = useServerFn(captureLead);
  const [profile, setProfile] = useState<EnrollmentProfile | null>(null);
  const [savedProfile, setSavedProfile] = useState(initialProfile);
  useEffect(() => { if (initialProfile) { setSavedProfile(initialProfile); return; } try { const saved = sessionStorage.getItem(PROFILE_STORAGE_KEY); if (saved) setSavedProfile(JSON.parse(saved)); } catch { /* storage unavailable */ } }, [initialProfile]);
  const isWise = method === "wise";
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acknowledgePrivacy, setAcknowledgePrivacy] = useState(false);
  const [immediateAccess, setImmediateAccess] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!profile || !profileSchema.safeParse(profile).success) { setError("Please complete all student details first."); return; }
    if (!acceptTerms) {
      setError("Please accept the Terms of Service and the Refund Policy to continue.");
      return;
    }
    if (!acknowledgePrivacy) {
      setError("Please confirm that you have read the Privacy Policy notice.");
      return;
    }
    if (!immediateAccess) {
      setError(
        "Please confirm the statement about access starting during the 14-day withdrawal period.",
      );
      return;
    }
    setLoading(true);
    const now = new Date().toISOString();
    const consent: PackageConsent = {
      termsVersion: LEGAL_VERSIONS.terms,
      privacyVersion: LEGAL_VERSIONS.privacy,
      refundVersion: LEGAL_VERSIONS.refund,
      acceptedAt: now,
      immediateAccessAt: now,
      marketingOptIn,
    };
    try {
      ensureUtmsCaptured();
      // getAttributionContext() returns empty values without analytics/marketing consent.
      const { utms, landingUrl, referrer } = getAttributionContext();
      const result = await capture({
        data: {
          profile,
          resumeCode,
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          planIntended,
          utms,
          landingUrl,
          referrer,
          consent,
        },
      });
      if ("error" in result) {
        setError(result.error);
        setLoading(false);
        return;
      }
      onCaptured({ leadId: result.leadId, email: email.trim(), consent });
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  const checkboxClass = "mt-1 accent-primary shrink-0";

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div className="min-h-screen flex items-start justify-center p-4 sm:p-8">
        <div
          className="relative w-full max-w-3xl bg-background rounded-2xl shadow-2xl p-6 sm:p-8"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute -top-3 -right-3 z-10 w-10 h-10 rounded-full bg-background border border-border flex items-center justify-center text-foreground hover:bg-muted shadow-lg"
            aria-label="Close"
          >
            ✕
          </button>

          <p className="text-xs uppercase tracking-[0.25em] text-primary mb-2">Step 1 of 2</p>
          <h2 className="font-display text-2xl mb-2">Reserve your seat</h2>
          <p className="text-sm text-muted-foreground mb-6">
            {planLabel} —{" "}
            {isWise
              ? "quick details before we send you to Wise to complete a manual international bank transfer, which covers a single period and does not renew."
              : "quick details before we open the secure payment."}{" "}
            Card plans are charged in full for the period you choose and renew automatically until you cancel.
          </p>

          {!profile ? <EnrollmentForm embedded initialProfile={savedProfile} onComplete={(value) => { setProfile(value); setFullName(value.fullName); setEmail(value.email); setPhone(value.phone); }} /> : <>
          <div className="mb-4 text-sm text-foreground"><p>{fullName} · {email}</p><Button variant="link" onClick={() => { setSavedProfile(profile); setProfile(null); }}>Edit student details</Button></div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-3 rounded-xl border border-border/60 p-4">
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className={checkboxClass}
                />
                <span className="text-muted-foreground leading-relaxed">
                  I accept the{" "}
                  <Link to="/terms-of-service" target="_blank" className="text-primary underline underline-offset-2">
                    Terms of Service
                  </Link>{" "}
                  and the{" "}
                  <Link to="/refund-policy" target="_blank" className="text-primary underline underline-offset-2">
                    Refund Policy
                  </Link>
                  . *
                </span>
              </label>

              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={acknowledgePrivacy}
                  onChange={(e) => setAcknowledgePrivacy(e.target.checked)}
                  className={checkboxClass}
                />
                <span className="text-muted-foreground leading-relaxed">
                  I have read the{" "}
                  <Link to="/privacy-policy" target="_blank" className="text-primary underline underline-offset-2">
                    Privacy Policy
                  </Link>{" "}
                  notice explaining how my data is processed. *
                </span>
              </label>

              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={immediateAccess}
                  onChange={(e) => setImmediateAccess(e.target.checked)}
                  className={checkboxClass}
                />
                <span className="text-muted-foreground leading-relaxed">
                  I request that access/performance begin during the 14-day withdrawal period and
                  understand that, where legally permitted, a proportionate amount may be deducted
                  for services already supplied if I withdraw. *
                </span>
              </label>
            </div>

            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={marketingOptIn}
                onChange={(e) => setMarketingOptIn(e.target.checked)}
                className={checkboxClass}
              />
              <span className="text-muted-foreground leading-relaxed">
                Optional: I would like to receive news, offers and WhatsApp messages about future
                courses. This is not required to enroll and I can opt out at any time.
              </span>
            </label>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-3 rounded-full bg-gradient-to-r from-primary to-[oklch(0.65_0.20_45)] text-primary-foreground font-semibold shadow-glow-gold hover:scale-[1.02] transition-transform disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading
                ? "Saving…"
                : isWise
                  ? "Continue to international transfer →"
                  : "Continue to secure payment →"}
            </Button>

            <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
              {isWise
                ? "You will be taken to Wise to complete a manual international bank transfer. It covers a single period and does not renew."
                : "Payment is processed securely by Stripe."}{" "}
              Full period charged today · Renews automatically until cancelled.
              <br />
              {LEGAL.sellerName} · CNPJ {LEGAL.cnpj} · {LEGAL.addressFull} · {LEGAL.contactEmail}
            </p>
          </form>
          </>}
        </div>
      </div>
    </div>
  );
}
