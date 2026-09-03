import { sanitizeUntrustedText } from "./untrusted";

export type ProviderQueryTarget = "x" | "youtube";

const DERIVATION_INPUT_CEILING = 4_000;

/**
 * Derive only the provider discovery query. The complete WatchBot instruction
 * remains unchanged for OpenBento's relevance and meaningfulness stages.
 */
export function deriveProviderSearchQuery(
  instruction: unknown,
  target: ProviderQueryTarget,
  maxLength: number,
): string {
  const boundedLength = Number.isFinite(maxLength)
    ? Math.max(1, Math.floor(maxLength))
    : 1;
  const input = sanitizeUntrustedText(instruction, DERIVATION_INPUT_CEILING);
  if (!input) {
    return "";
  }

  const protectedPhrases: string[] = [];
  let query = input.replace(
    /(["'“”‘’])([^"'“”‘’]+)(["'“”‘’])/gu,
    (match) => {
      const token = `OPENBENTOQUOTED${protectedPhrases.length}TOKEN`;
      protectedPhrases.push(match);
      return token;
    },
  );

  query = query
    .replace(
      /\b(?:and\s+)?(?:alert|notify)\s+me(?:\s+(?:when|if)\b[\s\S]*)?$/iu,
      " ",
    )
    .replace(/\b(?:and\s+)?tell\s+me\s+when\b[\s\S]*$/iu, " ")
    .replace(/^\s*(?:please\s+)?(?:follow|monitor|watch|track)\b/iu, " ")
    .replace(/\bimportant\s+(updates?)\s+(?:about|on)\b/giu, "$1 ")
    .replace(/\bmeaningful\s+developments?\s+(?:about|on)\b/giu, " ")
    .replace(/\bimportant\s+(?=(?:breaking\s+)?news\b)/giu, " ");

  if (target === "youtube") {
    query = query.replace(
      /^\s*(?:latest\s+)?(?:youtube\s+)?videos?\s+(?:about|on)\b/iu,
      " ",
    );
  }

  query = query
    .replace(/\b(?:about|on|for)\b/giu, " ")
    .replace(/\s*[,;:.!?]+\s*/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();

  for (const [index, phrase] of protectedPhrases.entries()) {
    query = query.replace(`OPENBENTOQUOTED${index}TOKEN`, phrase);
  }

  return sanitizeUntrustedText(query, boundedLength);
}
