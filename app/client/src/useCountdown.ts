import { useEffect, useState } from "react";

/** 1秒刻みのカウントダウン。0で自動停止。start/pause/reset を提供 */
export function useCountdown(initialSeconds: number) {
  const [remaining, setRemaining] = useState(initialSeconds);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setRemaining((r) => (r > 0 ? r - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [running]);

  useEffect(() => {
    if (remaining === 0 && running) setRunning(false);
  }, [remaining, running]);

  return {
    remaining,
    running,
    expired: remaining === 0,
    start: () => setRunning(true),
    pause: () => setRunning(false),
    reset: (seconds: number) => {
      setRunning(false);
      setRemaining(seconds);
    },
  };
}

export function formatMmSs(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
