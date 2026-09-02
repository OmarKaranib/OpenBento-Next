import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  createFixtureMeaningfulnessClassifier,
  judgeRepresentatives,
  selectMeaningfulDevelopments,
  toMeaningfulnessInput,
} from "../meaningfulness";
import {
  MEANINGFULNESS_CLASSIFIER_INSTRUCTIONS,
  MEANINGFULNESS_JUDGMENT_JSON_SCHEMA,
  MEANINGFULNESS_JUDGMENT_TEXT_FORMAT,
} from "./meaningfulness-classifier-protocol";
import {
  MEANING_CLASSIFIER_LABEL_FIXTURES,
  PINNED_X_CLASSIFIER_INSTRUCTION,
  PINNED_X_MEANING_FIXTURES,
} from "./meaningfulness-classifier-pins.fixture";

const here = dirname(fileURLToPath(import.meta.url));

function readAdapter(name: string): string {
  return readFileSync(join(here, name), "utf8");
}

describe("shared classifier instruction calibration", () => {
  it("guides the model to reject reply / quote / secondary-commentary amplification", () => {
    const instructions = MEANINGFULNESS_CLASSIFIER_INSTRUCTIONS;
    expect(instructions).toMatch(/reply amplification/i);
    expect(instructions).toMatch(/quote-post amplification/i);
    expect(instructions).toMatch(/secondary commentary/i);
    expect(instructions).toMatch(/not itself a new development/i);
    expect(instructions).toMatch(/THIS SOURCE/i);
    expect(instructions).toMatch(/amplifies someone else's report/i);
  });

  it("keeps multilingual eligibility and does not encode an English-only lexical gate", () => {
    const instructions = MEANINGFULNESS_CLASSIFIER_INSTRUCTIONS;
    expect(instructions).toMatch(/Judge meaning, not language/i);
    expect(instructions).toMatch(
      /Non-English and non-ASCII text is equally eligible/i,
    );
    expect(instructions).toMatch(/Language and script do not change this/i);
    expect(instructions).not.toMatch(/english only|must be english|ascii-only/i);
    expect(instructions).not.toMatch(
      /(?:announce|confirm|breaking|lawsuit|officials)\s*[:=]/i,
    );
    expect(instructions).not.toMatch(/\b(startsWith|regex|keyword list)\b/i);
  });

  it("leaves the strict structured JSON output schema unchanged", () => {
    expect(MEANINGFULNESS_JUDGMENT_JSON_SCHEMA).toEqual({
      type: "object",
      properties: {
        meaningful: { type: "boolean" },
        importanceScore: { type: "number" },
      },
      required: ["meaningful", "importanceScore"],
      additionalProperties: false,
    });
    expect(MEANINGFULNESS_JUDGMENT_TEXT_FORMAT.format).toMatchObject({
      type: "json_schema",
      name: "meaningfulness_judgment",
      strict: true,
    });
  });

  it("is the single prompt both OpenAI and xAI adapters send (no vendor forks)", () => {
    const protocol = readAdapter("meaningfulness-classifier-protocol.ts");
    const grok = readAdapter("meaningfulness-classifier.ts");
    const openai = readAdapter("openai-meaningfulness-classifier.ts");
    expect(protocol).toMatch(/export const MEANINGFULNESS_CLASSIFIER_INSTRUCTIONS/);
    expect(grok).toMatch(/instructions: MEANINGFULNESS_CLASSIFIER_INSTRUCTIONS/);
    expect(openai).toMatch(
      /instructions: MEANINGFULNESS_CLASSIFIER_INSTRUCTIONS/,
    );
    expect(grok).not.toMatch(/You classify whether one SOURCE/);
    expect(openai).not.toMatch(/You classify whether one SOURCE/);
    expect(protocol).not.toMatch(/startsWith\(["']@/);
    expect(protocol).not.toMatch(/title\.match\(/);
  });
});

describe("pinned X meaning labels (fixture classifier, no live model)", () => {
  const classifier = createFixtureMeaningfulnessClassifier(
    MEANING_CLASSIFIER_LABEL_FIXTURES.map((pin) => ({
      title: pin.title,
      canonicalUrl: pin.canonicalUrl,
      meaningful: pin.expectedMeaningful,
      importanceScore: pin.expectedMeaningful ? 0.85 : 0.15,
    })),
  );

  it("documents human blind-eval labels for the five pinned candidates", async () => {
    expect(PINNED_X_MEANING_FIXTURES).toHaveLength(5);
    expect(
      PINNED_X_MEANING_FIXTURES.map((pin) => pin.expectedMeaningful),
    ).toEqual([true, false, false, true, false]);

    for (const pin of PINNED_X_MEANING_FIXTURES) {
      expect(pin.sourceType).toBe("x");
      expect(pin.instruction).toBe(PINNED_X_CLASSIFIER_INSTRUCTION);
      expect(pin.snippet).toBe(pin.title);
      const judgment = await classifier.classify(
        toMeaningfulnessInput(
          {
            title: pin.title,
            snippet: pin.snippet,
            sourceType: pin.sourceType,
            canonicalUrl: pin.canonicalUrl,
          },
          pin.instruction,
        ),
      );
      expect(judgment.meaningful, pin.id).toBe(pin.expectedMeaningful);
      expect(judgment.classificationStatus).toBe("classified");
    }
  });

  it("labels synthetic reply / quote / secondary-commentary cases as not meaningful", async () => {
    const synthetic = MEANING_CLASSIFIER_LABEL_FIXTURES.filter(
      (pin) => pin.kind === "synthetic",
    );
    expect(synthetic.length).toBeGreaterThanOrEqual(3);
    for (const pin of synthetic) {
      const judgment = await classifier.classify(
        toMeaningfulnessInput(
          {
            title: pin.title,
            snippet: pin.snippet,
            sourceType: pin.sourceType,
            canonicalUrl: pin.canonicalUrl,
          },
          pin.instruction,
        ),
      );
      expect(judgment.meaningful, pin.id).toBe(pin.expectedMeaningful);
    }
  });

  it("keeps only the meaningful pins before selection", async () => {
    const judged = await judgeRepresentatives(
      PINNED_X_MEANING_FIXTURES.map((pin, arrivalIndex) => ({
        arrivalIndex,
        relevanceScore: 0.8,
        noveltyScore: 1,
        title: pin.title,
        canonicalUrl: pin.canonicalUrl,
      })),
      (candidate) =>
        toMeaningfulnessInput(
          {
            title: candidate.title,
            snippet: candidate.title,
            sourceType: "x",
            canonicalUrl: candidate.canonicalUrl,
          },
          PINNED_X_CLASSIFIER_INSTRUCTION,
        ),
      classifier,
    );
    const selected = selectMeaningfulDevelopments(judged);
    expect(selected.map((item) => item.canonicalUrl)).toEqual([
      "https://x.com/dailytechonx/status/2095134626800894439",
      "https://x.com/rakutsune_/status/2095134599471137170",
    ]);
  });

  it("does not reject unmatched @-prefixed titles via a lexical gate (passthrough unmatched)", async () => {
    const unmatched = await classifier.classify(
      toMeaningfulnessInput(
        {
          title: "@someone this unmatched fixture row is not in the table",
          snippet: "@someone this unmatched fixture row is not in the table",
          sourceType: "x",
          canonicalUrl: "https://x.com/example/status/unmatched-not-in-table",
        },
        PINNED_X_CLASSIFIER_INSTRUCTION,
      ),
    );
    expect(unmatched.meaningful).toBe(true);
    expect(unmatched.importanceScore).toBe(0);
  });
});
