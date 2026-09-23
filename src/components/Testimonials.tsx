import { useEffect, useState } from "react";
import { translateTestimonials } from "@/lib/translate.functions";

type Testimonial = {
  name: string;
  role: string;
  quote: string; // original PT
  en?: string;   // manual English translation when available
};

const testimonials: Testimonial[] = [
  {
    name: "Marina S.",
    role: "Cantora · Porto Alegre",
    quote:
      "As aulas com a Cuca transformaram minha relação com a voz. Hoje canto com mais liberdade, presença e consciência do corpo. É um trabalho profundo e amoroso.",
  },
  {
    name: "Rafael L.",
    role: "Ator e cantor · São Paulo",
    quote:
      "Cuca tem uma escuta refinadíssima. Ela percebe sutilezas que ninguém mais percebe e devolve isso em forma de orientação clara e poética. Mudou minha técnica e minha vida artística.",
  },
  {
    name: "Camila R.",
    role: "Educadora vocal · Florianópolis",
    quote:
      "Estudo com a Cuca há anos. Sua abordagem une fisiologia, escuta interna e expressão de um jeito que eu nunca tinha visto. Recomendo de olhos fechados.",
  },
  {
    name: "Tomás A.",
    role: "Compositor · Buenos Aires",
    quote:
      "A maneira como Cuca trabalha respiração e ressonância é única. Sinto que finalmente entendi meu instrumento. É arte, é pedagogia, é cuidado humano.",
  },
  {
    name: "Júlia M.",
    role: "Iniciante · Recife",
    quote:
      "Eu tinha muito medo de cantar. As aulas da Cuca abriram um espaço seguro para eu descobrir minha voz aos poucos, com leveza e profundidade.",
  },
  {
    name: "Kátia",
    role: "Participante · Grupo de Coro",
    quote:
      "Há mais de três anos participo da oficina de Técnica Vocal ministrada pela Cuca. Comecei com o intuito de aprimorar e aumentar meu alcance vocal, uma vez que faço parte de um Grupo de Coro. Porém, todas as técnicas e aprendizados desenvolvidos, além de melhorar a projeção da minha voz, trouxeram uma melhor percepção corporal e uma condução correta da respiração, facilitando o alcance de determinadas notas, sem causar danos na garganta. Recomendo muito!!!",
    en:
      "For over three years I have been attending the Vocal Technique workshop taught by Cuca. I started with the intention of improving and expanding my vocal range, since I am part of a Choir Group. However, all the techniques and learnings developed, in addition to improving the projection of my voice, brought better body awareness and correct breath control, facilitating the reaching of certain notes without causing damage to the throat. I highly recommend!!!",
  },
  {
    name: "Vitor Barreto Moreira",
    role: "Arte-educador · Porto Alegre",
    quote:
      "Aprendi muito com a Cuca, foi com ela que aprendi toda minha base do canto, técnica vocal e música. Uma profissional formidável com vasto conhecimento de técnica, fisiologia da voz, teoria musical e qualidade musical. São aprendizados que carrego comigo e jamais esquecerei, foram cruciais para hoje eu trabalhar com arte e passar esse conhecimento adiante.",
    en:
      "I learned a lot from Cuca; it was with her that I built my entire foundation in singing, vocal technique, and music. She is a remarkable professional with vast knowledge of vocal technique, voice physiology, music theory, and musical quality. These are lessons that I carry with me and will never forget; they were crucial for me to be able to work in the arts today and pass this knowledge on to others.",
  },
  {
    name: "Jéssica Prestes",
    role: "Bailarina e historiadora · Porto Alegre",
    quote:
      "Minha experiência com a música se deu primeiramente a partir dos 16 anos, nas aulas de técnica vocal e teoria musical da Cuca Medina. Foi ali que iniciei meus estudos a cerca da musicalidade e ainda hoje, 20 anos depois, carrego esses ensinamentos comigo, na minha prática como bailarina profissional de Danças Ciganas.",
    en:
      "My experience with music began when I was 16, in Cuca Medina's vocal technique and music theory classes. That is where I started my studies in musicality, and even today, 20 years later, I carry those teachings with me in my practice as a professional Gypsy Dances dancer.",
  },
  {
    name: "Yelitza Izabel Indriago",
    role: "Aluna · Venezuela",
    quote:
      "Ter aulas com a professora Cuca foi uma experiência enriquecedora e renovadora porque me permitiu aumentar minha autoestima e autoconfiança ao me propor desafios que superei com a ajuda de suas orientações. Ela é uma profissional altamente competente, comprometida, responsável e amável. Além disso, aplica estratégias ativas e inovadoras que facilitam a aprendizagem e permitem reduzir o estresse e a ansiedade, promovendo um estado de relaxamento.",
    en:
      "Taking classes with Professor Cuca was an enriching and refreshing experience because it allowed me to increase my self-esteem and self-confidence by presenting me with challenges that I overcame with the help of her guidance. She is a highly competent, committed, responsible, and kind professional. In addition, she applies active and innovative strategies that facilitate learning and help reduce stress and anxiety, promoting a state of relaxation.",
  },
];

