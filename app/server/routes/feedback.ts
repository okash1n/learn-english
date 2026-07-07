import { localYmd } from "../dates";
import { json, parseJsonBody, exact, type RouteEntry } from "./http";
import type { FeedbackRating, FeedbackStore } from "../feedback-store";

export type FeedbackRoutesDeps = {
  feedbackStore: FeedbackStore;
};

const RATINGS = ["hard", "just-right", "easy"] as const;

function isRating(v: unknown): v is FeedbackRating {
  return typeof v === "string" && (RATINGS as readonly string[]).includes(v);
}

/** undefined/null → null（未指定は null 扱い）、整数 → その値、それ以外 → undefined（不正） */
function asNullableInt(v: unknown): number | null | undefined {
  if (v === undefined || v === null) return null;
  return typeof v === "number" && Number.isInteger(v) ? v : undefined;
}

/** undefined/null → null、max 以下の文字列 → その値、それ以外 → undefined（不正） */
function asNullableStr(v: unknown, max: number): string | null | undefined {
  if (v === undefined || v === null) return null;
  return typeof v === "string" && v.length <= max ? v : undefined;
}

type FeedbackBody = {
  blockKind?: unknown; refId?: unknown; level?: unknown; stage?: unknown; rating?: unknown; note?: unknown;
};

async function handlePost(req: Request, deps: FeedbackRoutesDeps): Promise<Response> {
  const parsed = await parseJsonBody<FeedbackBody>(req);
  if (!parsed.ok) return parsed.response;
  const b = parsed.body;

  if (typeof b.blockKind !== "string" || !b.blockKind.trim() || b.blockKind.length > 40) {
    return json({ error: "blockKind must be a non-empty string of at most 40 characters" }, 400);
  }
  if (!isRating(b.rating)) {
    return json({ error: `rating must be one of ${RATINGS.join(", ")}` }, 400);
  }
  const note = b.note === undefined || b.note === null ? "" : b.note;
  if (typeof note !== "string" || note.length > 300) {
    return json({ error: "note must be a string of at most 300 characters" }, 400);
  }
  const refId = asNullableStr(b.refId, 120);
  if (refId === undefined) return json({ error: "refId must be a string of at most 120 characters or null" }, 400);
  const level = asNullableInt(b.level);
  if (level === undefined) return json({ error: "level must be an integer or null" }, 400);
  const stage = asNullableInt(b.stage);
  if (stage === undefined) return json({ error: "stage must be an integer or null" }, 400);

  deps.feedbackStore.save({
    blockKind: b.blockKind, refId, level, stage, rating: b.rating, note, ymd: localYmd(new Date()),
  });
  return json({ ok: true });
}

function handleList(deps: FeedbackRoutesDeps): Response {
  return json({ items: deps.feedbackStore.list() });
}

export function makeFeedbackRoutes(deps: FeedbackRoutesDeps): RouteEntry[] {
  return [
    exact("POST", "/api/feedback", (req) => handlePost(req, deps)),
    exact("GET", "/api/feedback", () => handleList(deps)),
  ];
}
