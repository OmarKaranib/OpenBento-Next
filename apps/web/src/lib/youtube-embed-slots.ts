/**
 * Cap simultaneously mounted official YouTube iframes.
 * Lazy-mount callers must acquire a slot before rendering an embed.
 */

export const MAX_LIVE_YOUTUBE_EMBEDS = 2;

type SlotListener = (mountedIds: readonly string[]) => void;

const order: string[] = [];
const listeners = new Set<SlotListener>();

function emit(): void {
  const snapshot = [...order];
  for (const listener of listeners) {
    listener(snapshot);
  }
}

export function subscribeYoutubeEmbedSlots(listener: SlotListener): () => void {
  listeners.add(listener);
  listener([...order]);
  return () => {
    listeners.delete(listener);
  };
}

export function liveYoutubeEmbedIds(): readonly string[] {
  return order;
}

/**
 * Request a live embed slot for `cardId`. Evicts the oldest slot when full.
 * Returns the ids that should currently mount an iframe.
 */
export function acquireYoutubeEmbedSlot(cardId: string): readonly string[] {
  const existing = order.indexOf(cardId);
  if (existing >= 0) {
    order.splice(existing, 1);
  }
  order.push(cardId);
  while (order.length > MAX_LIVE_YOUTUBE_EMBEDS) {
    order.shift();
  }
  emit();
  return order;
}

export function releaseYoutubeEmbedSlot(cardId: string): readonly string[] {
  const existing = order.indexOf(cardId);
  if (existing >= 0) {
    order.splice(existing, 1);
    emit();
  }
  return order;
}

export function resetYoutubeEmbedSlots(): void {
  order.splice(0, order.length);
  emit();
}
