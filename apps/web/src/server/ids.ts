import type { OwnerId } from "@openbento/domain";

/**
 * Stable local/dev ids so undo replay through the server executor keeps
 * the same Card/Frame/Canvas identities. Per-owner, not a process-wide owner.
 */
export class IdSequence {
  private values: string[] = [];
  private index = 0;

  next = (): string => {
    const existing = this.values[this.index];
    if (existing !== undefined) {
      this.index += 1;
      return existing;
    }
    const id = crypto.randomUUID();
    this.values.push(id);
    this.index += 1;
    return id;
  };

  rewind(): void {
    this.index = 0;
  }
}

const sequences = new Map<OwnerId, IdSequence>();

export function idFactoryForOwner(ownerId: OwnerId): () => string {
  let sequence = sequences.get(ownerId);
  if (!sequence) {
    sequence = new IdSequence();
    sequences.set(ownerId, sequence);
  }
  return sequence.next;
}

export function rewindIdsForOwner(ownerId: OwnerId): void {
  sequences.get(ownerId)?.rewind();
}

export function resetIdSequences(): void {
  sequences.clear();
}
