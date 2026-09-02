import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  createActionExecutor,
  InMemoryDomainStore,
  isValidCardPayload,
} from "@openbento/domain";
import { persistCreatedCard } from "./persist-created-card";
import { planCardGeometry } from "./membership";
import type { CatalogCall } from "./inputs";
import {
  buildCreateArticleCardInput,
  buildCreateWebCardInput,
  buildCreateYoutubeCardInput,
  knownPublishedAtLabel,
  publishedAtForCreate,
} from "./source-card";

const here = dirname(fileURLToPath(import.meta.url));
const webSrc = join(here, "../..");

async function commitThrough(
  executor: ReturnType<typeof createActionExecutor>,
  names: CatalogCall["name"][],
) {
  return async (calls: CatalogCall[]) => {
    const results: unknown[] = [];
    for (const call of calls) {
      names.push(call.name);
      results.push(await executor.execute(call.name, call.input));
    }
    return results;
  };
}

describe("UI youtube/article create uses provenance payloads", () => {
  it("builds youtube + article + web SourceCardPayload and persists via createCard", async () => {
    const executor = createActionExecutor({
      store: new InMemoryDomainStore(),
      ownerId: "local-session",
    });
    const canvas = await executor.createCanvas({ name: "Story" });

    const youtubeInput = buildCreateYoutubeCardInput({
      canvasId: canvas.id,
      sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      title: "Press conference",
      position: { x: 40, y: 80 },
    });
    expect(youtubeInput.type).toBe("youtube");
    expect(youtubeInput.payload).toEqual({
      provenance: {
        sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        title: "Press conference",
        publishedAt: "",
        sourceType: "youtube",
        externalId: "dQw4w9WgXcQ",
      },
    });
    expect(isValidCardPayload("youtube", youtubeInput.payload)).toBe(true);
    expect(isValidCardPayload("note", youtubeInput.payload)).toBe(false);

    const youtube = await executor.execute("createCard", youtubeInput);
    expect(youtube.type).toBe("youtube");
    if (youtube.type !== "youtube") {
      throw new Error("expected youtube");
    }
    expect(youtube.payload.provenance.sourceUrl).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    expect(youtube.payload.provenance.publishedAt).toBe("");

    const articleInput = buildCreateArticleCardInput({
      canvasId: canvas.id,
      sourceUrl: "https://example.com/world/story",
      title: "Official statement",
    });
    expect(articleInput.type).toBe("article");
    expect(articleInput.payload).toEqual({
      provenance: {
        sourceUrl: "https://example.com/world/story",
        title: "Official statement",
        publishedAt: "",
        sourceType: "web",
      },
    });
    expect(isValidCardPayload("article", articleInput.payload)).toBe(true);

    const webInput = buildCreateWebCardInput({
      canvasId: canvas.id,
      sourceUrl: "https://example.com/page",
      title: "Source page",
    });
    expect(webInput.type).toBe("web");
    expect(isValidCardPayload("web", webInput.payload)).toBe(true);

    const article = await executor.execute("createCard", articleInput);
    const web = await executor.execute("createCard", webInput);
    expect(article.type).toBe("article");
    expect(web.type).toBe("web");
    if (article.type !== "article" || web.type !== "web") {
      throw new Error("expected article and web");
    }
    expect(article.payload.provenance.publishedAt).toBe("");
    expect(web.payload.provenance.publishedAt).toBe("");
  });

  it("stores empty publishedAt when none is supplied and keeps a real ISO", async () => {
    const executor = createActionExecutor({
      store: new InMemoryDomainStore(),
      ownerId: "local-session",
    });
    const canvas = await executor.createCanvas({ name: "Story" });
    const publishedAt = "2026-03-14T15:09:00.000Z";

    expect(publishedAtForCreate(undefined)).toBe("");
    expect(publishedAtForCreate("")).toBe("");
    expect(publishedAtForCreate("   ")).toBe("");
    expect(publishedAtForCreate(publishedAt)).toBe(publishedAt);
    expect(knownPublishedAtLabel("")).toBeNull();
    expect(knownPublishedAtLabel("not a date")).toBeNull();
    expect(knownPublishedAtLabel(publishedAt)).toBe("2026-03-14");
    expect(knownPublishedAtLabel("")).not.toBe(
      new Date().toISOString().slice(0, 10),
    );

    const youtube = await executor.execute(
      "createCard",
      buildCreateYoutubeCardInput({
        canvasId: canvas.id,
        sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        title: "No mint",
      }),
    );
    const article = await executor.execute(
      "createCard",
      buildCreateArticleCardInput({
        canvasId: canvas.id,
        sourceUrl: "https://example.com/a",
        title: "No mint",
      }),
    );
    const dated = await executor.execute(
      "createCard",
      buildCreateArticleCardInput({
        canvasId: canvas.id,
        sourceUrl: "https://example.com/dated",
        title: "Dated",
        publishedAt,
      }),
    );

    expect(youtube.type).toBe("youtube");
    expect(article.type).toBe("article");
    expect(dated.type).toBe("article");
    if (
      youtube.type !== "youtube" ||
      article.type !== "article" ||
      dated.type !== "article"
    ) {
      throw new Error("expected source cards");
    }
    expect(youtube.payload.provenance.publishedAt).toBe("");
    expect(article.payload.provenance.publishedAt).toBe("");
    expect(dated.payload.provenance.publishedAt).toBe(publishedAt);
    expect(knownPublishedAtLabel(youtube.payload.provenance.publishedAt)).toBeNull();
    expect(knownPublishedAtLabel(article.payload.provenance.publishedAt)).toBeNull();
    expect(knownPublishedAtLabel(dated.payload.provenance.publishedAt)).toBe(
      "2026-03-14",
    );

    const source = readFileSync(join(webSrc, "lib/domain/source-card.ts"), "utf8");
    expect(source).not.toMatch(/publishedNow/);
    expect(source).not.toMatch(/new Date\(\)\.toISOString\(\)/);
  });

  it("rejects javascript: and HTML-as-URL on the UI create path", () => {
    expect(() =>
      buildCreateYoutubeCardInput({
        canvasId: "c1",
        sourceUrl: 'javascript:alert(1)',
        title: "<script>alert(1)</script>",
      }),
    ).toThrow(/official YouTube/);
    expect(() =>
      buildCreateArticleCardInput({
        canvasId: "c1",
        sourceUrl: 'javascript:alert(1)',
        title: "<img src=x onerror=alert(1)>",
      }),
    ).toThrow(/http\(s\)/);
  });
});

