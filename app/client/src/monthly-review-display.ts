import type { MonthlyReport, MonthlyReportPreview } from "./api";
import type { LoadState } from "./useLoad";

export type MonthlyReviewDisplay = {
  report: MonthlyReport | null;
  past: MonthlyReportPreview[];
  latestStatus: LoadState<MonthlyReport | null>["status"];
  historyStatus: LoadState<MonthlyReportPreview[]>["status"];
  latestKnown: boolean;
};

/** 最新レビューと履歴は独立した取得結果として扱い、片方の失敗で成功側を隠さない。 */
export function monthlyReviewDisplay(
  latest: LoadState<MonthlyReport | null>,
  history: LoadState<MonthlyReportPreview[]>,
  generated: MonthlyReport | null,
): MonthlyReviewDisplay {
  const latestKnown = latest.status === "ready";
  const report = generated ?? (latestKnown ? latest.data : null);
  const past = history.status === "ready"
    ? history.data.filter((item) => item.id !== report?.id)
    : [];

  return {
    report,
    past,
    latestStatus: latest.status,
    historyStatus: history.status,
    latestKnown,
  };
}
