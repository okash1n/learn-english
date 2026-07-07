import type { Database } from "bun:sqlite";
import { insertReturningId } from "./db-util";

export type FeedbackRating = "hard" | "just-right" | "easy";

export type FeedbackInput = {
  blockKind: string;
  refId: string | null;
  level: number | null;
  stage: number | null;
  rating: FeedbackRating;
  note: string;
  ymd: string;
};

export type FeedbackRow = {
  id: number;
  ts: string;
  ymd: string;
  blockKind: string;
  refId: string | null;
  level: number | null;
  stage: number | null;
  rating: FeedbackRating;
  note: string;
};

export type FeedbackStore = {
  /** 1件の完了時フィードバックを記録する（情報表示のみ・削除しない）。ymd は呼び出し側のローカル日付。 */
  save(input: FeedbackInput): FeedbackRow;
  /** 新しい順（id 降順）で最大 limit 件。閲覧画面と Markdown エクスポートで使う。 */
  list(limit?: number): FeedbackRow[];
};

export function ensureFeedbackSchema(db: Database): void {
  db.run(`CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    ymd TEXT NOT NULL,
    block_kind TEXT NOT NULL,
    ref_id TEXT,
    level INTEGER,
    stage INTEGER,
    rating TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT ''
  )`);
}

type Row = {
  id: number; ts: string; ymd: string; block_kind: string;
  ref_id: string | null; level: number | null; stage: number | null;
  rating: string; note: string;
};

function toEntry(r: Row): FeedbackRow {
  return {
    id: r.id, ts: r.ts, ymd: r.ymd, blockKind: r.block_kind,
    refId: r.ref_id, level: r.level, stage: r.stage,
    rating: r.rating as FeedbackRating, note: r.note,
  };
}

export function makeFeedbackStore(db: Database): FeedbackStore {
  return {
    save(input) {
      const ts = new Date().toISOString();
      db.run(
        "INSERT INTO feedback (ts, ymd, block_kind, ref_id, level, stage, rating, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [ts, input.ymd, input.blockKind, input.refId, input.level, input.stage, input.rating, input.note],
      );
      return {
        id: insertReturningId(db), ts, ymd: input.ymd, blockKind: input.blockKind,
        refId: input.refId, level: input.level, stage: input.stage, rating: input.rating, note: input.note,
      };
    },
    list(limit = 500) {
      const rows = db
        .query<Row, [number]>("SELECT * FROM feedback ORDER BY id DESC LIMIT ?")
        .all(limit);
      return rows.map(toEntry);
    },
  };
}
