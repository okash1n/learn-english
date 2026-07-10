import { useEffect, useRef, useState } from "react";

type CountdownClockOptions = {
  now: () => number;
  setInterval: (fn: () => void, intervalMs: number) => unknown;
  clearInterval: (handle: unknown) => void;
  onRemaining: (remaining: number) => void;
  onRunning: (running: boolean) => void;
  onExpire: () => void;
};

/** interval の発火回数ではなく monotonic clock の期限から残り時間を計算する。 */
export class CountdownClock {
  private remaining: number;
  private remainingMs: number;
  private running = false;
  private deadline = 0;
  private interval: unknown | null = null;
  private expiredNotified = false;

  constructor(initialSeconds: number, private readonly options: CountdownClockOptions) {
    this.remaining = normalizeSeconds(initialSeconds);
    this.remainingMs = this.remaining * 1_000;
  }

  isRunning(): boolean {
    return this.running;
  }

  start(): void {
    if (this.running || this.remaining === 0) return;
    this.deadline = this.options.now() + this.remainingMs;
    this.running = true;
    this.options.onRunning(true);
    this.interval = this.options.setInterval(() => this.tick(), 250);
  }

  pause(): void {
    if (!this.running) return;
    this.updateRemaining();
    if (!this.running) return;
    this.stopInterval();
    this.running = false;
    this.options.onRunning(false);
  }

  reset(seconds: number): void {
    this.stopInterval();
    this.running = false;
    this.remaining = normalizeSeconds(seconds);
    this.remainingMs = this.remaining * 1_000;
    this.expiredNotified = false;
    this.options.onRunning(false);
    this.options.onRemaining(this.remaining);
  }

  dispose(): void {
    this.stopInterval();
    this.running = false;
  }

  private tick(): void {
    if (this.running) this.updateRemaining();
  }

  private updateRemaining(): void {
    this.remainingMs = Math.max(0, this.deadline - this.options.now());
    const next = Math.ceil(this.remainingMs / 1_000);
    if (next !== this.remaining) {
      this.remaining = next;
      this.options.onRemaining(next);
    }
    if (next !== 0) return;
    this.stopInterval();
    this.running = false;
    this.options.onRunning(false);
    if (!this.expiredNotified) {
      this.expiredNotified = true;
      this.options.onExpire();
    }
  }

  private stopInterval(): void {
    if (this.interval === null) return;
    this.options.clearInterval(this.interval);
    this.interval = null;
  }
}

function normalizeSeconds(seconds: number): number {
  return Math.max(0, Math.ceil(Number.isFinite(seconds) ? seconds : 0));
}

/** 期限ベースのカウントダウン。onExpire は各 reset につき一度だけ呼ばれる。 */
export function useCountdown(initialSeconds: number, options: { onExpire?: () => void } = {}) {
  const [remaining, setRemaining] = useState(normalizeSeconds(initialSeconds));
  const [running, setRunning] = useState(false);
  const onExpireRef = useRef(options.onExpire);
  onExpireRef.current = options.onExpire;
  const clockRef = useRef<CountdownClock | null>(null);
  if (!clockRef.current) {
    clockRef.current = new CountdownClock(initialSeconds, {
      now: () => performance.now(),
      setInterval: (fn, intervalMs) => globalThis.setInterval(fn, intervalMs),
      clearInterval: (handle) => globalThis.clearInterval(handle as ReturnType<typeof setInterval>),
      onRemaining: setRemaining,
      onRunning: setRunning,
      onExpire: () => onExpireRef.current?.(),
    });
  }

  useEffect(() => () => clockRef.current?.dispose(), []);
  const clock = clockRef.current;
  return {
    remaining,
    running,
    expired: remaining === 0,
    start: () => clock.start(),
    pause: () => clock.pause(),
    reset: (seconds: number) => clock.reset(seconds),
  };
}

export function formatMmSs(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
