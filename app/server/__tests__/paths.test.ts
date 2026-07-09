import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  ensureDirs, REPO_ROOT, DATA_DIR, CLIENT_DIST_DIR, WHISPER_BIN_DIR,
  SESSIONS_DIR, RECORDINGS_DIR, LOGS_DIR, POC_STT_LOG_FILE, TTS_CACHE_DIR, MODELS_DIR,
  CONTENT_DIR, TOPICS_DIR, SCENARIOS_DIR, LISTENING_DIR, TOPIC_ASSETS_DIR,
  SENTENCES_FILE, BUNDLED_AUDIO_DIR, EXPLANATIONS_FILE, PROGRESS_DIR, CLAUDE_PRINT_DIR,
  sessionLogPath, resolvePaths,
} from "../paths";
import { CODEX_HOME_DIR } from "../codex-auth";

describe("paths", () => {
  test("sessionLogPath は SESSIONS_DIR 配下の YYYY-MM-DD.jsonl を返す", () => {
    const p = sessionLogPath(new Date("2026-07-05T12:34:56Z"));
    expect(p).toBe(path.join(SESSIONS_DIR, "2026-07-05.jsonl"));
  });

  test("ensureDirs 後は全データディレクトリが存在する", () => {
    ensureDirs();
    for (const d of [SESSIONS_DIR, RECORDINGS_DIR, TTS_CACHE_DIR, MODELS_DIR, PROGRESS_DIR, CLAUDE_PRINT_DIR]) {
      expect(existsSync(d)).toBe(true);
    }
  });

  // env 未設定時、実際にモジュールが export する値が現行どおり REPO_ROOT 相対であることのピン留め
  // （Tauri Phase 2 で env 二本立てを導入しても、dev/LaunchAgent の挙動は完全不変であることの保証）。
  test("DATA_DIR は REPO_ROOT/data", () => {
    expect(DATA_DIR).toBe(path.join(REPO_ROOT, "data"));
  });

  test("CLIENT_DIST_DIR は REPO_ROOT/app/client/dist", () => {
    expect(CLIENT_DIST_DIR).toBe(path.join(REPO_ROOT, "app", "client", "dist"));
  });

  test("MODELS_DIR は REPO_ROOT/models（DATA_DIR配下ではない）", () => {
    expect(MODELS_DIR).toBe(path.join(REPO_ROOT, "models"));
  });

  test("CONTENT_DIR は REPO_ROOT/content", () => {
    expect(CONTENT_DIR).toBe(path.join(REPO_ROOT, "content"));
  });

  test("TOPICS_DIR は CONTENT_DIR/topics", () => {
    expect(TOPICS_DIR).toBe(path.join(CONTENT_DIR, "topics"));
  });

  test("SCENARIOS_DIR は CONTENT_DIR/scenarios", () => {
    expect(SCENARIOS_DIR).toBe(path.join(CONTENT_DIR, "scenarios"));
  });

  test("LISTENING_DIR は CONTENT_DIR/listening", () => {
    expect(LISTENING_DIR).toBe(path.join(CONTENT_DIR, "listening"));
  });

  test("TOPIC_ASSETS_DIR は CONTENT_DIR/topic-assets", () => {
    expect(TOPIC_ASSETS_DIR).toBe(path.join(CONTENT_DIR, "topic-assets"));
  });

  test("SENTENCES_FILE / BUNDLED_AUDIO_DIR / EXPLANATIONS_FILE は CONTENT_DIR/sentences 配下", () => {
    expect(SENTENCES_FILE).toBe(path.join(CONTENT_DIR, "sentences", "sentences300.json"));
    expect(BUNDLED_AUDIO_DIR).toBe(path.join(CONTENT_DIR, "sentences", "audio"));
    expect(EXPLANATIONS_FILE).toBe(path.join(CONTENT_DIR, "sentences", "explanations.json"));
  });

  test("SESSIONS_DIR / RECORDINGS_DIR / LOGS_DIR / TTS_CACHE_DIR は DATA_DIR 配下", () => {
    expect(SESSIONS_DIR).toBe(path.join(DATA_DIR, "sessions"));
    expect(RECORDINGS_DIR).toBe(path.join(DATA_DIR, "recordings"));
    expect(LOGS_DIR).toBe(path.join(DATA_DIR, "logs"));
    expect(TTS_CACHE_DIR).toBe(path.join(DATA_DIR, "tts-cache"));
  });

  test("POC_STT_LOG_FILE は LOGS_DIR/poc-stt.jsonl", () => {
    expect(POC_STT_LOG_FILE).toBe(path.join(LOGS_DIR, "poc-stt.jsonl"));
  });

  test("PROGRESS_DIR は DATA_DIR/progress", () => {
    expect(PROGRESS_DIR).toBe(path.join(DATA_DIR, "progress"));
  });

  test("CLAUDE_PRINT_DIR は DATA_DIR/claude-print", () => {
    expect(CLAUDE_PRINT_DIR).toBe(path.join(DATA_DIR, "claude-print"));
  });

  test("WHISPER_BIN_DIR は REPO_ROOT/whisper-bin（Tauri Phase 2 Task 2/5 で使用予定・現状未使用）", () => {
    expect(WHISPER_BIN_DIR).toBe(path.join(REPO_ROOT, "whisper-bin"));
  });

  test("CODEX_HOME_DIR（codex-auth.ts）は DATA_DIR 配下 — env 二本立ての書き込みセットに含まれる", () => {
    expect(CODEX_HOME_DIR).toBe(path.join(DATA_DIR, "codex-home"));
  });
});

