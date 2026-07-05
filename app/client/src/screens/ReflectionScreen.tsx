import { useEffect, useState } from "react";
import { fetchReflection, type Reflection } from "../api";

export function ReflectionScreen() {
  const [reflection, setReflection] = useState<Reflection | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetchReflection()
      .then(setReflection)
      .catch((err) => setErrorMsg(err instanceof Error ? err.message : String(err)));
  }, []);

  if (errorMsg) return <p style={{ color: "crimson" }}>{errorMsg}</p>;
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
