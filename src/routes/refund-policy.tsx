import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage, Section } from "@/components/legal/LegalPage";
import { LEGAL, LEGAL_VERSIONS } from "@/lib/legal";

const CANONICAL = "https://consciousvoice.tecendosom.com/refund-policy";

export const Route = createFileRoute("/refund-policy")({
  head: () => ({
    meta: [
      { title: "Refund Policy — The Power of Conscious Voice" },
      {
        name: "description",
        content:
          "14-day withdrawal window, proportionate deduction rules, how to request a refund by email, and how automatically renewing plans are treated after the withdrawal period.",
      },
      { property: "og:title", content: "Refund Policy — The Power of Conscious Voice" },
      {
        property: "og:description",
        content:
          "How to request a refund within 14 calendar days, and how renewing plans are treated afterwards.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: CANONICAL }],
  }),
  component: RefundPolicyPage,
});

function RefundPolicyPage() {
  return (
    <LegalPage
      title="Refund Policy"
      subtitle="Every plan is charged in full for the period you choose and renews automatically until you cancel. This policy explains the 14-day withdrawal window, how to request a refund, and how cancellation works."
      version={LEGAL_VERSIONS.refund}
    >
      <Section heading="1. How to request a refund">
        <p>
          Send an email to{" "}
          <a href={`mailto:${LEGAL.contactEmail}`} className="text-primary hover:underline">
            {LEGAL.contactEmail}
          </a>{" "}
          within <strong>14 calendar days</strong> of your purchase, including:
        </p>
        <ul>
          <li>the purchaser's full name;</li>
          <li>the email address used at enrolment;</li>
          <li>the purchase date;</li>
          <li>the payment reference (receipt, checkout/session ID, or bank transfer reference).</li>
        </ul>
        <p>
          We confirm receipt and tell you the outcome and any deduction before processing. Requests
          made through other channels are still valid if we can identify the purchase, but email is
          the fastest route.
        </p>
      </Section>

      <Section heading="2. Full refund when performance has not begun">
        <p>
          If you withdraw within the 14-day window and access or performance has{" "}
          <strong>not yet begun</strong> — you have not attended a live session and have not accessed
          the member area or recordings — you receive a <strong>full refund</strong> of the amount
          paid.
        </p>
      </Section>

      <Section heading="3. Proportionate deduction when you requested immediate access">
        <p>
          At checkout you may expressly request that access or performance begins during the 14-day
          withdrawal period. If you then withdraw within that period, we may deduct a{" "}
          <strong>reasonable amount proportionate to the services actually supplied</strong> up to
          the moment of withdrawal, where such deduction is permitted by applicable law.
        </p>
        <p>
          The deduction is calculated in proportion to the sessions delivered and the access
          effectively made available, compared with the full scope of the package purchased. It will
          never exceed the amount you paid, and the remaining balance is refunded.
        </p>
        <p>
          This deduction never applies during the Brazilian consumer's mandatory 7-day right of
          regret described in section 5.1: within those first 7 days the refund is full.
        </p>

      </Section>

      <Section heading="4. After the 14-day window">
        <p>
          After the withdrawal period, amounts already paid for the current period are generally{" "}
          <strong>non-refundable for unused access time</strong>. Refunds are still granted where:
        </p>
        <ul>
          <li>mandatory consumer law requires it;</li>
          <li>we cancel the course or fail to deliver material parts of it;</li>
          <li>you were charged more than once for the same purchase (duplicate charge);</li>
          <li>a charge was unauthorised;</li>
          <li>another legally required remedy applies.</li>
        </ul>
      </Section>

      <Section heading="5. Automatic renewal and cancellation">
        <p>
          Card plans renew automatically until you cancel. Cancelling in the billing portal stops all
          future charges and{" "}
          <strong>keeps your access until the end of the period you already paid for</strong>. A
          cancellation is <strong>not in itself a refund request</strong> for the current period; if
          you also want a refund, email us within the applicable window.
        </p>
        <p>
          The contractual <strong>14-day withdrawal window applies to your initial enrolment</strong>
          , not to each automatic renewal. Renewal charges are governed by section 4 above and by
          mandatory law.
        </p>
        <p>
          International bank transfers (Wise) cover a single period, never renew, and require no
          cancellation.
        </p>
      </Section>

      <Section heading="5.1 Brazilian consumers — 7-day right of regret (Article 49)">
        <p>
          If you are a consumer purchasing online, Article 49 of the Brazilian Consumer Protection
          Code gives you an unconditional{" "}
          <strong>7-calendar-day right of regret from purchase or from access</strong>, whichever is
          later. Within those 7 days you receive a{" "}
          <strong>full refund of the amounts paid, monetarily adjusted, with no proportionate
          deduction</strong>, even if you had already requested immediate access and used part of the
          service.
        </p>
        <p>
          From day 8 to day 14 of the contractual withdrawal window, a{" "}
          <strong>reasonable proportionate deduction</strong> for services actually supplied may be
          applied, only where applicable law permits it.
        </p>
      </Section>


      <Section heading="6. Discounts and scholarships">
        <p>
          Where a discount, promotional price or scholarship was applied, any refund is calculated on
          the <strong>amount actually paid</strong>, not on the standard list price.
        </p>
      </Section>

      <Section heading="7. How refunds are paid">
        <p>
          Approved refunds are returned to the <strong>original payment method</strong> whenever
          technically possible. Where that is not possible (for example, a closed account), we agree
          an alternative method with you.
        </p>
        <p>
          We initiate a valid refund no later than <strong>14 days</strong> after receiving your
          notice. The time it takes for the money to appear on your statement depends on your card
          issuer, bank or payment provider and can vary; international transfers may also involve
          conversion differences and bank fees charged by your own institution.
        </p>
      </Section>

      <Section heading="8. Your statutory rights">
        <p>
          Mandatory consumer rights always prevail over this policy, including rights under the
          Brazilian Consumer Protection Code and, where applicable, consumer legislation in your
          country of residence. Contacting us first does not waive your right to dispute a charge
          with your bank or card issuer, nor any other statutory right.
        </p>
        <p>
          See also our{" "}
          <Link to="/terms-of-service" className="text-primary hover:underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link to="/privacy-policy" className="text-primary hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
        <p>Effective date: {LEGAL.effectiveDate}.</p>
      </Section>
    </LegalPage>
  );
}
