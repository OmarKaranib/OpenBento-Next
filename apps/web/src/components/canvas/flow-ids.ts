export function cardNodeId(cardId: string): string {
  return `card:${cardId}`;
}

export function frameNodeId(frameId: string): string {
  return `frame:${frameId}`;
}

export function parseFlowNodeId(
  id: string,
): { kind: "card" | "frame"; entityId: string } | null {
  if (id.startsWith("card:")) {
    return { kind: "card", entityId: id.slice(5) };
  }
  if (id.startsWith("frame:")) {
    return { kind: "frame", entityId: id.slice(6) };
  }
  return null;
}
