import { describe, expect, test } from "bun:test";
import { joinBirthDate, splitBirthDate } from "../src/lib/birth-date-parts";
import { profileSchema, profileAnswers, profileFromAnswers } from "../src/lib/enrollment-profile";

const dateSchema = profileSchema.shape.birthDate;
describe("shared birth date ISO contract", () => {
  test("restores ISO without ambiguous month/day ordering", () => {
    expect(splitBirthDate("1992-12-03")).toEqual({ day: "03", month: "12", year: "1992" });
    expect(joinBirthDate(splitBirthDate("1992-12-03"))).toBe("1992-12-03");
  });
  test("required incomplete dates remain empty", () => {
    expect(joinBirthDate({ day: "29", month: "02", year: "" })).toBe("");
    expect(dateSchema.safeParse("").success).toBe(false);
  });
  test("accepts February 29 in a leap year", () => {
    expect(dateSchema.safeParse(joinBirthDate({ day: "29", month: "02", year: "2000" })).success).toBe(true);
  });
  test("rejects February 29 in a non-leap year", () => {
    expect(dateSchema.safeParse("2001-02-29").success).toBe(false);
  });
  test("rejects impossible month/day without silently rolling over", () => {
    expect(joinBirthDate({ day: "31", month: "04", year: "2000" })).toBe("2000-04-31");
    expect(dateSchema.safeParse("2000-04-31").success).toBe(false);
  });
  test("rejects future dates", () => {
    expect(dateSchema.safeParse("2999-01-01").success).toBe(false);
  });
  test("stored answer recovery retains the ISO date", () => {
    const profile = { fullName: "Synthetic Tester", birthDate: "2000-02-29", email: "fixture@example.invalid", phone: "+1 5550100", country: "Fixture", city: "Fixture", address: "Fixture", profession: "Fixture", musicLevel: "Beginner", academicExperience: "None yet", musicalPreferences: "Jazz", motivation: "Fixture" };
    const restored = profileFromAnswers(profile, profileAnswers(profile));
    expect(joinBirthDate(splitBirthDate(restored.birthDate))).toBe("2000-02-29");
  });
});