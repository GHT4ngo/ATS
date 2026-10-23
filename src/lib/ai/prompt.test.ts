import { describe, expect, it } from "vitest";
import { buildUserPrompt } from "./prompt";

describe("buildUserPrompt", () => {
  const input = {
    language: "en" as const,
    title: "Frontend developer",
    description: "React and TypeScript",
    cv: "Price $& and $1, plus {title} written in the CV",
  };

  it("inserts user text literally", () => {
    const text = buildUserPrompt(input);
    expect(text).toContain("Price $& and $1, plus {title} written in the CV");
    expect(text).toContain("Title: Frontend developer");
  });

  it("keeps the job and the CV inside their tags", () => {
    const text = buildUserPrompt(input);
    expect(text).toMatch(/<language>English<\/language>/);
    expect(text).toMatch(/<job>[\s\S]*React and TypeScript[\s\S]*<\/job>/);
    expect(text).toMatch(/<cv>[\s\S]*Price[\s\S]*<\/cv>$/);
  });

  it("does not expand placeholders inside the job description", () => {
    const text = buildUserPrompt({ ...input, description: "See {cv}" });
    expect(text).toContain("See {cv}");
    expect(text.match(/Price/g)).toHaveLength(1);
  });

  it("asks for Swedish by default locale", () => {
    expect(buildUserPrompt({ ...input, language: "sv" })).toContain(
      "<language>Swedish</language>",
    );
  });
});
