import { useState } from "react";
import { fetchModelTalk, ttsFetch, type ContentItem } from "../api";
import { playBlob } from "../audio";

type State = "init" | "loading" | "ready" | "playing" | "error";

/** モデルトークをTTSで聞きながら重ねて音読するシャドーイングブロック（知覚ドリル） */
export function ShadowingScreen(props: { topic: ContentItem }) {
  const [state, setState] = useState<State>("init");
  const [text, setText] = useState("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  async function prepare() {
    setState("loading");
    setErrorMsg("");
    try {
      const talk = await fetchModelTalk(props.topic.id);
      setText(talk);
      setAudioBlob(await ttsFetch(talk));
      setState("ready");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setState("error");
    }
  }

  async function play() {
    if (!audioBlob) return;
    setState("playing");
    try {
      await playBlob(audioBlob);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
    setState("ready");
  }

  return (
    <div>
      <p style={{ color: "#666" }}>
        音声に少し遅れてかぶせるように声に出して繰り返します（シャドーイング）。まず1回聞くだけでもOK。
      </p>
      {(state === "init" || state === "error") && (
        <button onClick={prepare} style={{ padding: "0.6rem 1.2rem" }}>モデルトークを生成する</button>
      )}
      {state === "loading" && <p>コーチがモデルトークを書いています…</p>}
      {(state === "ready" || state === "playing") && (
        <div>
          <button onClick={play} disabled={state === "playing"} style={{ padding: "0.6rem 1.2rem" }}>
            {state === "playing" ? "🔊 再生中…" : "▶ 再生（何度でも）"}
          </button>
          <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.8 }}>{text}</p>
        </div>
      )}
      {errorMsg && <p style={{ color: "crimson" }}>{errorMsg}</p>}
    </div>
  );
}
