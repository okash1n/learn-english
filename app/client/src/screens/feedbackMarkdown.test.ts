import { describe, expect, test } from "bun:test";
import { feedbackToMarkdown, type FeedbackMarkdownLabels } from "./feedbackMarkdown";
import type { FeedbackEntry } from "../api";

const LABELS: FeedbackMarkdownLabels = {
  heading: (n) => `# フィードバック（${n}件）`,
  rating: (r) => ({ hard: "きつい", "just-right": "ちょうどいい", easy: "簡単" }[r]),
};

function entry(over: Partial<FeedbackEntry>): FeedbackEntry {
  return {
    id: 1, ts: "t", ymd: "2026-07-07", blockKind: "session",
    refId: null, level: null, stage: null, rating: "just-right", note: "", ...over,
  };
}

describe("feedbackToMarkdown", () => {
  test("日付ごとに見出しを作り、文脈と評価を1行にまとめる", () => {
    const md = feedbackToMarkdown([
      entry({ ymd: "2026-07-07", blockKind: "session", refId: "daily-60", level: 13, stage: 2, rating: "hard", note: "きつめ" }),
      entry({ ymd: "2026-07-07", blockKind: "free-talk", rating: "just-right" }),
      entry({ ymd: "2026-07-06", blockKind: "listening", refId: "morning-routine", rating: "easy" }),
    ], LABELS);
    expect(md).toBe(
      [
        "# フィードバック（3件）",
        "",
        "## 2026-07-07",
        "- **session** · (daily-60) · Lv13 · Stage2 · きつい — きつめ",
        "- **free-talk** · ちょうどいい",
        "",
        "## 2026-07-06",
        "- **listening** · (morning-routine) · 簡単",
      ].join("\n"),
    );
  });

  test("空配列でも見出しだけ返す", () => {
    expect(feedbackToMarkdown([], LABELS)).toBe("# フィードバック（0件）\n");
  });
});
