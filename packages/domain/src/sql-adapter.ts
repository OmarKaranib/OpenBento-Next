import type {
  CanvasRecord,
  CardRecord,
  FrameRecord,
  WatchBotEventRecord,
  WatchBotRecord,
} from "./schema";
import type { DomainWriteOp } from "./sql-contract";
import { SqlContractEngine, type SharedSqlTables, type SqlContractSession } from "./sql-contract";

/**
 * Record-level persistence used by `SupabaseDomainStore`.
 * Runtime uses the Supabase JS driver. CI uses the SQL-contract engine.
 */
export interface DomainSqlAdapter {
  getCanvas(id: string): Promise<CanvasRecord | null>;
  upsertCanvas(row: CanvasRecord): Promise<void>;
  listCanvasesByOwner(ownerId: string): Promise<CanvasRecord[]>;

  getCard(id: string): Promise<CardRecord | null>;
  upsertCard(row: CardRecord): Promise<void>;
  listCardsByCanvas(canvasId: string): Promise<CardRecord[]>;

  getFrame(id: string): Promise<FrameRecord | null>;
  upsertFrame(row: FrameRecord): Promise<void>;
  listFramesByCanvas(canvasId: string): Promise<FrameRecord[]>;

  getWatchBot(id: string): Promise<WatchBotRecord | null>;
  upsertWatchBot(row: WatchBotRecord): Promise<void>;
  listWatchBotsByCanvas(canvasId: string): Promise<WatchBotRecord[]>;
  listWatchBots(): Promise<WatchBotRecord[]>;

  insertWatchBotEvent(row: WatchBotEventRecord): Promise<void>;
  listWatchBotEvents(watchBotId: string): Promise<WatchBotEventRecord[]>;

  applyTransaction(ops: DomainWriteOp[]): Promise<void>;
}

export function createSqlContractAdapter(
  tables: SharedSqlTables,
  session: SqlContractSession,
): DomainSqlAdapter {
  const engine = new SqlContractEngine(tables, session);
  return {
    async getCanvas(id) {
      return engine.getCanvas(id);
    },
    async upsertCanvas(row) {
      engine.upsertCanvas(row);
    },
    async listCanvasesByOwner(ownerId) {
      return engine.listCanvases().filter((row) => row.owner_id === ownerId);
    },
    async getCard(id) {
      return engine.getCard(id);
    },
    async upsertCard(row) {
      engine.upsertCard(row);
    },
    async listCardsByCanvas(canvasId) {
      return engine.listCardsByCanvas(canvasId);
    },
    async getFrame(id) {
      return engine.getFrame(id);
    },
    async upsertFrame(row) {
      engine.upsertFrame(row);
    },
    async listFramesByCanvas(canvasId) {
      return engine.listFramesByCanvas(canvasId);
    },
    async getWatchBot(id) {
      return engine.getWatchBot(id);
    },
    async upsertWatchBot(row) {
      engine.upsertWatchBot(row);
    },
    async listWatchBotsByCanvas(canvasId) {
      return engine.listWatchBotsByCanvas(canvasId);
    },
    async listWatchBots() {
      return engine.listWatchBots();
    },
    async insertWatchBotEvent(row) {
      engine.insertWatchBotEvent(row);
    },
    async listWatchBotEvents(watchBotId) {
      return engine.listWatchBotEvents(watchBotId);
    },
    async applyTransaction(ops) {
      engine.applyTransaction(ops);
    },
  };
}
