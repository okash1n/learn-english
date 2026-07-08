import { describe, expect, test } from "bun:test";
import {
  splitSentences,
  countWords,
  countContractions,
  findWrittenVocabHits,
  computeSpokenRegisterMetrics,
  checkSpokenRegister,
  WRITTEN_VOCAB_BAN_LIST,
  THRESHOLDS_BY_BAND,
} from "../spoken-register-check";

describe("splitSentences", () => {
  test("., !, ? の直後の空白で文を分割する", () => {
    expect(splitSentences("I like coffee. Do you? Yes!")).toEqual(["I like coffee.", "Do you?", "Yes!"]);
  });

  test("Mr. / Dr. などの略語のピリオドでは分割しない", () => {
    expect(splitSentences("Mr. Smith called Dr. Lee. They talked.")).toEqual([
      "Mr. Smith called Dr. Lee.",
      "They talked.",
    ]);
  });

  test("空文字列は空配列", () => {
    expect(splitSentences("")).toEqual([]);
  });
});

describe("countWords", () => {
  test("短縮形は1語として数える", () => {
    expect(countWords("I don't know.")).toBe(3);
  });

  test("空文字列は0語", () => {
    expect(countWords("")).toBe(0);
  });
});

describe("countContractions", () => {
  test("I'm / don't / it's / we've / can't / that's を数える", () => {
    expect(countContractions("I'm sure it's fine. We've tried, but that's not enough — I don't think we can't do it.")).toBe(6);
  });

  test("短縮形が無ければ0", () => {
    expect(countContractions("I am sure it is fine.")).toBe(0);
  });
});

describe("findWrittenVocabHits", () => {
  test("禁止語彙（moreover/furthermore/utilize等）を検出する", () => {
    const hits = findWrittenVocabHits("Moreover, we should utilize this. Furthermore, therefore we must act.");
    const terms = hits.map((h) => h.term);
    expect(terms).toContain("moreover");
    expect(terms).toContain("utilize");
    expect(terms).toContain("furthermore");
    expect(terms).toContain("therefore");
  });

  test("フレーズ(in addition)も検出する", () => {
    const hits = findWrittenVocabHits("In addition, we finished early.");
    expect(hits.map((h) => h.term)).toContain("in addition");
  });

  test("禁止語彙が無ければ空配列", () => {
    expect(findWrittenVocabHits("So we just finished it and it's fine.")).toEqual([]);
  });

  test("禁止リストは書き言葉語彙の代表例を含む(Task1 spoken-style.tsのブロックと整合)", () => {
    expect(WRITTEN_VOCAB_BAN_LIST).toContain("moreover");
    expect(WRITTEN_VOCAB_BAN_LIST).toContain("furthermore");
    expect(WRITTEN_VOCAB_BAN_LIST).toContain("utilize");
    expect(WRITTEN_VOCAB_BAN_LIST).toContain("therefore");
  });
});

describe("computeSpokenRegisterMetrics", () => {
  test("文数・語数・平均文長・短縮形率をまとめて返す", () => {
    const metrics = computeSpokenRegisterMetrics("I'm happy. You are not.");
    expect(metrics.sentenceCount).toBe(2);
    expect(metrics.wordCount).toBe(5);
    expect(metrics.avgWordsPerSentence).toBe(2.5);
    expect(metrics.contractionCount).toBe(1);
    expect(metrics.contractionsPerSentence).toBe(0.5);
  });

  test("空文字列は0除算せずゼロを返す", () => {
    const metrics = computeSpokenRegisterMetrics("");
    expect(metrics.sentenceCount).toBe(0);
    expect(metrics.avgWordsPerSentence).toBe(0);
    expect(metrics.contractionsPerSentence).toBe(0);
  });
});

