import { extractErrorMessage } from "./http";

export type FeedbackRating = "hard" | "just-right" | "easy";

export type FeedbackEntry = {
  id: number;
  ts: string;
  ymd: string;
  blockKind: string;
  refId: string | null;
  level: number | null;
  stage: number | null;
  rating: FeedbackRating;
  note: string;
};

/** 配置側が渡す最小文脈。level/stage は FeedbackRow が送信時に付与するのでここには含めない。 */
export type FeedbackContext = { blockKind: string; refId?: string | null };

/** 練習完了時の1タップ評価を記録する（情報表示のみ・スキップ自由・返り値は使わない）。 */
export async function postFeedback(input: {
  blockKind: string; refId: string | null; level: number | null; stage: number | null;
  rating: FeedbackRating; note: string;
}): Promise<void> {
  const res = await fetch("/api/feedback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`feedback failed: ${await extractErrorMessage(res)}`);
}

export async function fetchFeedback(): Promise<FeedbackEntry[]> {
  const res = await fetch("/api/feedback");
  if (!res.ok) throw new Error(`feedback list failed: ${await extractErrorMessage(res)}`);
  return ((await res.json()) as { items: FeedbackEntry[] }).items;
}
