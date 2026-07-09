import { json, parseJsonBody, exact, type RouteEntry } from "./http";
import { WHISPER_MODEL_IDS, type ModelDownloadManager, type WhisperModelId } from "../model-download";

export type SetupRoutesDeps = {
  modelDownload: ModelDownloadManager;
};

function isWhisperModelId(v: unknown): v is WhisperModelId {
  return typeof v === "string" && (WHISPER_MODEL_IDS as readonly string[]).includes(v);
}

/** GET/POST共通のビュー: ダウンロード状態 + 空き容量 + 導入済みモデル一覧 */
function statusView(deps: SetupRoutesDeps) {
  return {
    ...deps.modelDownload.getState(),
    diskFreeBytes: deps.modelDownload.diskFreeBytes(),
    models: deps.modelDownload.installedModels(),
  };
}

async function handleStart(req: Request, deps: SetupRoutesDeps): Promise<Response> {
  const parsed = await parseJsonBody<{ model?: unknown }>(req);
  if (!parsed.ok) return parsed.response;
  const { model } = parsed.body;
  if (!isWhisperModelId(model)) {
    return json({ error: `model must be one of: ${WHISPER_MODEL_IDS.join(", ")}` }, 400);
  }
  const result = deps.modelDownload.start(model);
  if (!result.ok) return json({ error: result.error }, result.status);
  // ダウンロード本体は fire-and-forget（result.done は await しない）— 進捗はポーリングで見る設計。
  return json(statusView(deps), 202);
}

export function makeSetupRoutes(deps: SetupRoutesDeps): RouteEntry[] {
  return [
    exact("GET", "/api/setup/status", () => json(statusView(deps))),
    exact("POST", "/api/setup/whisper-model", (req) => handleStart(req, deps)),
    exact("POST", "/api/setup/whisper-model/cancel", () => {
      deps.modelDownload.cancel();
      return json(statusView(deps));
    }),
  ];
}
