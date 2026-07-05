import { useEffect, useRef, useState } from "react";
import { converse, sttUpload, ttsFetch } from "../api";
import { playBlob, Recorder, stopPlayback } from "../audio";

type Turn = { role: "you" | "ai"; text: string };
type Status = "idle" | "recording" | "transcribing" | "thinking" | "speaking" | "error";

const LABELS: Record<Status, string> = {
  idle: "🎙 話す（クリックで録音開始）",
  recording: "⏹ 録音中…（クリックで送信）",
  transcribing: "📝 文字起こし中…",
  thinking: "🤔 考え中…",
  speaking: "🔊 再生中…",
  error: "🎙 もう一度話す",
};

/** 会話ループ画面。scenarioId を渡すとロールプレイモードになる（M1の自由会話UIを抽出したもの） */
export function FreeTalkScreen(props: { scenarioId?: string; onSessionId?: (id: string) => void }) {
  const [status, setStatus] = useState<Status>("idle");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const sessionIdRef = useRef<string | undefined>(undefined);
  const recorderRef = useRef(new Recorder());

  // 録音中/再生中に画面を離脱してもマイク・音声が解放されるよう、アンマウント時に停止する
  useEffect(() => () => { recorderRef.current.cancel(); stopPlayback(); }, []);

  async function onMainButton() {
    setErrorMsg("");
    if (status === "idle" || status === "error") {
      try {
        await recorderRef.current.start();
        setStatus("recording");
      } catch (err) {
        setErrorMsg(`マイクにアクセスできません: ${err instanceof Error ? err.message : String(err)}`);
        setStatus("error");
      }
      return;
    }
    if (status !== "recording") return;
    try {
      setStatus("transcribing");
      const blob = await recorderRef.current.stop();
      const text = await sttUpload(blob);
      if (!text) {
        setErrorMsg("音声を聞き取れませんでした。もう一度話してください。");
        setStatus("error");
        return;
      }
      setTurns((t) => [...t, { role: "you", text }]);

      setStatus("thinking");
      const { replyText, sessionId } = await converse(text, sessionIdRef.current, props.scenarioId);
      sessionIdRef.current = sessionId;
      props.onSessionId?.(sessionId);
      setTurns((t) => [...t, { role: "ai", text: replyText }]);

      setStatus("speaking");
      await playBlob(await ttsFetch(replyText));
      setStatus("idle");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }

  return (
    <div>
      <div style={{ margin: "1rem 0" }}>
        <button
          onClick={onMainButton}
          disabled={status === "transcribing" || status === "thinking" || status === "speaking"}
          style={{ fontSize: "1.1rem", padding: "0.8rem 1.4rem", cursor: "pointer" }}
        >
          {LABELS[status]}
        </button>
      </div>
      {errorMsg && <p style={{ color: "crimson" }}>{errorMsg}</p>}
      <section>
        {turns.map((t, i) => (
          <p key={i} style={{ whiteSpace: "pre-wrap" }}>
            <strong>{t.role === "you" ? "You" : "AI"}:</strong> {t.text}
          </p>
        ))}
      </section>
    </div>
  );
}
