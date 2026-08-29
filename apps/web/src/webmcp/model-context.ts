/**
 * Minimal WebMCP `document.modelContext` types.
 * Feature-detect at runtime. Do not assume the API is present.
 */
export type WebMcpRegisterTool = {
  name: string;
  description: string;
  inputSchema: object;
  annotations?: { readOnlyHint: boolean };
  execute: (args: Record<string, unknown>) => Promise<unknown> | unknown;
};

export type ModelContext = {
  registerTool: (
    tool: WebMcpRegisterTool,
    options?: { signal?: AbortSignal },
  ) => Promise<void> | void;
};

type ModelContextHost = {
  modelContext?: ModelContext;
};

export function getModelContext(source?: ModelContextHost): ModelContext | null {
  const documentRef: ModelContextHost | undefined =
    source ??
    (typeof document === "undefined"
      ? undefined
      : (document as unknown as ModelContextHost));
  const fromDocument = documentRef?.modelContext;
  const fromNavigator =
    typeof navigator === "undefined"
      ? undefined
      : (navigator as unknown as ModelContextHost).modelContext;
  const ctx = fromDocument ?? fromNavigator;
  if (!ctx || typeof ctx.registerTool !== "function") {
    return null;
  }
  return ctx;
}
