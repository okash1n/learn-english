import { describe, expect, test } from "bun:test";
import {
  makeSttGate, SttCancelledError, SttQueueFullError, SttRunTimeoutError, SttWaitTimeoutError,
} from "../stt-gate";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

describe("STT gate", () => {
  test("同時実行数と待機queue長を上限内に保つ", async () => {
    const gate = makeSttGate({ maxConcurrent: 1, maxQueue: 1, waitTimeoutMs: 1_000, runTimeoutMs: 1_000 });
    const first = deferred<void>();
    const second = deferred<void>();
    const started: number[] = [];
    const p1 = gate.run(async () => { started.push(1); await first.promise; return 1; });
    await Promise.resolve();
    const p2 = gate.run(async () => { started.push(2); await second.promise; return 2; });
    await expect(gate.run(async () => 3)).rejects.toBeInstanceOf(SttQueueFullError);
    expect(started).toEqual([1]);
    first.resolve();
    await p1;
    await Promise.resolve();
    expect(started).toEqual([1, 2]);
    second.resolve();
    await expect(p2).resolves.toBe(2);
  });

  test("待機中のrequest abortをqueueから除外する", async () => {
    const gate = makeSttGate({ maxConcurrent: 1, maxQueue: 1, waitTimeoutMs: 1_000, runTimeoutMs: 1_000 });
    const first = deferred<void>();
    const p1 = gate.run(async () => { await first.promise; });
    await Promise.resolve();
    const controller = new AbortController();
    let secondStarted = false;
    const p2 = gate.run(async () => { secondStarted = true; }, controller.signal);
    controller.abort();
    await expect(p2).rejects.toBeInstanceOf(SttCancelledError);
    expect(secondStarted).toBe(false);
    first.resolve();
    await p1;
  });

  test("queue待機上限を超えたrequestをtimeoutにする", async () => {
    const gate = makeSttGate({ maxConcurrent: 1, maxQueue: 1, waitTimeoutMs: 5, runTimeoutMs: 1_000 });
    const first = deferred<void>();
    const p1 = gate.run(async () => { await first.promise; });
    await Promise.resolve();
    const p2 = gate.run(async () => {});
    await expect(p2).rejects.toBeInstanceOf(SttWaitTimeoutError);
    first.resolve();
    await p1;
  });

  test("実行上限でtaskのsignalをabortする", async () => {
    const gate = makeSttGate({ maxConcurrent: 1, maxQueue: 0, waitTimeoutMs: 1_000, runTimeoutMs: 5 });
    let taskSignal: AbortSignal | undefined;
    const running = gate.run((signal) => new Promise<void>((_resolve, reject) => {
      taskSignal = signal;
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    }));
    await expect(running).rejects.toBeInstanceOf(SttRunTimeoutError);
    expect(taskSignal?.aborted).toBe(true);
  });

  test("実行中のrequest abortをtaskへ伝え、slotを次の要求へ渡す", async () => {
    const gate = makeSttGate({ maxConcurrent: 1, maxQueue: 0, waitTimeoutMs: 1_000, runTimeoutMs: 1_000 });
    const controller = new AbortController();
    let taskSignal: AbortSignal | undefined;
    const running = gate.run((signal) => new Promise<void>((_resolve, reject) => {
      taskSignal = signal;
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    }), controller.signal);
    await Promise.resolve();
    controller.abort();
    await expect(running).rejects.toBeInstanceOf(SttCancelledError);
    expect(taskSignal?.aborted).toBe(true);
    await expect(gate.run(async () => 7)).resolves.toBe(7);
  });
});