// --- 較正: 実データに対する閾値の固定 ---
// 監査(docs/superpowers/plans/2026-07-09-spoken-register-pack.md)の事実:
//   例文300 = 平均9.58語/文・短縮形37%・書き言葉語彙ほぼ0 → PASS基準のコーパス
//   多聴6本（旧版） = 初級2本 短縮形0%の教科書調 / 上級3本 平均17.8〜19.4語/文のエッセイ調 → FAIL現物
// 閾値: 文長上限は spoken-style.ts の帯別ガイド上限+1語（beginner 11 / intermediate 14 / advanced 16）、
//       短縮形率下限は全帯 0.2（短縮形数/文数）で統一。
describe("較正: 例文300(実データ抜粋) は PASS する", () => {
  // content/sentences/sentences300.json の no.1-10 の en をそのまま抜粋（口語の会話文が並ぶ良好サンプル）
  const goodExcerpt = [
    "I usually skip breakfast and just grab coffee on my way out.",
    "This curry tastes a bit spicy, doesn't it?",
    "My eyesight is getting worse these days, honestly.",
    "My son is always leaving his socks all over the floor.",
    "I'm working from home this week, so just message me anytime.",
    "The weekly meeting starts at nine sharp, so don't be late.",
    "I think we need one more week to finish the report.",
    "I'm meeting a new client on Thursday afternoon.",
    "The deployment is still running, so don't merge anything yet.",
    "This script checks disk usage every five minutes and sends alerts.",
  ].join(" ");

  test("beginner帯の閾値でPASSする", () => {
    const result = checkSpokenRegister(goodExcerpt, "beginner");
    expect(result.pass).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  test("平均文長11語未満・短縮形率0.2以上である（数値の固定）", () => {
    const metrics = computeSpokenRegisterMetrics(goodExcerpt);
    expect(metrics.avgWordsPerSentence).toBeLessThan(THRESHOLDS_BY_BAND.beginner.maxAvgWordsPerSentence);
    expect(metrics.contractionsPerSentence).toBeGreaterThanOrEqual(THRESHOLDS_BY_BAND.beginner.minContractionsPerSentence);
  });
});

describe("較正: 多聴6本(旧版・実データ抜粋)はFAILする", () => {
  // content/listening/testing-a-new-app.md 第1段落（初級帯・短縮形0%の教科書調の実例）
  const badTextbookExcerpt =
    "I work for a small software company. My job is not to write code. My job is to test the app before other people use it. I look for problems. We call these problems bugs. Every day, I open the app on my phone or my computer and I try different things.";

  test("初級帯: 短縮形率0でFAILする（教科書調）", () => {
    const result = checkSpokenRegister(badTextbookExcerpt, "beginner");
    expect(result.pass).toBe(false);
    expect(result.reasons.some((r) => r.includes("短縮形率"))).toBe(true);
  });

  // content/listening/cleaning-out-the-closet.md 第1段落（上級帯・平均17.7語/文のエッセイ調の実例）
  const badEssayExcerpt =
    "Last Saturday, I finally decided to clean out my closet. It had been a mess for months, and every time I opened the door, something would fall out onto the floor. I told myself I would just spend twenty minutes tidying it up, but of course, that plan didn't work out at all.";

  test("上級帯: 平均文長オーバーでFAILする（エッセイ調）", () => {
    const result = checkSpokenRegister(badEssayExcerpt, "advanced");
    expect(result.pass).toBe(false);
    expect(result.reasons.some((r) => r.includes("平均文長"))).toBe(true);
  });
});

describe("checkSpokenRegister: 書き言葉語彙ヒットでFAILする", () => {
  test("禁止語彙が1つでもあればFAILする（帯を問わず）", () => {
    const text =
      "I usually skip breakfast. Moreover, I don't eat much at lunch either, so I'm always hungry by dinner.";
    const result = checkSpokenRegister(text, "beginner");
    expect(result.pass).toBe(false);
    expect(result.reasons.some((r) => r.includes("書き言葉語彙"))).toBe(true);
  });
});
