import prompt from "./assessment-prompt.json";

/** Fills the template in one pass, so user text is never treated as a placeholder. */
export function buildUserPrompt(input: {
  language: "sv" | "en";
  title: string;
  description: string;
  cv: string;
}) {
  const values: Record<string, string> = {
    language: input.language === "sv" ? "Swedish" : "English",
    title: input.title,
    description: input.description,
    cv: input.cv,
  };
  return prompt.user.replace(
    /\{(language|title|description|cv)\}/g,
    (_, key: string) => values[key],
  );
}
