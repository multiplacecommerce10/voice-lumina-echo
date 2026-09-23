import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage, Section } from "@/components/legal/LegalPage";
import { LEGAL, LEGAL_VERSIONS } from "@/lib/legal";
import { openPrivacyPreferences } from "@/lib/consent";

const CANONICAL = "https://consciousvoice.tecendosom.com/privacy-policy";

export const Route = createFileRoute("/privacy-policy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — The Power of Conscious Voice" },
      {
        name: "description",
        content:
          "How Priscila Medina Gubert - ME collects, uses, shares and protects personal data of students of The Power of Conscious Voice, under LGPD and GDPR.",
      },
      { property: "og:title", content: "Privacy Policy — The Power of Conscious Voice" },
      {
        property: "og:description",
        content:
          "Controller identity, data collected, legal bases, processors, transfers, retention and your rights.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: CANONICAL }],
  }),
  component: PrivacyPolicyPage,
});

function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      subtitle="This policy explains what personal data we collect when you visit this website and enrol in The Power of Conscious Voice, why we process it, who we share it with, and the rights you can exercise at any time."
      version={LEGAL_VERSIONS.privacy}
    >
      <Section heading="1. Who is responsible for your data">
        <p>
          The controller of your personal data is <strong>{LEGAL.sellerName}</strong>, CNPJ{" "}
          {LEGAL.cnpj}, with registered business address at {LEGAL.addressFull}. Privacy requests
          are handled by email.
        </p>
        <p>
          Privacy, cancellation and refund contact:{" "}
          <a href={`mailto:${LEGAL.contactEmail}`} className="text-primary hover:underline">
            {LEGAL.contactEmail}
          </a>
        </p>
      </Section>

      <Section heading="2. Data we collect">
        <ul>
          <li>
            <strong>Identity and contact data:</strong> full name, email address, phone number
            including international dialling code, and date of birth.
          </li>
          <li>
            <strong>Location data you supply:</strong> country, state and city, and any address
            details you choose to provide in the enrolment form. We do not require a full street
            address to deliver the course.
          </li>
          <li>
            <strong>Enrolment profile:</strong> profession or occupation, musical and vocal
            background, previous course experience, learning preferences, goals and motivation
            for joining, and your time zone (detected from your browser or selected by you) so we
            can show and send class times in your local time.
          </li>
          <li>
            <strong>Payment transaction metadata:</strong> purchased package, amount, currency,
            payment status, payment or checkout session references and the payment provider used.
            Card numbers, CVV and full banking credentials are entered directly with the payment
            provider and are <strong>never</strong> collected, seen or stored by us.
          </li>
          <li>
            <strong>Account and access records:</strong> membership/member-area credentials issued
            to you, access status, class attendance where applicable, and the access period you
            purchased.
          </li>
          <li>
            <strong>Support and communications:</strong> emails, messages and any content you send
            us, including recovery or assistance requests.
          </li>
          <li>
            <strong>Device and log data:</strong> IP address, browser and device type, pages
            viewed, timestamps and technical error logs, generated when you use the site or when
            our systems record a request.
          </li>
          <li>
            <strong>Cookies and local/session storage:</strong> strictly necessary storage for the
            session, security and the enrolment/checkout flow, plus optional analytics and
            marketing technologies.
          </li>
          <li>
            <strong>Attribution data:</strong> UTM parameters, referrer, <em>gclid</em> and{" "}
            <em>fbclid</em>. These are only stored and transmitted when you have given the
            corresponding analytics/marketing consent.
          </li>
        </ul>
      </Section>

      <Section heading="3. Why we process your data and on what legal basis">
        <ul>
          <li>
            <strong>To perform our contract with you</strong> (LGPD Art. 7, V; GDPR Art. 6(1)(b)):
            processing your enrolment, delivering the course and live sessions, issuing member-area
            access, sending service messages such as confirmations, class times, schedule changes
            and access details, and handling refunds.
          </li>
          <li>
            <strong>To comply with legal obligations</strong> (LGPD Art. 7, II; GDPR Art. 6(1)(c)):
            tax, accounting and consumer-protection record keeping, and responding to lawful
            requests.
          </li>
          <li>
            <strong>Legitimate interests</strong> (LGPD Art. 7, IX; GDPR Art. 6(1)(f)): keeping the
            site secure and preventing fraud and abuse, maintaining and debugging our systems,
            understanding aggregate demand, and contacting people who started an enrolment to help
            them complete it. We balance these interests against your rights and freedoms and you
            may object at any time by writing to {LEGAL.contactEmail}.
          </li>
          <li>
            <strong>Consent</strong> (LGPD Art. 7, I; GDPR Art. 6(1)(a)): optional analytics and
            marketing technologies, campaign attribution data, and optional marketing or WhatsApp
            communications. Consent is always optional, is never bundled with the purchase, and can
            be withdrawn at any time as easily as it was given.
          </li>
        </ul>
        <p>
          Where you request that access or performance begins during the withdrawal period, we
          record that acknowledgement (with its timestamp and document version) because it is
          necessary to perform the contract and to evidence compliance with consumer law.
        </p>
      </Section>

      <Section heading="4. Service providers who process data for us">
        <p>
          We share personal data only with providers that support the operation of this website and
          the course, under contractual confidentiality and security obligations, and only to the
          extent needed:
        </p>
        <ul>
          <li>
            <strong>Lovable / Lovable Cloud and Supabase</strong> — website hosting, application
            infrastructure, database and secure storage of enrolment records.
          </li>
          <li>
            <strong>Stripe</strong> — payment processing, fraud prevention and payment records.
          </li>
          <li>
            <strong>PayPal</strong> — payment processing, only if and while that payment option is
            enabled and chosen by you.
          </li>
          <li>
            <strong>Wise</strong> — receipt of international bank transfers when you choose that
            payment method.
          </li>
          <li>
            <strong>Zoom</strong> — delivery of live online sessions.
          </li>
          <li>
            <strong>Taskade</strong> — student onboarding, member area and automated course
            communications.
          </li>
          <li>
            <strong>Make</strong> — automation between the systems above, where used.
          </li>
          <li>
            <strong>Hostinger and related email infrastructure</strong> — sending and receiving
            email.
          </li>
          <li>
            <strong>Google Analytics</strong> — audience measurement, loaded{" "}
            <strong>only after</strong> you give analytics consent.
          </li>
        </ul>
        <p>
          We do not sell your personal data and we do not share it with third parties for their own
          independent marketing.
        </p>
      </Section>

      <Section heading="5. International transfers">
        <p>
          The course is international and several providers listed above operate outside Brazil,
          including in the United States and the European Union. When personal data is transferred
          internationally, we rely on appropriate safeguards permitted by applicable law, such as
          standard contractual clauses, adequacy decisions, or the transfer being necessary to
          perform a contract with you or at your request.
        </p>
      </Section>

      <Section heading="6. How long we keep data">
        <p>
          We do not apply arbitrary fixed periods. We keep personal data for as long as it is needed
          for the purpose it was collected for, and afterwards only where a legal or defensive
          reason applies. In practice we use the following criteria:
        </p>
        <ul>
          <li>enrolment and access data: while your access period is active and while you may need
            support or proof of purchase;</li>
          <li>payment and tax records: for the periods required by tax, accounting and consumer law;</li>
          <li>records of consent and legal acknowledgements: while they may be needed as evidence of
            compliance;</li>
          <li>marketing contacts: until you withdraw consent or object;</li>
          <li>security and technical logs: for a short operational period, unless an incident
            requires longer.</li>
        </ul>
      </Section>

      <Section heading="7. Security">
        <p>
          We use encrypted connections (HTTPS), access controls, database row-level security,
          secret management for credentials, and providers with recognised security practices. We
          never receive full card data. No method of transmission or storage is perfectly secure,
          so we cannot guarantee absolute security, but we take reasonable and appropriate
          technical and organisational measures and will notify you and the competent authority of
          incidents where the law requires it.
        </p>
      </Section>

      <Section heading="8. Your rights">
        <p>
          Under the Brazilian LGPD, and under the GDPR / UK GDPR where they apply to you, you can
          request: confirmation that we process your data; access to it; correction of incomplete or
          outdated data; anonymisation, blocking or deletion of unnecessary or excessive data;
          portability; information about the entities we share data with; information about the
          consequences of refusing consent; withdrawal of consent; restriction of processing;
          objection to processing based on legitimate interests or to direct marketing; and review
          of decisions based solely on automated processing where applicable.
        </p>
        <p>
          Write to{" "}
          <a href={`mailto:${LEGAL.contactEmail}`} className="text-primary hover:underline">
            {LEGAL.contactEmail}
          </a>
          . We reply within the deadlines set by applicable law and may ask for information to
          confirm your identity. You also have the right to complain to the Brazilian data
          protection authority (ANPD) or, where applicable, to your local supervisory authority
          in the EU or the UK.
        </p>
      </Section>

      <Section heading="9. Necessary versus optional technologies">
        <p>
          <strong>Strictly necessary</strong> storage keeps you logged in, secures the session and
          allows enrolment and checkout to work. It cannot be switched off without breaking the
          service.
        </p>
        <p>
          <strong>Optional analytics and marketing</strong> technologies, including Google Analytics
          and campaign attribution parameters (UTM, referrer, gclid, fbclid), stay disabled until
          you actively allow them. Rejecting them does not limit your access to the course in any
          way.
        </p>
        <p>
          <button
            type="button"
            onClick={openPrivacyPreferences}
            className="text-primary underline underline-offset-2"
          >
            Change your cookie and privacy preferences
          </button>
        </p>
      </Section>

      <Section heading="10. Children and minors">
        <p>
          This course is intended for adults. People under the age of majority in their country may
          only enrol and participate with the express authorisation and supervision of a parent or
          legal guardian, who is responsible for the enrolment and for the data provided. If we
          learn that we have collected data from a minor without proper authorisation, we will
          delete it.
        </p>
      </Section>

      <Section heading="11. Updates to this policy">
        <p>
          We may update this policy to reflect changes in the service, our providers or the law. The
          effective date at the top of the page always shows the current version, and material
          changes will be communicated by email or through the website.
        </p>
        <p>
          Related documents:{" "}
          <Link to="/terms-of-service" className="text-primary hover:underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link to="/refund-policy" className="text-primary hover:underline">
            Refund Policy
          </Link>
          .
        </p>
      </Section>
    </LegalPage>
  );
}
