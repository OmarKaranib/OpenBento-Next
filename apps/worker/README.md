# `apps/worker`

Worker app stub. No job system in this scaffold.

WatchBot Engineer implements the first slice **here, on a branch after the scaffold PR merges**:

- web/news only
- `SourceProvider` (xAI/Grok adapter planned; not in domain)
- Pipeline: discover → normalize → dedup → novelty → relevance → provenance → Card
- Shared actions only: `createWatchBot`, `pauseWatchBot`, `createCard`, `updateCard`
- No invented schema; no merge to `main` without Bento Lead review
