/**
 * WatchBot Intelligence v1 — Slice D xAI/Grok MeaningfulnessClassifier.
 *
 * Reuses the optional xAI/Grok Responses conventions from `grok.ts`
 * (same env key names, base URL, model). The pipeline still talks only
 * to {@link MeaningfulnessClassifier}. Domain never imports this file.
 *
 * This constructor is **xAI-only**. Worker composition uses
 * `createConfiguredMeaningfulnessClassifier`, which requires an explicit
 * `WATCHBOT_MEANINGFULNESS_PROVIDER=xai` in addition to the env gate and
 * xAI credentials. Calling this factory directly (tests / compat) still
 * constructs when the gate is on and an xAI/Grok key is present.
 *
 * Disabled unless WATCHBOT_MEANINGFULNESS_CLASSIFIER_ENABLED=true **and**
 * XAI_API_KEY / GROK_API_KEY is present. Missing gate or credentials →
 * `createModelMeaningfulnessClassifier` returns null so the worker keeps
 * passthrough. This adapter does not silently start paid calls and does
 * not fall back to OpenAI.
 *
 * Title / snippet / URL are untrusted data. The WatchBot instruction is
 * configuration context only. Protocol JSON is parsed once; source text
 * is never JSON.parsed into commands.
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
import { grokEnvApiKey } from "./grok";
import {
  CLASSIFIER_TIMEOUT_MS_DEFAULT,
  MEANINGFULNESS_CLASSIFIER_INSTRUCTIONS,
  classifierEnabled,
  classifierFetchWithTimeout,
  classifierTimeoutMs,
  formatClassifierUserPayload,
  parseMeaningfulnessJudgment,
} from "./meaningfulness-classifier-protocol";

export {
  CLASSIFIER_TIMEOUT_MS_CEILING,
  CLASSIFIER_TIMEOUT_MS_DEFAULT,
  MEANINGFULNESS_CLASSIFIER_INSTRUCTIONS,
  MEANINGFULNESS_JUDGMENT_JSON_SCHEMA,
  MEANINGFULNESS_JUDGMENT_TEXT_FORMAT,
  classifierTimeoutMs,
  formatClassifierUserPayload,
  isMeaningfulnessClassifierEnabled,
  parseMeaningfulnessJudgment,
} from "./meaningfulness-classifier-protocol";

export type { MeaningfulnessClassifierTelemetry };

export interface ModelMeaningfulnessClassifierOptions {
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

/**
 * Construct the xAI/Grok adapter, or null when the gate is off or
 * credentials are missing (worker must keep passthrough).
 *
 * Paid calls require the env gate `WATCHBOT_MEANINGFULNESS_CLASSIFIER_ENABLED=true`
 * (or `options.enabled === true` in tests) **and** an xAI/Grok API key.
 * The factory never invents credentials and never reads another vendor's key.
 */
export function createModelMeaningfulnessClassifier(
  options?: Partial<ModelMeaningfulnessClassifierOptions>,
  env: NodeJS.ProcessEnv = process.env,
): (MeaningfulnessClassifier & GrokMeaningfulnessClassifierPublic) | null {
  const enabled = options?.enabled ?? classifierEnabled(env);
  if (!enabled) {
    return null;
  }
  const apiKey = options?.apiKey ?? grokEnvApiKey(env);
  if (!apiKey) {
    return null;
  }
  return new GrokMeaningfulnessClassifier({
    apiKey,
    baseUrl: options?.baseUrl ?? env.XAI_API_BASE_URL ?? "https://api.x.ai/v1",
    model: options?.model ?? env.XAI_MODEL ?? "grok-4-fast-non-reasoning",
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

export interface GrokMeaningfulnessClassifierPublic {
  readonly telemetry: MeaningfulnessClassifierTelemetry;
  readonly vendor: "xai-grok";
  startCycle(): void;
}

class GrokMeaningfulnessClassifier
  implements MeaningfulnessClassifier, GrokMeaningfulnessClassifierPublic
{
  readonly vendor = "xai-grok" as const;
  readonly telemetry: MeaningfulnessClassifierTelemetry;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly budget: ClassifierCallBudget;

  constructor(options: ModelMeaningfulnessClassifierOptions & { apiKey: string }) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? "https://api.x.ai/v1").replace(/\/$/, "");
    this.model = options.model ?? "grok-4-fast-non-reasoning";
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
    this.telemetry.classifierProvider = "xai";
    this.telemetry.classifierModel = this.model;
  }

  startCycle(): void {
    this.budget.startCycle();
  }

  async classify(input: MeaningfulnessInput): Promise<MeaningfulnessJudgment> {
    if (!this.budget.tryConsume()) {
      this.telemetry.classifierErrors += 1;
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
