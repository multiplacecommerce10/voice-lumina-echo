import { useMemo, useState } from "react";

// Curated list of countries → IANA timezones (region/city)
// Focused on regions likely to enroll. Easy to extend.
const TIMEZONES: Record<string, { tz: string; label: string }[]> = {
  // ─── South America ───
  Brazil: [
    { tz: "America/Sao_Paulo", label: "São Paulo" },
    { tz: "America/Sao_Paulo", label: "Rio de Janeiro" },
    { tz: "America/Sao_Paulo", label: "Belo Horizonte" },
    { tz: "America/Sao_Paulo", label: "Brasília" },
    { tz: "America/Sao_Paulo", label: "Curitiba" },
    { tz: "America/Sao_Paulo", label: "Porto Alegre" },
    { tz: "America/Sao_Paulo", label: "Salvador" },
    { tz: "America/Sao_Paulo", label: "Florianópolis" },
    { tz: "America/Sao_Paulo", label: "Vitória" },
    { tz: "America/Sao_Paulo", label: "Goiânia" },
    { tz: "America/Fortaleza", label: "Fortaleza" },
    { tz: "America/Recife", label: "Recife" },
    { tz: "America/Maceio", label: "Maceió" },
    { tz: "America/Bahia", label: "Bahia (interior)" },
    { tz: "America/Belem", label: "Belém" },
    { tz: "America/Araguaina", label: "Palmas" },
    { tz: "America/Manaus", label: "Manaus" },
    { tz: "America/Porto_Velho", label: "Porto Velho" },
    { tz: "America/Cuiaba", label: "Cuiabá" },
    { tz: "America/Campo_Grande", label: "Campo Grande" },
    { tz: "America/Boa_Vista", label: "Boa Vista" },
    { tz: "America/Rio_Branco", label: "Rio Branco" },
    { tz: "America/Noronha", label: "Fernando de Noronha" },
  ],
  Argentina: [
    { tz: "America/Argentina/Buenos_Aires", label: "Buenos Aires" },
    { tz: "America/Argentina/Cordoba", label: "Córdoba" },
    { tz: "America/Argentina/Mendoza", label: "Mendoza" },
    { tz: "America/Argentina/Ushuaia", label: "Ushuaia" },
  ],
  Bolivia: [{ tz: "America/La_Paz", label: "La Paz" }],
  Chile: [
    { tz: "America/Santiago", label: "Santiago" },
    { tz: "Pacific/Easter", label: "Easter Island" },
  ],
  Colombia: [
    { tz: "America/Bogota", label: "Bogotá" },
    { tz: "America/Bogota", label: "Medellín" },
    { tz: "America/Bogota", label: "Cali" },
  ],
  Ecuador: [
    { tz: "America/Guayaquil", label: "Quito / Guayaquil" },
    { tz: "Pacific/Galapagos", label: "Galápagos" },
  ],
  Paraguay: [{ tz: "America/Asuncion", label: "Asunción" }],
  Peru: [
    { tz: "America/Lima", label: "Lima" },
    { tz: "America/Lima", label: "Cusco" },
  ],
  Uruguay: [{ tz: "America/Montevideo", label: "Montevideo" }],
  Venezuela: [{ tz: "America/Caracas", label: "Caracas" }],

  // ─── North & Central America ───
  Canada: [
    { tz: "America/Toronto", label: "Toronto" },
    { tz: "America/Montreal", label: "Montreal" },
    { tz: "America/Halifax", label: "Halifax" },
    { tz: "America/St_Johns", label: "St. John's" },
    { tz: "America/Winnipeg", label: "Winnipeg" },
    { tz: "America/Edmonton", label: "Calgary / Edmonton" },
    { tz: "America/Vancouver", label: "Vancouver" },
  ],
  "Costa Rica": [{ tz: "America/Costa_Rica", label: "San José" }],
  Cuba: [{ tz: "America/Havana", label: "Havana" }],
  "Dominican Republic": [{ tz: "America/Santo_Domingo", label: "Santo Domingo" }],
  Guatemala: [{ tz: "America/Guatemala", label: "Guatemala City" }],
  Mexico: [
    { tz: "America/Mexico_City", label: "Mexico City" },
    { tz: "America/Monterrey", label: "Monterrey" },
    { tz: "America/Cancun", label: "Cancún" },
    { tz: "America/Tijuana", label: "Tijuana" },
  ],
  Panama: [{ tz: "America/Panama", label: "Panama City" }],
  "Puerto Rico": [{ tz: "America/Puerto_Rico", label: "San Juan" }],
  "United States": [
    { tz: "America/New_York", label: "New York" },
    { tz: "America/New_York", label: "Boston" },
    { tz: "America/New_York", label: "Washington DC" },
    { tz: "America/New_York", label: "Miami" },
    { tz: "America/New_York", label: "Atlanta" },
    { tz: "America/Chicago", label: "Chicago" },
    { tz: "America/Chicago", label: "Houston" },
    { tz: "America/Chicago", label: "Dallas" },
    { tz: "America/Chicago", label: "New Orleans" },
    { tz: "America/Denver", label: "Denver" },
    { tz: "America/Phoenix", label: "Phoenix" },
    { tz: "America/Los_Angeles", label: "Los Angeles" },
    { tz: "America/Los_Angeles", label: "San Francisco" },
    { tz: "America/Los_Angeles", label: "Seattle" },
    { tz: "America/Los_Angeles", label: "San Diego" },
    { tz: "America/Anchorage", label: "Anchorage" },
    { tz: "Pacific/Honolulu", label: "Honolulu" },
  ],

  // ─── Europe ───
  Austria: [{ tz: "Europe/Vienna", label: "Vienna" }],
  Belgium: [{ tz: "Europe/Brussels", label: "Brussels" }],
  Bulgaria: [{ tz: "Europe/Sofia", label: "Sofia" }],
  Croatia: [{ tz: "Europe/Zagreb", label: "Zagreb" }],
  "Czech Republic": [{ tz: "Europe/Prague", label: "Prague" }],
  Denmark: [{ tz: "Europe/Copenhagen", label: "Copenhagen" }],
  Estonia: [{ tz: "Europe/Tallinn", label: "Tallinn" }],
  Finland: [{ tz: "Europe/Helsinki", label: "Helsinki" }],
  France: [
    { tz: "Europe/Paris", label: "Paris" },
    { tz: "Europe/Paris", label: "Lyon" },
    { tz: "Europe/Paris", label: "Marseille" },
  ],
  Germany: [
    { tz: "Europe/Berlin", label: "Berlin" },
    { tz: "Europe/Berlin", label: "Munich" },
    { tz: "Europe/Berlin", label: "Hamburg" },
    { tz: "Europe/Berlin", label: "Frankfurt" },
  ],
  Greece: [{ tz: "Europe/Athens", label: "Athens" }],
  Hungary: [{ tz: "Europe/Budapest", label: "Budapest" }],
  Iceland: [{ tz: "Atlantic/Reykjavik", label: "Reykjavík" }],
  Ireland: [
    { tz: "Europe/Dublin", label: "Dublin" },
    { tz: "Europe/Dublin", label: "Cork" },
  ],
  Italy: [
    { tz: "Europe/Rome", label: "Rome" },
    { tz: "Europe/Rome", label: "Milan" },
    { tz: "Europe/Rome", label: "Florence" },
    { tz: "Europe/Rome", label: "Naples" },
  ],
  Latvia: [{ tz: "Europe/Riga", label: "Riga" }],
  Lithuania: [{ tz: "Europe/Vilnius", label: "Vilnius" }],
  Luxembourg: [{ tz: "Europe/Luxembourg", label: "Luxembourg" }],
  Malta: [{ tz: "Europe/Malta", label: "Valletta" }],
  Netherlands: [
    { tz: "Europe/Amsterdam", label: "Amsterdam" },
    { tz: "Europe/Amsterdam", label: "Rotterdam" },
  ],
  Norway: [{ tz: "Europe/Oslo", label: "Oslo" }],
  Poland: [
    { tz: "Europe/Warsaw", label: "Warsaw" },
    { tz: "Europe/Warsaw", label: "Kraków" },
  ],
  Portugal: [
    { tz: "Europe/Lisbon", label: "Lisbon" },
    { tz: "Europe/Lisbon", label: "Porto" },
    { tz: "Atlantic/Madeira", label: "Madeira" },
    { tz: "Atlantic/Azores", label: "Azores" },
  ],
  Romania: [{ tz: "Europe/Bucharest", label: "Bucharest" }],
  Russia: [
    { tz: "Europe/Moscow", label: "Moscow" },
    { tz: "Europe/Kaliningrad", label: "Kaliningrad" },
    { tz: "Asia/Yekaterinburg", label: "Yekaterinburg" },
    { tz: "Asia/Novosibirsk", label: "Novosibirsk" },
    { tz: "Asia/Vladivostok", label: "Vladivostok" },
  ],
  Serbia: [{ tz: "Europe/Belgrade", label: "Belgrade" }],
  Slovakia: [{ tz: "Europe/Bratislava", label: "Bratislava" }],
  Slovenia: [{ tz: "Europe/Ljubljana", label: "Ljubljana" }],
  Spain: [
    { tz: "Europe/Madrid", label: "Madrid" },
    { tz: "Europe/Madrid", label: "Barcelona" },
    { tz: "Europe/Madrid", label: "Valencia" },
    { tz: "Europe/Madrid", label: "Seville" },
    { tz: "Atlantic/Canary", label: "Canary Islands" },
  ],
  Sweden: [{ tz: "Europe/Stockholm", label: "Stockholm" }],
  Switzerland: [
    { tz: "Europe/Zurich", label: "Zurich" },
    { tz: "Europe/Zurich", label: "Geneva" },
  ],
  Ukraine: [{ tz: "Europe/Kyiv", label: "Kyiv" }],
  "United Kingdom": [
    { tz: "Europe/London", label: "London" },
    { tz: "Europe/London", label: "Manchester" },
    { tz: "Europe/London", label: "Birmingham" },
    { tz: "Europe/London", label: "Edinburgh" },
    { tz: "Europe/London", label: "Glasgow" },
    { tz: "Europe/London", label: "Cardiff" },
    { tz: "Europe/London", label: "Belfast" },
  ],

  // ─── Middle East ───
  Bahrain: [{ tz: "Asia/Bahrain", label: "Manama" }],
  Iran: [{ tz: "Asia/Tehran", label: "Tehran" }],
  Iraq: [{ tz: "Asia/Baghdad", label: "Baghdad" }],
  Israel: [{ tz: "Asia/Jerusalem", label: "Tel Aviv / Jerusalem" }],
  Jordan: [{ tz: "Asia/Amman", label: "Amman" }],
  Kuwait: [{ tz: "Asia/Kuwait", label: "Kuwait City" }],
  Lebanon: [{ tz: "Asia/Beirut", label: "Beirut" }],
  Oman: [{ tz: "Asia/Muscat", label: "Muscat" }],
  Qatar: [{ tz: "Asia/Qatar", label: "Doha" }],
  "Saudi Arabia": [
    { tz: "Asia/Riyadh", label: "Riyadh" },
    { tz: "Asia/Riyadh", label: "Jeddah" },
  ],
  Turkey: [
    { tz: "Europe/Istanbul", label: "Istanbul" },
    { tz: "Europe/Istanbul", label: "Ankara" },
  ],
  "United Arab Emirates": [
    { tz: "Asia/Dubai", label: "Dubai" },
    { tz: "Asia/Dubai", label: "Abu Dhabi" },
  ],

  // ─── Asia ───
  Bangladesh: [{ tz: "Asia/Dhaka", label: "Dhaka" }],
  Cambodia: [{ tz: "Asia/Phnom_Penh", label: "Phnom Penh" }],
  China: [
    { tz: "Asia/Shanghai", label: "Beijing" },
    { tz: "Asia/Shanghai", label: "Shanghai" },
    { tz: "Asia/Shanghai", label: "Guangzhou" },
  ],
  "Hong Kong": [{ tz: "Asia/Hong_Kong", label: "Hong Kong" }],
  India: [
    { tz: "Asia/Kolkata", label: "Mumbai" },
    { tz: "Asia/Kolkata", label: "Delhi" },
    { tz: "Asia/Kolkata", label: "Bangalore" },
    { tz: "Asia/Kolkata", label: "Kolkata" },
    { tz: "Asia/Kolkata", label: "Chennai" },
    { tz: "Asia/Kolkata", label: "Hyderabad" },
  ],
  Indonesia: [
    { tz: "Asia/Jakarta", label: "Jakarta" },
    { tz: "Asia/Makassar", label: "Bali / Denpasar" },
  ],
  Japan: [
    { tz: "Asia/Tokyo", label: "Tokyo" },
    { tz: "Asia/Tokyo", label: "Osaka" },
    { tz: "Asia/Tokyo", label: "Kyoto" },
  ],
  Malaysia: [{ tz: "Asia/Kuala_Lumpur", label: "Kuala Lumpur" }],
  Nepal: [{ tz: "Asia/Kathmandu", label: "Kathmandu" }],
  Pakistan: [
    { tz: "Asia/Karachi", label: "Karachi" },
    { tz: "Asia/Karachi", label: "Lahore" },
    { tz: "Asia/Karachi", label: "Islamabad" },
  ],
  Philippines: [{ tz: "Asia/Manila", label: "Manila" }],
  Singapore: [{ tz: "Asia/Singapore", label: "Singapore" }],
  "South Korea": [{ tz: "Asia/Seoul", label: "Seoul" }],
  "Sri Lanka": [{ tz: "Asia/Colombo", label: "Colombo" }],
  Taiwan: [{ tz: "Asia/Taipei", label: "Taipei" }],
  Thailand: [{ tz: "Asia/Bangkok", label: "Bangkok" }],
  Vietnam: [
    { tz: "Asia/Ho_Chi_Minh", label: "Ho Chi Minh City" },
    { tz: "Asia/Ho_Chi_Minh", label: "Hanoi" },
  ],

  // ─── Africa ───
  Algeria: [{ tz: "Africa/Algiers", label: "Algiers" }],
  Angola: [{ tz: "Africa/Luanda", label: "Luanda" }],
  "Cape Verde": [{ tz: "Atlantic/Cape_Verde", label: "Praia" }],
  Egypt: [{ tz: "Africa/Cairo", label: "Cairo" }],
  Ethiopia: [{ tz: "Africa/Addis_Ababa", label: "Addis Ababa" }],
  Ghana: [{ tz: "Africa/Accra", label: "Accra" }],
  Kenya: [{ tz: "Africa/Nairobi", label: "Nairobi" }],
  Morocco: [{ tz: "Africa/Casablanca", label: "Casablanca" }],
  Mozambique: [{ tz: "Africa/Maputo", label: "Maputo" }],
  Nigeria: [{ tz: "Africa/Lagos", label: "Lagos" }],
  Senegal: [{ tz: "Africa/Dakar", label: "Dakar" }],
  "South Africa": [
    { tz: "Africa/Johannesburg", label: "Johannesburg" },
    { tz: "Africa/Johannesburg", label: "Cape Town" },
    { tz: "Africa/Johannesburg", label: "Durban" },
  ],
  Tanzania: [{ tz: "Africa/Dar_es_Salaam", label: "Dar es Salaam" }],
  Tunisia: [{ tz: "Africa/Tunis", label: "Tunis" }],

  // ─── Oceania ───
  Australia: [
    { tz: "Australia/Sydney", label: "Sydney" },
    { tz: "Australia/Melbourne", label: "Melbourne" },
    { tz: "Australia/Brisbane", label: "Brisbane" },
    { tz: "Australia/Adelaide", label: "Adelaide" },
    { tz: "Australia/Perth", label: "Perth" },
    { tz: "Australia/Hobart", label: "Hobart" },
    { tz: "Australia/Darwin", label: "Darwin" },
  ],
  Fiji: [{ tz: "Pacific/Fiji", label: "Suva" }],
  "New Zealand": [
    { tz: "Pacific/Auckland", label: "Auckland" },
    { tz: "Pacific/Auckland", label: "Wellington" },
  ],
};

