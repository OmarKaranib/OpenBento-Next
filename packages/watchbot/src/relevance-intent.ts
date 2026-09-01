import { sanitizeUntrustedText } from "./untrusted";

/**
 * Scoring lanes. Provider adapters stay out of `@openbento/domain`.
 *
 * 1. Provider search/filter query — what an adapter sent (X recent-search).
 * 2. Natural-language monitoring intent — raw WatchBot instruction for NL bots.
 * 3. Provider-filtered candidate — item already matched the provider query.
 * 4. OpenBento post-fetch relevance — still scored; never trust every hit.
 */
export type RelevanceLane = "natural_language" | "provider_filtered";

export interface DerivedRelevanceIntent {
  lane: RelevanceLane;
  /** Terms used for post-fetch scoring. Never executed or JSON-parsed. */
  intentText: string;
}

/**
 * X / YouTube / Reddit can opt into provider-filtered scoring later.
 * web/news stay on the natural-language path.
 */
export function relevanceLaneForSourceType(sourceType: string): RelevanceLane {
  return sourceType === "x" ? "provider_filtered" : "natural_language";
}

export function deriveRelevanceIntent(
  instruction: string,
  sourceType: string,
): DerivedRelevanceIntent {
  const lane = relevanceLaneForSourceType(sourceType);
  if (lane === "provider_filtered" && sourceType === "x") {
    return { lane, intentText: deriveXPositiveSearchTerms(instruction) };
  }
  return { lane: "natural_language", intentText: instruction };
}

const BOOLEAN_OPERATORS = new Set(["OR", "AND"]);

/**
 * Linear scan of an X recent-search query. Keeps only positive keywords and
 * quoted phrases. Drops boolean operators, `-exclusions`, and `key:value`
 * operators (`-is:retweet`, `lang:en`, `from:user`). Does not parse JSON,
 * does not recurse, and does not treat source text as instructions.
 */
export function deriveXPositiveSearchTerms(query: string): string {
  const input = sanitizeUntrustedText(query, 2_000);
  if (!input) {
    return "";
  }

  const terms: string[] = [];
  let i = 0;
  let excludeNext = false;

  while (i < input.length) {
    const ch = input[i];
    if (ch === undefined) {
      break;
    }
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === "(" || ch === ")") {
      i += 1;
      continue;
    }
    if (ch === "{" || ch === "[") {
      i = skipBalanced(input, i);
      continue;
    }
    if (ch === "}" || ch === "]") {
      i += 1;
      continue;
    }
    if (ch === "-") {
      excludeNext = true;
      i += 1;
      continue;
    }
    if (isQuote(ch)) {
      const quoted = readQuoted(input, i);
      if (!excludeNext && quoted.text) {
        terms.push(quoted.text);
      }
      excludeNext = false;
      i = quoted.next;
      continue;
    }

    const atom = readAtom(input, i);
    i = atom.next;
    if (!atom.text) {
      excludeNext = false;
      continue;
    }
    if (!excludeNext && BOOLEAN_OPERATORS.has(atom.text)) {
      continue;
    }
    if (atom.text === "NOT") {
      excludeNext = true;
      continue;
    }
    if (excludeNext || isColonOperator(atom.text)) {
      excludeNext = false;
      continue;
    }
    terms.push(stripLeadingSigil(atom.text));
    excludeNext = false;
  }

  return terms.filter((term) => term.length > 0).join(" ");
}

function isQuote(ch: string): boolean {
  return ch === '"' || ch === "'" || ch === "\u201c" || ch === "\u201d" || ch === "\u2018" || ch === "\u2019";
}

function isColonOperator(text: string): boolean {
  return text.includes(":");
}

function stripLeadingSigil(text: string): string {
  return text.replace(/^[#@$]+/, "");
}

function readQuoted(input: string, start: number): { text: string; next: number } {
  let i = start + 1;
  while (i < input.length && !isQuote(input[i] ?? "")) {
    i += 1;
  }
  return {
    text: input.slice(start + 1, i),
    next: i < input.length ? i + 1 : i,
  };
}

/** Linear brace walk. Not JSON.parse, not recursive descent. */
function skipBalanced(input: string, start: number): number {
  const open = input[start] ?? "";
  const close = open === "{" ? "}" : open === "[" ? "]" : "";
  if (!close) {
    return start + 1;
  }
  let depth = 1;
  let i = start + 1;
  let inQuote = false;
  while (i < input.length && depth > 0) {
    const ch = input[i] ?? "";
    if (inQuote) {
      if (isQuote(ch)) {
        inQuote = false;
      }
      i += 1;
      continue;
    }
    if (isQuote(ch)) {
      inQuote = true;
    } else if (ch === open) {
      depth += 1;
    } else if (ch === close) {
      depth -= 1;
    }
    i += 1;
  }
  return i;
}

function readAtom(input: string, start: number): { text: string; next: number } {
  let i = start;
  while (i < input.length) {
    const ch = input[i] ?? "";
    if (/\s/.test(ch) || ch === "(" || ch === ")" || isQuote(ch)) {
      break;
    }
    i += 1;
  }
  return { text: input.slice(start, i), next: i };
}
