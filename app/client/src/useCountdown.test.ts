import { describe, expect, test } from "bun:test";
import { CountdownClock } from "./useCountdown";

describe("CountdownClock", () => {
  test("interval抑制相当の時刻jump後に0へ進み、expireを一度だけ発火する", () => {
    let now = 0;
    let tick = () => {};
    const remaining: number[] = [];
    let expired = 0;
    const clock = new CountdownClock(3, {
      now: () => now,
      setInterval: (fn) => { tick = fn; return 1; },
      clearInterval: () => {},
      onRemaining: (value) => remaining.push(value),
      onRunning: () => {},
      onExpire: () => { expired++; },
    });

    clock.start();
    now = 5_000;
    tick();
    tick();
    expect(remaining.at(-1)).toBe(0);
    expect(expired).toBe(1);
    expect(clock.isRunning()).toBe(false);
  });

  test("pauseはtick回数でなくdeadlineとの差から残秒を計算する", () => {
    let now = 0;
    const values: number[] = [];
    const clock = new CountdownClock(10, {
      now: () => now,
      setInterval: () => 1,
      clearInterval: () => {},
      onRemaining: (value) => values.push(value),
      onRunning: () => {},
      onExpire: () => {},
    });
    clock.start();
    now = 3_400;
    clock.pause();
    expect(values.at(-1)).toBe(7);
  });

  test("pause後に再開しても表示用の切り上げ分だけ期限を延長しない", () => {
    let now = 0;
    let tick = () => {};
    let expired = 0;
    const clock = new CountdownClock(10, {
      now: () => now,
      setInterval: (fn) => { tick = fn; return 1; },
      clearInterval: () => {},
      onRemaining: () => {},
      onRunning: () => {},
      onExpire: () => { expired++; },
    });
    clock.start();
    now = 3_400;
    clock.pause();
    clock.start();
    now = 10_000;
    tick();
    expect(expired).toBe(1);
  });
});
