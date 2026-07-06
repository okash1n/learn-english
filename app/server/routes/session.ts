import { appendEvent } from "../session-log";
import { json, parseJsonBody, exact, type RouteEntry } from "./http";

export type SessionRoutesDeps = {
  logFile: () => string;
};

const BLOCK_EVENT_TYPES = ["block_start", "block_end", "round_start", "round_end"] as const;
type BlockEventType = (typeof BLOCK_EVENT_TYPES)[number];

async function handleSessionEvent(req: Request, deps: SessionRoutesDeps): Promise<Response> {
  const parsed = await parseJsonBody<{ type?: string; sessionId?: string; meta?: Record<string, unknown> }>(req);
  if (!parsed.ok) return parsed.response;
  const t = parsed.body.type;
  if (!t || !(BLOCK_EVENT_TYPES as readonly string[]).includes(t)) {
    return json({ error: `type must be one of: ${BLOCK_EVENT_TYPES.join(", ")}` }, 400);
  }
  appendEvent(deps.logFile(), {
    ts: new Date().toISOString(),
    type: t as BlockEventType,
    sessionId: parsed.body.sessionId ?? "pending",
    meta: parsed.body.meta,
  });
  return json({ ok: true });
}

/**
 * ボディは任意（後方互換: 空ボディ・不正JSONでも従来どおり sessionId 無しとして扱い 200 を返す）。
 * クライアント側で mint したアプリレベルの session UUID を受け取り、以後のライフサイクル/
 * ブロック/ラウンドイベントと突き合わせられるようにする。
 */
async function handleSessionStart(req: Request, deps: SessionRoutesDeps): Promise<Response> {
  let sessionId: string | undefined;
  try {
    const body = (await req.json()) as { sessionId?: string };
    if (typeof body?.sessionId === "string" && body.sessionId) sessionId = body.sessionId;
  } catch {
    // ボディなし・不正JSONは従来どおり（sessionId無し）として扱う
  }
  appendEvent(deps.logFile(), {
    ts: new Date().toISOString(), type: "session_start", sessionId: sessionId ?? "pending",
  });
  return json({ ok: true });
}

async function handleSessionEnd(req: Request, deps: SessionRoutesDeps): Promise<Response> {
  const parsed = await parseJsonBody<{ sessionId?: string }>(req);
  if (!parsed.ok) return parsed.response;
  appendEvent(deps.logFile(), {
    ts: new Date().toISOString(), type: "session_end", sessionId: parsed.body.sessionId ?? "unknown",
  });
  return json({ ok: true });
}

export function makeSessionRoutes(deps: SessionRoutesDeps): RouteEntry[] {
  return [
    exact("POST", "/api/session/start", (req) => handleSessionStart(req, deps)),
    exact("POST", "/api/session/end", (req) => handleSessionEnd(req, deps)),
    exact("POST", "/api/session/event", (req) => handleSessionEvent(req, deps)),
  ];
}
