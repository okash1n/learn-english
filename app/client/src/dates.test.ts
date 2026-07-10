import { describe, expect, test } from "bun:test";
import { canGenerateMonthlyReview, formatYmdLong, formatYmdShort, localYmd, localYmdFromTimestamp } from "./dates";

describe("local date helpers", () => {
  test("UTC ISO timestampを閲覧環境のローカル日付へ戻す", () => {
    const localAfterMidnight = new Date(2026, 6, 10, 0, 30, 0);
    const timestamp = localAfterMidnight.toISOString();
    expect(localYmdFromTimestamp(timestamp)).toBe("2026-07-10");
    expect(localYmd(new Date(timestamp))).toBe("2026-07-10");
  });

  test("月次レビューは同じローカル暦月なら生成不可、前月なら月初から生成可", () => {
    const augustFirst = new Date(2026, 7, 1, 0, 1, 0);
    expect(canGenerateMonthlyReview(null, augustFirst)).toBe(true);
    expect(canGenerateMonthlyReview("2026-08-01", augustFirst)).toBe(false);
    expect(canGenerateMonthlyReview("2026-08-31", augustFirst)).toBe(false);
    expect(canGenerateMonthlyReview("2026-07-31", augustFirst)).toBe(true);
  });

  test("表示用の日付はUI言語に合わせ、内部のYYYY-MM-DDをそのまま出さない", () => {
    expect(formatYmdShort("2026-07-10", "ja")).toBe("7/10");
    expect(formatYmdShort("2026-07-10", "en")).toBe("Jul 10");
    expect(formatYmdLong("2026-07-10", "ja")).toBe("2026年7月10日");
    expect(formatYmdLong("2026-07-10", "en")).toBe("July 10, 2026");
  });

  test("不正な内部日付は変換せず、安全に元の値を返す", () => {
    expect(formatYmdShort("2026-02-30", "ja")).toBe("2026-02-30");
    expect(formatYmdLong("unknown", "en")).toBe("unknown");
  });
});