describe("source Card create is two catalog calls", () => {
  it("creates youtube/article then setCardFrame from geometry", async () => {
    const store = new InMemoryDomainStore();
    const executor = createActionExecutor({ store, ownerId: "local-session" });
    const canvas = await executor.createCanvas({ name: "Board" });
    const frame = await executor.createFrame({
      canvasId: canvas.id,
      bounds: { x: 0, y: 0, width: 400, height: 300 },
      name: "Main",
    });

    const youtubeNames: CatalogCall["name"][] = [];
    const youtube = await persistCreatedCard(
      await commitThrough(executor, youtubeNames),
      buildCreateYoutubeCardInput({
        canvasId: canvas.id,
        sourceUrl: "https://youtu.be/dQw4w9WgXcQ",
        title: "Video",
        position: { x: 24, y: 24 },
      }),
      [frame],
    );
    expect(youtube.type).toBe("youtube");
    expect(youtube.frameId ?? null).toBeNull();
    expect(youtubeNames).toEqual(["createCard", "setCardFrame"]);

    const articleNames: CatalogCall["name"][] = [];
    const article = await persistCreatedCard(
      await commitThrough(executor, articleNames),
      buildCreateArticleCardInput({
        canvasId: canvas.id,
        sourceUrl: "https://example.com/a",
        title: "Article",
        position: { x: 40, y: 40 },
      }),
      [frame],
    );
    expect(article.type).toBe("article");
    expect(articleNames).toEqual(["createCard", "setCardFrame"]);

    const attached = await executor.getCanvasState({ canvasId: canvas.id });
    expect(attached.cards.every((card) => card.frameId === frame.id)).toBe(true);
  });

  it("NW resize of a youtube Card persists position+size then remembership", async () => {
    const store = new InMemoryDomainStore();
    const executor = createActionExecutor({ store, ownerId: "local-session" });
    const canvas = await executor.createCanvas({ name: "Board" });
    const frame = await executor.createFrame({
      canvasId: canvas.id,
      bounds: { x: 0, y: 0, width: 200, height: 200 },
      name: "Main",
    });
    const created = await persistCreatedCard(
      async (calls) => {
        const results: unknown[] = [];
        for (const call of calls) {
          results.push(await executor.execute(call.name, call.input));
        }
        return results;
      },
      buildCreateYoutubeCardInput({
        canvasId: canvas.id,
        sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        position: { x: 20, y: 20 },
        size: { width: 80, height: 80 },
      }),
      [frame],
    );
    const member = await executor.getCanvasState({ canvasId: canvas.id });
    const card = member.cards.find((entry) => entry.id === created.id)!;
    expect(card.frameId).toBe(frame.id);

    const nextPosition = { x: 240, y: 240 };
    const nextSize = { width: 40, height: 40 };
    const plan = planCardGeometry(
      card,
      { position: nextPosition, size: nextSize },
      member.frames,
    );
    expect(plan.move).toEqual({ cardId: card.id, position: nextPosition });
    expect(plan.resize).toEqual({ cardId: card.id, size: nextSize });
    expect(plan.membership).toEqual({ cardId: card.id, frameId: null });
  });
});

