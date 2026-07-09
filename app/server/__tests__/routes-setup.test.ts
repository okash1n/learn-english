import { describe, expect, test } from "bun:test";
import { makeSetupRoutes } from "../routes/setup";
import type { DownloadState, ModelDownloadManager, StartResult, WhisperModelId } from "../model-download";
import { getReq, postJson } from "./helpers/http";

const IDLE: DownloadState = {
  status: "idle", model: null, receivedBytes: 0, totalBytes: 0, error: null, resumable: false,
};

function makeFakeManager(overrides: Partial<ModelDownloadManager> = {}): ModelDownloadManager {
  let state: DownloadState = { ...IDLE };
  return {
    getState: () => state,
    start: (model: WhisperModelId): StartResult => {
      state = { status: "downloading", model, receivedBytes: 0, totalBytes: 1000, error: null, resumable: true };
      return { ok: true, done: Promise.resolve() };
    },
    cancel: () => { state = { ...IDLE }; },
    diskFreeBytes: () => 999_999_999,
    installedModels: () => ({ "large-v3-turbo": false, small: false }),
    ...overrides,
  };
}

function makeHandler(overrides: Partial<ModelDownloadManager> = {}) {
  const modelDownload = makeFakeManager(overrides);
  const routes = makeSetupRoutes({ modelDownload });
  return async (req: Request) => {
    for (const r of routes) {
      const url = new URL(req.url);
      if (req.method === r.method && r.match(url.pathname)) return r.handler(req, url);
    }
    return new Response("not found", { status: 404 });
  };
}

describe("GET /api/setup/status", () => {
  test("state + diskFreeBytes + installedModelsを返す", async () => {
    const handler = makeHandler({
      getState: () => ({ ...IDLE }),
      diskFreeBytes: () => 5_000_000_000,
      installedModels: () => ({ "large-v3-turbo": true, small: false }),
    });
    const res = await handler(getReq("/api/setup/status"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: "idle", model: null, receivedBytes: 0, totalBytes: 0, error: null, resumable: false,
      diskFreeBytes: 5_000_000_000,
      models: { "large-v3-turbo": true, small: false },
    });
  });
});

describe("POST /api/setup/whisper-model", () => {
  test("既知のmodelなら202でダウンロード開始後の状態を返す", async () => {
    const started: WhisperModelId[] = [];
    const handler = makeHandler({
      start: (model) => { started.push(model); return { ok: true, done: Promise.resolve() }; },
      getState: () => ({ status: "downloading", model: "small", receivedBytes: 0, totalBytes: 500, error: null, resumable: true }),
    });
    const res = await handler(postJson("/api/setup/whisper-model", { model: "small" }));
    expect(res.status).toBe(202);
    expect(started).toEqual(["small"]);
    const body = await res.json();
    expect(body.status).toBe("downloading");
    expect(body.model).toBe("small");
  });

  test("未知のmodel文字列は400", async () => {
    const handler = makeHandler();
    const res = await handler(postJson("/api/setup/whisper-model", { model: "medium" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("model must be one of");
  });

  test("model欠落は400", async () => {
    const handler = makeHandler();
    const res = await handler(postJson("/api/setup/whisper-model", {}));
    expect(res.status).toBe(400);
  });

  test("不正なJSONボディは400", async () => {
    const handler = makeHandler();
    const req = new Request("http://localhost/api/setup/whisper-model", {
      method: "POST", headers: { "content-type": "application/json" }, body: "{not json",
    });
    const res = await handler(req);
    expect(res.status).toBe(400);
  });

  test("同時実行拒否（manager.startが409を返すケース）はそのままステータスを転送する", async () => {
    const handler = makeHandler({
      start: () => ({ ok: false, status: 409, error: "a whisper model download is already in progress" }),
    });
    const res = await handler(postJson("/api/setup/whisper-model", { model: "small" }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("already in progress");
  });

  test("容量不足（manager.startが507を返すケース）はそのままステータスを転送する", async () => {
    const handler = makeHandler({
      start: () => ({ ok: false, status: 507, error: "insufficient disk space for small: need ~585122360 bytes free (have 100)" }),
    });
    const res = await handler(postJson("/api/setup/whisper-model", { model: "small" }));
    expect(res.status).toBe(507);
    expect((await res.json()).error).toContain("insufficient disk space");
  });
});

describe("POST /api/setup/whisper-model/cancel", () => {
  test("manager.cancel()を呼び、以後のstateを返す", async () => {
    let cancelled = 0;
    const handler = makeHandler({
      cancel: () => { cancelled++; },
      getState: () => ({ ...IDLE }),
    });
    const res = await handler(new Request("http://localhost/api/setup/whisper-model/cancel", { method: "POST" }));
    expect(res.status).toBe(200);
    expect(cancelled).toBe(1);
    expect((await res.json()).status).toBe("idle");
  });
});
