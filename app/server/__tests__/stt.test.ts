import { describe, expect, test } from "bun:test";
import { buildWhisperArgs, parseWhisperJson } from "../stt";

describe("stt", () => {
  test("buildWhisperArgs は英語専用・JSON出力の引数列を組み立てる", () => {
    const args = buildWhisperArgs("/m/model.bin", "/tmp/in.wav", "/tmp/out");
    expect(args).toEqual([
      "-m", "/m/model.bin",
      "-f", "/tmp/in.wav",
      "-l", "en",
      "-oj",
      "-of", "/tmp/out",
      "-np",
    ]);
  });

  test("parseWhisperJson は transcription の text を結合して trim する", () => {
    const json = JSON.stringify({
      transcription: [
        { text: " Hello, my name is", offsets: { from: 0, to: 1200 } },
        { text: " Shin.", offsets: { from: 1200, to: 2000 } },
      ],
    });
    expect(parseWhisperJson(json)).toBe("Hello, my name is Shin.");
  });

  test("parseWhisperJson は transcription が無ければ空文字", () => {
    expect(parseWhisperJson("{}")).toBe("");
  });
});
