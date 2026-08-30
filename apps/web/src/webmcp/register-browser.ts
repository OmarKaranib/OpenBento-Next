import {
  listWebMcpTools,
  type WebMcpRuntime,
  type WebMcpToolName,
} from "@openbento/domain";
import { getModelContext, type ModelContext } from "./model-context";

type RegistrationState = {
  registered: Set<WebMcpToolName>;
  inFlight?: Promise<WebMcpToolName[]>;
};

/** One registration set per browser-provided model context. */
const registrationStates = new WeakMap<ModelContext, RegistrationState>();

function registrationStateFor(ctx: ModelContext): RegistrationState {
  const current = registrationStates.get(ctx);
  if (current) {
    return current;
  }
  const next: RegistrationState = { registered: new Set<WebMcpToolName>() };
  registrationStates.set(ctx, next);
  return next;
}

/**
 * 1:1 snake_case `registerTool` wrappers. execute must already be bound to
 * `runBoundAction` + `requireOwnerIdFromRequest` (see `runWebMcpTool`).
 */
export async function registerOpenBentoWebMcpTools(
  runtime: Pick<WebMcpRuntime, "tools" | "invoke">,
  options?: { signal?: AbortSignal; modelContext?: ModelContext | null },
): Promise<WebMcpToolName[]> {
  const ctx =
    options && "modelContext" in options
      ? (options.modelContext ?? null)
      : getModelContext();
  if (!ctx) {
    return [];
  }
  const state = registrationStateFor(ctx);
  if (state.inFlight) {
    return state.inFlight;
  }

  const registration = (async () => {
    const registered: WebMcpToolName[] = [];
    for (const tool of runtime.tools) {
      if (state.registered.has(tool.name)) {
        continue;
      }
      await ctx.registerTool(
        {
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          annotations: tool.annotations,
          execute: (args) => runtime.invoke(tool.name, args ?? {}),
        },
        { signal: options?.signal },
      );
      state.registered.add(tool.name);
      registered.push(tool.name);
    }
    return registered;
  })();
  state.inFlight = registration;
  try {
    return await registration;
  } finally {
    if (state.inFlight === registration) {
      state.inFlight = undefined;
    }
  }
}

export function webMcpToolNamesForHost(): WebMcpToolName[] {
  return listWebMcpTools().map((tool) => tool.name);
}
