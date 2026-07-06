import { BLOCK_KINDS } from "../menu";
import type { ProgressStore, XpKind } from "../progress-store";
import { json, parseJsonBody, exact, type RouteEntry } from "./http";

export type ProgressRoutesDeps = {
  practiceDays: () => string[];
  /** レベル/XPの進行状態（実体は progress-store.ts、テストはフェイク） */
  progressStore: ProgressStore;
  /** 明示的なレベル変更（accept/set）後に当日の通しメニューキャッシュを無効化する（decline では呼ばない） */
  invalidateMenuCache: () => void;
};

async function handleProgressXp(req: Request, deps: ProgressRoutesDeps): Promise<Response> {
  const parsed = await parseJsonBody<{ kind?: unknown; amount?: unknown; attemptId?: unknown }>(req);
  if (!parsed.ok) return parsed.response;
  const { kind, amount, attemptId } = parsed.body;
  // HTTP経由で受けるのは block のみ（srs-grade はサーバ内部、placement は Phase C のサーバ内部付与）
  if (kind !== "block") return json({ error: "kind must be \"block\"" }, 400);
  if (typeof amount !== "number") return json({ error: "amount must be a number" }, 400);
  if (attemptId !== undefined && !Number.isInteger(attemptId)) {
    return json({ error: "attemptId must be an integer" }, 400);
  }
  const s = deps.progressStore.addXp(kind as XpKind, amount, attemptId !== undefined ? { attemptId } : {});
  if (!s) return json({ error: "invalid amount for kind" }, 400);
  return json(s);
}

async function handleProgressBlockStart(req: Request, deps: ProgressRoutesDeps): Promise<Response> {
  const parsed = await parseJsonBody<{ kind?: unknown }>(req);
  if (!parsed.ok) return parsed.response;
  const kind = parsed.body.kind;
  if (typeof kind !== "string" || !(BLOCK_KINDS as readonly string[]).includes(kind)) {
    return json({ error: `kind must be one of: ${BLOCK_KINDS.join(", ")}` }, 400);
  }
  return json(deps.progressStore.blockStart(kind));
}

const LEVEL_ACTIONS = ["accept", "decline", "set"] as const;

async function handleProgressLevel(req: Request, deps: ProgressRoutesDeps): Promise<Response> {
  const parsed = await parseJsonBody<{ action?: unknown; level?: unknown }>(req);
  if (!parsed.ok) return parsed.response;
  const { action, level } = parsed.body;
  if (!(LEVEL_ACTIONS as readonly string[]).includes(action as string)) {
    return json({ error: `action must be one of: ${LEVEL_ACTIONS.join(", ")}` }, 400);
  }
  if (level !== undefined && typeof level !== "number") return json({ error: "level must be a number" }, 400);
  const r = deps.progressStore.levelAction(action as "accept" | "decline" | "set", level as number | undefined);
  if (!r) {
    return json({ error: action === "set" ? "level must be an integer between 1 and 999" : "no active proposal" }, 400);
  }
  // 明示的なレベル変更（accept/set）で実際にレベルが動いたときだけ当日メニューを再構築する。
  // decline や同一レベルへの set は levelChanged=false なので無効化しない。
  if (r.levelChanged) deps.invalidateMenuCache();
  return json(r.summary);
}

export function makeProgressRoutes(deps: ProgressRoutesDeps): RouteEntry[] {
  return [
    exact("GET", "/api/progress/days", () => json({ days: deps.practiceDays() })),
    exact("GET", "/api/progress/summary", () => json(deps.progressStore.getSummary())),
    exact("POST", "/api/progress/xp", (req) => handleProgressXp(req, deps)),
    exact("POST", "/api/progress/block-start", (req) => handleProgressBlockStart(req, deps)),
    exact("POST", "/api/progress/level", (req) => handleProgressLevel(req, deps)),
  ];
}
