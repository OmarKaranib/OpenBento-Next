import {
  createActionExecutor,
  InMemoryDomainStore,
  type DomainStore,
} from "@openbento/domain";
import { FakeSourceProvider } from "@openbento/watchbot";

/** In-memory fixture so the worker can run a cycle without a hosted database. */
export async function seedFixtureStore(store: DomainStore = new InMemoryDomainStore()): Promise<{
  store: DomainStore;
  ownerId: string;
  canvasId: string;
  watchBotId: string;
  provider: FakeSourceProvider;
}> {
  const ownerId = "worker-fixture";
  const executor = createActionExecutor({ store, ownerId });
  const canvas = await executor.createCanvas({ name: "Lake Ontario Watch" });
  await executor.createFrame({
    canvasId: canvas.id,
    name: "Main Story",
    bounds: { x: 0, y: 0, width: 1400, height: 900 },
  });
  const watchBot = await executor.createWatchBot({
    canvasId: canvas.id,
    instruction: "Monitor meaningful developments around renaming Lake Ontario to Lake America",
    name: "Ontario Watch",
    sourceTypes: ["web", "news"],
  });
  const provider = new FakeSourceProvider([
    {
      sourceUrl: "https://news.example.com/ontario-rename?utm_source=rss",
      title: "Officials debate renaming Lake Ontario",
      publishedAt: "2026-08-28T12:00:00.000Z",
      sourceType: "news",
      rawExcerpt: "A proposal to rename Lake Ontario prompted official statements.",
    },
    {
      sourceUrl: "https://www.example.com/lake-america-reaction",
      title: "Canadian reaction to the Lake Ontario proposal",
      publishedAt: "2026-08-28T14:00:00.000Z",
      sourceType: "web",
      rawExcerpt: "Regional coverage of the Lake America rename discussion.",
    },
    {
      sourceUrl: "https://sports.example.com/unrelated-score",
      title: "Local team wins on Saturday",
      publishedAt: "2026-08-28T16:00:00.000Z",
      sourceType: "news",
      rawExcerpt: "Final score and highlights from an unrelated game.",
    },
  ]);
  return { store, ownerId, canvasId: canvas.id, watchBotId: watchBot.id, provider };
}
