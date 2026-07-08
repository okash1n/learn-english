import { describe, expect, test } from "bun:test";
import { DOMAINS, loadContent, parseContentFile } from "../content";
import { SCENARIOS_DIR, TOPICS_DIR } from "../paths";

/** リポジトリ実コンテンツの整合性（frontmatter タグの網羅チェック） */
describe("content integrity", () => {
  const topics = loadContent(TOPICS_DIR);
  const scenarios = loadContent(SCENARIOS_DIR);

  test("topics は22本以上・scenarios は16本以上パースできる", () => {
    expect(topics.length).toBeGreaterThanOrEqual(22);
    expect(scenarios.length).toBeGreaterThanOrEqual(16);
  });

  test("topics / scenarios とも3ドメインすべてに1本以上ある", () => {
    for (const domain of DOMAINS) {
      expect(topics.filter((t) => t.domain === domain).length).toBeGreaterThanOrEqual(1);
      expect(scenarios.filter((s) => s.domain === domain).length).toBeGreaterThanOrEqual(1);
    }
  });

  test("全アイテムの level が 1..6 の有効範囲", () => {
    for (const it of [...topics, ...scenarios]) {
      expect(it.level[0]).toBeGreaterThanOrEqual(1);
      expect(it.level[1]).toBeLessThanOrEqual(6);
      expect(it.level[0]).toBeLessThanOrEqual(it.level[1]);
    }
  });

  test("どの stage(1..6) にも topics / scenarios の適合プールが3本以上ある", () => {
    for (let stage = 1; stage <= 6; stage++) {
      const tPool = topics.filter((t) => t.level[0] <= stage && stage <= t.level[1]);
      const sPool = scenarios.filter((s) => s.level[0] <= stage && stage <= s.level[1]);
      expect(tPool.length).toBeGreaterThanOrEqual(3);
      expect(sPool.length).toBeGreaterThanOrEqual(3);
    }
  });
});

/**
 * v0.26 content-ladder wave1: topic の「完全に既知」アンカー(experienceAnchor/memoryCue/commonObjectsOrActions)
 * を frontmatter に comma区切りの1行フィールドとして追加パース対象にする(既存フィールドの挙動は不変・追加のみ)。
 */
describe("content: 完全に既知アンカーのfrontmatterパース(追加のみ・既存挙動不変)", () => {
  const MD = `---
id: coffee-routine
kind: topic
title: "My morning coffee"
title_ja: "朝のコーヒー"
domain: daily
level: [5, 6]
experience_anchor: "誰もが経験する朝のルーティンに接地している"
memory_cue: "毎朝コーヒーを淹れる自分の姿を思い浮かべる"
common_objects_or_actions: "coffee maker, mug, kettle"
---
Talk about:
- What you drink — 何を飲むか
`;

  test("3フィールドがパースされる(commonObjectsOrActionsはカンマ区切りをtrimした配列)", () => {
    const parsed = parseContentFile(MD)!;
    expect(parsed.experienceAnchor).toBe("誰もが経験する朝のルーティンに接地している");
    expect(parsed.memoryCue).toBe("毎朝コーヒーを淹れる自分の姿を思い浮かべる");
    expect(parsed.commonObjectsOrActions).toEqual(["coffee maker", "mug", "kettle"]);
  });

  test("フィールドが無い既存ファイル形式はundefinedのまま(後方互換)", () => {
    const withoutAnchor = MD
      .replace(/experience_anchor:.*\n/, "")
      .replace(/memory_cue:.*\n/, "")
      .replace(/common_objects_or_actions:.*\n/, "");
    const parsed = parseContentFile(withoutAnchor)!;
    expect(parsed.experienceAnchor).toBeUndefined();
    expect(parsed.memoryCue).toBeUndefined();
    expect(parsed.commonObjectsOrActions).toBeUndefined();
  });
});
