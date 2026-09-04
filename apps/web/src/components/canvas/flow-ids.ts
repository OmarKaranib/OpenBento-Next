export function cardNodeId(cardId: string): string {
  return `card:${cardId}`;
}

export function frameNodeId(frameId: string): string {
  return `frame:${frameId}`;
}

export function columnNodeId(columnId: string): string {
  return `column:${columnId}`;
}

export function parseFlowNodeId(
  id: string,
): { kind: "card" | "frame" | "column"; entityId: string } | null {
  if (id.startsWith("card:")) {
    return { kind: "card", entityId: id.slice(5) };
  }
  if (id.startsWith("frame:")) {
    return { kind: "frame", entityId: id.slice(6) };
  }
  if (id.startsWith("column:")) {
    return { kind: "column", entityId: id.slice(7) };
  }
  return null;
}
