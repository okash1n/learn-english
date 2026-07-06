/** サーバのローカル日付 YYYY-MM-DD（UTC罠回避のため toISOString は使わない） */
export function localYmd(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return localYmd(new Date(y, m - 1, d + days));
}
