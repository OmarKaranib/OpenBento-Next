/**
 * Offline Terra compare eval harness (operator replay only).
 *
 * Replays ≤5 pinned candidates through the existing Slice E OpenAI
 * meaningfulness adapter. No X provider, no worker cycle, no Card
 * creation, no prompt edits. CI must inject a mock fetch — never a
 * live OpenAI call.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createOpenAIMeaningfulnessClassifier,
  openaiEnvApiKey,
} from "./adapters/openai-meaningfulness-classifier";
import { ClassifierCallBudget } from "./classifier-budget";
import type {
  ClassificationStatus,
  MeaningfulnessInput,
} from "./meaningfulness";

export const TERRA_EVAL_MODEL_DEFAULT = "gpt-5.6-terra";
export const TERRA_EVAL_MAX_CALLS = 5;
export const TERRA_EVAL_INSTRUCTION = "(OpenAI OR WebMCP) -is:retweet";
export const TERRA_EVAL_SOURCE_TYPE = "x";

const TITLE_ELLIPSIS = "\u2026";

export interface TerraCompareCandidate {
  url: string;
  title: string;
}

export interface TerraCompareFixture {
  label?: string;
  instruction: string;
  sourceType: string;
  note?: string;
  candidates: TerraCompareCandidate[];
}

export interface TerraCompareEvalRow {
  index: number;
  url: string;
  title: string;
  meaningful: "yes" | "no";
  importanceScore: number;
  classificationStatus?: ClassificationStatus;
  provider: "openai";
  model: string;
}

export interface TerraCompareEvalOptions {
  env?: NodeJS.ProcessEnv;
  fixturePath?: string;
  fixture?: TerraCompareFixture;
  fetchImpl?: typeof fetch;
  write?: (text: string) => void;
}

export interface TerraCompareEvalResult {
  ok: boolean;
  exitCode: number;
  output: string;
  rows: TerraCompareEvalRow[];
  model: string;
  error?: string;
}

export function defaultTerraCompareFixturePath(): string {
  return join(
    dirname(fileURLToPath(import.meta.url)),
    "../scripts/fixtures/terra-compare-five.json",
  );
}

/**
 * Harness default is Terra. Shared `OPENAI_MEANINGFULNESS_MODEL` still
 * overrides (same as the production adapter). Harness-specific
 * `OPENAI_TERRA_EVAL_MODEL` wins when set.
 */
export function resolveTerraEvalModel(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const harness = env.OPENAI_TERRA_EVAL_MODEL?.trim();
  if (harness) {
    return harness;
  }
  const shared = env.OPENAI_MEANINGFULNESS_MODEL?.trim();
  if (shared) {
    return shared;
  }
  return TERRA_EVAL_MODEL_DEFAULT;
}

export function loadTerraCompareFixture(path: string): TerraCompareFixture {
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw) as TerraCompareFixture;
}

export function validateTerraCompareFixture(
  fixture: TerraCompareFixture,
): string | undefined {
  if (fixture.instruction !== TERRA_EVAL_INSTRUCTION) {
    return `terra-compare-eval: fixture instruction must be exactly ${JSON.stringify(TERRA_EVAL_INSTRUCTION)}.`;
  }
  if (fixture.sourceType !== TERRA_EVAL_SOURCE_TYPE) {
    return "terra-compare-eval: fixture sourceType must be exactly \"x\".";
  }
  if (!Array.isArray(fixture.candidates)) {
    return "terra-compare-eval: fixture candidates must be an array.";
  }
  if (fixture.candidates.length !== TERRA_EVAL_MAX_CALLS) {
    return `terra-compare-eval: fixture must pin exactly ${TERRA_EVAL_MAX_CALLS} candidates (got ${fixture.candidates.length}).`;
  }
  for (const [index, candidate] of fixture.candidates.entries()) {
    if (!candidate || typeof candidate.url !== "string" || !candidate.url) {
      return `terra-compare-eval: candidate ${index + 1} is missing url.`;
    }
    if (typeof candidate.title !== "string" || !candidate.title) {
      return `terra-compare-eval: candidate ${index + 1} is missing title.`;
    }
    if (candidate.title.includes(TITLE_ELLIPSIS)) {
      return (
        `terra-compare-eval: candidate ${index + 1} title still contains a Unicode ellipsis (${TITLE_ELLIPSIS}). ` +
        "Replace it with the exact durable watch_bot_events.title before running. Refusing to pretend replay."
      );
    }
  }
  return undefined;
}

