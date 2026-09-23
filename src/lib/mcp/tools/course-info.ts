import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import {
  COURSE_MODEL,
  OFFERED_DURATIONS,
  resolveEntitlements,
  type Tier,
} from "@/lib/entitlements";
import { SUBSCRIPTION_CATALOG, catalogEntry, type DurationMonths } from "@/lib/subscription-catalog";

export default defineTool({
  name: "course_info",
  title: "Course, tiers and plans",
  description:
    "Authoritative details about The Power of Conscious Voice: course model, cohort rules, what the Live and Complete tiers include, and the plan durations currently offered.",
  inputSchema: {
    tier: z
      .enum(["live", "complete", "both"])
      .default("both")
      .describe("Which tier to describe."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ tier }) => {
    const tiers: Tier[] = tier === "both" ? ["live", "complete"] : [tier];
    const plans = tiers.map((t) => ({
      tier: t,
      entitlements: { ...resolveEntitlements(t, null) },
      durations: OFFERED_DURATIONS.map((months) => {
        const entry = catalogEntry(t, months as DurationMonths);
        return {
          months,
          lookup_key: entry.lookupKey,
          amount_usd_per_cycle: entry.amountUsd,
        };
      }),

    }));

    const payload = {
      course_model: { ...COURSE_MODEL },
      offered_durations_months: [...OFFERED_DURATIONS],
      retired_durations_months: [12],
      billing_note:
        "Checkout is currently one-time prepaid; automatic renewal is not claimed while checkout runs in one-time payment mode.",
      certificate:
        "Certificate of Completion — Professional Development in Singing and Vocal Technique. Eligibility begins after six active months and requires the Foundations pathway plus approval of the Conscious Voice Transformation Portfolio. It is not an academic degree and is never automatic.",
      tiers: plans,
      catalog_tiers: Object.keys(SUBSCRIPTION_CATALOG),
    };

    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
