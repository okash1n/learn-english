import path from "node:path";
import type { Database } from "bun:sqlite";
import { addDaysYmd, localYmd } from "./dates";
import { readEvents } from "./session-log";
import { SESSIONS_DIR } from "./paths";
import type { UtteranceMetrics } from "./metrics";

export type DayMetrics = {
  ymd: string;
  utterances: number;
  speakingSec: number;
  avgArticulationWpm: number;
  avgPauseRatio: number;
  repetitionRatio: number;
};

export type MetricsSummary = {
  days: DayMetrics[];
  level: { current: number; history: Array<{ ymd: string; level: number }> };
};

/** 直近N日のセッションログとlevel_eventsから進捗サマリを作る（stt_result のみ集計） */
export function makeMetricsSummary(deps: { db: Database; sessionsDir?: string; currentLevel: () => number }) {
  const dir = deps.sessionsDir ?? SESSIONS_DIR;
  return function metricsSummary(days: number, today = localYmd()): MetricsSummary {
    const out: DayMetrics[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const ymd = addDaysYmd(today, -i);
      let words = 0, speechMs = 0, totalMs = 0, pauseMs = 0, utterances = 0, repWeighted = 0;
      for (const e of readEvents(path.join(dir, `${ymd}.jsonl`))) {
        if (e.type !== "stt_result") continue;
        const m = (e.meta as { metrics?: UtteranceMetrics } | undefined)?.metrics;
        if (!m || typeof m.words !== "number" || typeof m.speechMs !== "number") continue;
        utterances++;
        words += m.words;
        speechMs += m.speechMs;
        totalMs += m.totalMs ?? 0;
        pauseMs += m.pauses?.totalMs ?? 0;
        repWeighted += (m.repetitionRatio ?? 0) * m.words;
      }
      out.push({
        ymd,
        utterances,
        speakingSec: Math.round(speechMs / 1000),
        avgArticulationWpm: speechMs > 0 ? Math.round((words / (speechMs / 60000)) * 10) / 10 : 0,
        avgPauseRatio: totalMs > 0 ? Math.round((pauseMs / totalMs) * 1000) / 1000 : 0,
        repetitionRatio: words > 0 ? Math.round((repWeighted / words) * 1000) / 1000 : 0,
      });
    }
    const rows = deps.db
      .query<{ ymd: string; to_level: number }, []>("SELECT ymd, to_level FROM level_events ORDER BY id")
      .all();
    const lastByYmd = new Map<string, number>();
    for (const r of rows) lastByYmd.set(r.ymd, r.to_level);
    const history = [...lastByYmd.entries()]
      .map(([ymd, level]) => ({ ymd, level }))
      .sort((a, b) => (a.ymd < b.ymd ? -1 : 1));
    return { days: out, level: { current: deps.currentLevel(), history } };
  };
}
