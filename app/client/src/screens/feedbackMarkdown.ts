import type { FeedbackEntry, FeedbackRating } from "../api";

export type FeedbackMarkdownLabels = {
  heading: (n: number) => string;
  rating: (rating: FeedbackRating) => string;
};

/**
 * フィードバック一覧を日付見出し付き Markdown にする（次の開発サイクルへ貼るエクスポート用の純関数）。
 * entries は日付降順（サーバの list 順）を前提とし、ymd が変わるたびに `## <ymd>` を挟む。
 */
export function feedbackToMarkdown(entries: FeedbackEntry[], labels: FeedbackMarkdownLabels): string {
  const lines: string[] = [labels.heading(entries.length), ""];
  let currentYmd: string | null = null;
  for (const e of entries) {
    if (e.ymd !== currentYmd) {
      if (currentYmd !== null) lines.push("");
      lines.push(`## ${e.ymd}`);
      currentYmd = e.ymd;
    }
    const parts = [`**${e.blockKind}**`];
    if (e.refId) parts.push(`(${e.refId})`);
    if (e.level !== null) parts.push(`Lv${e.level}`);
    if (e.stage !== null) parts.push(`Stage${e.stage}`);
    parts.push(labels.rating(e.rating));
    let line = `- ${parts.join(" · ")}`;
    if (e.note) line += ` — ${e.note}`;
    lines.push(line);
  }
  return lines.join("\n");
}
