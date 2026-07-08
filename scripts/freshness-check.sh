#!/usr/bin/env bash
# モデル鮮度チェック（Claude Code の SessionStart hook から実行される想定・軽量/オフラインのみ）。
# 重い調査（Web検索等）はここでは行わない — 検出と督促だけを行い、実調査はセッション内で行う。
# 完了記録: 鮮度レビュー実施後に `touch data/freshness.stamp`
set -uo pipefail
cd "$(dirname "$0")/.." || exit 0
OUT=""

# ① codex CLI と検証済みバージョンの乖離（毎回・オフライン・codex 未導入なら黙ってスキップ）
if command -v codex >/dev/null 2>&1; then
  tested=$(grep -o 'TESTED_CODEX_VERSION = "[^"]*"' app/server/providers/codex-app-server.ts 2>/dev/null | cut -d'"' -f2)
  actual=$(codex --version 2>/dev/null | awk '{print $NF}')
  if [ -n "$tested" ] && [ -n "$actual" ] && [ "$actual" != "$tested" ]; then
    OUT="${OUT}⚠ codex CLI(${actual}) が検証済みバージョン(${tested})とズレています。./scripts/check-codex-protocol.sh を実行し、問題なければ TESTED_CODEX_VERSION とプロトコルスナップショットを更新してください。\n"
  fi
fi

# ② 鮮度レビューの30日督促（スタンプ: data/freshness.stamp）
STAMP="data/freshness.stamp"
if [ ! -f "$STAMP" ] || [ -n "$(find "$STAMP" -mtime +30 2>/dev/null)" ]; then
  OUT="${OUT}📋 モデル鮮度レビューが30日以上未実施です。memory/model-freshness-policy の5項目（ローカルLLM推奨構成 / 推奨マトリクス / TESTED_CODEX_VERSION / claude CLI・SDK新版 / README内の具体モデル名）を確認し、完了後に \`touch data/freshness.stamp\` してください。\n"
fi

[ -n "$OUT" ] && printf "%b" "$OUT"
exit 0
