import type { LucideIcon } from "lucide-react";
import { Bot, ChartNoAxesCombined, FileText, Globe, LayoutPanelLeft, StickyNote, Youtube } from "lucide-react";

export type AddCatalogMode = "note" | "column" | "watchbot" | "source" | "stock";
export type AddCatalogId = "column" | "watchbot" | "note" | "youtube" | "web" | "article" | "stock";

export type AddCatalogEntry = {
  id: AddCatalogId;
  label: string;
  icon: LucideIcon;
  category: "Structure" | "Cards";
  description: string;
  creationMode: AddCatalogMode;
  slashCommand: string;
};

/** UI discovery only. Domain writes still use ACTION_CATALOG/createActionExecutor. */
export const ADD_CATALOG: readonly AddCatalogEntry[] = [
  { id: "column", label: "Column", icon: LayoutPanelLeft, category: "Structure", description: "A vertical live Card stream", creationMode: "column", slashCommand: "/column" },
  { id: "watchbot", label: "WatchBot", icon: Bot, category: "Structure", description: "Monitor sources into a Column", creationMode: "watchbot", slashCommand: "/watch" },
  { id: "note", label: "Note", icon: StickyNote, category: "Cards", description: "A quick canvas note", creationMode: "note", slashCommand: "/note" },
  { id: "youtube", label: "YouTube", icon: Youtube, category: "Cards", description: "An official YouTube source", creationMode: "source", slashCommand: "/youtube" },
  { id: "web", label: "Web", icon: Globe, category: "Cards", description: "A web source link", creationMode: "source", slashCommand: "/web" },
  { id: "article", label: "Article", icon: FileText, category: "Cards", description: "An article source link", creationMode: "source", slashCommand: "/web" },
  { id: "stock", label: "Stock", icon: ChartNoAxesCombined, category: "Cards", description: "A server-resolved market snapshot", creationMode: "stock", slashCommand: "/stock" },
];

export function addCatalogEntry(id: AddCatalogId): AddCatalogEntry {
  const entry = ADD_CATALOG.find((candidate) => candidate.id === id);
  if (!entry) throw new Error(`Unknown Add catalog entry: ${id}`);
  return entry;
}
