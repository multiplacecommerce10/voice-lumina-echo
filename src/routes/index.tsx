import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import logo from "@/assets/tecendo-som-logo.png";
import heroImg from "@/assets/hero-conscious-voice.png";
import scholarshipsImg from "@/assets/scholarships-banner.png";
import { TimezoneConverter } from "@/components/TimezoneConverter";
import { Testimonials } from "@/components/Testimonials";
import { Gallery } from "@/components/Gallery";
import { PricingPlans } from "@/components/PricingPlans";
import { EnrollmentForm } from "@/components/EnrollmentForm";
import { SiteFooter } from "@/components/SiteFooter";
import { trackCTAClick } from "@/lib/analytics";
import { appendUtmsToUrl } from "@/lib/utm";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "The Power of Conscious Voice — with Cuca Medina | Tecendo Som" },
      {
        name: "description",
        content:
          "A live international voice training journey for singers, speakers, teachers and sensitive creators. Develop vocal presence, body awareness, resonance and expressive freedom.",
      },
      { property: "og:title", content: "The Power of Conscious Voice — with Cuca Medina" },
      {
        property: "og:description",
        content:
          "Live international voice training with Cuca Medina. Tuesdays 9:30–11:00 AM São Paulo. Weekly 90-minute cohort classes, private sessions and a recorded Method Foundations Library. Founding Cohort begins September 1, 2026.",
      },
      { property: "og:type", content: "website" },
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      } as never,
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Inter:wght@300;400;500;600;700&display=swap",
      },
    ],
  }),
  component: LandingPage,
});

const navLinks = [
  { href: "#about", label: "About" },
  { href: "#audience", label: "Who It's For" },
  { href: "#learn", label: "What You'll Learn" },
  { href: "#format", label: "Format" },
  { href: "#path", label: "Your Path" },
  { href: "#schedule", label: "Schedule" },
  { href: "#gallery", label: "Gallery" },
  { href: "#testimonials", label: "Voices" },
  { href: "#pricing", label: "Pricing" },
  { href: "#scholarships", label: "Scholarships" },
  { href: "#enroll", label: "Enroll" },
];

function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/70 border-b border-border/40">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-6">
        <a href="#top" className="flex items-center gap-4 shrink-0">
          <img src={logo} alt="Tecendo Som" className="h-20 w-20 sm:h-24 sm:w-24 rounded-full object-cover ring-1 ring-primary/30" />
          <span className="font-display text-2xl tracking-wide text-foreground/90 hidden sm:inline">
            Tecendo Som
          </span>
        </a>
        <nav className="hidden lg:flex items-center gap-7 text-sm text-muted-foreground">
          {navLinks.map((l) => (
            <a key={l.href} href={l.href} className="hover:text-primary transition-colors">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setOpen(!open)}
            className="lg:hidden p-2 text-foreground"
            aria-label="Menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
        </div>
      </div>
      {open && (
        <div className="lg:hidden border-t border-border/40 bg-background/95 px-6 py-4 flex flex-col gap-3">
          {navLinks.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="text-sm text-muted-foreground hover:text-primary py-1">
              {l.label}
            </a>
          ))}
        </div>
      )}
    </header>
  );
}

