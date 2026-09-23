import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  texts: z.array(z.string().min(1).max(2000)).min(1).max(20),
  target: z.enum(["en", "pt"]).default("en"),
});

export const translateTestimonials = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const targetLang = data.target === "en" ? "English" : "Portuguese";
    const sourceLang = data.target === "en" ? "Portuguese" : "English";

    const numbered = data.texts
      .map((t, i) => `${i + 1}. ${t}`)
      .join("\n\n");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are a refined literary translator specialized in artistic, musical and pedagogical contexts. Translate testimonials about a voice teacher with elegance, warmth and emotional fidelity. Preserve sincere tone. Do not add commentary.",
          },
          {
            role: "user",
            content: `Translate the following ${sourceLang} testimonials into ${targetLang}. Return ONLY the translations, in the same numbered order, one per line, without the original text.\n\n${numbered}`,
          },
        ],
      }),
    });

    if (response.status === 429) {
      throw new Error("Rate limit exceeded. Please try again shortly.");
    }
    if (response.status === 402) {
      throw new Error("AI credits exhausted.");
    }
    if (!response.ok) {
      throw new Error(`Translation failed: ${response.status}`);
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content ?? "";

    // Parse numbered list back into array
    const lines = content
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const translated: string[] = [];
    let current = "";
    for (const line of lines) {
      const match = line.match(/^(\d+)[.)]\s*(.*)$/);
      if (match) {
        if (current) translated.push(current.trim());
        current = match[2];
      } else {
        current += (current ? " " : "") + line;
      }
    }
    if (current) translated.push(current.trim());

    // Fallback if parsing didn't yield expected count
    if (translated.length !== data.texts.length) {
      return { translations: data.texts.map((_, i) => translated[i] ?? "") };
    }

    return { translations: translated };
  });
