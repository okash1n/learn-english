import { describe, expect, test } from "bun:test";
import { openDb } from "../db";
import { makeFeedbackStore } from "../feedback-store";

function memStore() {
  return makeFeedbackStore(openDb(":memory:"));
}

describe("feedback-store", () => {
  test("save して list で取れる（スキーマ自動作成・採番・列マッピング）", () => {
    const store = memStore();
    const row = store.save({
      blockKind: "session", refId: "daily-60", level: 13, stage: 2,
      rating: "just-right", note: "調子よかった", ymd: "2026-07-07",
    });
    expect(typeof row.id).toBe("number");
    expect(row.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    const list = store.list();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      blockKind: "session", refId: "daily-60", level: 13, stage: 2,
      rating: "just-right", note: "調子よかった", ymd: "2026-07-07",
    });
  });

  test("null の refId/level/stage と空 note を保持する", () => {
    const store = memStore();
    store.save({ blockKind: "free-talk", refId: null, level: null, stage: null, rating: "hard", note: "", ymd: "2026-07-07" });
    const [row] = store.list();
    expect(row.refId).toBeNull();
    expect(row.level).toBeNull();
    expect(row.stage).toBeNull();
    expect(row.note).toBe("");
  });

  test("list は id 降順（新しい順）", () => {
    const store = memStore();
    store.save({ blockKind: "a", refId: null, level: null, stage: null, rating: "easy", note: "", ymd: "2026-07-06" });
    store.save({ blockKind: "b", refId: null, level: null, stage: null, rating: "easy", note: "", ymd: "2026-07-07" });
    const list = store.list();
    expect(list.map((r) => r.blockKind)).toEqual(["b", "a"]);
  });
});
