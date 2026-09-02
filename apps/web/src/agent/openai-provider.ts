import type {
  AgentProvider,
  AgentProviderMessage,
  AgentProviderResponse,
  AgentToolDefinition,
} from "./types";

export const OPENAI_AGENT_MODEL_DEFAULT = "gpt-5.6-terra";
export const OPENAI_API_BASE_URL_DEFAULT = "https://api.openai.com/v1";
export const AGENT_PROVIDER_TIMEOUT_MS_DEFAULT = 45_000;

export function openaiAgentApiKey(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  // Dedicated web server-only key. Never fall back to worker OPENAI_API_KEY.
  const key = env.OPENAI_AGENT_API_KEY?.trim();
  return key ? key : undefined;
}

export function openaiAgentModel(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const model = env.OPENAI_AGENT_MODEL?.trim();
  return model && model.length > 0 ? model : OPENAI_AGENT_MODEL_DEFAULT;
}

export function openaiAgentBaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return (env.OPENAI_API_BASE_URL ?? OPENAI_API_BASE_URL_DEFAULT).replace(
    /\/$/,
    "",
  );
}

export type OpenAIAgentProviderOptions = {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractAssistantText(output: unknown[]): string {
  const parts: string[] = [];
  for (const item of output) {
    if (!isRecord(item) || item.type !== "message") {
      continue;
    }
    const content = item.content;
    if (!Array.isArray(content)) {
      continue;
    }
    for (const block of content) {
      if (!isRecord(block)) {
        continue;
      }
      if (
        (block.type === "output_text" || block.type === "text") &&
        typeof block.text === "string"
      ) {
        parts.push(block.text);
      }
    }
  }
  return parts.join("\n").trim();
}

function extractFunctionCalls(
  output: unknown[],
): AgentProviderResponse["functionCalls"] {
  const calls: AgentProviderResponse["functionCalls"] = [];
  for (const item of output) {
    if (!isRecord(item) || item.type !== "function_call") {
      continue;
    }
    const callId =
      typeof item.call_id === "string"
        ? item.call_id
        : typeof item.id === "string"
          ? item.id
          : "";
    const name = typeof item.name === "string" ? item.name : "";
    const args =
      typeof item.arguments === "string"
        ? item.arguments
        : JSON.stringify(item.arguments ?? {});
    if (!callId || !name) {
      continue;
    }
    calls.push({ call_id: callId, name, arguments: args });
  }
  return calls;
}

function continuationItemsFromOutput(
  output: unknown[],
): AgentProviderMessage[] {
  const items: AgentProviderMessage[] = [];
  for (const item of output) {
    if (!isRecord(item)) {
      continue;
    }
    if (item.type === "function_call") {
      const callId =
        typeof item.call_id === "string"
          ? item.call_id
          : typeof item.id === "string"
            ? item.id
            : "";
      const name = typeof item.name === "string" ? item.name : "";
      const args =
        typeof item.arguments === "string"
          ? item.arguments
          : JSON.stringify(item.arguments ?? {});
      if (callId && name) {
        items.push({
          type: "function_call",
          call_id: callId,
          name,
          arguments: args,
        });
      }
    }
  }
  return items;
}

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Server-only OpenAI Responses API provider for the Interactive Agent.
 * Never import from client components.
 */
export function createOpenAIAgentProvider(
  options: OpenAIAgentProviderOptions,
): AgentProvider {
  const baseUrl = (options.baseUrl ?? OPENAI_API_BASE_URL_DEFAULT).replace(
    /\/$/,
    "",
  );
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? AGENT_PROVIDER_TIMEOUT_MS_DEFAULT;
  const apiKey = options.apiKey;

  return {
    async createResponse(input): Promise<AgentProviderResponse> {
      const response = await fetchWithTimeout(
        fetchImpl,
        `${baseUrl}/responses`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: input.model,
            instructions: input.instructions,
            input: input.input,
            tools: input.tools.map((tool: AgentToolDefinition) => ({
              type: "function",
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters,
            })),
          }),
        },
        timeoutMs,
      );

      if (!response.ok) {
        throw new Error(`openai_agent_http_${response.status}`);
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new Error("openai_agent_malformed");
      }

      const record = isRecord(body) ? body : null;
      const output = Array.isArray(record?.output) ? record.output : [];
      return {
        assistantText: extractAssistantText(output),
        functionCalls: extractFunctionCalls(output),
        continuationItems: continuationItemsFromOutput(output),
      };
    },
  };
}

export function createConfiguredOpenAIAgentProvider(
  env: NodeJS.ProcessEnv = process.env,
  options?: Partial<OpenAIAgentProviderOptions>,
): AgentProvider | null {
  const apiKey = options?.apiKey ?? openaiAgentApiKey(env);
  if (!apiKey) {
    return null;
  }
  return createOpenAIAgentProvider({
    apiKey,
    baseUrl: options?.baseUrl ?? openaiAgentBaseUrl(env),
    fetchImpl: options?.fetchImpl,
    timeoutMs: options?.timeoutMs,
  });
}
