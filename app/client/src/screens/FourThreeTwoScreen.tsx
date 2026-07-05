import { useRef, useState } from "react";
import { fetchAeFeedback, sendSessionEvent, sttUpload, type AeFeedback, type ContentItem } from "../api";
import { Recorder } from "../audio";
import { formatMmSs, useCountdown } from "../useCountdown";

const ROUNDS = [
  { seconds: 240, label: "Round 1（4分）", listener: "Listener: a colleague who doesn't know this topic yet." },
  { seconds: 180, label: "Round 2（3分）", listener: "New listener: your manager. Tell the same story, faster." },
  { seconds: 120, label: "Round 3（2分）", listener: "New listener: someone at a conference. Same story, 2 minutes." },
] as const;

type Phase = { kind: "round"; index: number } | { kind: "ae" } | { kind: "done" };
type RecState = "idle" | "recording" | "transcribing";

/** 4/3/2 流暢性ブロック: 同じ話を4分→(AE)→3分→2分。時間圧タイマー＋ラウンド間の遅延明示フィードバック */
export function FourThreeTwoScreen(props: { topic: ContentItem; onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>({ kind: "round", index: 0 });
  const [recState, setRecState] = useState<RecState>("idle");
  const [transcripts, setTranscripts] = useState<string[]>(["", "", ""]);
  // setState は非同期に反映されるため、finishRound が直後に読む用の同期ミラーを持つ
  // （これが無いと Round 1 直後の AE フィードバックが最後の発話を取りこぼす）
  const transcriptsRef = useRef<string[]>(["", "", ""]);
  const [ae, setAe] = useState<AeFeedback | null>(null);
  const [aeLoading, setAeLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const recorderRef = useRef(new Recorder());
  const timer = useCountdown(ROUNDS[0].seconds);

  const roundIndex = phase.kind === "round" ? phase.index : 0;

  async function toggleRecording() {
    setErrorMsg("");
    if (recState === "idle") {
      try {
        await recorderRef.current.start();
        setRecState("recording");
        if (!timer.running && !timer.expired) {
          timer.start();
          sendSessionEvent("round_start", { block: "four-three-two", round: roundIndex + 1 });
        }
      } catch (err) {
        setErrorMsg(`マイクにアクセスできません: ${err instanceof Error ? err.message : String(err)}`);
      }
      return;
    }
    if (recState !== "recording") return;
    try {
      setRecState("transcribing");
      const blob = await recorderRef.current.stop();
      const text = await sttUpload(blob);
      transcriptsRef.current[roundIndex] = [transcriptsRef.current[roundIndex], text]
        .filter(Boolean)
        .join(" ");
      setTranscripts([...transcriptsRef.current]);
      setRecState("idle");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setRecState("idle");
    }
  }

  async function finishRound() {
    if (recState === "recording") await toggleRecording();
    timer.pause();
    sendSessionEvent("round_end", { block: "four-three-two", round: roundIndex + 1 });
    if (roundIndex === 0) {
      setPhase({ kind: "ae" });
      setAeLoading(true);
      try {
        setAe(await fetchAeFeedback(transcriptsRef.current[0], props.topic.title));
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : String(err));
      } finally {
        setAeLoading(false);
      }
    } else if (roundIndex < ROUNDS.length - 1) {
      startRound(roundIndex + 1);
    } else {
      setPhase({ kind: "done" });
      props.onDone();
    }
  }

  function startRound(index: number) {
    setPhase({ kind: "round", index });
    timer.reset(ROUNDS[index].seconds);
  }

  if (phase.kind === "ae") {
    return (
      <div>
        <h3>フィードバック（読んだら Round 2 へ）</h3>
        {aeLoading && <p>コーチがフィードバックを書いています…</p>}
        {ae && (
          <div>
            {ae.praise && <p>👏 {ae.praise}</p>}
            <ul>
              {ae.items.map((item, i) => (
                <li key={i} style={{ marginBottom: "0.6rem" }}>
                  {item.quote && (
                    <div>
                      <s>{item.quote}</s> → <strong>{item.better}</strong> <em>({item.issue})</em>
                    </div>
                  )}
                  <div>{item.why_ja}</div>
                </li>
              ))}
            </ul>
          </div>
        )}
        {errorMsg && <p style={{ color: "crimson" }}>{errorMsg}</p>}
        <button onClick={() => startRound(1)} disabled={aeLoading} style={{ padding: "0.6rem 1.2rem" }}>
          Round 2 を始める（3分）
        </button>
      </div>
    );
  }

  if (phase.kind === "done") {
    return <p>4/3/2 完了！同じ話を3回、少しずつ速く話せました。</p>;
  }

  const round = ROUNDS[roundIndex];
  return (
    <div>
      <h3>{round.label} — {props.topic.title}</h3>
      <p style={{ color: "#666" }}>{round.listener}</p>
      <ul>
        {props.topic.hints.map((h, i) => (
          <li key={i}>{h}</li>
        ))}
      </ul>
      <p style={{ fontSize: "2rem", fontVariantNumeric: "tabular-nums" }}>
        ⏱ {formatMmSs(timer.remaining)} {timer.expired && "— 時間切れ！"}
      </p>
      <button onClick={toggleRecording} disabled={recState === "transcribing"} style={{ padding: "0.6rem 1.2rem" }}>
        {recState === "recording" ? "⏹ 録音を止める" : recState === "transcribing" ? "📝 文字起こし中…" : "🎙 話し始める"}
      </button>{" "}
      <button onClick={finishRound} disabled={recState === "transcribing"} style={{ padding: "0.6rem 1.2rem" }}>
        このラウンドを終える →
      </button>
      {errorMsg && <p style={{ color: "crimson" }}>{errorMsg}</p>}
      {transcripts[roundIndex] && (
        <p style={{ whiteSpace: "pre-wrap" }}>
          <strong>You:</strong> {transcripts[roundIndex]}
        </p>
      )}
    </div>
  );
}
