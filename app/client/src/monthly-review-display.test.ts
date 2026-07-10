import { describe, expect, test } from "bun:test";
import type { MonthlyReport, MonthlyReportPreview } from "./api";
import { monthlyReviewDisplay } from "./monthly-review-display";

const latest: MonthlyReport = { id: 2, ts: "2026-07-10T00:00:00.000Z", ymd: "2026-07-10", text: "Latest" };
const latestPreview: MonthlyReportPreview = { ...latest, preview: "Latest" };
const past: MonthlyReportPreview = { id: 1, ts: "2026-06-10T00:00:00.000Z", ymd: "2026-06-10", text: "Past", preview: "Past" };

describe("月次レビューの独立表示", () => {
  test("履歴だけ失敗しても最新レビューを保持する", () => {
    const display = monthlyReviewDisplay(
      { status: "ready", data: latest },
      { status: "error", error: "history unavailable" },
      null,
    );

    expect(display.report).toEqual(latest);
    expect(display.past).toEqual([]);
    expect(display.latestKnown).toBe(true);
  });

  test("最新だけ失敗しても取得済みの履歴を表示する", () => {
    const display = monthlyReviewDisplay(
      { status: "error", error: "latest unavailable" },
      { status: "ready", data: [past] },
      null,
    );

    expect(display.report).toBeNull();
    expect(display.past).toEqual([past]);
    expect(display.latestKnown).toBe(false);
  });

  test("両方の失敗後に再試行で回復した表示へ切り替えられる", () => {
    const failed = monthlyReviewDisplay(
      { status: "error", error: "latest unavailable" },
      { status: "error", error: "history unavailable" },
      null,
    );
    const recovered = monthlyReviewDisplay(
      { status: "ready", data: latest },
      { status: "ready", data: [latestPreview, past] },
      null,
    );

    expect(failed.report).toBeNull();
    expect(failed.past).toEqual([]);
    expect(recovered.report).toEqual(latest);
    expect(recovered.past).toEqual([past]);
  });
});
