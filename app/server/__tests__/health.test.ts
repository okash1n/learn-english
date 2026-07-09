import { describe, expect, test } from "bun:test";
import { checkHealth } from "../health";
import pkg from "../../package.json";

describe("health", () => {
  test("全依存が揃っていれば ok=true", () => {
    const h = checkHealth({
      whichFn: () => "/opt/homebrew/bin/x",
      env: { OPENAI_API_KEY: "sk-test" },
      modelExists: () => true,
    });
    expect(h).toEqual({
      ok: true, whisper: true, ffmpeg: true, claude: true, ttsKey: true, modelFile: true,
      app: "solo-eikaiwa", version: pkg.version,
    });
  });

  test("app/version は sidecar の身元確認用に常に additive で付く", () => {
    const h = checkHealth({ whichFn: () => null, env: {}, modelExists: () => false });
    expect(h.app).toBe("solo-eikaiwa");
    expect(h.version).toBe(pkg.version);
    expect(typeof h.version).toBe("string");
    expect(h.version.length).toBeGreaterThan(0);
  });

  test("ttsKey が無くても ok は true（say フォールバックがあるため）", () => {
    const h = checkHealth({ whichFn: () => "/bin/x", env: {}, modelExists: () => true });
    expect(h.ttsKey).toBe(false);
    expect(h.ok).toBe(true);
  });

  test("whisper が無いと ok=false", () => {
    const h = checkHealth({
      whichFn: (bin) => (bin.startsWith("whisper") ? null : "/bin/x"),
      env: {},
      modelExists: () => true,
    });
    expect(h.whisper).toBe(false);
    expect(h.ok).toBe(false);
  });
});