// First class: Tuesday September 1, 2026, 09:30 in São Paulo — that's 12:30 UTC (UTC-3, no DST).
const FIRST_CLASS_UTC = new Date(Date.UTC(2026, 8, 1, 12, 30));
const CLASS_END_UTC = new Date(Date.UTC(2026, 8, 1, 14, 0));

function formatInTz(date: Date, timeZone: string) {
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    weekday: "long",
  }).format(date);
  return time;
}

function tzOffsetLabel(timeZone: string, date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
  }).formatToParts(date);
  return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
}

export function TimezoneConverter() {
  const [open, setOpen] = useState(false);
  const countries = Object.keys(TIMEZONES).sort();
  const [country, setCountry] = useState<string>("");
  const cities = country ? TIMEZONES[country] : [];
  const [cityIdx, setCityIdx] = useState<number>(-1);
  const selected = cityIdx >= 0 ? cities[cityIdx] : null;
  const hasSelection = Boolean(country && selected);

  const localStart = useMemo(
    () => (selected ? formatInTz(FIRST_CLASS_UTC, selected.tz) : ""),
    [selected],
  );
  const localEnd = useMemo(
    () => (selected ? formatInTz(CLASS_END_UTC, selected.tz) : ""),
    [selected],
  );
  const offset = useMemo(
    () => (selected ? tzOffsetLabel(selected.tz, FIRST_CLASS_UTC) : ""),
    [selected],
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group inline-flex items-center gap-2 px-4 py-2 rounded-full mb-[5px] text-sm font-medium
                   bg-gradient-to-r from-primary/20 via-secondary/15 to-primary/20
                   border border-primary/40 text-foreground hover:from-primary/30 hover:to-secondary/30
                   hover:border-secondary/60 transition-all ring-glow-cyan"
        aria-label="Convert class time to your local timezone"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-secondary">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />
        </svg>
        <span className="text-secondary">⌖</span> See your local class time
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-md glass-card rounded-2xl p-6 ring-glow-gold"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              ✕
            </button>
            <p className="text-xs uppercase tracking-[0.25em] text-primary mb-2">
              Your Local Class Time
            </p>
            <h3 className="font-display text-2xl text-foreground mb-1">
              Find your timezone
            </h3>
            <p className="text-sm text-muted-foreground mb-5">
              Classes start Tuesday, September 1. Select your country and city to see
              your local time.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  Country
                </label>
                <select
                  value={country}
                  onChange={(e) => {
                    setCountry(e.target.value);
                    setCityIdx(-1);
                  }}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">Select your country…</option>
                  {countries.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              {country && (
                <div>
                  <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-2">
                    City / Region
                  </label>
                  <select
                    value={cityIdx}
                    onChange={(e) => setCityIdx(Number(e.target.value))}
                    className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value={-1}>Select your city…</option>
                    {cities.map((c, i) => (
                      <option key={`${c.tz}-${c.label}-${i}`} value={i}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="mt-6 p-5 rounded-xl bg-gradient-to-br from-primary/10 via-transparent to-secondary/10 border border-primary/20">
              <p className="text-xs uppercase tracking-[0.25em] text-secondary mb-2">
                Weekly class · Local time
              </p>
              {hasSelection && selected ? (
                <>
                  <p className="font-display text-2xl text-primary text-glow-gold">
                    {localStart} → {localEnd.replace(/^[^,]+,?\s*/, "")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {selected.label}, {country} · {offset}
                  </p>
                </>
              ) : (
                <p className="font-display text-2xl text-primary text-glow-gold">
                  Tuesday, September 1, 2026
                </p>
              )}
              <p className="text-xs text-muted-foreground/80 mt-3 italic">
                {hasSelection
                  ? "Based on the first class — Tuesday, September 1, 2026."
                  : "Select your country and city above to reveal your local class time."}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
