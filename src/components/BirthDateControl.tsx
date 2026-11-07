import { useEffect, useState } from "react";
import { joinBirthDate, splitBirthDate } from "@/lib/birth-date-parts";

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function BirthDateControl({ initialValue, error }: { initialValue?: string; error?: string }) {
  const [parts, setParts] = useState(() => splitBirthDate(initialValue));
  useEffect(() => { setParts(splitBirthDate(initialValue)); }, [initialValue]);
  const currentYear = new Date().getUTCFullYear();
  const selectClass = "min-h-11 w-full min-w-0 rounded-lg border border-border/60 bg-background px-2 py-3 text-base text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary";
  return (
    <fieldset data-birth-date-control="selects-v1" className="min-w-0">
      <legend className="mb-2 text-sm text-foreground/85">Date of birth *</legend>
      <input type="hidden" name="birthDate" value={joinBirthDate(parts)} />
      <div className="grid grid-cols-[0.8fr_1fr_1.2fr] gap-2">
        <div className="min-w-0">
          <label htmlFor="birthDate" className="mb-1 block text-xs text-muted-foreground">Day</label>
          <select id="birthDate" required value={parts.day} onChange={e => setParts(p => ({ ...p, day: e.target.value }))} aria-invalid={!!error} aria-describedby={error ? "birthDate-error" : undefined} className={selectClass}>
            <option value="">Day</option>
            {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0")).map(day => <option key={day} value={day}>{Number(day)}</option>)}
          </select>
        </div>
        <div className="min-w-0">
          <label htmlFor="birthDate-month" className="mb-1 block text-xs text-muted-foreground">Month</label>
          <select id="birthDate-month" required value={parts.month} onChange={e => setParts(p => ({ ...p, month: e.target.value }))} aria-invalid={!!error} aria-describedby={error ? "birthDate-error" : undefined} className={selectClass}>
            <option value="">Month</option>
            {months.map((month, i) => <option key={month} value={String(i + 1).padStart(2, "0")}>{month}</option>)}
          </select>
        </div>
        <div className="min-w-0">
          <label htmlFor="birthDate-year" className="mb-1 block text-xs text-muted-foreground">Year</label>
          <select id="birthDate-year" required value={parts.year} onChange={e => setParts(p => ({ ...p, year: e.target.value }))} aria-invalid={!!error} aria-describedby={error ? "birthDate-error" : undefined} className={selectClass}>
            <option value="">Year</option>
            {Array.from({ length: currentYear + 1 }, (_, i) => String(currentYear - i).padStart(4, "0")).map(year => <option key={year} value={year}>{year}</option>)}
          </select>
        </div>
      </div>
      {error && <p id="birthDate-error" className="mt-2 text-sm text-destructive">{error}</p>}
    </fieldset>
  );
}