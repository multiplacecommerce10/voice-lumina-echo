import { useEffect, useMemo, useState, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { submitEnrollment } from "@/lib/enrollment.functions";
import { ensureUtmsCaptured, getAttributionContext, utmsToString } from "@/lib/utm";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { profileSchema, PROFILE_STORAGE_KEY, type EnrollmentProfile } from "@/lib/enrollment-profile";
import { Button } from "@/components/ui/button";
import { FlagIcon } from "@/components/ui/flag-icon";
import { BirthDateControl } from "@/components/BirthDateControl";

type Status = "idle" | "submitting" | "success" | "error";

const musicLevels = [
  "Beginner — just starting to explore my voice",
  "Some experience — sing for pleasure or in groups",
  "Intermediate — formal study or active practice",
  "Advanced — performer / teacher / professional",
];

export function EnrollmentForm({ initialProfile, onComplete, embedded = false, diagnostic = false }: { initialProfile?: Partial<EnrollmentProfile>; onComplete?: (profile: EnrollmentProfile) => void | Promise<void>; embedded?: boolean; diagnostic?: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [restoredProfile, setRestoredProfile] = useState(initialProfile);
  useEffect(() => {
    if (diagnostic) return;
    if (initialProfile) { setRestoredProfile(initialProfile); return; }
    try { const saved = sessionStorage.getItem(PROFILE_STORAGE_KEY); if (saved) setRestoredProfile(JSON.parse(saved)); } catch { /* storage unavailable */ }
  }, [initialProfile, diagnostic]);
  const submit = useServerFn(submitEnrollment);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [storageConsent, setStorageConsent] = useState(false);

  // Loaded lazily in the browser only: the country/city dataset is far too
  // large to ship inside the server bundle.
  const [allCountries, setAllCountries] = useState<
    { iso2: string; name: string; dial: string }[]
  >([]);

  useEffect(() => {
    let cancelled = false;
    import("country-state-city").then(({ Country }) => {
      if (cancelled) return;
      setAllCountries(
        Country.getAllCountries()
          .map((c) => ({
            iso2: c.isoCode,
            name: c.name,
            dial: c.phonecode?.startsWith("+") ? c.phonecode : `+${c.phonecode}`,
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);


  const dialCodes = useMemo(() => {
    return [...allCountries].sort((a, b) => {
      const na = parseInt(a.dial.replace(/\D/g, ""), 10) || 0;
      const nb = parseInt(b.dial.replace(/\D/g, ""), 10) || 0;
      return na - nb;
    });
  }, [allCountries]);

  const [dialIso, setDialIso] = useState<string>("BR");
  const [countryIso, setCountryIso] = useState<string>("");
  const [cities, setCities] = useState<string[]>([]);
  const [cityStatus, setCityStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [cityErrorMsg, setCityErrorMsg] = useState<string>("");

  const selectedCountryName = useMemo(() => {
    return allCountries.find((c) => c.iso2 === countryIso)?.name || "";
  }, [allCountries, countryIso]);

  useEffect(() => {
    if (!countryIso) {
      setCities([]);
      setCityStatus("idle");
      setCityErrorMsg("");
      return;
    }

    setCityStatus("loading");
    setCityErrorMsg("");

    const timer = setTimeout(() => {
      import("country-state-city")
        .then(({ City }) => {
          const list = City.getCitiesOfCountry(countryIso) || [];
          const names = Array.from(new Set(list.map((c) => c.name))).sort((a, b) =>
            a.localeCompare(b),
          );
          setCities(names);
          setCityStatus("success");
        })
        .catch((err: unknown) => {
          console.error("City autocomplete failed:", err);
          setCities([]);
          setCityStatus("error");
          setCityErrorMsg(
            err instanceof Error
              ? err.message
              : "Could not load cities. You can still type your city manually.",
          );
        });
    }, 400);

    return () => clearTimeout(timer);
  }, [countryIso]);

  useEffect(() => {
    if (!restoredProfile || !allCountries.length || !formRef.current) return;
    const country = allCountries.find((c) => c.name === restoredProfile.country);
    setCountryIso(country?.iso2 ?? "");
    const dial = [...allCountries].sort((a, b) => b.dial.length - a.dial.length).find((c) => restoredProfile.phone?.startsWith(`${c.dial} `));
    if (dial) setDialIso(dial.iso2);
    for (const [key, value] of Object.entries(restoredProfile)) {
      if (key === "birthDate") continue; // The controlled date selectors restore their own ISO value.
      const element = formRef.current.elements.namedItem(key);
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) element.value = key === "phone" && dial ? String(value).slice(dial.dial.length).trim() : String(value ?? "");
    }
    const checked = profileSchema.safeParse(restoredProfile);
    if (!checked.success) setFieldErrors(Object.fromEntries(checked.error.issues.map((issue) => [String(issue.path[0]), issue.message])));
  }, [restoredProfile, allCountries]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    setErrorMsg("");

    const form = e.currentTarget;
    const fd = new FormData(form);
    if (!diagnostic) ensureUtmsCaptured();
    const { utms, landingUrl, referrer } = diagnostic ? { utms: {}, landingUrl: "", referrer: "" } : getAttributionContext();
    const attributionParts = [
      utmsToString(utms),
      landingUrl ? `landing=${landingUrl}` : "",
      referrer ? `referrer=${referrer}` : "",
    ].filter(Boolean);
    const payload = {
      fullName: String(fd.get("fullName") || ""),
      birthDate: String(fd.get("birthDate") || ""),
      email: String(fd.get("email") || ""),
      phone:
        `${dialCodes.find((c) => c.iso2 === dialIso)?.dial || ""} ${String(fd.get("phone") || "")}`.trim(),
      city: String(fd.get("city") || ""),
      country: selectedCountryName,
      address: String(fd.get("address") || ""),
      profession: String(fd.get("profession") || ""),
      musicLevel: String(fd.get("musicLevel") || ""),
      academicExperience: String(fd.get("academicExperience") || ""),
      musicalPreferences: String(fd.get("musicalPreferences") || ""),
      motivation: String(fd.get("motivation") || ""),
      plan: "",
      attribution: attributionParts.join(" | ").slice(0, 1000),
      utmSource: utms.utm_source || "",
      utmMedium: utms.utm_medium || "",
      utmCampaign: utms.utm_campaign || "",
      utmTerm: utms.utm_term || "",
      utmContent: utms.utm_content || "",
      utmId: utms.utm_id || "",
      gclid: utms.gclid || "",
      fbclid: utms.fbclid || "",
      landingUrl: landingUrl || "",
      referrer: referrer || "",
      timezone: (() => {
        try {
          return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
        } catch {
          return "";
        }
      })(),
    };

    const checked = profileSchema.safeParse(payload);
    if (!checked.success) {
      setFieldErrors(Object.fromEntries(checked.error.issues.map((issue) => [String(issue.path[0]), issue.message])));
      setStatus("idle");
      const firstField = String(checked.error.issues[0]?.path[0]);
      form.querySelector<HTMLElement>(firstField === "birthDate" ? '[id="birthDate"]' : `[name="${firstField}"]`)?.focus();
      return;
    }
    setFieldErrors({});
    if (onComplete) {
      if (diagnostic && !storageConsent) { setStatus("error"); setErrorMsg("Please consent to storing your private test answers before continuing."); return; }
      try { await onComplete(checked.data); setStatus("idle"); }
      catch (error) { setStatus("error"); setErrorMsg(error instanceof Error ? error.message : "Your answers could not be saved. No payment was started."); }
      return;
    }
    if (diagnostic) { setStatus("error"); setErrorMsg("Private test unavailable."); return; }
    try {
      await submit({ data: payload });
      try { sessionStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(checked.data)); } catch { /* storage unavailable */ }
      setStatus("success");
      form.reset();
      setTimeout(() => {
        document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
      }, 600);
    } catch (err) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setStatus("error");
    }
  };

  const inputCls =
    "w-full rounded-xl border border-border/60 bg-background/40 px-4 py-3 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/40 transition-colors";
  const labelCls = "block text-sm text-foreground/85 mb-2";
  const hintCls = "text-xs text-muted-foreground/80 mt-1.5 italic";

  return (
    <section id={embedded ? "resumed-enrollment-form" : "enrollment-form"} className={embedded ? "w-full" : "max-w-4xl mx-auto px-6 py-24"}>
      {!embedded && <div className="text-center mb-10">
        <p className="text-xs uppercase tracking-[0.3em] text-primary mb-3">
          Step 1 · Pre-Enrollment
        </p>
        <h2 className="font-display text-4xl lg:text-5xl">
          Tell us a little about <span className="text-primary text-glow-gold">you</span>
        </h2>
        <p className="text-muted-foreground mt-4 max-w-2xl mx-auto leading-relaxed">
          Before choosing your plan, share a few words about yourself. This helps Cuca prepare your
          welcome and support you with care once you join — and unlocks the payment options below.
        </p>
      </div>

      }
      {status === "success" ? (
        <div className="glass-card rounded-3xl p-10 text-center ring-glow-gold">
          <div className="text-4xl text-primary mb-4">✦</div>
          <h3 className="font-display text-2xl text-primary mb-3">
            Thank you — we received your details
          </h3>
          <p className="text-muted-foreground leading-relaxed max-w-xl mx-auto">
            You can now choose your plan below. After your payment is confirmed, you will receive a
            personal welcome and preparation messages from our team to get you ready for the course.
          </p>
          <a
            href="#pricing"
            className="mt-6 inline-block px-6 py-3 rounded-full bg-gradient-to-r from-primary to-[oklch(0.65_0.20_45)] text-primary-foreground font-semibold shadow-glow-gold hover:scale-[1.02] transition-transform"
          >
            Continue to payment options
          </a>
        </div>
      ) : (
        <form ref={formRef} noValidate onSubmit={handleSubmit} className={embedded ? "space-y-6" : "glass-card rounded-3xl p-6 sm:p-10 space-y-6"}>
          {Object.keys(fieldErrors).length > 0 && <div role="alert" className="border border-destructive/50 bg-destructive/10 text-destructive rounded-lg p-4"><p className="font-semibold">Please complete the highlighted required details.</p><ul className="mt-2 space-y-1">{Object.entries(fieldErrors).map(([field, message]) => <li key={field}><a href={`#${field}`} onClick={(e) => { e.preventDefault(); formRef.current?.querySelector<HTMLElement>(`[id="${field}"]`)?.focus(); }} className="underline">{message}</a></li>)}</ul></div>}
          <div className="grid sm:grid-cols-2 gap-5">
            <div className={fieldErrors.fullName ? "rounded-lg ring-2 ring-destructive/60 bg-destructive/5 p-2" : ""}>
              <label className={labelCls} htmlFor="fullName">
                Full name *
              </label>
              <input
                id="fullName"
                name="fullName"
                required
                maxLength={120}
                className={inputCls}
                placeholder="Your full name"
              />
            </div>
            <div className={fieldErrors.birthDate ? "rounded-lg ring-2 ring-destructive/60 bg-destructive/5 p-2" : ""}>
              <BirthDateControl initialValue={restoredProfile?.birthDate} error={fieldErrors.birthDate} />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <div className={fieldErrors.email ? "rounded-lg ring-2 ring-destructive/60 bg-destructive/5 p-2" : ""}>
              <label className={labelCls} htmlFor="email">
                Email *
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                maxLength={160}
                className={inputCls}
                placeholder="you@example.com"
              />
            </div>
            <div className={fieldErrors.phone ? "rounded-lg ring-2 ring-destructive/60 bg-destructive/5 p-2" : ""}>
              <label className={labelCls} htmlFor="phone">
                Phone / WhatsApp *
              </label>
              <div className="flex gap-2">
                <Select value={dialIso} onValueChange={setDialIso}>
                  <SelectTrigger
                    className={`${inputCls} w-32 shrink-0 pr-2 justify-between`}
                    aria-label="Country dialing code"
                  >
                    <span className="flex items-center gap-2 truncate">
                      {(() => {
                        const c = dialCodes.find((c) => c.iso2 === dialIso);
                        return c ? (
                          <>
                            <FlagIcon countryCode={c.iso2} className="w-5 h-3.5" />
                            <span>
                              {c.dial} {c.iso2}
                            </span>
                          </>
                        ) : (
                          "Code"
                        );
                      })()}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {dialCodes.map((c) => (
                      <SelectItem key={`dial-${c.iso2}`} value={c.iso2}>
                        <span className="flex items-center gap-2">
                          <FlagIcon countryCode={c.iso2} className="w-5 h-3.5" />
                          <span>
                            {c.dial} {c.iso2}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input
                  id="phone"
                  name="phone"
                  required
                  maxLength={40}
                  inputMode="tel"
                  className={inputCls}
                  placeholder="000 000 000"
                />
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <div className={fieldErrors.country ? "rounded-lg ring-2 ring-destructive/60 bg-destructive/5 p-2" : ""}>
              <label className={labelCls} htmlFor="country">
                Country *
              </label>
              <Select value={countryIso} onValueChange={setCountryIso} required>
                <SelectTrigger className={`${inputCls} justify-between`} id="country">
                  <span className="flex items-center gap-2 truncate">
                    {(() => {
                      const c = allCountries.find((c) => c.iso2 === countryIso);
                      return c ? (
                        <>
                          <FlagIcon countryCode={c.iso2} className="w-5 h-3.5" />
                          <span>{c.name}</span>
                        </>
                      ) : (
                        "Select your country…"
                      );
                    })()}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {allCountries.map((c) => (
                    <SelectItem key={c.iso2} value={c.iso2}>
                      <span className="flex items-center gap-2">
                        <FlagIcon countryCode={c.iso2} className="w-5 h-3.5" />
                        <span>{c.name}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className={fieldErrors.city ? "rounded-lg ring-2 ring-destructive/60 bg-destructive/5 p-2" : ""}>
              <label className={labelCls} htmlFor="city">
                City *
              </label>
              <div className="relative">
                <input
                  id="city"
                  name="city"
                  required
                  maxLength={120}
                  list="city-options"
                  className={`${inputCls} ${cityStatus === "loading" ? "pr-10" : ""}`}
                  placeholder={countryIso ? "Start typing your city…" : "Select a country first"}
                  disabled={!countryIso || cityStatus === "loading"}
                />
                {cityStatus === "loading" && (
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/70">
                    <svg
                      className="animate-spin h-5 w-5"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                  </span>
                )}
              </div>
              <datalist id="city-options">
                {cities.slice(0, 5000).map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
              {cityStatus === "loading" && (
                <p className={hintCls}>Loading cities for your country…</p>
              )}
              {cityStatus === "error" && (
                <p className="text-xs text-destructive mt-1.5">
                  {cityErrorMsg || "Could not load cities. You can still type your city manually."}
                </p>
              )}
              {cityStatus === "success" && cities.length === 0 && countryIso && (
                <p className={hintCls}>
                  No cities were found in our database for this country — feel free to type yours.
                </p>
              )}
            </div>
          </div>

          <div className={fieldErrors.address ? "rounded-lg ring-2 ring-destructive/60 bg-destructive/5 p-2" : ""}>
            <label className={labelCls} htmlFor="address">
              Address *
            </label>
            <input
              id="address"
              name="address"
              required
              maxLength={300}
              className={inputCls}
              placeholder="Street, number, neighborhood, postal code"
            />
          </div>

          <div className={fieldErrors.profession ? "rounded-lg ring-2 ring-destructive/60 bg-destructive/5 p-2" : ""}>
            <label className={labelCls} htmlFor="profession">
              Profession *
            </label>
            <input
              id="profession"
              name="profession"
              required
              maxLength={160}
              className={inputCls}
              placeholder="What do you do? (e.g. teacher, designer, student, singer…)"
            />
          </div>

          <div className={fieldErrors.musicLevel ? "rounded-lg ring-2 ring-destructive/60 bg-destructive/5 p-2" : ""}>
            <label className={labelCls} htmlFor="musicLevel">
              Level of musical formation *
            </label>
            <select id="musicLevel" name="musicLevel" required className={inputCls} defaultValue="">
              <option value="" disabled>
                Select your level…
              </option>
              {musicLevels.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          <div className={fieldErrors.academicExperience ? "rounded-lg ring-2 ring-destructive/60 bg-destructive/5 p-2" : ""}>
            <label className={labelCls} htmlFor="academicExperience">
              Musical & academic experience *
            </label>
            <textarea
              id="academicExperience"
              name="academicExperience"
              required
              rows={3}
              maxLength={2000}
              className={inputCls}
              placeholder="Have you studied music formally? Taken part in choirs, bands, theatre, dance? What instruments or styles have shaped you so far?"
            />
            <p className={hintCls}>
              ✦ Share anything that feels meaningful — even a self-taught path tells a beautiful
              story.
            </p>
          </div>

          <div className={fieldErrors.musicalPreferences ? "rounded-lg ring-2 ring-destructive/60 bg-destructive/5 p-2" : ""}>
            <label className={labelCls} htmlFor="musicalPreferences">
              Musical preferences — genres & styles you listen to often *
            </label>
            <textarea
              id="musicalPreferences"
              name="musicalPreferences"
              required
              rows={3}
              maxLength={2000}
              className={inputCls}
              placeholder="What genres, artists or styles light you up? What are you drawn to lately?"
            />
            <p className={hintCls}>
              ✧ Your listening shapes your voice — we love hearing where your ear lives.
            </p>
          </div>

          <div className={fieldErrors.motivation ? "rounded-lg ring-2 ring-destructive/60 bg-destructive/5 p-2" : ""}>
            <label className={labelCls} htmlFor="motivation">
              What moves you to grow vocally? *
            </label>
            <textarea
              id="motivation"
              name="motivation"
              required
              rows={4}
              maxLength={2000}
              className={inputCls}
              placeholder="Comment on your musical and artistic experience and what most motivates you to grow vocally — what would you love to unlock in your voice?"
            />
            <p className={hintCls}>
              ◈ There are no right answers — only your truth. This helps Cuca welcome you
              personally.
            </p>
          </div>

          {status === "error" && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              {errorMsg || "Something went wrong. Please try again."}
            </div>
          )}

          {diagnostic && <label className="flex items-start gap-3 text-sm leading-relaxed"><input className="mt-1 shrink-0" type="checkbox" checked={storageConsent} onChange={e => setStorageConsent(e.target.checked)} aria-label="Consent to private answer storage" /><span>I consent to Tecendo Som privately storing all my form answers and this consent before checkout for this private guest test.</span></label>}
          <div className="flex flex-col items-center gap-3 pt-2">
            <Button
              type="submit"
              disabled={status === "submitting" || (diagnostic && !storageConsent)}
              className="w-full sm:w-auto px-10 py-4 rounded-full bg-gradient-to-r from-primary to-[oklch(0.65_0.20_45)] text-primary-foreground font-semibold shadow-glow-gold hover:scale-[1.02] transition-transform disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {status === "submitting" ? "Sending…" : embedded ? "Continue with these details" : "Submit"}
            </Button>
            <p className="text-xs text-muted-foreground/80 text-center max-w-md">
              {diagnostic ? "Your answers stay private. Continuing saves them; it does not make a payment." : "Your information is kept private and used only to welcome and prepare you for the course."}
            </p>
          </div>
        </form>
      )}
    </section>
  );
}
