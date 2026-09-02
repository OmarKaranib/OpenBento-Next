/**
 * WatchBot Intelligence v1 — Slice E classifier composition.
 *
 * Selects OpenAI vs xAI **only** from an explicit provider env.
 * Credentials never decide the vendor. Missing / empty / unknown
 * `WATCHBOT_MEANINGFULNESS_PROVIDER` is treated as `none` (passthrough).
 *
 * Rules:
 * - gate off → null (passthrough; zero paid calls)
 * - enabled + provider=openai + OPENAI_API_KEY → OpenAI adapter
 * - enabled + provider=xai + XAI_API_KEY/GROK_API_KEY → xAI adapter
 * - enabled + missing key for the selected provider → null
 *   (never silent fallback to the other vendor)
 * - enabled + provider=none / unset / invalid → null
 */

import type { ClassifierCallBudget } from "../classifier-budget";
import type { MeaningfulnessClassifier } from "../meaningfulness";
import type { MeaningfulnessClassifierTelemetry } from "../telemetry";
import { createModelMeaningfulnessClassifier } from "./meaningfulness-classifier";
import { classifierEnabled } from "./meaningfulness-classifier-protocol";
import { createOpenAIMeaningfulnessClassifier } from "./openai-meaningfulness-classifier";

export type MeaningfulnessProviderId = "openai" | "xai" | "none";

export interface ConfiguredMeaningfulnessClassifierOptions {
  enabled?: boolean;
  provider?: MeaningfulnessProviderId;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  budget?: ClassifierCallBudget;
  telemetry?: MeaningfulnessClassifierTelemetry;
}

/**
 * Missing, empty, and any value other than `openai` | `xai` | `none`
 * resolve to `none`. Never infers a vendor from which API key is set.
 */
export function resolveMeaningfulnessProvider(
  env: NodeJS.ProcessEnv = process.env,
): MeaningfulnessProviderId {
  const raw = (env.WATCHBOT_MEANINGFULNESS_PROVIDER ?? "").trim().toLowerCase();
  if (raw === "openai" || raw === "xai" || raw === "none") {
    return raw;
  }
  return "none";
}

/**
 * Worker/watchbot composition entry. Returns null for passthrough.
 *
 * Does not auto-pick OpenAI vs xAI when both keys exist. The provider
 * must be set explicitly via `WATCHBOT_MEANINGFULNESS_PROVIDER` (or
 * `options.provider` in tests).
 */
export function createConfiguredMeaningfulnessClassifier(
  options?: Partial<ConfiguredMeaningfulnessClassifierOptions>,
  env: NodeJS.ProcessEnv = process.env,
): MeaningfulnessClassifier | null {
  const enabled = options?.enabled ?? classifierEnabled(env);
  if (!enabled) {
    return null;
  }
  const provider = options?.provider ?? resolveMeaningfulnessProvider(env);
  if (provider === "none") {
    return null;
  }
  const adapterOptions = {
    enabled: true,
    fetchImpl: options?.fetchImpl,
    timeoutMs: options?.timeoutMs,
    budget: options?.budget,
    telemetry: options?.telemetry,
    baseUrl: options?.baseUrl,
    model: options?.model,
    ...(options?.apiKey ? { apiKey: options.apiKey } : {}),
  };
  if (provider === "openai") {
    return createOpenAIMeaningfulnessClassifier(adapterOptions, env);
  }
  if (provider === "xai") {
    return createModelMeaningfulnessClassifier(adapterOptions, env);
  }
  return null;
}
