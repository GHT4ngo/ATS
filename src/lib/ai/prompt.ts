import prompt from "./assessment-prompt.json";

/**
 * Removes anything that looks like the prompt's own tags, so text in a CV or
 * job posting cannot close the data block it sits in.
 */
export function neutraliseTags(text: string) {
  return text.replace(/<\s*\/?\s*(cv|job|language)\b[^>]*>/gi, "");
}

/** Fills the template in one pass, so user text is never treated as a placeholder. */
export function buildUserPrompt(input: {
  language: "sv" | "en";
  title: string;
  description: string;
  cv: string;
}) {
  const values: Record<string, string> = {
    language: input.language === "sv" ? "Swedish" : "English",
    title: neutraliseTags(input.title),
    description: neutraliseTags(input.description),
    cv: neutraliseTags(input.cv),
  };
  return prompt.user.replace(
    /\{(language|title|description|cv)\}/g,
    (_, key: string) => values[key],
  );
}