describe("resolvePaths: env 未設定時は repoRoot 相対で完全不変", () => {
  const repoRoot = "/repo";

  test("読み取り専用・書き込み双方の起点が repoRoot になる", () => {
    const p = resolvePaths({}, repoRoot);
    expect(p.REPO_ROOT).toBe(repoRoot);
    expect(p.DATA_DIR).toBe(path.join(repoRoot, "data"));
    expect(p.CLIENT_DIST_DIR).toBe(path.join(repoRoot, "app", "client", "dist"));
    expect(p.WHISPER_BIN_DIR).toBe(path.join(repoRoot, "whisper-bin"));
    expect(p.MODELS_DIR).toBe(path.join(repoRoot, "models"));
    expect(p.CONTENT_DIR).toBe(path.join(repoRoot, "content"));
    expect(p.TOPICS_DIR).toBe(path.join(repoRoot, "content", "topics"));
    expect(p.SCENARIOS_DIR).toBe(path.join(repoRoot, "content", "scenarios"));
    expect(p.LISTENING_DIR).toBe(path.join(repoRoot, "content", "listening"));
    expect(p.TOPIC_ASSETS_DIR).toBe(path.join(repoRoot, "content", "topic-assets"));
    expect(p.SENTENCES_FILE).toBe(path.join(repoRoot, "content", "sentences", "sentences300.json"));
    expect(p.BUNDLED_AUDIO_DIR).toBe(path.join(repoRoot, "content", "sentences", "audio"));
    expect(p.EXPLANATIONS_FILE).toBe(path.join(repoRoot, "content", "sentences", "explanations.json"));
    expect(p.SESSIONS_DIR).toBe(path.join(repoRoot, "data", "sessions"));
    expect(p.RECORDINGS_DIR).toBe(path.join(repoRoot, "data", "recordings"));
    expect(p.LOGS_DIR).toBe(path.join(repoRoot, "data", "logs"));
    expect(p.POC_STT_LOG_FILE).toBe(path.join(repoRoot, "data", "logs", "poc-stt.jsonl"));
    expect(p.TTS_CACHE_DIR).toBe(path.join(repoRoot, "data", "tts-cache"));
    expect(p.PROGRESS_DIR).toBe(path.join(repoRoot, "data", "progress"));
    expect(p.CLAUDE_PRINT_DIR).toBe(path.join(repoRoot, "data", "claude-print"));
  });

  test("空文字/空白のみの env 値は未設定として扱う", () => {
    const p = resolvePaths({ SOLO_EIKAIWA_RESOURCES_DIR: "", SOLO_EIKAIWA_DATA_DIR: "   " }, repoRoot);
    expect(p.CONTENT_DIR).toBe(path.join(repoRoot, "content"));
    expect(p.DATA_DIR).toBe(path.join(repoRoot, "data"));
  });
});

