import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { ensureTtsSettingsSchema, makeTtsSettingsStore } from "../tts-settings-store";

function freshStore() {
  const db = new Database(":memory:");
  ensureTtsSettingsSchema(db);
  return makeTtsSettingsStore(db);
}

describe("tts-settings-store", () => {
  test("get: 未設定なら null（＝env/既定に従う）", () => {
    expect(freshStore().get()).toBeNull();
  });

  test("save→get: 保存した値をそのまま返す（単一行 upsert）", () => {
    const store = freshStore();
    const saved = store.save({ baseUrl: "http://localhost:8880/v1", model: "kokoro", voice: "af_sky" });
    expect(saved).toEqual({ baseUrl: "http://localhost:8880/v1", model: "kokoro", voice: "af_sky" });
    expect(store.get()).toEqual({ baseUrl: "http://localhost:8880/v1", model: "kokoro", voice: "af_sky" });
  });

  test("save: 2回目は同じ行を上書きする（id=1 単一行・null で既定へ戻せる）", () => {
    const store = freshStore();
    store.save({ baseUrl: "http://localhost:8880/v1", model: "kokoro", voice: "af_sky" });
    store.save({ baseUrl: null, model: null, voice: null });
    expect(store.get()).toEqual({ baseUrl: null, model: null, voice: null });
  });
});
