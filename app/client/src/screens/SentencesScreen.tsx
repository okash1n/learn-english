import { useEffect, useRef, useState } from "react";
import {
  fetchSentenceQueue, fetchSentences, gradeSentence, playTtsCached,
  type SentenceItem,
} from "../api";
import { stopPlayback } from "../audio";
import { Banner } from "../ui/Banner";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

const DOMAIN_LABEL: Record<SentenceItem["domain"], string> = {
  daily: "日常", business: "ビジネス", it: "IT",
};
const NEW_PER_DAY = 10;

type Tab = "practice" | "browse";
type Phase = "prompt" | "answer";
type LoadState = "loading" | "ready" | "error";

function localYmd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 練習タブ: ja→（声に出す）→答えを見る→自動再生→自己評価、の産出リトリーバルフロー */
function PracticeTab() {
  const [state, setState] = useState<LoadState>("loading");
  const [queue, setQueue] = useState<SentenceItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("prompt");
  const [gradedCount, setGradedCount] = useState(0);
  const [dueTomorrow, setDueTomorrow] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [busy, setBusy] = useState(false);
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
      const q = await fetchSentenceQueue(NEW_PER_DAY);
      if (!aliveRef.current) return;
      setQueue(q);
      setIdx(0);
      setPhase("prompt");
      setState("ready");
    } catch (err) {
      if (!aliveRef.current) return;
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setState("error");
    }
  }

  const current = queue[idx];
  const done = state === "ready" && !current;

  useEffect(() => {
    // 完了画面で「明日の復習予定数」を出す（情報表示のみ・失敗は無視）
    if (!done || dueTomorrow !== null) return;
    fetchSentences()
      .then((all) => {
        if (!aliveRef.current) return;
        const t = new Date();
        t.setDate(t.getDate() + 1);
        const tomorrow = localYmd(t);
        setDueTomorrow(all.filter((s) => s.srs && s.srs.due <= tomorrow).length);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  async function reveal() {
    setPhase("answer");
    try {
      await playTtsCached(current.en);
    } catch {
      // 音声は補助 — 再生失敗でフローを止めない（🔊で再試行できる）
    }
  }

  async function grade(g: "good" | "soso" | "bad") {
    setBusy(true);
    setErrorMsg("");
    try {
      await gradeSentence(current.no, g);
      if (!aliveRef.current) return;
      stopPlayback();
      setGradedCount((n) => n + 1);
      setIdx((i) => i + 1);
      setPhase("prompt");
    } catch (err) {
      if (!aliveRef.current) return;
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      if (aliveRef.current) setBusy(false);
    }
  }

  if (state === "loading") return <p className="text-muted">読み込み中…</p>;
  if (state === "error") {
    return <Banner kind="error" action={<Button onClick={load}>再試行</Button>}>{errorMsg}</Banner>;
  }
  if (done) {
    return (
      <Card>
        <p className="sentence-done">今日の分は完了です（{gradedCount}文）</p>
        <p className="text-muted">
          {dueTomorrow === null ? "" : `明日の復習予定: ${dueTomorrow}文。`}
          思い出して声に出すことが定着の近道です。また明日。
        </p>
      </Card>
    );
  }
  return (
    <div className="stack">
      <p className="text-sm text-muted">残り {queue.length - idx} 文（うち評価済み {gradedCount}）</p>
      <Card>
        <p className="sentence-ja">{current.ja}</p>
        <p className="text-sm text-muted">{current.note}</p>
        {phase === "prompt" && (
          <>
            <p className="text-muted">↑ を英語で、まず声に出して言ってみる</p>
            <div className="round-actions">
              <Button variant="primary" size="lg" onClick={reveal}>答えを見る</Button>
            </div>
          </>
        )}
        {phase === "answer" && (
          <>
            <p className="sentence-en">{current.en}</p>
            <div className="round-actions">
              <Button variant="ghost" onClick={() => playTtsCached(current.en).catch(() => {})} ariaLabel="もう一度再生">
                🔊 もう一度聞く
              </Button>
            </div>
            <div className="grade-row">
              <Button onClick={() => grade("good")} disabled={busy}>✅ 言えた</Button>
              <Button onClick={() => grade("soso")} disabled={busy}>😕 あいまい</Button>
              <Button onClick={() => grade("bad")} disabled={busy}>❌ 出てこない</Button>
            </div>
          </>
        )}
        {errorMsg && <Banner kind="error">{errorMsg}</Banner>}
      </Card>
    </div>
  );
}

/** 一覧タブ: domainフィルタ + カテゴリ見出しでのブラウズ。SRS状態は情報表示のみ */
function BrowseTab() {
  const [state, setState] = useState<LoadState>("loading");
  const [items, setItems] = useState<SentenceItem[]>([]);
  const [filter, setFilter] = useState<"all" | SentenceItem["domain"]>("all");
  const [playingNo, setPlayingNo] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
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
      const all = await fetchSentences();
      if (!aliveRef.current) return;
      setItems(all);
      setState("ready");
    } catch (err) {
      if (!aliveRef.current) return;
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setState("error");
    }
  }

  async function play(s: SentenceItem) {
    setPlayingNo(s.no);
    try {
      await playTtsCached(s.en);
    } catch (err) {
      if (!aliveRef.current) return;
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      if (aliveRef.current) setPlayingNo(null);
    }
  }

  if (state === "loading") return <p className="text-muted">読み込み中…</p>;
  if (state === "error") {
    return <Banner kind="error" action={<Button onClick={load}>再試行</Button>}>{errorMsg}</Banner>;
  }
  const shown = filter === "all" ? items : items.filter((s) => s.domain === filter);
  const categories = [...new Map(shown.map((s) => [s.category_no, s.category])).entries()]
    .sort((a, b) => a[0] - b[0]);
  return (
    <div className="stack">
      <div className="filter-row">
        {(["all", "daily", "business", "it"] as const).map((f) => (
          <button
            key={f}
            className={`filter-chip${filter === f ? " is-active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "すべて" : DOMAIN_LABEL[f]}
          </button>
        ))}
      </div>
      {errorMsg && <Banner kind="error">{errorMsg}</Banner>}
      {categories.map(([catNo, catName]) => (
        <Card key={catNo} header={`${catNo}. ${catName}`}>
          {shown.filter((s) => s.category_no === catNo).map((s) => (
            <div key={s.no} className="sentence-row">
              <Button
                variant="ghost"
                onClick={() => play(s)}
                disabled={playingNo !== null}
                ariaLabel={`No.${s.no} を再生`}
              >
                {playingNo === s.no ? "🔊" : "▶"}
              </Button>
              <div className="sentence-body">
                <span className="sentence-en">{s.en}</span>
                <span className="sentence-ja-sub">{s.ja}</span>
                <span className="text-sm text-muted">{s.note}</span>
              </div>
              <span className="sentence-srs text-sm text-muted">
                {s.srs ? `st${s.srs.stage} ・ ${s.srs.due.slice(5)}` : "未学習"}
              </span>
            </div>
          ))}
        </Card>
      ))}
    </div>
  );
}

export function SentencesScreen() {
  const [tab, setTab] = useState<Tab>("practice");
  return (
    <div className="stack">
      <div className="hero">
        <h2 className="hero-title">暗記例文300</h2>
        <p className="hero-date">日本語を見て、まず声に出す — 思い出す練習が記憶を作ります</p>
      </div>
      <div className="filter-row">
        <button className={`filter-chip${tab === "practice" ? " is-active" : ""}`} onClick={() => setTab("practice")}>
          今日の練習
        </button>
        <button className={`filter-chip${tab === "browse" ? " is-active" : ""}`} onClick={() => setTab("browse")}>
          一覧
        </button>
      </div>
      {tab === "practice" ? <PracticeTab /> : <BrowseTab />}
    </div>
  );
}
