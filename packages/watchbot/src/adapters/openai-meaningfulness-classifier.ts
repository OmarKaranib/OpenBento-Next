/**
 * WatchBot Intelligence v1 — Slice E OpenAI MeaningfulnessClassifier.
 *
 * Implements the Slice C port with the OpenAI Responses API and strict
 * JSON-schema structured output. Domain never imports this file.
 *
 * This constructor is **OpenAI-only**. Worker composition uses
 * `createConfiguredMeaningfulnessClassifier`, which requires an explicit
 * `WATCHBOT_MEANINGFULNESS_PROVIDER=openai` in addition to the env gate
 * and `OPENAI_API_KEY`. Calling this factory directly (tests) still
 * constructs when the gate is on and an OpenAI key is present.
 *
 * Disabled unless WATCHBOT_MEANINGFULNESS_CLASSIFIER_ENABLED=true **and**
 * OPENAI_API_KEY is present. Missing gate or credentials → returns null
 * so the worker keeps passthrough. Never falls back to xAI/Grok.
 *
 * Title / snippet / URL are untrusted data. The WatchBot instruction is
 * configuration context only. Protocol JSON is parsed once; source text
 * is never JSON.parsed into commands. No tools / web-search in this call.
 */

import {
  ClassifierCallBudget,
  classifierMaxCallsPerCycle,
  classifierMaxCallsPerWorkerTick,
} from "../classifier-budget";
import {
  FAIL_CLOSED_MEANINGFULNESS_JUDGMENT,
  type MeaningfulnessClassifier,
  type MeaningfulnessInput,
  type MeaningfulnessJudgment,
} from "../meaningfulness";
import {
  emptyMeaningfulnessClassifierTelemetry,
  type MeaningfulnessClassifierTelemetry,
} from "../telemetry";
import {
  CLASSIFIER_TIMEOUT_MS_DEFAULT,
  MEANINGFULNESS_CLASSIFIER_INSTRUCTIONS,
  MEANINGFULNESS_JUDGMENT_TEXT_FORMAT,
  classifierEnabled,
  classifierFetchWithTimeout,
  classifierTimeoutMs,
  formatClassifierUserPayload,
  parseMeaningfulnessJudgment,
} from "./meaningfulness-classifier-protocol";

export const OPENAI_MEANINGFULNESS_MODEL_DEFAULT = "gpt-5.6-luna";
export const OPENAI_API_BASE_URL_DEFAULT = "https://api.openai.com/v1";

export type { MeaningfulnessClassifierTelemetry };

export interface OpenAIMeaningfulnessClassifierOptions {
  /** Explicit construction (tests). Production uses the env gate. */
  enabled?: boolean;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  budget?: ClassifierCallBudget;
  telemetry?: MeaningfulnessClassifierTelemetry;
}

export function openaiEnvApiKey(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const key = env.OPENAI_API_KEY;
  return key && key.length > 0 ? key : undefined;
}

export function openaiMeaningfulnessModel(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const model = env.OPENAI_MEANINGFULNESS_MODEL?.trim();
  return model && model.length > 0
    ? model
    : OPENAI_MEANINGFULNESS_MODEL_DEFAULT;
}

/**
 * Construct the OpenAI adapter, or null when the gate is off or
 * credentials are missing (worker must keep passthrough).
 *
 * Paid calls require `WATCHBOT_MEANINGFULNESS_CLASSIFIER_ENABLED=true`
 * (or `options.enabled === true` in tests) **and** OPENAI_API_KEY.
 * The factory never invents credentials and never reads another vendor's key.
 */