function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-primary/15 blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full bg-secondary/15 blur-[120px]" />
      </div>
      <div className="max-w-7xl mx-auto px-6 pt-16 pb-24 lg:pt-24 lg:pb-32 grid lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7 space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-xs uppercase tracking-[0.25em] text-primary">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Live International Course · Tecendo Som
          </div>
          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl leading-[1.05]">
            <span className="text-primary text-glow-gold">The Power of</span>
            <br />
            <span className="text-secondary text-glow-cyan italic font-light">Conscious Voice</span>
          </h1>
          <p className="text-lg lg:text-xl text-muted-foreground max-w-2xl leading-relaxed mb-[56px]">
            A live international voice training journey for singers, speakers, teachers and sensitive
            creators who want to develop vocal presence, body awareness, resonance and expressive
            freedom.
          </p>
          <div className="flex flex-wrap gap-3 text-sm items-center">
            <span className="px-4 py-2 rounded-full glass-card text-foreground/80 mr-[5px] mb-[5px]">
              <span className="text-secondary">●</span> Weekly live 90-min classes
            </span>
            <span className="px-4 py-2 rounded-full glass-card text-foreground/80 mr-[5px] mb-[5px]">
              <span className="text-primary">●</span> First class · September 1, 2026
            </span>
            <TimezoneConverter />
          </div>
          <p className="text-xs text-muted-foreground/80 max-w-xl leading-relaxed">
            <span className="text-secondary">✦</span> In September, two special live sessions
            deepen the journey — exploring the professional path of singing, sharing
            lived experience and strengthening our connection with the training.
          </p>
          <p className="text-xs text-muted-foreground/70 pt-2">
            Created by Cuca Medina · Mezzo-soprano, composer & voice educator
          </p>
        </div>
        <div className="lg:col-span-5 relative">
          <div className="relative rounded-3xl overflow-hidden ring-glow-gold">
            <img src={heroImg} alt="Conscious voice — luminous voice energy" className="w-full h-auto" />
            <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent pointer-events-none" />
          </div>
          <div className="absolute -bottom-6 -left-6 px-5 py-3 rounded-2xl glass-card text-xs text-foreground/80 hidden md:block">
            <div className="text-primary font-semibold">With Cuca Medina</div>
            <div className="text-muted-foreground">20+ years in vocal pedagogy</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Divider() {
  return (
    <div className="max-w-5xl mx-auto px-6">
      <div className="divider-luminous" />
    </div>
  );
}

function VSL() {
  const primaryRef = useRef<HTMLVideoElement>(null);
  const storyRef = useRef<HTMLVideoElement>(null);

  const handlePrimaryEnded = () => {
    const next = storyRef.current;
    const primary = primaryRef.current;
    if (!next) return;
    // Only auto-scroll if the user is still watching the primary video
    // (avoids yanking the page up when they've already scrolled away).
    const primaryRect = primary?.getBoundingClientRect();
    const isPrimaryVisible =
      !!primaryRect &&
      primaryRect.bottom > 0 &&
      primaryRect.top < window.innerHeight;
    if (isPrimaryVisible) {
      next.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    next.muted = true;
    next.play().catch(() => {});
  };

  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
      <div className="text-center mb-8">
        <p className="text-xs uppercase tracking-[0.3em] text-primary mb-3">A Personal Invitation</p>
        <h2 className="font-display text-3xl lg:text-4xl text-foreground/90">From Cuca to You</h2>
      </div>
      <div className="relative mx-auto w-full max-w-[360px] sm:max-w-[400px] aspect-[720/1288] rounded-2xl overflow-hidden glass-card ring-glow-cyan bg-black">
        <video
          ref={primaryRef}
          className="absolute inset-0 w-full h-full object-cover"
          src="/__l5e/assets-v1/826d574d-addc-4ca0-9e8e-6ef61b2b91b1/from-cuca-to-you-v2.mp4"
          controls
          playsInline
          muted
          autoPlay
          preload="metadata"
          controlsList="nodownload"
          onEnded={handlePrimaryEnded}
        />
      </div>

      <div className="text-center mt-16 mb-8">
        <p className="text-xs uppercase tracking-[0.3em] text-secondary mb-3">My Story</p>
        <h3 className="font-display text-2xl lg:text-3xl text-foreground/90">A glimpse into the meaning of my music</h3>
      </div>
      <div className="relative mx-auto w-full max-w-[360px] sm:max-w-[400px] aspect-square rounded-2xl overflow-hidden glass-card ring-glow-gold bg-black">
        <video
          ref={storyRef}
          className="absolute inset-0 w-full h-full object-contain"
          src="/__l5e/assets-v1/a53ecfdf-1d7f-4249-8c4b-2fe92092b497/meu-fazer-musical.mp4"
          controls
          playsInline
          preload="metadata"
          controlsList="nodownload"
        />
      </div>
    </section>
  );
}

