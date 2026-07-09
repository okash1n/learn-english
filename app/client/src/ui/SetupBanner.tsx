import { useEffect, useRef, useState } from "react";
import { cancelWhisperModelDownload, getSetupStatus, startWhisperModelDownload, type SetupStatus, type WhisperModelId } from "../api/setup";
import { STR, type Lang } from "../i18n";
import { formatBytes, isDownloadActive, progressPercent } from "../lib/whisper-setup";
import { Banner } from "./Banner";
import { Button } from "./Button";

const POLL_MS = 1000;
const MODEL_CHOICES: WhisperModelId[] = ["large-v3-turbo", "small"];

/**
 * health.modelFile===false のときだけ App.tsx から表示される、whisperモデルの初回セットアップバナー。
 * GET /api/setup/status をポーリングして進捗を追い、完了したら onModelReady() で親に health 再取得を促す
 * （health.modelFile が true に変わり、バナー自体は shouldShowSetupBanner の条件不成立で自然に消える）。
 */
export function SetupBanner({
  lang, onDismiss, onModelReady,
}: {
  lang: Lang; onDismiss: () => void; onModelReady: () => void;
}) {
  const t = STR[lang].setup;
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [selected, setSelected] = useState<WhisperModelId>("large-v3-turbo");
  const [busy, setBusy] = useState(false);
  const [pollError, setPollError] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const readyNotifiedRef = useRef(false);

  function stopPolling() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  function applyStatus(s: SetupStatus) {
    setStatus(s);
    setPollError(false);
    if (isDownloadActive(s.status)) {
      if (!timerRef.current) timerRef.current = setInterval(poll, POLL_MS);
    } else {
      stopPolling();
      if (s.status === "done" && !readyNotifiedRef.current) {
        readyNotifiedRef.current = true;
        onModelReady();
      }
    }
  }

  function poll() {
    getSetupStatus().then(applyStatus).catch(() => setPollError(true));
  }

  useEffect(() => {
    poll();
    return stopPolling;
    // 初回マウント時のみ起動する（以後はapplyStatus内のsetIntervalが自走する）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onStart() {
    setBusy(true);
    try {
      applyStatus(await startWhisperModelDownload(selected));
    } catch {
      setPollError(true);
    } finally {
      setBusy(false);
    }
  }

  async function onCancel() {
    setBusy(true);
    try {
      applyStatus(await cancelWhisperModelDownload());
    } finally {
      setBusy(false);
    }
  }

  const st = status?.status ?? "idle";
  const showChoice = st === "idle" || st === "error";
  const pct = status ? progressPercent(status.receivedBytes, status.totalBytes) : 0;

  return (
    <Banner
      kind={st === "error" ? "warn" : "info"}
      action={<Button variant="ghost" ariaLabel={t.dismissAriaLabel} onClick={onDismiss}>×</Button>}
    >
      <div className="stack setup-banner">
        <div>{t.intro}</div>

        {showChoice && (
          <>
            <div className="lang-toggle" role="radiogroup" aria-label={t.modelChoiceLabel}>
              {MODEL_CHOICES.map((m) => (
                <button
                  key={m}
                  role="radio"
                  aria-checked={selected === m}
                  className={selected === m ? "is-active" : ""}
                  onClick={() => setSelected(m)}
                >
                  {m === "large-v3-turbo" ? t.modelLarge : t.modelSmall}
                </button>
              ))}
            </div>
            <p className="text-sm text-muted">
              {selected === "large-v3-turbo" ? t.modelLargeNote : t.modelSmallNote}
            </p>
            {st === "error" && status?.error && <div className="level-edit-error">{status.error}</div>}
            <Button variant="primary" loading={busy} onClick={onStart}>
              {st === "error" && status?.resumable ? t.resumeButton : t.startButton}
            </Button>
          </>
        )}

        {isDownloadActive(st) && status && (
          <>
            <div
              className="gauge" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
              aria-label={t.modelChoiceLabel}
            >
              <div className="gauge-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="text-sm text-muted">
              {st === "verifying" ? t.verifying : t.progress(formatBytes(status.receivedBytes), formatBytes(status.totalBytes))}
            </div>
            <Button variant="secondary" loading={busy} onClick={onCancel}>{t.cancelButton}</Button>
          </>
        )}

        {pollError && <div className="level-edit-error">{t.pollError}</div>}
      </div>
    </Banner>
  );
}
