export function splitBirthDate(value = "") {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? { year: match[1], month: match[2], day: match[3] } : { year: "", month: "", day: "" };
}

export function joinBirthDate(parts: { year: string; month: string; day: string }) {
  return parts.year && parts.month && parts.day ? `${parts.year}-${parts.month}-${parts.day}` : "";
}