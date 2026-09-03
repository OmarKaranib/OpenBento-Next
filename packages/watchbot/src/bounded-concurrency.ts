/**
 * Generic bounded-concurrency mapper. Preserves input order regardless of
 * completion order. Never fans out unbounded — at most `concurrency`
 * promises are in-flight at any time.
 */
export async function mapBounded<T, U>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<U>,
): Promise<U[]> {
  const limit = Math.max(1, Math.min(concurrency, items.length));
  const results = new Array<U>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      results[i] = await fn(items[i]!, i);
    }
  }

  const workers: Promise<void>[] = [];
  for (let w = 0; w < limit; w++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}
