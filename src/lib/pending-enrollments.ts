import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** SQL <> excludes NULL too; ordinary checkout leads can have no source. */
export function pendingEnrollmentsQuery(client: SupabaseClient<Database>) {
  return client.from("leads")
    .select("id, full_name, email, plan_intended, status, created_at, admission_status")
    .or("source.is.null,source.neq.scholarship_application")
    .in("status", ["captured", "checkout_started", "abandoned"])
    .order("created_at", { ascending: false })
    .limit(200);
}