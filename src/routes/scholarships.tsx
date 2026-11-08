import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, Section } from "@/components/legal/LegalPage";
import { ScholarshipForm } from "@/components/ScholarshipForm";
import { LEGAL } from "@/lib/legal";

const CANONICAL = "https://consciousvoice.tecendosom.com/scholarships";
const TITLE = "Global Solidarity Scholarships — The Power of Conscious Voice";
const DESCRIPTION =
  "Apply for a Global Solidarity Scholarship if international tuition in USD is currently beyond your reach. Limited seats, reviewed with care by Cuca Medina.";

const MAILTO = `mailto:${LEGAL.contactEmail}?subject=${encodeURIComponent(
  "Global Solidarity Scholarship application",
)}&body=${encodeURIComponent(
  "Full name:\nCountry and city:\nEmail:\nPhone (optional):\n\nYour voice journey so far:\n\nWhat you hope to develop in the course:\n\nWhy a scholarship would make this possible for you:\n",
)}`;

export const Route = createFileRoute("/scholarships")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "article" },
      { property: "og:url", content: CANONICAL },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: CANONICAL }],
  }),
  component: ScholarshipsPage,
});

function ScholarshipsPage() {
  return (
    <LegalPage
      eyebrow="Global Solidarity"
      title="Global Solidarity Scholarships"
      subtitle="Voice as Access. Art as Bridge. If international tuition in USD is currently beyond your reach, you may apply for a Global Solidarity Scholarship."
    >
      <Section heading="About the scholarships">
        <p>
          Scholarship seats are limited and may represent up to 20% of the total enrolled course
          group. No prior professional experience is required.
        </p>
        <p>
          <strong>The first three approved scholarship seats are fully free of charge.</strong>{" "}
          Applications are considered in the order they are received.
        </p>
        <p>
          Each application is reviewed with care by Cuca Medina, considering your circumstances and
          the spirit of this initiative. Submitting an application does not guarantee a seat.
        </p>
      </Section>

      <Section heading="How to apply">
        <p>Applications are open through Sunday, January 3, 2027. The cohort begins Monday, December 7, 2026, with classes on Monday mornings, 9:30–11:00 AM São Paulo time. Accepted applicants may join the group already in progress after Cuca Medina’s personal review and confirmed enrollment.</p>
        <p>Fill in the application form below. It asks for:</p>
        <ul>
          <li>your full name, country and city;</li>
          <li>the email address you would use for enrollment;</li>
          <li>a few words about your voice journey so far;</li>
          <li>what you hope to develop in the course;</li>
          <li>why a scholarship would make your participation possible.</li>
        </ul>
        <div className="rounded-2xl border border-border/60 bg-card/40 p-6 sm:p-8 not-prose">
          <ScholarshipForm />
        </div>
        <p className="text-sm text-muted-foreground">
          Prefer email? You can also{" "}
          <a href={MAILTO} className="text-primary hover:underline">
            apply by writing to {LEGAL.contactEmail}
          </a>
          .
        </p>
      </Section>

      <Section heading="What happens next">
        <p>
          We confirm receipt of your application and reply with the outcome. If a scholarship is
          granted, we will send you the enrollment details for your seat.
        </p>
      </Section>
    </LegalPage>
  );
}
