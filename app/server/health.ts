import { existsSync } from "node:fs";
import { WHISPER_MODEL_PATH } from "./stt";
// package.json を静的 import することで compile（bun build --compile）時もバンドラーが値を
// インライン化する — 実行時に fs でファイルを読みに行かないため、Resources レイアウトに依存しない。
import pkg from "../package.json";

export type WhichFn = (bin: string) => string | null;

export type Health = {
  ok: boolean;
  whisper: boolean;
  ffmpeg: boolean;
  claude: boolean;
  ttsKey: boolean;
  modelFile: boolean;
  /** Tauri Phase 2: attach-first が別アプリの health に誤って接続していないかの身元確認用固定値 */
  app: "solo-eikaiwa";
  version: string;
};

export function checkHealth(opts: {
  whichFn?: WhichFn;
  env?: Record<string, string | undefined>;
  modelExists?: () => boolean;
} = {}): Health {
  const which = opts.whichFn ?? ((b: string) => Bun.which(b));
  const env = opts.env ?? Bun.env;
  const modelExists = opts.modelExists ?? (() => existsSync(WHISPER_MODEL_PATH));

  const whisper = Boolean(which("whisper-cli") ?? which("whisper-cpp"));
  const ffmpeg = Boolean(which("ffmpeg"));
  const claude = Boolean(which("claude"));
  const ttsKey = Boolean(env.OPENAI_API_KEY);
  const modelFile = modelExists();

  return {
    ok: whisper && ffmpeg && claude && modelFile,
    whisper, ffmpeg, claude, ttsKey, modelFile,
    app: "solo-eikaiwa",
    version: pkg.version,
  };
}
