import { enrollmentSheetRow } from "./enrollment-projection";

/** Retry a deterministic row update, never append after an ambiguous response. */
export async function deliverEnrollmentProjection(row: { payload?: Record<string, unknown> }) {
  const leadId = row.payload?.leadId;
  if (typeof leadId !== "string") throw new Error("Enrollment projection binding missing");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: lead, error } = await supabaseAdmin.from("leads").select("id,full_name,email,phone,plan_intended,answers,enrollment_sheet_row").eq("id", leadId).eq("source", "enrollment_form").single();
  if (error || !lead) throw new Error("Enrollment projection unavailable");
  const projectKey = process.env["LOVABLE_API_KEY"], key = process.env["GOOGLE_SHEETS_API_KEY"];
  if (!projectKey || !key) throw new Error("Enrollment projection connection unavailable");
  const position = lead.enrollment_sheet_row;
  if (!position || !Number.isSafeInteger(position) || position < 2) throw new Error("Enrollment projection position unavailable");
  const range = `'Enrollment intents'!A${position}:P${position}`;
  const response = await fetch(`https://connector-gateway.lovable.dev/google_sheets/v4/spreadsheets/1H12v76VWsxnNTGT4CjDeQ5Bo5LJ8t8v0Y5YxX78bbWg/values/${range}?valueInputOption=RAW`, { method: "PUT", headers: { Authorization: `Bearer ${projectKey}`, "X-Connection-Api-Key": key, "Content-Type": "application/json" }, body: JSON.stringify({ values: [enrollmentSheetRow(lead)] }) });
  if (!response.ok) throw new Error(`Enrollment projection failed (HTTP ${response.status})`);
}