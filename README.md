# learn-english

検証済みの第二言語習得（SLA）研究に基づいて、英会話の独習を毎日回すためのローカルファーストなアプリ。
A local-first, research-grounded English speaking practice app for daily self-study on macOS (Japanese UI).

個人開発のツールを公開しているものです。Issue / PR は歓迎しますが、対応は保証しません。お題・シナリオ（`content/`）はサンプルとして同梱しているので、自分の仕事・関心に合わせて差し替えて使ってください。

## 特徴

- **音声ループがローカル中心**: ブラウザ録音 → [whisper.cpp](https://github.com/ggerganov/whisper.cpp)（ローカルSTT・音声は外部送信されない）→ Claude（会話相手・コーチ）→ OpenAI TTS（キー未設定時は macOS `say` にフォールバック）
- **研究ベースのセッション設計**: 4/3/2 流暢性トレーニング（準備フェーズ → 時間圧ラウンド → ラウンド間の明示的フィードバック）、実務ロールプレイ、シャドーイング、振り返り。方法論の根拠は3本のディープリサーチレポート（[docs/research/](docs/research/)、主要クレームは原典まで3票の敵対的検証済み）と[設計ドキュメント](docs/superpowers/specs/2026-07-05-learn-english-system-design.md) §5
- **コンテンツは Markdown を置くだけ**: お題（`content/topics/`）とロールプレイシナリオ（`content/scenarios/`）は frontmatter 付き Markdown。追加すれば自動でローテーションに入る
- **プライバシー**: 学習データ（録音・トランスクリプト・進捗・キャッシュ）はすべて `data/` のローカルファイルで、**リポジトリには一切コミットされない**

## 前提条件

- macOS（Apple Silicon 推奨）
- [Bun](https://bun.sh) ≥ 1.3
- Homebrew（whisper-cpp / ffmpeg の導入に使用）
- [Claude Code](https://claude.com/claude-code) CLI にログイン済みであること（対話AIは Claude Agent SDK 経由で、あなたの Claude Pro/Max サブスクリプションを使います。Anthropic API キーは不要）
- 任意: OpenAI API キー（高品質TTS用。なければ macOS `say` で動作）
- Chrome 系ブラウザ推奨（録音が audio/webm 固定のため。Safari 非対応）

## セットアップ（初回のみ）

```bash
./scripts/setup.sh   # brew 依存・whisperモデル(約1.6GB)DL・bun install
```

任意で `app/.env` に OpenAI キーを設定（環境変数参照も可）:

```
OPENAI_API_KEY=$YOUR_OPENAI_KEY_ENV_VAR
```

## 起動

```bash
cd app && bun run dev        # APIサーバ :3111（127.0.0.1 のみ、外部非公開）
cd app/client && bun run dev # UI :5173（/api をプロキシ）
```

ブラウザで http://localhost:5173 を開く。

## 使い方

- **クイックドリル（5〜10分）** — 日々のデフォルト。音読ウォームアップ / 4/3/2ミニ / ロールプレイ / シャドーイングの単品ドリル。研究上、総学習時間より「頻度と完了」が効くため、短くても毎日が正解
- **強化セッション（60分 / 30分・週1〜2回おすすめ）** — 5ブロック通し: 音読ウォームアップ → 4/3/2 流暢性トレーニング → 実務ロールプレイ → シャドーイング → 振り返り
- **自由会話** — AIと英語でただ話す

お題・シナリオの追加は Markdown ファイル1枚（frontmatter: `id` / `kind` / `title` / `title_ja`、本文の `- ` 行がヒント。既存ファイル参照）。選択は least-recently-used で自動ローテーションします。

## テスト

```bash
cd app && bun test           # サーバユニット/契約テスト
cd app && bun run typecheck
cd app/client && bun run build
./scripts/smoke-stt.sh       # STT 実機スモーク
```

## データとプライバシー

- `data/` 以下（セッションログ・録音・進捗・TTSキャッシュ）は**すべてローカル専用**（gitignore 済み）
- 外部に出るもの: 発話の**テキスト**が Claude（Anthropic）へ、AI応答テキストが OpenAI TTS へ（キー設定時のみ）。音声データ自体はマシンから出ません
- サーバは 127.0.0.1 バインドのみ

## ドキュメント

- [設計ドキュメント](docs/superpowers/specs/2026-07-05-learn-english-system-design.md) — システム構成と学習方法論（10原則）
- [リサーチレポート](docs/research/) — 流暢性・語彙・チャンク・シャドーイング・AI会話・継続/習慣化の検証済み知見
- [実装計画](docs/superpowers/plans/) — 各マイルストーンの実装計画

## ロードマップ

- **M3**: チャンクSRS（産出型リトリーバル・分散復習・セッションからの自動収集）、話し言葉チャンク集
- **M4**: スピーキングメトリクス（調音速度・節内ポーズ・繰り返し頻度）と進捗ダッシュボード
- **M5**: 月次アセスメント・コンテンツ生成パイプライン

## ライセンス

[MIT](LICENSE)
