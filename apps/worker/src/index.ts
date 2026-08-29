/**
 * Worker stub.
 *
 * WatchBot Engineer first slice lands here on a **branch after the scaffold
 * merges**: discover → normalize → dedup → novelty → relevance → provenance → Card.
 *
 * Do not implement a job system, provider adapter, or pipeline in this phase.
 * Do not invent schema. Use `@openbento/domain` records only.
 * No merge to main without Bento Lead review.
 */

export function workerPlaceholder(): string {
  return "OpenBento worker stub — no job system in this scaffold phase.";
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(workerPlaceholder());
}
