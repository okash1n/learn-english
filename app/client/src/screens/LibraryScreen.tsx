import { useEffect, useRef, useState } from "react";
import { fetchModelTalkLibrary, playTtsCached, type ModelTalkEntry } from "../api";
import { stopPlayback } from "../audio";
import { Banner } from "../ui/Banner";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

type State = "loading" | "ready" | "error";

/** 生成済みモデルトークの一覧（情報表示のみ）。本文確認と再再生ができる。 */
export function LibraryScreen() {
  const [state, setState] = useState<State>("loading");
  const [entries, setEntries] = useState<ModelTalkEntry[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [playingId, setPlayingId] = useState<number | null>(null);
  const aliveRef = useRef(true);
  const fetchedRef = useRef(false);

  useEffect(() => {
    aliveRef.current = true;
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      load();
    }
    return () => {
      aliveRef.current = false;
      stopPlayback();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setState("loading");
    setErrorMsg("");
    try {
      const list = await fetchModelTalkLibrary();
      if (!aliveRef.current) return;
      setEntries(list);
      setState("ready");
    } catch (err) {
      if (!aliveRef.current) return;
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setState("error");
    }
  }

  async function play(entry: ModelTalkEntry) {
    setErrorMsg("");
    setPlayingId(entry.id);
    try {
      await playTtsCached(entry.text);
    } catch (err) {
      if (!aliveRef.current) return;
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      if (aliveRef.current) setPlayingId(null);
    }
  }

  return (
    <div>
      <h3>📚 モデルトークライブラリ</h3>
      {state === "loading" && <p className="text-muted">読み込み中…</p>}
      {state === "error" && (
        <Banner kind="error" action={<Button onClick={load}>再試行</Button>}>{errorMsg}</Banner>
      )}
      {state === "ready" && entries.length === 0 && (
        <p className="text-muted">
          まだありません。4/3/2 の準備やシャドーイングでモデルトークを生成すると、ここに残ります。
        </p>
      )}
      {state === "ready" &&
        entries.map((e) => (
          <Card
            key={e.id}
            header={
              <>
                <Button
                  variant="ghost"
                  onClick={() => play(e)}
                  disabled={playingId !== null}
                  ariaLabel={`「${e.topicTitle || e.topicId}」を再生`}
                >
                  {playingId === e.id ? "🔊 再生中…" : "▶"}
                </Button>{" "}
                {e.topicTitle || e.topicId}{" "}
                <span className="text-sm text-muted">{e.createdAt.slice(0, 10)}</span>
              </>
            }
          >
            <details>
              <summary className="text-muted">本文</summary>
              <p className="reading-text">{e.text}</p>
            </details>
          </Card>
        ))}
      {state === "ready" && errorMsg && <Banner kind="error">{errorMsg}</Banner>}
    </div>
  );
}