function About() {
  return (
    <section id="about" className="max-w-6xl mx-auto px-6 py-24">
      <div className="max-w-3xl mx-auto text-center" data-reveal>
        <p className="text-xs uppercase tracking-[0.3em] text-secondary mb-4">The Method</p>
        <h2 className="font-display text-4xl lg:text-5xl leading-tight mb-8">
          <span className="italic text-foreground/95">Not just vocal technique —</span>
          <br />
          <span className="text-primary text-glow-gold">a conscious path</span>{" "}
          <span className="text-foreground/95">to inhabit your voice</span>
          <br />
          <span className="text-foreground/80 font-light">as body, presence and expression.</span>
        </h2>
        <p className="text-lg text-muted-foreground leading-relaxed">
          An artistic path of vocal training that weaves together breath, sound,
          listening and body awareness. A space to study your voice with depth,
          refinement and care — and to meet a community of artists from around
          the world.
        </p>
      </div>
    </section>
  );
}

const audience = [
  {
    title: "Singers",
    desc: "who want healthy, free and resonant technique.",
    icon: "♪",
  },
  {
    title: "Artists",
    desc: "who want expressive freedom and authentic voice.",
    icon: "✦",
  },
  {
    title: "Teachers & Speakers",
    desc: "who want vocal presence, clarity and stamina.",
    icon: "◈",
  },
  {
    title: "Seekers",
    desc: "exploring body awareness and self-knowledge through voice.",
    icon: "✺",
  },
  {
    title: "Curious Beginners",
    desc: "exploring the practical physiology of voice and the art of singing.",
    icon: "◐",
  },
  {
    title: "International Creators",
    desc: "from Europe, the UK, the Americas, India, Pakistan and beyond.",
    icon: "✧",
  },
];

