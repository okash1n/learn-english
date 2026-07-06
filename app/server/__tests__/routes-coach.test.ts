import { describe, expect, test } from "bun:test";
import { makeFetchHandler } from "../routes";
import { FAKE_AE, FAKE_REFLECTION, makeFakeTalkExplainCache, makeTestDeps } from "./helpers/route-deps";

describe("routes: coach", () => {
  test("POST /api/feedback/ae: 正常系とtranscript空400", async () => {
    const { deps } = makeTestDeps();
    const handler = makeFetchHandler(deps);
    const ok = await handler(new Request("http://localhost/api/feedback/ae", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ transcript: "I go yesterday", topicTitle: "My week" }),
    }));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ ...FAKE_AE, collectedChunks: 0 });
    const bad = await handler(new Request("http://localhost/api/feedback/ae", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ topicTitle: "x" }),
    }));
    expect(bad.status).toBe(400);
  });

  test("POST /api/coach/model-talk: 既知ID 200 / 欠落400 / 未知404", async () => {
    const { deps } = makeTestDeps();
    const handler = makeFetchHandler(deps);
    const ok = await handler(new Request("http://localhost/api/coach/model-talk", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ topicId: "known-topic" }),
    }));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ text: "model talk" });
    const missing = await handler(new Request("http://localhost/api/coach/model-talk", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}),
    }));
    expect(missing.status).toBe(400);
    const unknown = await handler(new Request("http://localhost/api/coach/model-talk", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ topicId: "nope" }),
    }));
    expect(unknown.status).toBe(404);
  });

  test("POST /api/coach/reflection は Reflection を返す", async () => {
    const { deps } = makeTestDeps();
    const handler = makeFetchHandler(deps);
    const res = await handler(new Request("http://localhost/api/coach/reflection", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}),
    }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ...FAKE_REFLECTION, collectedChunks: 0 });
  });
});

describe("routes: coach/prep", () => {
  test("topicId欠落は400", async () => {
    const { deps } = makeTestDeps();
    const handler = makeFetchHandler(deps);
    const res = await handler(new Request("http://localhost/api/coach/prep", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}),
    }));
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toContain("topicId");
  });

  test("未知のtopicIdは404", async () => {
    const { deps } = makeTestDeps({ prepPack: async () => null });
    const handler = makeFetchHandler(deps);
    const res = await handler(new Request("http://localhost/api/coach/prep", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ topicId: "nope" }),
    }));
    expect(res.status).toBe(404);
  });

  test("正常系はPrepPackを返す", async () => {
    const { deps } = makeTestDeps();
    const handler = makeFetchHandler(deps);
    const res = await handler(new Request("http://localhost/api/coach/prep", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ topicId: "zero-trust" }),
    }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { chunks: Array<{ en: string; ja: string }>; outline: string[] };
    expect(body.chunks[0].en).toContain("problem");
    expect(body.outline).toEqual(["Opening"]);
  });

  test("不正JSONボディは400", async () => {
    const { deps } = makeTestDeps();
    const handler = makeFetchHandler(deps);
    const res = await handler(new Request("http://localhost/api/coach/prep", {
      method: "POST", headers: { "content-type": "application/json" }, body: "{oops",
    }));
    expect(res.status).toBe(400);
  });
});

describe("routes: モデルトーク解説", () => {
  test("POST /api/coach/talk-explain は生成して返しハッシュキーで保存する", async () => {
    const saved: Array<{ hash: string; text: string }> = [];
    let generateCalls = 0;
    const { deps } = makeTestDeps({
      explainTalk: async () => { generateCalls++; return { text: "日本語訳: 訳文\n\n表現ポイント:\n- a — b" }; },
      talkExplainCache: makeFakeTalkExplainCache({
        get: () => null,
        save: (hash, text) => { saved.push({ hash, text }); },
      }),
    });
    const res = await makeFetchHandler(deps)(new Request("http://x/api/coach/talk-explain", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "I usually start my day with coffee." }),
    }));
    expect(res.status).toBe(200);
    expect((await res.json()).text).toContain("日本語訳");
    expect(generateCalls).toBe(1);
    expect(saved).toHaveLength(1);
    expect(saved[0].hash).toMatch(/^[0-9a-f]{64}$/);
  });

  test("POST /api/coach/talk-explain はキャッシュ命中時に生成しない", async () => {
    let generateCalls = 0;
    const { deps } = makeTestDeps({
      explainTalk: async () => { generateCalls++; return { text: "x" }; },
      talkExplainCache: makeFakeTalkExplainCache({
        get: () => "キャッシュ済み訳と解説",
        save: () => { throw new Error("must not save on cache hit"); },
      }),
    });
    const res = await makeFetchHandler(deps)(new Request("http://x/api/coach/talk-explain", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Any talk text." }),
    }));
    expect(res.status).toBe(200);
    expect((await res.json()).text).toBe("キャッシュ済み訳と解説");
    expect(generateCalls).toBe(0);
  });

  test("POST /api/coach/talk-explain は空文字・過長テキストに 400", async () => {
    const handler = makeFetchHandler(makeTestDeps().deps);
    const empty = await handler(new Request("http://x/api/coach/talk-explain", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "  " }),
    }));
    expect(empty.status).toBe(400);
    const tooLong = await handler(new Request("http://x/api/coach/talk-explain", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "a".repeat(3001) }),
    }));
    expect(tooLong.status).toBe(400);
  });
});
