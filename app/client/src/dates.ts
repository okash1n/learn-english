import type { Lang } from "./i18n";

/**
 * ローカルタイムゾーンの YYYY-MM-DD。UTC の toISOString().slice(0,10) と違い日付境界でずれない。
 * サーバ app/server/dates.ts の localYmd と同一セマンティクス（SRS の due 比較の一致に必要）。
 */
export function localYmd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** UTC ISO等のtimestampを、閲覧環境のローカル日付へ変換する。 */
export function localYmdFromTimestamp(timestamp: string): string {
  return localYmd(new Date(timestamp));
}

type YmdParts = { year: number; month: number; day: number };

function parseYmd(ymd: string): YmdParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? { year, month, day }
    : null;
}

const EN_SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const EN_LONG_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** YYYY-MM-DD をグラフ・一覧向けの短いUI日付へ変換する。 */
export function formatYmdShort(ymd: string, lang: Lang): string {
  const parts = parseYmd(ymd);
  if (!parts) return ymd;
  return lang === "ja"
    ? `${parts.month}/${parts.day}`
    : `${EN_SHORT_MONTHS[parts.month - 1]} ${parts.day}`;
}

/** YYYY-MM-DD をツールチップ・履歴向けの長いUI日付へ変換する。 */
export function formatYmdLong(ymd: string, lang: Lang): string {
  const parts = parseYmd(ymd);
  if (!parts) return ymd;
  return lang === "ja"
    ? `${parts.year}年${parts.month}月${parts.day}日`
    : `${EN_LONG_MONTHS[parts.month - 1]} ${parts.day}, ${parts.year}`;
}

/** サーバのymdと同じローカル暦月にレポートが無ければ生成できる。 */
export function canGenerateMonthlyReview(reportYmd: string | null, today: Date = new Date()): boolean {
  return reportYmd === null || reportYmd.slice(0, 7) !== localYmd(today).slice(0, 7);
}
