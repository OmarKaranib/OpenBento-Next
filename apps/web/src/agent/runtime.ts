import {
  DomainError,
  followUpCardFrameFromGeometry,
  type ActionInputMap,
  type ActionName,
  type ActionResultMap,
  type Card,
  type DomainStore,
} from "@openbento/domain";
import {
  AGENT_SYSTEM_INSTRUCTIONS,
  agentRequiresFrameFollowUp,
  buildAgentCanvasContext,
  buildAgentToolDefinitions,
  isAgentActionName,
} from "./tools";
import {
  openaiAgentModel,
  createConfiguredOpenAIAgentProvider,
} from "./openai-provider";
import {
  AGENT_MAX_TOOL_CALLS_PER_TURN,
  type AgentProvider,
  type AgentProviderMessage,
  type AgentToolActivity,
  type AgentTurnResult,
} from "./types";

export type AgentExecute = <K extends ActionName>(
  name: K,
  input: ActionInputMap[K],
) => Promise<ActionResultMap[K]>;

export type RunInteractiveAgentTurnInput = {
  canvasId: string;
  message: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  execute: AgentExecute;
  store?: DomainStore;
  provider?: AgentProvider | null;
  env?: NodeJS.ProcessEnv;
  maxToolCalls?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stripOwnerId(input: unknown): unknown {
  if (!isRecord(input)) {
    return input;
  }
  if (!Object.prototype.hasOwnProperty.call(input, "ownerId")) {
    return input;
  }
  const { ownerId: _ignored, ...rest } = input;
  void _ignored;
  return rest;
}

function assertNoOwnerId(input: unknown): void {
  if (isRecord(input) && Object.prototype.hasOwnProperty.call(input, "ownerId")) {
    throw new DomainError(
      "invalid_input",
      "ownerId must not be supplied on tool arguments; it is session-derived",
    );
  }
}

function summarizeToolResult(name: string, result: unknown): string {
  if (!isRecord(result)) {
    return `${name} completed`;
  }
  if (typeof result.id === "string") {
    return `${name} → ${result.id}`;
  }
  if (typeof result.canvasId === "string" && Array.isArray(result.cards)) {
    return `${name} → ${result.cards.length} cards`;
  }
  if (typeof result.status === "string") {
    return `${name} → ${result.status}`;
  }
  return `${name} completed`;
}

function parseToolArguments(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new DomainError("invalid_input", "Malformed tool call arguments");
  }
}

/**
 * Interactive Agent turn: Responses API → ACTION_CATALOG via bound execute.
 * ownerId never comes from model/user tool arguments.
 */
