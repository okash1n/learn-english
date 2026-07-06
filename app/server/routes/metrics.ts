import type { MetricsSummary } from "../metrics-aggregate";
import { json, exact, type RouteEntry } from "./http";

export type MetricsRoutesDeps = {
  /** 直近N日の練習メトリクス集計（実体は metrics-aggregate.ts、テストはフェイク） */
  metricsSummary: (days: number) => MetricsSummary;
};

function handleMetricsSummary(url: URL, deps: MetricsRoutesDeps): Response {
  const raw = url.searchParams.get("days") ?? "14";
  const days = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isInteger(days) || days < 1 || days > 90) {
    return json({ error: "days must be an integer between 1 and 90" }, 400);
  }
  return json(deps.metricsSummary(days));
}

export function makeMetricsRoutes(deps: MetricsRoutesDeps): RouteEntry[] {
  return [exact("GET", "/api/metrics/summary", (_req, url) => handleMetricsSummary(url, deps))];
}