function missingApiKeyMessage(): string {
  return [
    "terra-compare-eval: OPENAI_API_KEY is missing or empty.",
    "Refusing to run. Set OPENAI_API_KEY in the local environment.",
    "This harness never invents or fetches secrets.",
  ].join(" ");
}

function formatTable(rows: TerraCompareEvalRow[], model: string): string {
  const header = [
    "Terra compare eval — offline harness (no X, no worker, no Cards)",
    `provider=openai  model=${model}  budget=${TERRA_EVAL_MAX_CALLS}/${TERRA_EVAL_MAX_CALLS}`,
    `instruction=${TERRA_EVAL_INSTRUCTION}`,
    `sourceType=${TERRA_EVAL_SOURCE_TYPE}  candidates=${rows.length}`,
    "",
    "# | meaningful | importanceScore | classificationStatus | url",
  ];
  const lines = rows.map((row) =>
    [
      String(row.index),
      row.meaningful,
      String(row.importanceScore),
      row.classificationStatus ?? "",
      row.url,
    ].join(" | "),
  );
  const details = rows.flatMap((row) => [
    "",
    `${row.index}. title: ${row.title}`,
    `   url: ${row.url}`,
    `   meaningful: ${row.meaningful}`,
    `   importanceScore: ${row.importanceScore}`,
    `   classificationStatus: ${row.classificationStatus ?? ""}`,
    `   provider: ${row.provider}`,
    `   model: ${row.model}`,
  ]);
  return [...header, ...lines, ...details, ""].join("\n");
}

export async function runTerraCompareEval(
  options: TerraCompareEvalOptions = {},
): Promise<TerraCompareEvalResult> {
  const env = options.env ?? {};
  const chunks: string[] = [];
  const write = (text: string) => {
    chunks.push(text);
    options.write?.(text);
  };
  const fail = (message: string): TerraCompareEvalResult => {
    write(`${message}\n`);
    return {
      ok: false,
      exitCode: 1,
      output: chunks.join(""),
      rows: [],
      model: resolveTerraEvalModel(env),
      error: message,
    };
  };

  let fixture = options.fixture;
  if (!fixture) {
    const path = options.fixturePath ?? defaultTerraCompareFixturePath();
    try {
      fixture = loadTerraCompareFixture(path);
    } catch {
      return fail(`terra-compare-eval: failed to read fixture at ${path}.`);
    }
  }

  const fixtureError = validateTerraCompareFixture(fixture);
  if (fixtureError) {
    return fail(fixtureError);
  }

  const apiKey = openaiEnvApiKey(env);
  if (!apiKey) {
    return fail(missingApiKeyMessage());
  }

  const model = resolveTerraEvalModel(env);
  const budget = new ClassifierCallBudget(
    TERRA_EVAL_MAX_CALLS,
    TERRA_EVAL_MAX_CALLS,
  );
  const classifier = createOpenAIMeaningfulnessClassifier(
    {
      enabled: true,
      apiKey,
      model,
      fetchImpl: options.fetchImpl,
      budget,
    },
    env,
  );
  if (!classifier) {
    return fail(
      "terra-compare-eval: OpenAI classifier could not be constructed. Refusing to run.",
    );
  }

  classifier.startCycle();

  const rows: TerraCompareEvalRow[] = [];
  for (const [index, candidate] of fixture.candidates.entries()) {
    const input: MeaningfulnessInput = {
      title: candidate.title,
      snippet: candidate.title,
      sourceType: TERRA_EVAL_SOURCE_TYPE,
      canonicalUrl: candidate.url,
      instruction: TERRA_EVAL_INSTRUCTION,
    };
    const judgment = await classifier.classify(input);
    rows.push({
      index: index + 1,
      url: candidate.url,
      title: candidate.title,
      meaningful: judgment.meaningful ? "yes" : "no",
      importanceScore: judgment.importanceScore,
      ...(judgment.classificationStatus
        ? { classificationStatus: judgment.classificationStatus }
        : {}),
      provider: "openai",
      model,
    });
  }

  const output = formatTable(rows, model);
  write(output);
  return {
    ok: true,
    exitCode: 0,
    output,
    rows,
    model,
  };
}

export async function runTerraCompareEvalCli(
  options: TerraCompareEvalOptions = {},
): Promise<number> {
  const result = await runTerraCompareEval({
    ...options,
    env: options.env ?? process.env,
    write: options.write ?? ((text) => {
      process.stdout.write(text);
    }),
  });
  return result.exitCode;
}
