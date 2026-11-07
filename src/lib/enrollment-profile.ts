import { z } from "zod";

export const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Please enter your full name.").max(120),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Please enter your date of birth.").refine((value) => {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && date.getTime() <= Date.now();
  }, "Please enter a valid date of birth."),
  email: z.string().trim().email("Please enter a valid email.").max(160),
  phone: z.string().trim().min(4, "Please enter your phone number and country code.").max(40),
  country: z.string().trim().min(1, "Please select your country.").max(120),
  city: z.string().trim().min(1, "Please enter your city.").max(120),
  address: z.string().trim().min(1, "Please enter your address.").max(300),
  profession: z.string().trim().min(1, "Please enter your profession.").max(160),
  musicLevel: z.string().trim().min(1, "Please select your musical level.").max(80),
  academicExperience: z.string().trim().min(1, "Please describe your musical and academic experience (or write None yet).").max(2000),
  musicalPreferences: z.string().trim().min(1, "Please share your musical preferences.").max(2000),
  motivation: z.string().trim().min(1, "Please share your motivation.").max(2000),
});
export type EnrollmentProfile = z.infer<typeof profileSchema>;
export const PROFILE_STORAGE_KEY = "conscious-voice-enrollment-profile";

export function profileFromAnswers(contact: { fullName: string | null; email: string | null; phone: string | null }, answers: unknown): Partial<EnrollmentProfile> {
  const parsed = z.record(z.string(), z.unknown()).safeParse(answers);
  const values = parsed.success ? parsed.data : {};
  const text = (key: string) => typeof values[key] === "string" ? values[key] as string : "";
  return { fullName: contact.fullName ?? "", email: contact.email ?? "", phone: contact.phone ?? "", birthDate: text("birth_date"), country: text("country"), city: text("city"), address: text("address"), profession: text("profession"), musicLevel: text("music_level"), academicExperience: text("academic_experience"), musicalPreferences: text("musical_preferences"), motivation: text("motivation") };
}

export function profileAnswers(profile: EnrollmentProfile) {
  return { birth_date: profile.birthDate, country: profile.country, city: profile.city, address: profile.address, profession: profile.profession, music_level: profile.musicLevel, academic_experience: profile.academicExperience, musical_preferences: profile.musicalPreferences, motivation: profile.motivation };
}