function Audience() {
  return (
    <section id="audience" className="max-w-7xl mx-auto px-6 py-24">
      <div className="text-center mb-14" data-reveal>
        <p className="text-xs uppercase tracking-[0.3em] text-primary mb-3">Who This Is For</p>
        <h2 className="font-display text-4xl lg:text-5xl">A journey for sensitive voices</h2>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {audience.map((a, i) => (
          <div
            key={a.title}
            data-reveal
            data-reveal-delay={String((i % 3) + 1)}
            className="glass-card rounded-2xl p-7 hover:border-primary/40 transition-colors group"
          >
            <div className="text-3xl text-primary mb-4 group-hover:text-glow-gold transition-all">{a.icon}</div>
            <h3 className="font-display text-2xl mb-2 text-foreground/95">{a.title}</h3>
            <p className="text-muted-foreground leading-relaxed">{a.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const learn = [
  {
    title: "Breath & Embodied Support",
    desc: "Discover the breath as a living architecture — the foundation of presence and free sound.",
  },
  {
    title: "Vocal Technique",
    desc: "Healthy sound production based on physiology, ease and refined listening.",
  },
  {
    title: "Resonance & Vocal Presence",
    desc: "Awaken the spaces of your voice — bones, cavities and the subtle geometry of resonance.",
  },
  {
    title: "Musical Perception & Listening",
    desc: "Train your inner ear: pitch, intervals, timbre, intention and silence.",
  },
  {
    title: "Body Awareness & Proprioception",
    desc: "Inhabit the body that sings — alignment, sensation, awareness in real time.",
  },
  {
    title: "Voice as Expression",
    desc: "Beyond mechanism: voice as meaning, story, emotion and human encounter.",
  },
];

function Learn() {
  return (
    <section id="learn" className="relative py-24">
      <div className="absolute inset-0 bg-gradient-to-b from-deep-purple/20 via-transparent to-transparent -z-10" />
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-14" data-reveal>
          <p className="text-xs uppercase tracking-[0.3em] text-secondary mb-3">Course Syllabus</p>
          <h2 className="font-display text-4xl lg:text-5xl">Six woven threads of study</h2>
          <p className="text-muted-foreground max-w-3xl mx-auto mt-6 leading-relaxed">
            Distilled from more than two decades of teaching — from one-to-one
            study with individual students (many of them now active professional
            singers who began and refined their craft with Cuca) to the
            preparation of choirs and choral practice groups of up to forty
            voices — this international online course gathers that lived
            pedagogy into a weekly, year-long training journey.
          </p>
          <p className="text-sm text-muted-foreground/80 max-w-3xl mx-auto mt-4 leading-relaxed italic">
            A study of breath support, body awareness, intonation, sonority,
            timbre control and the practical physiology of the singing voice —
            woven with the artistic listening that only years of accompanying
            singers can shape.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {learn.map((l, i) => (
            <div
              key={l.title}
              data-reveal
              data-reveal-delay={String((i % 3) + 1)}
              className="glass-card rounded-2xl p-7 relative overflow-hidden"
            >
              <div className="absolute top-4 right-5 font-display text-5xl text-primary/20">
                0{i + 1}
              </div>
              <h3 className="font-display text-2xl mb-3 text-secondary">{l.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{l.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 glass-card rounded-3xl p-8 lg:p-10 max-w-5xl mx-auto" data-reveal>
          <p className="text-xs uppercase tracking-[0.3em] text-primary mb-4">Course Content · Ementa</p>
          <h3 className="font-display text-2xl lg:text-3xl text-foreground/95 mb-5">
            What we study, week after week
          </h3>
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-foreground/85">
            {[
              "Breath support and aerial sustenance",
              "Body awareness applied to singing",
              "Intonation and refined pitch listening",
              "Building a powerful, healthy sonority",
              "Conscious control of vocal timbre",
              "Practical physiology of the voice",
              "Vocal technique grounded in ease",
              "Musical perception and inner ear",
              "Repertoire study and interpretation",
              "Expressive freedom and artistic voice",
            ].map((t) => (
              <div key={t} className="flex gap-3">
                <span className="text-primary mt-1.5 text-xs">✦</span>
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Instructor() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-24">
      <div className="grid lg:grid-cols-5 gap-12 items-center">
        <div className="lg:col-span-2">
          <div className="aspect-[3/4] rounded-3xl overflow-hidden ring-glow-gold relative bg-background/40">
            <img
              src="/media/about-cuca.jpg"
              alt="Cuca Medina — mezzo-soprano and educator"
              className="absolute inset-0 w-full h-full object-contain"
              loading="lazy"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/95 via-background/60 to-transparent p-5 text-center">
              <div className="font-display text-2xl tracking-wide text-primary text-glow-gold">Cuca Medina</div>
              <div className="text-secondary mt-1 text-sm">Mezzo-soprano · Educator</div>
            </div>
          </div>
        </div>
        <div className="lg:col-span-3 space-y-6">
          <p className="text-xs uppercase tracking-[0.3em] text-primary">Your Guide</p>
          <h2 className="font-display text-4xl lg:text-5xl text-foreground/95">
            About <span className="text-primary text-glow-gold">Cuca Medina</span>
          </h2>
          <div className="space-y-4 text-muted-foreground leading-relaxed text-lg">
            <p>
              Cuca Medina is a singer (mezzo-soprano and vocalist), pianist and composer with a
              vast experience in erudite music, the creation of sound paths for dance and theatre,
              in diverse styles of popular music, in improvisation practice and in experimental music.
            </p>
            <p>
              Bachelor and Master in Music from UFRGS, she is a member of the acclaimed Lux Sonora
              orchestra (especially dedicated to baroque music), where she also works as a singer and
              contributes to the elaboration of arrangements.
            </p>
            <p>
              She has taken part in many recordings and premieres, collaborating with musicians from
              Brazil, Argentina and Uruguay. She stands out for her versatility and expressive
              intensity, awakening strong emotions in her listeners. She also has theatrical
              experience and in the dance arts (in formation) of oriental styles and gypsy dances.
            </p>
            <p>
              Voice and choral teacher with more than 20 years of experience in musical teaching,
              across diverse styles — from classical singing to jazz, pop, rock, expanded vocal
              techniques and crossover singing. She has already
              trained hundreds of students, many of whom are active professionals today.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            {["Mezzo-soprano", "Composer", "Pianist", "UFRGS · M.A. Music", "Lux Sonora Orchestra", "Choral Conductor", "20+ years teaching"].map((tag) => (
              <span key={tag} className="px-3 py-1.5 rounded-full text-xs border border-border/60 text-foreground/70">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const formatItems = [
  { label: "Weekly 90-min live class", icon: "◉" },
  { label: "International online course", icon: "✺" },
  { label: "Tuesdays · 9:30–11:00 AM SP", icon: "◐" },
  { label: "2 private 30-min sessions per 30-day cycle", icon: "◎" },
  { label: "Recorded Method Foundations Library", icon: "▶" },
  { label: "Replays: Complete tier only, from your start date", icon: "⟳" },
  { label: "Private student portal", icon: "◈" },
  { label: "Guided practices & materials", icon: "✦" },
  { label: "Real-time Q&A in class", icon: "✧" },
  { label: "September 1, 2026 · Founding launch", icon: "♪" },
];

function Format() {
  return (
    <section id="format" className="max-w-7xl mx-auto px-6 py-24">
      <div className="text-center mb-14">
        <p className="text-xs uppercase tracking-[0.3em] text-primary mb-3">Course Format</p>
        <h2 className="font-display text-4xl lg:text-5xl">A weekly ritual of practice</h2>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {formatItems.map((f) => (
          <div key={f.label} className="glass-card rounded-2xl p-6 text-center">
            <div className="text-2xl text-secondary mb-3">{f.icon}</div>
            <p className="text-foreground/85 text-sm leading-relaxed">{f.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const pathSteps = [
  {
    step: "01",
    title: "Initial Mapping",
    caption: "First private session · 10 minutes",
    body:
      "Your first private 30-minute session opens with a 10-minute initial pedagogical voice and expressive mapping: an attentive musical observation of your voice today — breath, resonance, range, expression. It is a pedagogical reading, never a medical or clinical assessment, and it becomes the baseline everything else is measured against.",
  },
  {
    step: "02",
    title: "Personalized Learning Path",
    caption: "Weekly cohort class · 2 private sessions per 30-day cycle",
    body:
      "From that baseline, Cuca defines your priorities. You study in the weekly 90-minute live cohort class, deepen the work in two private 30-minute sessions in each active 30-day cycle, and practice with the recorded Method Foundations Library at your own rhythm. Complete Course Access adds a detailed Vocal and Artistic Identity Analysis covering technique, style and creative vocal possibilities in relation to your artistic identity.",
  },
  {
    step: "03",
    title: "Transformation Portfolio",
    caption: "Six active months of study",
    body:
      "The Conscious Voice Transformation Portfolio — a documented journey of vocal, expressive and creative development — compares an initial and a final vocal sample, presents an interpretation or vocal creation you choose, and a short reflection on your development and next goals. Cuca Medina reviews it qualitatively, and guided resubmission is offered whenever it will serve your growth.",
  },
  {
    step: "04",
    title: "Certificate of Completion",
    caption: "Professional Development in Singing and Vocal Technique",
    body:
      "After six active months you become eligible for the Certificate of Completion — Professional Development in Singing and Vocal Technique. Eligibility requires completing the Method Foundations pathway and approval of your Conscious Voice Transformation Portfolio. It documents completed professional development and demonstrated vocal and artistic growth; it is not an academic degree, professional license or automatic outcome of having paid tuition.",
  },
];

function CoursePath() {
  return (
    <section id="path" className="relative py-24">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent -z-10" />
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-14" data-reveal>
          <p className="text-xs uppercase tracking-[0.3em] text-primary mb-3">
            Course Path · Certification
          </p>
          <h2 className="font-display text-4xl lg:text-5xl">
            From your first mapping to your certificate
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto mt-6 leading-relaxed">
            A structured pedagogical journey — observed at the start, guided month by
            month, and documented at the end in your own voice.
          </p>
        </div>

        <ol className="relative grid md:grid-cols-2 gap-5">
          {pathSteps.map((s, i) => (
            <li
              key={s.step}
              data-reveal
              data-reveal-delay={String((i % 2) + 1)}
              className="glass-card rounded-3xl p-8 relative overflow-hidden"
            >
              <div
                aria-hidden
                className="absolute top-5 right-6 font-display text-6xl text-primary/15 leading-none"
              >
                {s.step}
              </div>
              <div className="flex items-center gap-3 mb-3">
                <span className="h-px w-8 bg-primary/50" />
                <span className="text-[11px] uppercase tracking-[0.25em] text-primary/90">
                  {s.caption}
                </span>
              </div>
              <h3 className="font-display text-2xl lg:text-3xl text-secondary mb-3">
                {s.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">{s.body}</p>
            </li>
          ))}
        </ol>

        <p className="text-center text-xs text-muted-foreground/80 max-w-3xl mx-auto mt-10 leading-relaxed italic">
          The Certificate of Completion — Professional Development in Singing and Vocal Technique — is awarded after six active months, completion of the Method Foundations pathway and approval of the Conscious Voice Transformation Portfolio. It documents completed professional development and demonstrated vocal and artistic growth; it is not an academic degree, professional license or automatic outcome of having paid tuition. Eligibility is not a guarantee of results, and the certificate does not constitute a medical assessment.
        </p>
      </div>
    </section>
  );
}

const schedule = [
  { city: "São Paulo", time: "9:30 AM", flag: "🇧🇷" },
  { city: "New York · Eastern", time: "8:30 AM", flag: "🇺🇸" },
  { city: "London", time: "1:30 PM", flag: "🇬🇧" },
  { city: "Central Europe", time: "2:30 PM", flag: "🇪🇺" },
  { city: "Pakistan", time: "5:30 PM", flag: "🇵🇰" },
  { city: "India", time: "6:00 PM", flag: "🇮🇳" },
];

function Schedule() {
  return (
    <section id="schedule" className="relative py-24">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-secondary/5 to-transparent -z-10" />
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-14">
          <p className="text-xs uppercase tracking-[0.3em] text-secondary mb-3">Schedule · Time Zones</p>
          <h2 className="font-display text-4xl lg:text-5xl">Tuesdays, around the world</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {schedule.map((s) => (
            <div key={s.city} className="glass-card rounded-2xl p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{s.flag}</span>
                <span className="font-display text-xl text-foreground/95">{s.city}</span>
              </div>
              <span className="font-mono text-primary text-glow-gold">{s.time}</span>
            </div>
          ))}
        </div>
        <p className="text-center text-muted-foreground mt-10 max-w-2xl mx-auto italic">
          If your time zone makes the live class difficult, Complete Course Access includes class
          replays from your own enrollment date, and both tiers include the recorded Method
          Foundations Library — so you can study at your own rhythm from anywhere in the world.
        </p>

        {/* Zoom — discreet access card */}
        <div className="mt-10 max-w-2xl mx-auto glass-card rounded-2xl px-6 py-5 flex flex-col sm:flex-row items-center gap-4 justify-between">
          <div className="flex items-center gap-3 text-sm text-foreground/85">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-secondary shrink-0">
              <rect x="2" y="6" width="14" height="12" rx="2" />
              <path d="M16 10l6-3v10l-6-3z" />
            </svg>
            <span>
              Live classes are held on <span className="text-secondary">Zoom</span>. New here? Download the app for the smoothest experience.
            </span>
          </div>
          <a
            href="https://zoom.us/download"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs uppercase tracking-[0.2em] px-4 py-2 rounded-full border border-secondary/40 text-secondary hover:bg-secondary/10 transition-colors whitespace-nowrap"
          >
            Get Zoom →
          </a>
        </div>
      </div>
    </section>
  );
}

// Pricing is now provided by <PricingPlans /> from "@/components/PricingPlans"

function Scholarships() {
  return (
    <section id="scholarships" className="max-w-6xl mx-auto px-6 py-24">
      <div className="relative rounded-3xl overflow-hidden glass-card">
        <img src={scholarshipsImg} alt="Global Solidarity Scholarships" className="absolute inset-0 w-full h-full object-cover opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/40" />
        <div className="relative p-10 lg:p-16 max-w-2xl">
          <p className="text-xs uppercase tracking-[0.3em] text-primary mb-4">Global Solidarity</p>
          <h2 className="font-display text-4xl lg:text-5xl mb-6">
            <span className="text-primary text-glow-gold">Voice as Access.</span>
            <br />
            <span className="text-secondary text-glow-cyan italic">Art as Bridge.</span>
          </h2>
          <div className="space-y-4 text-foreground/85 text-lg leading-relaxed mb-8">
            <p>Need financial support?</p>
            <p>
              If international tuition in USD is currently beyond your reach, you may apply for a{" "}
              <span className="text-primary">Global Solidarity Scholarship</span>.
            </p>
            <p className="text-muted-foreground text-base">
              Scholarship seats are limited and may represent up to 20% of the total enrolled
              course group.
            </p>
          </div>
          <a
            href={appendUtmsToUrl("/scholarships")}
            onClick={() => trackCTAClick("scholarship", "scholarships_section")}
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-gradient-to-r from-secondary to-[oklch(0.65_0.18_220)] text-secondary-foreground font-semibold shadow-glow-cyan hover:scale-[1.03] transition-transform"
          >
            Apply for a Global Solidarity Scholarship →
          </a>
          <p className="mt-4 text-sm text-foreground/70 leading-relaxed max-w-md">
            No prior professional experience required. Each application is reviewed with care,
            considering your circumstances and the spirit of this initiative.
          </p>
        </div>
      </div>
    </section>
  );
}

const faqs = [
  {
    q: "Do I need to be a professional singer?",
    a: "No. This course welcomes anyone curious about voice — singers, speakers, teachers, artists and sensitive creators at any level.",
  },
  {
    q: "Can I join if I cannot attend live?",
    a: "Partly. Complete Course Access includes class replays from your own confirmed enrollment date, and both tiers include the recorded Method Foundations Library and two private 30-minute sessions in each active 30-day cycle. The weekly 90-minute cohort class remains the heart of the course, so we recommend attending live whenever you can.",
  },
  {
    q: "Is this course beginner-friendly?",
    a: "Absolutely. The method meets you where you are and grows with you — from first explorations to refined artistic practice.",
  },
  {
    q: "Will I have access to recordings?",
    a: "Two different things: the recorded Method Foundations Library — foundational vocal-technique videos — is included in both tiers. Class replays are included only in Complete Course Access, and they begin strictly from your own confirmed enrollment date. No student receives recordings of classes held before they joined, and there is no historical cohort archive.",
  },
  {
    q: "How do the private sessions and the initial mapping work?",
    a: "Every active 30-day cycle includes two private 30-minute sessions with Cuca Medina. In your very first private session, 10 minutes are dedicated to an initial pedagogical voice and expressive mapping: a musical and expressive observation — never a medical or clinical assessment — that establishes your baseline and the priorities of your learning path.",
  },
  {
    q: "How does the Certificate of Completion work?",
    a: "After six active months you become eligible for the Certificate of Completion — Professional Development in Singing and Vocal Technique. Eligibility requires completing the Method Foundations pathway and Cuca Medina's approval of your Conscious Voice Transformation Portfolio. The certificate documents completed professional development and demonstrated vocal and artistic growth; it is not an academic degree, professional license or automatic outcome of having paid tuition.",
  },
  {
    q: "What is the Conscious Voice Transformation Portfolio?",
    a: "A documented journey of vocal, expressive and creative development. It compares an initial and a final vocal sample, includes an interpretation or vocal creation you select, and a short written reflection on your development and next goals. Cuca Medina reviews it qualitatively, and guided resubmission is offered when something still needs work.",
  },
  {
    q: "Is a seat guaranteed once I choose a plan?",
    a: "No. The Founding Cohort begins September 1, 2026 with a maximum of 30 active students. Your place is confirmed only after payment is confirmed and admission is permitted. Once the cohort has begun, admission continues on a rolling basis only after a personal pedagogical review by Cuca Medina — an open number never reopens enrollment automatically. When the cohort is full, paused or under review, you are welcome to join the waiting list and request consideration.",
  },
  {
    q: "Do you offer scholarships?",
    a: "Yes. Global Solidarity Scholarships are available for students for whom international tuition is currently out of reach. They represent up to 20% of the enrolled course group.",
  },
  {
    q: "How does the billing work? Does it renew?",
    a: "Yes, card enrollments renew. You choose a period of 1, 3 or 6 months; the full amount is charged today and then automatically again at the end of each period, at the same price, until you cancel. You can cancel any time in the billing portal and it takes effect at the end of the period you already paid for — you keep access until then. If a renewal payment fails, your card is retried and your access continues for 7 more days. An international Wise transfer is the manual exception: it covers a single period and does not renew.",
  },
  {
    q: "What happens after I pay?",
    a: "You receive a welcome email with your student portal login, the class schedule, the Zoom link and a short orientation. Your access stays open for the full period you purchased, and nothing is charged again.",
  },
  {
    q: "Can I change my mind after paying?",
    a: "Yes. You have 14 calendar days to withdraw by writing to contact@tecendosom.com. If access or performance has not begun, you receive a full refund. If you asked for access to start during that period, a reasonable amount proportionate to what was already delivered may be deducted where the law permits. See the Refund Policy for details.",
  },
  {
    q: "What payment method do you use?",
    a: "Payments are processed securely in USD via Stripe (cards and local methods) or a manual Wise international transfer. Details are shared at checkout, and your bank may apply conversion or international fees.",
  },
  {
    q: "What happens after enrollment?",
    a: "You receive a welcome email with your student portal access, the class link, the schedule and a short orientation to begin the journey.",
  },
];

function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="max-w-4xl mx-auto px-6 py-24">
      <div className="text-center mb-14">
        <p className="text-xs uppercase tracking-[0.3em] text-secondary mb-3">Questions</p>
        <h2 className="font-display text-4xl lg:text-5xl">Quiet answers</h2>
      </div>
      <div className="space-y-3">
        {faqs.map((f, i) => (
          <div key={f.q} className="glass-card rounded-2xl overflow-hidden">
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full px-6 py-5 flex items-center justify-between gap-4 text-left hover:bg-primary/5 transition-colors"
            >
              <span className="font-display text-lg lg:text-xl text-foreground/95">{f.q}</span>
              <span className={`text-primary text-2xl transition-transform ${open === i ? "rotate-45" : ""}`}>+</span>
            </button>
            {open === i && (
              <div className="px-6 pb-6 text-muted-foreground leading-relaxed">{f.a}</div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section id="enroll" className="relative py-28 overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-primary/10 blur-[140px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-secondary/10 blur-[100px]" />
      </div>
      <div className="max-w-4xl mx-auto px-6 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-primary mb-6">Begin</p>
        <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl leading-tight mb-8">
          <span className="text-foreground/95 italic">Your voice is not only a tool.</span>
          <br />
          <span className="text-primary text-glow-gold">It is presence,</span>{" "}
          <span className="text-secondary text-glow-cyan">body,</span>
          <br />
          <span className="text-foreground/95">perception and expression.</span>
        </h2>
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 justify-center pt-6">
          <a
            href="#pricing"
            onClick={() => trackCTAClick("join", "final_cta")}
            className="w-full sm:w-auto px-7 py-3.5 rounded-full bg-gradient-to-r from-primary to-[oklch(0.65_0.20_45)] text-primary-foreground font-semibold shadow-glow-gold hover:scale-[1.03] transition-transform text-center"
          >
            Reserve my live seat
          </a>
          <a
            href="#pricing"
            onClick={() => trackCTAClick("replay", "final_cta")}
            className="w-full sm:w-auto px-7 py-3.5 rounded-full bg-gradient-to-r from-secondary to-[oklch(0.65_0.18_220)] text-secondary-foreground font-semibold shadow-glow-cyan hover:scale-[1.03] transition-transform text-center"
          >
            Get live classes + replays from your start date
          </a>
          <a
            href={appendUtmsToUrl("/scholarships")}
            onClick={() => trackCTAClick("scholarship", "final_cta")}
            className="w-full sm:w-auto px-7 py-3.5 rounded-full border border-primary/40 bg-primary/5 text-foreground font-medium hover:bg-primary/10 hover:text-primary transition-colors text-center"
          >
            Apply for a Scholarship
          </a>
        </div>
        <p className="mt-5 text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
          Need support? Scholarships are available — no prior professional experience required.
        </p>
      </div>
    </section>
  );
}

function LandingPage() {
  return (
    <div className="min-h-screen text-foreground">
      <Header />
      <main>
        <Hero />
        <Divider />
        <VSL />
        <About />
        <Audience />
        <Learn />
        <Instructor />
        <Format />
        <CoursePath />
        <Schedule />
        <Gallery />
        <Testimonials />
        <EnrollmentForm />
        <PricingPlans />
        <Scholarships />
        <FAQ />
        <FinalCTA />
      </main>
      <SiteFooter />
    </div>
  );
}
