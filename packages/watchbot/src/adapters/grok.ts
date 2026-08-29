import type { DiscoveredItem, SourceProvider } from "../provider";
import { isWatchBotV0SourceType } from "../normalize";
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
    return extractDiscoveredItems(body).filter((item) =>
      allowed.includes(item.sourceType as (typeof allowed)[number]),
    );
  }
}

function extractDiscoveredItems(body: unknown): DiscoveredItem[] {
  const collected: DiscoveredItem[] = [];
  const seen = new Set<string>();

  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const entry of value) {
        visit(entry);
      }
      return;
    }
    if (typeof value !== "object" || value === null) {
      if (typeof value === "string") {
        try {
          visit(JSON.parse(value));
        } catch {
          /* untrusted model text is data, never eval */
        }
      }
      return;
    }
    const record = value as Record<string, unknown>;
    const url =
      pickString(record, ["sourceUrl", "url", "canonicalUrl"]) ??
      pickString(record, ["uri"]);
    const title = pickString(record, ["title", "name", "headline"]);
    if (url && title) {
      const sourceTypeRaw = pickString(record, ["sourceType", "type"]) ?? "web";
      const sourceType = sourceTypeRaw === "news" ? "news" : "web";
      if (!seen.has(url)) {
        seen.add(url);
        collected.push({
          sourceUrl: url,
          title,
          publishedAt:
            pickString(record, ["publishedAt", "published_at", "date"]) ?? "",
          sourceType,
          rawExcerpt: pickString(record, ["rawExcerpt", "snippet", "text"]),
        });
      }
    }
    for (const nested of Object.values(record)) {
      visit(nested);
    }
  };

  visit(body);
  return collected;
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
