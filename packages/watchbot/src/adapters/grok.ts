import type { DiscoveredItem, SourceProvider } from "../provider";
import {
  isBlockedWatchBotV0Url,
  isWatchBotV0SourceType,
  type WatchBotV0SourceType,
} from "../normalize";
import { sanitizeUntrustedText } from "../untrusted";

/**
 * Optional xAI / Grok adapter. Domain must never import this module.
 * Unused unless XAI_API_KEY (or GROK_API_KEY) is set at runtime.
 * First slice: web and news only. No X or YouTube discovery.
 */
export interface GrokSourceProviderOptions {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  fetchImpl?: typeof fetch;
}

export function grokEnvApiKey(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const key = env.XAI_API_KEY ?? env.GROK_API_KEY;
  return key && key.length > 0 ? key : undefined;
}

export function createGrokSourceProvider(
  options?: Partial<GrokSourceProviderOptions>,
  env: NodeJS.ProcessEnv = process.env,
): SourceProvider | null {
  const apiKey = options?.apiKey ?? grokEnvApiKey(env);
  if (!apiKey) {
    return null;
  }
  return new GrokSourceProvider({
    apiKey,
    baseUrl: options?.baseUrl ?? env.XAI_API_BASE_URL ?? "https://api.x.ai/v1",
    model: options?.model ?? env.XAI_MODEL ?? "grok-4-fast-non-reasoning",
    fetchImpl: options?.fetchImpl,
  });
}

class GrokSourceProvider implements SourceProvider {
  readonly id = "xai-grok";
  readonly vendor = "xai-grok" as const;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: GrokSourceProviderOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? "https://api.x.ai/v1").replace(/\/$/, "");
    this.model = options.model ?? "grok-4-fast-non-reasoning";
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async discover(input: {
    canvasId: string;
    watchBotId: string;
    instruction: string;
    sourceTypes: readonly string[];
  }): Promise<DiscoveredItem[]> {
    const allowed = input.sourceTypes.filter(isWatchBotV0SourceType);
    if (allowed.length === 0) {
      return [];
    }

    const response = await this.fetchImpl(`${this.baseUrl}/responses`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        tools: [{ type: "web_search" }],
        input: [
          {
            role: "user",
            content:
              "Return a JSON array of recent web and news sources about the following monitoring topic. " +
              "Each item must have sourceUrl, title, publishedAt (ISO-8601), sourceType (web|news), rawExcerpt. " +
              "Do not include social posts or videos. Topic: " +
              sanitizeUntrustedText(input.instruction, 400),
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`grok_http_${response.status}`);
    }

    const body: unknown = await response.json();
    return extractDiscoveredItems(body).filter(
      (item): item is DiscoveredItem =>
        isWatchBotV0SourceType(item.sourceType) &&
        allowed.includes(item.sourceType),
    );
  }
}

/**
 * Collect items from the already-parsed HTTP envelope, plus at most one
 * JSON.parse of each Responses `output_text` protocol field.
 * Never JSON.parse titles, snippets, HTML, or other untrusted strings.
 */
export function extractDiscoveredItems(body: unknown): DiscoveredItem[] {
  const collected: DiscoveredItem[] = [];
  const seen = new Set<string>();

  const addFrom = (value: unknown): void => {
    walkStructuredRecords(value, (record) => {
      const item = itemFromRecord(record);
      if (!item || seen.has(item.sourceUrl)) {
        return;
      }
      seen.add(item.sourceUrl);
      collected.push(item);
    });
  };

  addFrom(body);
  for (const text of collectProtocolOutputTexts(body)) {
    const parsed = parseJsonOnce(text);
    if (parsed !== undefined) {
      addFrom(parsed);
    }
  }
  return collected;
}

function walkStructuredRecords(
  value: unknown,
  onRecord: (record: Record<string, unknown>) => void,
): void {
  if (Array.isArray(value)) {
    for (const entry of value) {
      walkStructuredRecords(entry, onRecord);
    }
    return;
  }
  if (typeof value !== "object" || value === null) {
    return;
  }
  const record = value as Record<string, unknown>;
  onRecord(record);
  for (const nested of Object.values(record)) {
    if (nested && typeof nested === "object") {
      walkStructuredRecords(nested, onRecord);
    }
  }
}

/** Responses API protocol fields only. Item title/snippet `text` is not collected. */
function collectProtocolOutputTexts(value: unknown): string[] {
  const texts: string[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const entry of node) {
        walk(entry);
      }
      return;
    }
    if (typeof node !== "object" || node === null) {
      return;
    }
    const record = node as Record<string, unknown>;
    const type = record.type;
    if (
      (type === "output_text" || type === "text") &&
      typeof record.text === "string"
    ) {
      texts.push(record.text);
    }
    if (Array.isArray(record.output)) {
      walk(record.output);
    }
    if (Array.isArray(record.content)) {
      walk(record.content);
    }
    if (record.message && typeof record.message === "object") {
      walk(record.message);
    }
  };
  walk(value);
  return texts;
}

function parseJsonOnce(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function itemFromRecord(record: Record<string, unknown>): DiscoveredItem | null {
  const url =
    pickString(record, ["sourceUrl", "url", "canonicalUrl"]) ??
    pickString(record, ["uri"]);
  const title = pickString(record, ["title", "name", "headline"]);
  if (!url || !title) {
    return null;
  }
  if (isBlockedWatchBotV0Url(url)) {
    return null;
  }
  const sourceTypeRaw = pickString(record, ["sourceType", "type"]);
  const sourceType = resolveV0SourceType(sourceTypeRaw);
  if (!sourceType) {
    return null;
  }
  return {
    sourceUrl: url,
    title,
    publishedAt:
      pickString(record, ["publishedAt", "published_at", "date"]) ?? "",
    sourceType,
    rawExcerpt: pickString(record, ["rawExcerpt", "snippet", "text"]),
  };
}

/**
 * Keep web/news. Drop youtube/x and unknown types. Never coerce them to web.
 */
function resolveV0SourceType(raw: string | undefined): WatchBotV0SourceType | null {
  if (raw === undefined || raw === "") {
    return "web";
  }
  if (isWatchBotV0SourceType(raw)) {
    return raw;
  }
  if (raw === "article") {
    return "web";
  }
  return null;
}

function pickString(
  record: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return undefined;
}
