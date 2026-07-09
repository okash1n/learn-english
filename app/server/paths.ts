import path from "node:path";
import { mkdirSync } from "node:fs";
import { localYmd } from "./dates";

export type PathEnv = Record<string, string | undefined>;

export type ResolvedPaths = {
  REPO_ROOT: string;
  DATA_DIR: string;
  CLIENT_DIST_DIR: string;
  WHISPER_BIN_DIR: string;
  SESSIONS_DIR: string;
  RECORDINGS_DIR: string;
  LOGS_DIR: string;
  POC_STT_LOG_FILE: string;
  TTS_CACHE_DIR: string;
  MODELS_DIR: string;
  CONTENT_DIR: string;
  TOPICS_DIR: string;
  SCENARIOS_DIR: string;
  LISTENING_DIR: string;
  TOPIC_ASSETS_DIR: string;
  SENTENCES_FILE: string;
  BUNDLED_AUDIO_DIR: string;
  EXPLANATIONS_FILE: string;
  PROGRESS_DIR: string;
  CLAUDE_PRINT_DIR: string;
};

function overrideDir(env: PathEnv, key: string): string | null {
  const raw = env[key]?.trim();
  return raw ? path.resolve(raw) : null;
}

/**
 * 全パス解決を1箇所に集約した純関数（env→パスの計算のみ・fsに触れない）。index.ts が実行時に
 * Bun.env で1回呼び、テストは任意の env/repoRoot を渡して解決値を直接検証できる。
 *
 * Tauri Phase 2: 配布アプリは compile 済みバイナリを Tauri の externalBin として同梱するため、
 * import.meta.dir が /$bunfs/root のような仮想パスになり REPO_ROOT 起点の解決が壊れる。これを
 * env 二本立てで明示的に迂回する:
 * - SOLO_EIKAIWA_RESOURCES_DIR: 読み取り専用の同梱物（content・クライアントビルド・whisper-cli）の起点
 * - SOLO_EIKAIWA_DATA_DIR: 書き込み用（セッション・録音・ログ・キャッシュ・進捗・モデル等）の起点
 * 両方とも未設定時は repoRoot 起点（dev/LaunchAgent は現行どおり完全不変）。
 */