export function Testimonials() {
  const [lang, setLang] = useState<"pt" | "en">("en");
  const [translations, setTranslations] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (lang === "en" && !translations && !loading) {
      setLoading(true);
      translateTestimonials({
        data: { texts: testimonials.map((t) => t.quote), target: "en" },
      })
        .then((res) => setTranslations(res.translations))
        .catch(() => setTranslations(testimonials.map((t) => t.quote)))
        .finally(() => setLoading(false));
    }
  }, [lang, translations, loading]);

  const current = testimonials[index];
  const displayQuote =
    lang === "pt" ? current.quote : current.en ?? translations?.[index] ?? current.quote;

  const next = () => setIndex((i) => (i + 1) % testimonials.length);
  const prev = () =>
    setIndex((i) => (i - 1 + testimonials.length) % testimonials.length);

  return (
    <section id="testimonials" className="max-w-5xl mx-auto px-6 py-24">
      <div className="text-center mb-12">
        <p className="text-xs uppercase tracking-[0.3em] text-secondary mb-3">
          Voices of Students
        </p>
        <h2 className="font-display text-4xl lg:text-5xl">What students share</h2>
      </div>

      <div className="flex justify-center mb-8">
        <div className="inline-flex rounded-full border border-border/60 p-1 bg-card/40 backdrop-blur">
          <button
            onClick={() => setLang("en")}
            className={`px-4 py-1.5 rounded-full text-xs uppercase tracking-wider transition-colors ${
              lang === "en"
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            English {loading && lang === "en" && "…"}
          </button>
          <button
            onClick={() => setLang("pt")}
            className={`px-4 py-1.5 rounded-full text-xs uppercase tracking-wider transition-colors ${
              lang === "pt"
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Português
          </button>
        </div>
      </div>

      <div className="relative glass-card rounded-3xl p-8 lg:p-12 ring-glow-cyan min-h-[280px] flex flex-col justify-center">
        <div className="absolute top-6 left-8 font-display text-7xl text-primary/20 leading-none select-none">
          “
        </div>
        <blockquote className="relative z-10 text-lg lg:text-xl text-foreground/90 leading-relaxed italic font-light text-center max-w-3xl mx-auto">
          {displayQuote}
        </blockquote>
        <div className="mt-8 text-center">
          <div className="font-display text-xl text-primary text-glow-gold">
            {current.name}
          </div>
          <div className="text-sm text-muted-foreground mt-1">{current.role}</div>
        </div>

        <div className="flex items-center justify-between mt-8">
          <button
            onClick={prev}
            aria-label="Previous testimonial"
            className="w-11 h-11 rounded-full glass-card flex items-center justify-center text-secondary hover:text-primary hover:scale-105 transition"
          >
            ←
          </button>
          <div className="flex gap-2">
            {testimonials.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`Testimonial ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-8 bg-primary" : "w-1.5 bg-muted-foreground/40"
                }`}
              />
            ))}
          </div>
          <button
            onClick={next}
            aria-label="Next testimonial"
            className="w-11 h-11 rounded-full glass-card flex items-center justify-center text-secondary hover:text-primary hover:scale-105 transition"
          >
            →
          </button>
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground/70 mt-6 italic">
        {lang === "en"
          ? "Testimonials originally shared in Portuguese · translated with care."
          : "Depoimentos originais dos alunos."}
      </p>

      <div className="mt-12">
        <p className="text-center text-[11px] uppercase tracking-[0.3em] text-muted-foreground/70 mb-5">
          Why students trust this work
        </p>
        <ul className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4">
          {[
            { icon: "✦", title: "20+ years", sub: "teaching voice" },
            { icon: "✧", title: "M.Mus.", sub: "Master in Music" },
            { icon: "◈", title: "International", sub: "student cohorts" },
            { icon: "❖", title: "Supportive", sub: "body-aware methodology" },
          ].map((b) => (
            <li
              key={b.title}
              className="glass-card rounded-2xl px-4 py-4 flex flex-col items-center text-center border border-border/40 hover:border-primary/40 transition-colors"
            >
              <span className="text-primary text-lg mb-1.5">{b.icon}</span>
              <span className="font-display text-foreground text-base leading-tight">
                {b.title}
              </span>
              <span className="text-xs text-muted-foreground mt-1 leading-snug">
                {b.sub}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
