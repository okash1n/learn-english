import { useEffect, useRef, useState } from "react";
import { fetchPracticeDays, fetchSettings, saveSettings, type QuickDrillKind } from "../api";
import { Banner } from "../ui/Banner";
import { Button } from "../ui/Button";

export type StartSelection =
  | { type: "quick"; drill: QuickDrillKind }
  | { type: "daily"; minutes: 60 | 30 }
  | { type: "free" }
  | { type: "library" };

const QUICK_BUTTONS: Array<{ drill: QuickDrillKind; title: string; minutes: string }> = [
  { drill: "warmup", title: "🔊 音読ウォームアップ", minutes: "6分" },
  { drill: "ftt-mini", title: "🗣 4/3/2ミニ", minutes: "8分・2ラウンド" },
  { drill: "roleplay", title: "💼 実務ロールプレイ", minutes: "10分" },
  { drill: "shadowing", title: "🎧 シャドーイング", minutes: "5分" },
];

/** ローカル日付の YYYY-MM-DD（カレンダー表示用） */
function localYmd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 直近8週（56日）の練習日カレンダー。実施日のドット表示のみ（情報的フィードバック — 演出・連続日数なし） */
function PracticeCalendar({ days }: { days: string[] }) {
  const set = new Set(days);
  const today = new Date();
  const cells: Array<{ ymd: string; done: boolean; isToday: boolean }> = [];
  for (let i = 55; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ymd = localYmd(d);
    cells.push({ ymd, done: set.has(ymd), isToday: i === 0 });
  }
  return (
    <div>
      <h3 className="text-sm text-muted">練習日（直近8週）</h3>
      <div className="dot-grid">
        {cells.map((c) => (
          <div key={c.ymd} title={c.ymd} className={`day${c.done ? " is-done" : ""}${c.isToday ? " is-today" : ""}`} />
        ))}
      </div>
    </div>
  );
}

export function StartScreen(props: { onSelect: (sel: StartSelection) => void }) {
  const [days, setDays] = useState<string[]>([]);
  const [anchor, setAnchor] = useState("");
  const [anchorDraft, setAnchorDraft] = useState("");
  const [editingAnchor, setEditingAnchor] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const aliveRef = useRef(true);
  const fetchedRef = useRef(false);

  useEffect(() => {
    aliveRef.current = true;
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      // カレンダー/アンカーは補助情報 — 取得失敗でスタート画面を壊さない
      fetchPracticeDays().then((d) => { if (aliveRef.current) setDays(d); }).catch(() => {});
      fetchSettings().then((s) => {
        if (aliveRef.current) { setAnchor(s.anchor); setAnchorDraft(s.anchor); }
      }).catch(() => {});
    }
    return () => { aliveRef.current = false; };
  }, []);

  async function onSaveAnchor() {
    setSaveMsg("");
    try {
      await saveSettings({ anchor: anchorDraft });
      if (!aliveRef.current) return;
      setAnchor(anchorDraft);
      setEditingAnchor(false);
    } catch (err) {
      if (!aliveRef.current) return;
      setSaveMsg(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="stack">
      <div>
        <h3>クイックドリル（5〜10分）</h3>
        <div className="drill-grid">
          {QUICK_BUTTONS.map((q) => (
            <button key={q.drill} className="drill-card" onClick={() => props.onSelect({ type: "quick", drill: q.drill })}>
              <span className="drill-title">{q.title}</span>
              <span className="drill-min">{q.minutes}</span>
            </button>
          ))}
        </div>
        <h3>強化セッション <span className="text-sm text-muted">週1〜2回おすすめ</span></h3>
        <div className="start-row">
          <Button onClick={() => props.onSelect({ type: "daily", minutes: 60 })}>📋 通しセッション（60分）</Button>
          <Button onClick={() => props.onSelect({ type: "daily", minutes: 30 })}>📋 30分・短縮版</Button>
        </div>
        <div className="start-row">
          <Button variant="ghost" onClick={() => props.onSelect({ type: "free" })}>💬 自由会話のみ</Button>
          <Button variant="ghost" onClick={() => props.onSelect({ type: "library" })}>📚 ライブラリ</Button>
        </div>
      </div>

      <PracticeCalendar days={days} />

      <div>
        {!editingAnchor && anchor && (
          <p className="anchor-row">
            📌 {anchor}
            <Button variant="ghost" onClick={() => setEditingAnchor(true)}>編集</Button>
          </p>
        )}
        {!editingAnchor && !anchor && (
          <p className="anchor-row">
            続けるコツ: 既にある日課に紐づけると忘れません（例: 朝コーヒーを淹れたら1ドリル）
            <Button variant="ghost" onClick={() => setEditingAnchor(true)}>設定する</Button>
          </p>
        )}
        {editingAnchor && (
          <div className="anchor-row">
            <input
              className="anchor-input"
              value={anchorDraft}
              onChange={(e) => setAnchorDraft(e.target.value)}
              placeholder="朝コーヒーを淹れたら1ドリル"
              maxLength={200}
            />
            <Button variant="primary" onClick={onSaveAnchor}>保存</Button>
            <Button variant="ghost" onClick={() => { setEditingAnchor(false); setAnchorDraft(anchor); setSaveMsg(""); }}>やめる</Button>
          </div>
        )}
        {saveMsg && <Banner kind="error">{saveMsg}</Banner>}
      </div>
    </div>
  );
}