export function resolvePaths(env: PathEnv, repoRoot: string): ResolvedPaths {
  const resourcesOverride = overrideDir(env, "SOLO_EIKAIWA_RESOURCES_DIR");
  const dataOverride = overrideDir(env, "SOLO_EIKAIWA_DATA_DIR");

  const resourcesRoot = resourcesOverride ?? repoRoot;
  const dataDir = dataOverride ?? path.join(repoRoot, "data");

  // Tauri Phase 1: Caddy無しでも http://127.0.0.1:3111 で完結させるための直接配信先（vite build の出力）。
  // 未設定時は現行の app/client/dist（repoRoot 相対の入れ子）のまま。RESOURCES_DIR 設定時（sidecar 同梱物）
  // は Resources 直下がフラットな配置になる想定のため dist を直下に置く。
  const clientDistDir = resourcesOverride
    ? path.join(resourcesRoot, "dist")
    : path.join(repoRoot, "app", "client", "dist");

  // Tauri Phase 2 Task 2/5 で使う、同梱 whisper-cli + dylib の配置先。現状 dev では未使用
  // （whisper-cli は Bun.which() 経由の PATH 解決のまま）— このタスクでは定義のみ先行させる。
  const whisperBinDir = path.join(resourcesRoot, "whisper-bin");

  const logsDir = path.join(dataDir, "logs");
  const contentDir = path.join(resourcesRoot, "content");

  return {
    REPO_ROOT: repoRoot,
    DATA_DIR: dataDir,
    CLIENT_DIST_DIR: clientDistDir,
    WHISPER_BIN_DIR: whisperBinDir,
    SESSIONS_DIR: path.join(dataDir, "sessions"),
    RECORDINGS_DIR: path.join(dataDir, "recordings"),
    LOGS_DIR: logsDir,
    // Tauri Phase 1 Task 3: 録音→STT PoC（dev専用 /api/dev/poc-result）の追記先
    POC_STT_LOG_FILE: path.join(logsDir, "poc-stt.jsonl"),
    TTS_CACHE_DIR: path.join(dataDir, "tts-cache"),
    // モデルは初回DLで書き込み可能である必要がある。SOLO_EIKAIWA_DATA_DIR 設定時のみ DATA_DIR 配下
    // （Application Support 等・書き込み可能が保証される）に移し、未設定時は現行どおり repoRoot/models
    // のまま（挙動不変）。
    MODELS_DIR: dataOverride ? path.join(dataDir, "models") : path.join(repoRoot, "models"),
    CONTENT_DIR: contentDir,
    TOPICS_DIR: path.join(contentDir, "topics"),
    SCENARIOS_DIR: path.join(contentDir, "scenarios"),
    LISTENING_DIR: path.join(contentDir, "listening"),
    // v0.26 content-ladder wave3: topic×stage の prepPack/model talk 同梱JSON（topic-assets.ts の3層ルックアップ）
    TOPIC_ASSETS_DIR: path.join(contentDir, "topic-assets"),
    SENTENCES_FILE: path.join(contentDir, "sentences", "sentences300.json"),
    // 暗記例文300の同梱音声（リポジトリにコミット済み・読み取り専用のバンドルキャッシュ）
    BUNDLED_AUDIO_DIR: path.join(contentDir, "sentences", "audio"),
    // 暗記例文300の同梱解説（同上。都度生成はカスタム例文用のフォールバック）
    EXPLANATIONS_FILE: path.join(contentDir, "sentences", "explanations.json"),
    PROGRESS_DIR: path.join(dataDir, "progress"),
    // claude -p ランナーの固定作業ディレクトリ。--resume のセッション永続化が cwd にキーされるため、
    // mkdtemp 等で毎回変えず常にこのディレクトリを使う（providers/claude-print.ts）。
    CLAUDE_PRINT_DIR: path.join(dataDir, "claude-print"),
  };
}

const resolved = resolvePaths(Bun.env, path.resolve(import.meta.dir, "../.."));

export const REPO_ROOT = resolved.REPO_ROOT;
export const DATA_DIR = resolved.DATA_DIR;
export const CLIENT_DIST_DIR = resolved.CLIENT_DIST_DIR;
export const WHISPER_BIN_DIR = resolved.WHISPER_BIN_DIR;
export const SESSIONS_DIR = resolved.SESSIONS_DIR;
export const RECORDINGS_DIR = resolved.RECORDINGS_DIR;
export const LOGS_DIR = resolved.LOGS_DIR;
export const POC_STT_LOG_FILE = resolved.POC_STT_LOG_FILE;
export const TTS_CACHE_DIR = resolved.TTS_CACHE_DIR;
export const MODELS_DIR = resolved.MODELS_DIR;
export const CONTENT_DIR = resolved.CONTENT_DIR;
export const TOPICS_DIR = resolved.TOPICS_DIR;
export const SCENARIOS_DIR = resolved.SCENARIOS_DIR;
export const LISTENING_DIR = resolved.LISTENING_DIR;
export const TOPIC_ASSETS_DIR = resolved.TOPIC_ASSETS_DIR;
export const SENTENCES_FILE = resolved.SENTENCES_FILE;
export const BUNDLED_AUDIO_DIR = resolved.BUNDLED_AUDIO_DIR;
export const EXPLANATIONS_FILE = resolved.EXPLANATIONS_FILE;
export const PROGRESS_DIR = resolved.PROGRESS_DIR;
export const CLAUDE_PRINT_DIR = resolved.CLAUDE_PRINT_DIR;

export function ensureDirs(): void {
  for (const d of [SESSIONS_DIR, RECORDINGS_DIR, TTS_CACHE_DIR, MODELS_DIR, PROGRESS_DIR, CLAUDE_PRINT_DIR]) {
    mkdirSync(d, { recursive: true });
  }
}

export function sessionLogPath(date: Date): string {
  return path.join(SESSIONS_DIR, `${localYmd(date)}.jsonl`);
}
