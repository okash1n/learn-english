import { describe, expect, test } from "bun:test";
import { SPOKEN_STYLE_BLOCK, spokenStyleFor } from "../spoken-style";

describe("SPOKEN_STYLE_BLOCK", () => {
  test("短縮形をデフォルトにする指示を含む", () => {
    expect(SPOKEN_STYLE_BLOCK).toContain("contractions");
    expect(SPOKEN_STYLE_BLOCK).toContain("I'm");
    expect(SPOKEN_STYLE_BLOCK).toContain("don't");
  });

  test("書き言葉語彙の禁止例(moreover/utilize/furthermore/therefore)を含む", () => {
    expect(SPOKEN_STYLE_BLOCK).toContain("moreover");
    expect(SPOKEN_STYLE_BLOCK).toContain("furthermore");
    expect(SPOKEN_STYLE_BLOCK).toContain("utilize");
    expect(SPOKEN_STYLE_BLOCK).toContain("therefore");
    expect(SPOKEN_STYLE_BLOCK).toContain("so");
  });

  test("「実際に声に出して話すように書く」の指示を含む", () => {
    expect(SPOKEN_STYLE_BLOCK).toContain("spoken aloud");
    expect(SPOKEN_STYLE_BLOCK).toContain("listened to");
  });

  test("リスト・見出し形式の禁止を含む", () => {
    expect(SPOKEN_STYLE_BLOCK).toContain("bullet points");
    expect(SPOKEN_STYLE_BLOCK).toContain("headings");
  });
});

describe("spokenStyleFor", () => {
  test("どの帯でも SPOKEN_STYLE_BLOCK 本体を含む", () => {
    for (const band of ["beginner", "intermediate", "advanced"] as const) {
      expect(spokenStyleFor(band)).toContain(SPOKEN_STYLE_BLOCK);
    }
  });

  test("帯ごとに異なる文長ガイドを返す", () => {
    const beginner = spokenStyleFor("beginner");
    const intermediate = spokenStyleFor("intermediate");
    const advanced = spokenStyleFor("advanced");
    expect(beginner).not.toBe(intermediate);
    expect(intermediate).not.toBe(advanced);
    expect(beginner).not.toBe(advanced);
  });

  test("beginner は最短の文長上限(6-10 words)を提示する", () => {
    expect(spokenStyleFor("beginner")).toContain("6-10 words");
  });

  test("advanced も長文エッセイ化を防ぐ文長上限(10-15 words)を持つ", () => {
    expect(spokenStyleFor("advanced")).toContain("10-15 words");
  });
});