export function createOpenAIMeaningfulnessClassifier(
  options?: Partial<OpenAIMeaningfulnessClassifierOptions>,
  env: NodeJS.ProcessEnv = process.env,
): (MeaningfulnessClassifier & OpenAIMeaningfulnessClassifierPublic) | null {
  const enabled = options?.enabled ?? classifierEnabled(env);
  if (!enabled) {
    return null;
  }
  const apiKey = options?.apiKey ?? openaiEnvApiKey(env);
  if (!apiKey) {
    return null;
  }
  return new OpenAIMeaningfulnessClassifier({
    apiKey,
    baseUrl:
      options?.baseUrl ?? env.OPENAI_API_BASE_URL ?? OPENAI_API_BASE_URL_DEFAULT,
    model: options?.model ?? openaiMeaningfulnessModel(env),
    fetchImpl: options?.fetchImpl,
    timeoutMs: options?.timeoutMs ?? classifierTimeoutMs(env),
    budget:
      options?.budget ??
      new ClassifierCallBudget(
        classifierMaxCallsPerWorkerTick(env),
        classifierMaxCallsPerCycle(env),
      ),
    telemetry: options?.telemetry,
  });
}

export interface OpenAIMeaningfulnessClassifierPublic {
  readonly telemetry: MeaningfulnessClassifierTelemetry;
  readonly vendor: "openai";
  startCycle(): void;
}

class OpenAIMeaningfulnessClassifier
  implements MeaningfulnessClassifier, OpenAIMeaningfulnessClassifierPublic
{
  readonly vendor = "openai" as const;
  readonly telemetry: MeaningfulnessClassifierTelemetry;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly budget: ClassifierCallBudget;

  constructor(
    options: OpenAIMeaningfulnessClassifierOptions & { apiKey: string },
  ) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? OPENAI_API_BASE_URL_DEFAULT).replace(
      /\/$/,
      "",
    );
    this.model = options.model ?? OPENAI_MEANINGFULNESS_MODEL_DEFAULT;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? CLASSIFIER_TIMEOUT_MS_DEFAULT;
    this.budget =
      options.budget ??
      new ClassifierCallBudget(
        CLASSIFIER_MAX_CALLS_FALLBACK_TICK,
        CLASSIFIER_MAX_CALLS_FALLBACK_CYCLE,
      );
    this.telemetry =
      options.telemetry ?? emptyMeaningfulnessClassifierTelemetry();
    this.telemetry.classifierProvider = "openai";
    this.telemetry.classifierModel = this.model;
  }

  startCycle(): void {
    this.budget.startCycle();
  }

  async classify(input: MeaningfulnessInput): Promise<MeaningfulnessJudgment> {
    if (!this.budget.tryConsume()) {
      this.telemetry.classifierBudgetExhausted += 1;
      return FAIL_CLOSED_MEANINGFULNESS_JUDGMENT;
    }
    try {
      const judgment = await this.invokeModel(input);
      this.telemetry.classifierCalls += 1;
      if (judgment.meaningful) {
        this.telemetry.classifierMeaningful += 1;
      } else {
        this.telemetry.classifierNotMeaningful += 1;
      }
      return judgment;
    } catch {
      this.telemetry.classifierCalls += 1;
      this.telemetry.classifierErrors += 1;
      return FAIL_CLOSED_MEANINGFULNESS_JUDGMENT;
    }
  }

  private async invokeModel(
    input: MeaningfulnessInput,
  ): Promise<MeaningfulnessJudgment> {
    const response = await classifierFetchWithTimeout(
      this.fetchImpl,
      `${this.baseUrl}/responses`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          instructions: MEANINGFULNESS_CLASSIFIER_INSTRUCTIONS,
          input: [
            {
              role: "user",
              content: formatClassifierUserPayload(input),
            },
          ],
          text: MEANINGFULNESS_JUDGMENT_TEXT_FORMAT,
        }),
      },
      this.timeoutMs,
    );

    if (!response.ok) {
      throw new Error(`classifier_http_${response.status}`);
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new Error("classifier_malformed");
    }

    const parsed = parseMeaningfulnessJudgment(body);
    if (!parsed) {
      throw new Error("classifier_malformed");
    }
    return parsed;
  }
}

const CLASSIFIER_MAX_CALLS_FALLBACK_TICK = 5;
const CLASSIFIER_MAX_CALLS_FALLBACK_CYCLE = 5;
