export function StartScreen(props: { onSelect: (mode: "session60" | "session30" | "free") => void }) {
  const btn = { display: "block", width: "100%", fontSize: "1.1rem", padding: "1rem", marginBottom: "0.8rem", cursor: "pointer" } as const;
  return (
    <div>
      <p>今日のトレーニングを選んでください:</p>
      <button style={btn} onClick={() => props.onSelect("session60")}>📋 今日のセッション（60分）</button>
      <button style={btn} onClick={() => props.onSelect("session30")}>📋 今日のセッション（30分・短縮版）</button>
      <button style={btn} onClick={() => props.onSelect("free")}>💬 自由会話のみ</button>
    </div>
  );
}