describe("resolvePaths: SOLO_EIKAIWA_RESOURCES_DIR 設定時（読み取り専用セットのみ再ルート）", () => {
  const repoRoot = "/repo";
  const resources = "/Applications/solo-eikaiwa.app/Contents/Resources";

  test("content 系・CLIENT_DIST_DIR・WHISPER_BIN_DIR は RESOURCES_DIR 配下、書き込み系は repoRoot のまま", () => {
    const p = resolvePaths({ SOLO_EIKAIWA_RESOURCES_DIR: resources }, repoRoot);
    expect(p.CONTENT_DIR).toBe(path.join(resources, "content"));
    expect(p.TOPICS_DIR).toBe(path.join(resources, "content", "topics"));
    expect(p.SENTENCES_FILE).toBe(path.join(resources, "content", "sentences", "sentences300.json"));
    expect(p.CLIENT_DIST_DIR).toBe(path.join(resources, "dist"));
    expect(p.WHISPER_BIN_DIR).toBe(path.join(resources, "whisper-bin"));
    // 書き込み系（DATA_DIR 未設定）は repoRoot のまま — RESOURCES_DIR の影響を受けない
    expect(p.DATA_DIR).toBe(path.join(repoRoot, "data"));
    expect(p.MODELS_DIR).toBe(path.join(repoRoot, "models"));
    expect(p.SESSIONS_DIR).toBe(path.join(repoRoot, "data", "sessions"));
  });
});

describe("resolvePaths: SOLO_EIKAIWA_DATA_DIR 設定時（書き込みセットのみ再ルート・MODELSも移動）", () => {
  const repoRoot = "/repo";
  const appSupport = "/Users/tester/Library/Application Support/solo-eikaiwa";

  test("DATA_DIR とその子・MODELS_DIR が DATA_DIR 配下に移る、読み取り専用系は repoRoot のまま", () => {
    const p = resolvePaths({ SOLO_EIKAIWA_DATA_DIR: appSupport }, repoRoot);
    expect(p.DATA_DIR).toBe(appSupport);
    expect(p.SESSIONS_DIR).toBe(path.join(appSupport, "sessions"));
    expect(p.RECORDINGS_DIR).toBe(path.join(appSupport, "recordings"));
    expect(p.LOGS_DIR).toBe(path.join(appSupport, "logs"));
    expect(p.POC_STT_LOG_FILE).toBe(path.join(appSupport, "logs", "poc-stt.jsonl"));
    expect(p.TTS_CACHE_DIR).toBe(path.join(appSupport, "tts-cache"));
    expect(p.PROGRESS_DIR).toBe(path.join(appSupport, "progress"));
    expect(p.CLAUDE_PRINT_DIR).toBe(path.join(appSupport, "claude-print"));
    // モデルは書き込み可能性が必須なため、DATA_DIR override 時だけこちらに追従する
    expect(p.MODELS_DIR).toBe(path.join(appSupport, "models"));
    // 読み取り専用系（RESOURCES_DIR 未設定）は repoRoot のまま
    expect(p.CONTENT_DIR).toBe(path.join(repoRoot, "content"));
    expect(p.CLIENT_DIST_DIR).toBe(path.join(repoRoot, "app", "client", "dist"));
    expect(p.WHISPER_BIN_DIR).toBe(path.join(repoRoot, "whisper-bin"));
  });
});

describe("resolvePaths: 両方設定時は独立して再ルートされる", () => {
  test("RESOURCES/DATA がそれぞれ別ディレクトリに解決する", () => {
    const p = resolvePaths(
      { SOLO_EIKAIWA_RESOURCES_DIR: "/res", SOLO_EIKAIWA_DATA_DIR: "/data" },
      "/repo",
    );
    expect(p.CONTENT_DIR).toBe(path.join("/res", "content"));
    expect(p.WHISPER_BIN_DIR).toBe(path.join("/res", "whisper-bin"));
    expect(p.DATA_DIR).toBe("/data");
    expect(p.MODELS_DIR).toBe(path.join("/data", "models"));
    expect(p.SESSIONS_DIR).toBe(path.join("/data", "sessions"));
  });

  test("相対パスは repoRoot ではなく実行時 cwd 基準で絶対化される（path.resolve）", () => {
    const p = resolvePaths(
      { SOLO_EIKAIWA_RESOURCES_DIR: "relative-resources", SOLO_EIKAIWA_DATA_DIR: "relative-data" },
      "/repo",
    );
    expect(p.CONTENT_DIR).toBe(path.join(path.resolve("relative-resources"), "content"));
    expect(p.DATA_DIR).toBe(path.resolve("relative-data"));
  });
});
