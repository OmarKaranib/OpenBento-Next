import type { AddCatalogId } from "@/lib/add-catalog";

export type AddCommand =
  | { kind: "select"; id: AddCatalogId }
  | { kind: "source"; id: "youtube" | "web"; url: string }
  | { kind: "stock"; symbol: string }
  | { kind: "column"; name?: string }
  | { kind: "watchbot"; instruction: string }
  | { kind: "error"; message: string };

export function parseAddCommand(value: string): AddCommand | null {
  if (!value.startsWith("/")) return null;
  const [command, ...parts] = value.trim().split(/\s+/);
  const arg = parts.join(" ").trim();
  switch (command.toLowerCase()) {
    case "/note": return arg ? { kind: "error", message: "/note does not take an argument." } : { kind: "select", id: "note" };
    case "/column": return { kind: "column", ...(arg ? { name: arg } : {}) };
    case "/watch": return arg ? { kind: "watchbot", instruction: arg } : { kind: "error", message: "Add an instruction after /watch." };
    case "/youtube": return arg ? { kind: "source", id: "youtube", url: arg } : { kind: "error", message: "Add a YouTube URL after /youtube." };
    case "/web": return arg ? { kind: "source", id: "web", url: arg } : { kind: "error", message: "Add a URL after /web." };
    case "/stock": return arg ? { kind: "stock", symbol: arg } : { kind: "error", message: "Add a symbol after /stock." };
    default: return { kind: "error", message: `Unknown command: ${command}` };
  }
}
