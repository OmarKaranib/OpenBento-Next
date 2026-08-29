import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const sql = [
  readFileSync(
    join(repoRoot, "supabase/migrations/20260829140000_init_openbento_schema.sql"),
    "utf8",
  ),
  readFileSync(
    join(
      repoRoot,
      "supabase/migrations/20260829200000_watch_bot_event_card_same_canvas.sql",
    ),
    "utf8",
  ),
].join("\n");

describe("local/dev schema SQL", () => {
  it("defines the schema.ts tables and not title/body card columns", () => {
    expect(sql).toMatch(/create table public\.canvases/i);
    expect(sql).toMatch(/create table public\.cards/i);
    expect(sql).toMatch(/create table public\.frames/i);
    expect(sql).toMatch(/create table public\.watch_bots/i);
    expect(sql).toMatch(/create table public\.watch_bot_events/i);
    expect(sql).toMatch(/payload jsonb not null/i);
    const cardsTable = sql.match(
      /create table public\.cards \([\s\S]*?\n\);/,
    )?.[0];
    expect(cardsTable).toBeDefined();
    expect(cardsTable).toMatch(/payload jsonb not null/i);
    expect(cardsTable).not.toMatch(/\b(?:title|body)\s+(text|varchar)/i);
    expect(sql).toMatch(/status text not null check \(status in \('running', 'paused', 'error'\)\)/);
    expect(sql).toMatch(/instruction text not null/);
  });

  it("keeps card.frame_id on the same canvas and documents membership checks", () => {
    expect(sql).toMatch(/cards_frame_same_canvas_fkey/);
    expect(sql).toMatch(/foreign key \(frame_id, canvas_id\)/);
    expect(sql).toMatch(/assertSameCanvasMembership/);
    expect(sql).toMatch(/RLS is not a substitute/i);
  });

  it("scopes every table with owner RLS via auth.uid()", () => {
    for (const table of [
      "canvases",
      "cards",
      "frames",
      "watch_bots",
      "watch_bot_events",
    ]) {
      expect(sql).toMatch(
        new RegExp(`alter table public\\.${table} enable row level security`, "i"),
      );
      expect(sql).toMatch(
        new RegExp(`alter table public\\.${table} force row level security`, "i"),
      );
    }
    expect(sql).toMatch(/owner_id = \(select auth\.uid\(\)\)/);
    expect(sql).toMatch(/Never trust a client-supplied user id/i);
    expect(sql).toMatch(/Do NOT apply this migration to a hosted or production/i);
  });

  it("uniques watch_bot_events on (watch_bot_id, dedup_key)", () => {
    expect(sql).toMatch(
      /constraint watch_bot_events_watch_bot_id_dedup_key_key/,
    );
    expect(sql).toMatch(/unique \(watch_bot_id, dedup_key\)/);
  });

  it("protects watch_bot_events.card_id with a same-canvas composite FK", () => {
    expect(sql).toMatch(/watch_bot_events_card_same_canvas_fkey/);
    expect(sql).toMatch(/foreign key \(card_id, canvas_id\)/);
    expect(sql).toMatch(/references public\.cards \(id, canvas_id\)/);
    expect(sql).toMatch(/unique \(id, canvas_id\)/);
  });

  it("defines an invoker transaction helper for leftover-Card TOCTOU", () => {
    const fn = sql.match(
      /create or replace function public\.apply_domain_transaction[\s\S]*?language plpgsql\s+security invoker/,
    )?.[0];
    expect(fn).toBeDefined();
    expect(fn).not.toMatch(/security definer/i);
  });
});
