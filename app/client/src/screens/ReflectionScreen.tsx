import { useEffect, useState } from "react";
import { fetchReflection, type Reflection } from "../api";

export function ReflectionScreen() {
  const [reflection, setReflection] = useState<Reflection | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  function loadReflection() {
    setErrorMsg("");
    fetchReflection()
      .then(setReflection)
      .catch((err) => setErrorMsg(err instanceof Error ? err.message : String(err)));
  }

  useEffect(() => {
    loadReflection();
  }, []);

  if (errorMsg) {
    return (
      <div>
        <p style={{ color: "crimson" }}>{errorMsg}</p>
        <button onClick={loadReflection} style={{ padding: "0.6rem 1.2rem", cursor: "pointer" }}>再試行</button>
      </div>
    );
  }
  if (!reflection) return <p>コーチが今日のセッションを振り返っています…</p>;

  return (
    <div>
      {reflection.goodPhrases.length > 0 && (
        <div>
          <h3>👏 良かった表現</h3>
          <ul>{reflection.goodPhrases.map((p, i) => <li key={i}>{p}</li>)}</ul>
        </div>
      )}
      {reflection.fixes.length > 0 && (
        <div>
          <h3>✏️ 直したい表現</h3>
          <ul>
            {reflection.fixes.map((f, i) => (
              <li key={i}><s>{f.original}</s> → <strong>{f.better}</strong></li>
            ))}
          </ul>
        </div>
      )}
      <h3>📝 明日へ</h3>
      <p>{reflection.noteForTomorrow_ja}</p>
    </div>
  );
}