export async function runInteractiveAgentTurn(
  input: RunInteractiveAgentTurnInput,
): Promise<AgentTurnResult> {
  const env = input.env ?? process.env;
  const model = openaiAgentModel(env);
  const maxToolCalls = input.maxToolCalls ?? AGENT_MAX_TOOL_CALLS_PER_TURN;
  const provider =
    input.provider === undefined
      ? createConfiguredOpenAIAgentProvider(env)
      : input.provider;

  if (!provider) {
    return {
      assistantText: "",
      toolActivity: [],
      toolCallCount: 0,
      model,
      error:
        "Interactive Agent is not configured. Set server-only OPENAI_AGENT_API_KEY on the web service (never NEXT_PUBLIC_; never reuse worker OPENAI_API_KEY).",
    };
  }

  const message = input.message.trim();
  if (!message) {
    return {
      assistantText: "",
      toolActivity: [],
      toolCallCount: 0,
      model,
      error: "Message is required.",
    };
  }

  let canvasState;
  try {
    canvasState = await input.execute("getCanvasState", {
      canvasId: input.canvasId,
    });
  } catch (error) {
    const text =
      error instanceof DomainError
        ? error.message
        : "Could not load the current Canvas.";
    return {
      assistantText: "",
      toolActivity: [],
      toolCallCount: 0,
      model,
      error: text,
    };
  }

  const contextBlock = buildAgentCanvasContext(canvasState);
  const tools = buildAgentToolDefinitions();
  const providerInput: AgentProviderMessage[] = [];

  for (const prior of input.history ?? []) {
    const content = prior.content.trim();
    if (!content) {
      continue;
    }
    providerInput.push({ role: prior.role, content: content.slice(0, 4000) });
  }

  providerInput.push({
    role: "user",
    content: `${message}\n\n${contextBlock}`,
  });

  const toolActivity: AgentToolActivity[] = [];
  let toolCallCount = 0;
  let assistantText = "";

  try {
    while (true) {
      const response = await provider.createResponse({
        model,
        instructions: AGENT_SYSTEM_INSTRUCTIONS,
        input: providerInput,
        tools,
      });

      if (response.assistantText) {
        assistantText = response.assistantText;
      }

      for (const item of response.continuationItems) {
        providerInput.push(item);
      }

      if (response.functionCalls.length === 0) {
        break;
      }

      for (const call of response.functionCalls) {
        if (toolCallCount >= maxToolCalls) {
          toolActivity.push({
            name: call.name,
            success: false,
            summary: `tool loop bound (${maxToolCalls}) reached`,
          });
          providerInput.push({
            type: "function_call_output",
            call_id: call.call_id,
            output: JSON.stringify({
              error: "tool_loop_bound_reached",
            }),
          });
          continue;
        }

        toolCallCount += 1;

        if (!isAgentActionName(call.name)) {
          toolActivity.push({
            name: call.name,
            success: false,
            summary: "rejected: action not in Agent catalog",
          });
          providerInput.push({
            type: "function_call_output",
            call_id: call.call_id,
            output: JSON.stringify({
              error: "action_not_allowed",
            }),
          });
          continue;
        }

        try {
          const parsed = parseToolArguments(call.arguments);
          assertNoOwnerId(parsed);
          const safeInput = stripOwnerId(parsed);
          let result: unknown = await input.execute(
            call.name,
            safeInput as ActionInputMap[typeof call.name],
          );
          if (
            agentRequiresFrameFollowUp(call.name) &&
            isRecord(result) &&
            typeof result.id === "string"
          ) {
            result = await followUpCardFrameFromGeometry(
              input.execute,
              result as Card,
            );
          }
          toolActivity.push({
            name: call.name,
            success: true,
            summary: summarizeToolResult(call.name, result),
          });
          providerInput.push({
            type: "function_call_output",
            call_id: call.call_id,
            output: JSON.stringify({
              ok: true,
              summary: summarizeToolResult(call.name, result),
              result: sanitizeResultForModel(result),
            }),
          });
        } catch (error) {
          const detail =
            error instanceof DomainError
              ? error.message
              : "tool_execution_failed";
          toolActivity.push({
            name: call.name,
            success: false,
            summary: detail.slice(0, 160),
          });
          providerInput.push({
            type: "function_call_output",
            call_id: call.call_id,
            output: JSON.stringify({ error: detail.slice(0, 300) }),
          });
        }
      }

      if (toolCallCount >= maxToolCalls) {
        if (!assistantText) {
          assistantText =
            "I reached the per-turn tool limit. Tell me what to do next.";
        }
        break;
      }
    }
  } catch (error) {
    return {
      assistantText: "",
      toolActivity,
      toolCallCount,
      model,
      error:
        error instanceof Error
          ? "The Agent provider failed. Try again shortly."
          : "The Agent provider failed.",
    };
  }

  return {
    assistantText:
      assistantText ||
      (toolActivity.length > 0
        ? "Done. I updated the Canvas with the requested actions."
        : "I could not produce a response."),
    toolActivity,
    toolCallCount,
    model,
  };
}

/** Keep model-visible results small and free of secrets. */
function sanitizeResultForModel(result: unknown): unknown {
  if (!isRecord(result)) {
    return result;
  }
  const safe: Record<string, unknown> = {};
  for (const key of [
    "id",
    "canvasId",
    "name",
    "type",
    "status",
    "frameId",
    "position",
    "size",
    "bounds",
    "active",
    "sourceTypes",
  ]) {
    if (key in result) {
      safe[key] = result[key];
    }
  }
  return safe;
}
