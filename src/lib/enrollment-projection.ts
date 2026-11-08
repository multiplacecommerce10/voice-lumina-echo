/** Unsupported time zones must not discard an otherwise valid enrollment. */
export function enrollmentTimezone(value: string) {
  try { new Intl.DateTimeFormat("en-US", { timeZone: value || "UTC" }).format(); return value || "UTC"; }
  catch { return "UTC"; }
}
export function enrollmentSheetRow(lead: any): string[] {
  const a = lead.answers ?? {};
  return [lead.full_name, a.birth_date, lead.email, lead.phone, a.address, a.city, a.country, "", a.music_level, a.profession, lead.plan_intended ?? "", a.academic_experience, a.motivation, a.attribution_summary ?? "", a.musical_preferences, a.submitted_at].map(v => String(v ?? ""));
}