describe("source Card nodes do not execute untrusted HTML", () => {
  it("registers youtube/article/web beside Note in the existing registry", () => {
    const source = readFileSync(
      join(webSrc, "components/cards/registry.ts"),
      "utf8",
    );
    expect(source).toContain('type: "note"');
    expect(source).toContain('type: "youtube"');
    expect(source).toContain('type: "article"');
    expect(source).toContain('type: "web"');
    expect(source).toContain('type: "x"');
    expect(source).toContain("NoteCardNode");
    expect(source).toContain("YoutubeCardNode");
    expect(source).toContain("ArticleCardNode");
    expect(source).toContain("WebCardNode");
    expect(source).toContain("XCardNode");
    expect(source).not.toMatch(/LOCAL_SESSION_OWNER_ID/);
    expect(
      readFileSync(join(webSrc, "lib/domain/source-card.ts"), "utf8"),
    ).not.toMatch(/LOCAL_SESSION_OWNER_ID|ownerId/);
    expect(
      readFileSync(join(webSrc, "lib/domain/persist-created-card.ts"), "utf8"),
    ).not.toMatch(/LOCAL_SESSION_OWNER_ID/);
  });

  it("keeps title/URL out of innerHTML, srcDoc, and eval", () => {
    const files = [
      "components/cards/UntrustedText.tsx",
      "components/cards/SafeExternalLink.tsx",
      "components/canvas/nodes/YoutubeCardNode.tsx",
      "components/canvas/nodes/ArticleCardNode.tsx",
      "components/cards/SourceProvenanceMeta.tsx",
      "lib/untrusted.ts",
      "lib/youtube.ts",
      "lib/domain/source-card.ts",
      "lib/canvas/provenance-display.ts",
    ];
    for (const relative of files) {
      const source = readFileSync(join(webSrc, relative), "utf8");
      expect(source, relative).not.toMatch(/dangerouslySetInnerHTML/);
      expect(source, relative).not.toMatch(/\bsrcDoc\s*=/);
      expect(source, relative).not.toMatch(/\beval\s*\(/);
    }
  });
});
