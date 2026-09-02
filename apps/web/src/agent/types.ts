import type { ActionName } from "@openbento/domain";

/** Catalog actions the Interactive Agent may invoke. setCardFrame is follow-up only. */
export const AGENT_ACTION_NAMES = [
  "getCanvasState",
  "renameCanvas",
  "createCard",
  "updateCard",
  "moveCard",
  "resizeCard",
  "createFrame",
  "updateFrame",
  "moveFrame",
  "resizeFrame",
  "fullscreenFrame",
  "createWatchBot",
  "updateWatchBot",
  "pauseWatchBot",
  "resumeWatchBot",
  "getWatchBotStatus",
] as const satisfies readonly ActionName[];

export type AgentActionName = (typeof AGENT_ACTION_NAMES)[number];

export const AGENT_MAX_TOOL_CALLS_PER_TURN = 8;

export type AgentChatRole = "user" | "assistant";

export type AgentChatMessage = {
  id: string;
  role: AgentChatRole;
  content: string;
  toolActivity?: AgentToolActivity[];
  error?: string;
};

export type AgentToolActivity = {
  name: string;
  success: boolean;
  summary: string;
};

export type AgentTurnRequest = {
  canvasId: string;
  message: string;
  history?: Array<{ role: AgentChatRole; content: string }>;
};

export type AgentTurnResult = {
  assistantText: string;
  toolActivity: AgentToolActivity[];
  toolCallCount: number;
  model: string;
  error?: string;
};

export type AgentProviderMessage =
  | { role: "user" | "assistant"; content: string }
  | {
      type: "function_call";
      call_id: string;
      name: string;
      arguments: string;
    }
  | {
      type: "function_call_output";
      call_id: string;
      output: string;
    };

export type AgentToolDefinition = {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type AgentProviderFunctionCall = {
  call_id: string;
  name: string;
  arguments: string;
};

export type AgentProviderResponse = {
  assistantText: string;
  functionCalls: AgentProviderFunctionCall[];
  /** Raw output items that must be echoed back for the next Responses turn. */
  continuationItems: AgentProviderMessage[];
};

export type AgentProvider = {
  createResponse(input: {
    model: string;
    instructions: string;
    input: AgentProviderMessage[];
    tools: AgentToolDefinition[];
  }): Promise<AgentProviderResponse>;
};
