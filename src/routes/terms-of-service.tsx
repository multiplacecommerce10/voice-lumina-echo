import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage, Section } from "@/components/legal/LegalPage";
import { LEGAL, LEGAL_VERSIONS } from "@/lib/legal";

const CANONICAL = "https://consciousvoice.tecendosom.com/terms-of-service";

export const Route = createFileRoute("/terms-of-service")({
  head: () => ({
    meta: [
      { title: "Terms of Service — The Power of Conscious Voice" },
      {
        name: "description",
        content:
          "Enrolment terms for The Power of Conscious Voice: 1, 3 and 6-month plans charged in full up front and renewing automatically, cancellation at period end, conduct, recordings and liability.",
      },
      { property: "og:title", content: "Terms of Service — The Power of Conscious Voice" },
      {
        property: "og:description",
        content:
          "Automatically renewing access plans, payment in USD, participation rules, recordings, intellectual property and governing law.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: CANONICAL }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      subtitle="These terms govern your enrolment in and use of The Power of Conscious Voice. Please read them before completing your purchase — by enrolling, you accept them."
      version={LEGAL_VERSIONS.terms}
    >
      <Section heading="1. Who you are contracting with">
        <p>
          The course is offered by <strong>{LEGAL.sellerName}</strong>, CNPJ {LEGAL.cnpj},
          with registered business address at {LEGAL.addressFull} ("we", "us"). Contact:{" "}
          <a href={`mailto:${LEGAL.contactEmail}`} className="text-primary hover:underline">
            {LEGAL.contactEmail}
          </a>
          .
        </p>
      </Section>

      <Section heading="2. Eligibility and accurate information">
        <p>
          The course is intended for adults. Minors may only enrol with the express authorisation
          and supervision of a parent or legal guardian, who assumes responsibility for the
          enrolment. You agree to provide true, current and complete information in the enrolment
          form and to keep it updated, since we use it to deliver access, class times in your time
          zone, and support.
        </p>
      </Section>

      <Section heading="3. What the course is">
        <p>
          The Power of Conscious Voice is an online vocal education programme delivered in English,
          combining a weekly 90-minute live cohort class, two individual 30-minute sessions in each
          active 30-day cycle, and a recorded Method Foundations Library of foundational
          vocal-technique videos available to every student. The first individual session includes a
          10-minute initial pedagogical voice and expressive mapping.
        </p>
        <p>
          Over six active months, the programme schedules approximately{" "}
          <strong>26 weekly group classes (about 39 scheduled group hours)</strong> and{" "}
          <strong>12 individual sessions (about 6 scheduled private hours)</strong>. These figures are
          indicative and subject to the published calendar, holidays and rescheduling. Time spent in
          the Method Foundations Library and, for Complete Course Access, in the monthly VIP
          gathering, is additional to those hours.
        </p>
        <p>
          <strong>Complete Course Access</strong> additionally includes class replay access, a
          detailed <strong>Vocal and Artistic Identity Analysis</strong> with a personalized plan
          addressing technique, style and creative possibilities in relation to the student's
          artistic identity, and one exclusive <strong>monthly VIP gathering</strong>. Replay access
          begins strictly from the student's own confirmed enrollment date; no tier includes
          recordings of classes held before enrollment, and there is no historical cohort archive.
          The International Online Course (Live) tier does not include replays, the Identity Analysis
          or the VIP gathering.
        </p>
        <p>
          The cohort is limited to a maximum of <strong>30 active students</strong>. After the cohort
          begins, rolling admission is possible only after a{" "}
          <strong>human pedagogical review by Cuca Medina</strong>; a numerical vacancy never reopens
          enrollment automatically. When enrollment is full, paused or under review, applicants are
          placed on a waiting list or request-for-consideration path, and access begins only after
          confirmed payment and permitted admission.
        </p>
        <p>
          Certificate of Completion eligibility arises after six paid active months and requires
          completion of the Foundations pathway and Cuca Medina's approval of the Conscious Voice
          Transformation Portfolio; it is not automatic, is not an academic degree or a regulated
          professional credential, and is not a consequence of payment alone.
        </p>
        <p>
          We may make reasonable changes to the schedule, session times, order of contents, guest
          or supporting instructors, and the platforms used for delivery or communication. Such
          changes will not remove the essential value of the programme you purchased. If a change
          is material and adversely affects you, we will inform you and, where appropriate, offer a
          suitable alternative or a remedy under our{" "}
          <Link to="/refund-policy" className="text-primary hover:underline">
            Refund Policy
          </Link>
          .
        </p>
      </Section>


      <Section heading="4. Access packages, prices and payment">
        <ul>
          <li>
            Access is sold in billing periods of <strong>1, 3 or 6 months</strong> for the selected
            product (International Online Course, or Complete Course Access).
          </li>
          <li>
            The <strong>full amount charged today</strong>, and the fact that the same amount
            recurs at the end of each period, are displayed before you pay. Any monthly figure shown
            is only an equivalent value for comparison — it is not a monthly billing schedule.
          </li>
          <li>
            The full amount for the selected period is charged <strong>up front</strong>, and then{" "}
            <strong>renews automatically</strong> for the same period, at the same price, until you
            cancel.
          </li>
          <li>
            You may <strong>cancel at any time</strong> in the billing portal. Cancellation takes
            effect at the <strong>end of the period you have already paid for</strong>; you keep
            access until that date and are not charged again.
          </li>
          <li>
            If a renewal payment fails, your card is retried automatically and your access continues
            for a <strong>grace period of 7 calendar days</strong>. If the payment is still unpaid
            after that window, access is suspended until it succeeds.
          </li>
          <li>
            Changing tier or plan length is not automatic: it is arranged individually after a short
            review, by writing to{" "}
            <a href={`mailto:${LEGAL.contactEmail}`} className="text-primary hover:underline">
              {LEGAL.contactEmail}
            </a>
            .
          </li>
          <li>
            <strong>International bank transfers (Wise)</strong> are a manual exception: they are
            confirmed by hand, cover a single period only and do <strong>not</strong> renew
            automatically.
          </li>
          <li>
            Longer periods include a discount over the 1-month rate (approximately 5% for 3 months,
            and 10% for 6 months), already reflected in the displayed total.
          </li>
        </ul>
        <p>
          Prices are stated and charged in <strong>US dollars (USD)</strong>. Your bank, card issuer
          or payment provider may apply currency conversion, international transaction or transfer
          fees, which are outside our control and are your responsibility. Payments are processed by
          our payment providers; we never receive your full card details.
        </p>
        <p>
          Discounts, promotional prices and scholarships apply only as expressly granted, are
          personal and non-transferable, and cannot be combined unless we say so in writing. Any
          refund of a discounted or scholarship enrolment is calculated on the amount actually paid.
        </p>
      </Section>

      <Section heading="5. Account security and conduct">
        <p>
          Access credentials to the member area and live sessions are personal and non-transferable.
          You are responsible for keeping them confidential and for activity under your account, and
          must tell us promptly if you suspect unauthorised use. Sharing access, reselling it, or
          allowing others to use your credentials is a serious breach of these terms.
        </p>
        <p>
          In live sessions and community spaces we expect respectful, inclusive behaviour: no
          harassment, discrimination, hate speech, threats, spam, promotion of unrelated services,
          or disruption of the class. Please arrive on time, mute when not participating, and follow
          the instructor's guidance so everyone can work safely with their voice.
        </p>
      </Section>

      <Section heading="6. Intellectual property and licence">
        <p>
          All course content — including live sessions, recordings, videos, audio, exercises, slides,
          texts, materials, brand elements and the structure of the programme — is protected by
          intellectual property law and remains our property or that of its respective owners.
        </p>
        <p>
          Upon payment you receive a limited, personal, non-exclusive, non-transferable and
          revocable licence to access and use the content for your own learning during your access
          period. You may not record, download (except where a download is expressly offered), copy,
          republish, share, distribute, sell, sublicense, publicly display, or use the content to
          train artificial intelligence systems, or create derivative works, without our prior
          written permission.
        </p>
      </Section>

      <Section heading="7. Recording of live sessions">
        <p>
          Live sessions may be recorded so that they can be made available to students with
          class replay access (Complete Course Access, from their own enrollment date onward) and for teaching quality purposes. If you turn your camera on, speak,
          sing or use the chat, your <strong>name, voice and image</strong> may be captured in the
          recording and seen by other participants and by students who later watch it.
        </p>
        <p>
          Practical choices are available to you: you may keep your camera off, use a display name of
          your choice, participate by chat, ask not to be highlighted during individual feedback, or
          contact{" "}
          <a href={`mailto:${LEGAL.contactEmail}`} className="text-primary hover:underline">
            {LEGAL.contactEmail}
          </a>{" "}
          to discuss your participation. We will not use recordings of identifiable students for
          public advertising without their separate, specific consent.
        </p>
      </Section>

      <Section heading="8. Withdrawal, cancellation and refunds">
        <p>
          Withdrawal and refund conditions, including the 14-day withdrawal window and the possible
          proportionate deduction when you request immediate access or performance, are set out in
          our{" "}
          <Link to="/refund-policy" className="text-primary hover:underline">
            Refund Policy
          </Link>
          , which forms part of these terms. Card plans renew automatically until cancelled;
          cancelling stops all future charges and keeps your access until the end of the period you
          have already paid for.
        </p>
      </Section>

      <Section heading="9. Educational nature — not healthcare">
        <p>
          This programme is <strong>educational and artistic</strong>. It is not medical,
          psychological, psychiatric, speech-language therapy, physiotherapy, or any other regulated
          healthcare service, and it does not diagnose, treat, cure or prevent any condition. It does
          not replace consultation with a physician, laryngologist, speech-language pathologist,
          psychologist or other qualified professional.
        </p>
        <p>
          If you have a vocal, respiratory, neurological or psychological condition, are pregnant, or
          experience pain, discomfort, hoarseness or distress, stop and seek qualified professional
          advice. You participate at your own pace and take responsibility for adapting exercises to
          your own physical and emotional limits.
        </p>
      </Section>

      <Section heading="10. Liability">
        <p>
          We commit to delivering the course with professional diligence. To the maximum extent
          permitted by applicable law, and except in cases of wilful misconduct or gross negligence,
          our total liability arising from or in connection with the course is limited to the amount
          you actually paid for the package concerned, and we are not liable for indirect or
          consequential losses such as loss of profits or opportunity.
        </p>
        <p>
          Nothing in these terms excludes or limits liability that cannot be excluded or limited
          under mandatory law, including your mandatory rights as a consumer under the Brazilian
          Consumer Protection Code or the consumer law of your country of residence.
        </p>
      </Section>

      <Section heading="11. Suspension and termination">
        <p>
          We may suspend or terminate access, without refund of the period already used, in cases of
          serious misuse: sharing or reselling access, unauthorised recording or distribution of
          content, harassment or abusive conduct towards participants or staff, fraud, chargeback
          abuse, or breach of applicable law. Where the situation allows, we will warn you first and
          give you the chance to correct it.
        </p>
      </Section>

      <Section heading="12. Force majeure">
        <p>
          We are not liable for delay or failure caused by events beyond our reasonable control,
          such as natural disasters, epidemics, strikes, war, government acts, or failures of
          internet, electricity or third-party platforms. In such cases we will reschedule affected
          sessions or provide an equivalent alternative whenever possible.
        </p>
      </Section>

      <Section heading="13. Changes to these terms">
        <p>
          We may update these terms to reflect changes in the service or in the law. The version in
          force at the time of your purchase governs that purchase. Updated terms apply to new
          purchases and to continued use after we communicate the change.
        </p>
      </Section>

      <Section heading="14. Governing law and jurisdiction">
        <p>
          These terms are governed by the laws of the Federative Republic of Brazil, and the courts
          of {LEGAL.location} are the elected forum for disputes. This does not deprive you of the
          protection of mandatory provisions of the law of your country of residence, nor of any
          mandatory right to bring proceedings in the courts of your own domicile, where such rights
          apply to you as a consumer.
        </p>
        <p>Effective date: {LEGAL.effectiveDate}.</p>
      </Section>
    </LegalPage>
  );
}
