import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listEnrollmentsTool from "./tools/list-enrollments";
import listLeadsTool from "./tools/list-leads";
import courseInfoTool from "./tools/course-info";
import previewEmailTool from "./tools/preview-email";

const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "conscious-voice-journey",
  title: "Conscious Voice Journey",
  version: "0.1.0",
  instructions:
    "Tools for The Power of Conscious Voice (Tecendo Som). Use `course_info` for the authoritative course model, tiers and plan durations; `list_enrollments` for enrolled students; `list_leads` for enrollment-form submissions and abandoned checkouts; `preview_email` to render a student email for review. Student and lead data requires an admin account; these tools are read-only and never send email or change data.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [courseInfoTool, listEnrollmentsTool, listLeadsTool, previewEmailTool],
});
