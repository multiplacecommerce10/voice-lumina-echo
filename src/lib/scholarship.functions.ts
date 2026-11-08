import { createServerFn } from "@tanstack/react-start";
import { scholarshipSchema } from "./scholarship-validation";
import { getRequest } from "@tanstack/react-start/server";
import { assertDiagnosticOrigin } from "./private-diagnostic-rules";
import { LEGAL_VERSIONS } from "./legal";

/**
 * Records a Global Solidarity Scholarship application as a lead. The first
 * approved seats are decided by human review; every application
 * still requires Cuca Medina's human review before any seat is granted.
 * Submitting never grants access.
 */
export const submitScholarshipApplication = createServerFn({ method: "POST" })
  .validator((input: unknown) => scholarshipSchema.parse(input))
  .handler(async ({ data }): Promise<{ success: true; freeSeatCandidate: boolean } | { error: string }> => {
    const request = getRequest();
    assertDiagnosticOrigin(request.headers.get("origin"), new URL(request.url).origin, request.headers.get("sec-fetch-site"));
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin.rpc("record_scholarship_application", { p_request: data.requestId, p_data: data, p_privacy_version: LEGAL_VERSIONS.privacy });
      if (error) return { error: "Could not save your application. Please try again with the same form." };
      // Receipt queued atomically with application; the existing outbox sweep delivers/retries it.
      // Receiving order never decides which three human-approved seats are free.
      return { success: true, freeSeatCandidate: false };
    } catch (e) {
      return { error: "Unexpected error. Please try again." };
    }
  });
