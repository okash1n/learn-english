export class SttQueueFullError extends Error {
  constructor() {
    super("STT queue is full");
    this.name = "SttQueueFullError";
  }
}

export class SttWaitTimeoutError extends Error {
  constructor() {
    super("STT queue wait timed out");
    this.name = "SttWaitTimeoutError";
  }
}

export class SttRunTimeoutError extends Error {
  constructor() {
    super("STT processing timed out");
    this.name = "SttRunTimeoutError";
  }
}

export class SttCancelledError extends Error {
  constructor() {
    super("STT request was cancelled");
    this.name = "SttCancelledError";
  }
}

export type SttGate = {
  run<T>(task: (signal: AbortSignal) => Promise<T>, requestSignal?: AbortSignal): Promise<T>;
};

type Waiter = {
  resolve: () => void;
  reject: (error: Error) => void;
  signal?: AbortSignal;
  onAbort?: () => void;
  timer: ReturnType<typeof setTimeout>;
};

export function makeSttGate(options: {
  maxConcurrent: number;
  maxQueue: number;
  waitTimeoutMs: number;
  runTimeoutMs: number;
}): SttGate {
  const maxConcurrent = Math.max(1, Math.floor(options.maxConcurrent));
  const maxQueue = Math.max(0, Math.floor(options.maxQueue));
  let active = 0;
  const queue: Waiter[] = [];

  const removeWaiter = (waiter: Waiter): boolean => {
    const index = queue.indexOf(waiter);
    if (index < 0) return false;
    queue.splice(index, 1);
    clearTimeout(waiter.timer);
    if (waiter.signal && waiter.onAbort) waiter.signal.removeEventListener("abort", waiter.onAbort);
    return true;
  };

  const drain = () => {
    while (active < maxConcurrent && queue.length > 0) {
      const waiter = queue.shift()!;
      clearTimeout(waiter.timer);
      if (waiter.signal && waiter.onAbort) waiter.signal.removeEventListener("abort", waiter.onAbort);
      if (waiter.signal?.aborted) {
        waiter.reject(new SttCancelledError());
        continue;
      }
      active++;
      waiter.resolve();
    }
  };

  const acquire = (signal?: AbortSignal): Promise<void> => {
    if (signal?.aborted) return Promise.reject(new SttCancelledError());
    if (active < maxConcurrent) {
      active++;
      return Promise.resolve();
    }
    if (queue.length >= maxQueue) return Promise.reject(new SttQueueFullError());
    return new Promise<void>((resolve, reject) => {
      const waiter = {} as Waiter;
      waiter.resolve = resolve;
      waiter.reject = reject;
      waiter.signal = signal;
      waiter.timer = setTimeout(() => {
        if (removeWaiter(waiter)) reject(new SttWaitTimeoutError());
      }, options.waitTimeoutMs);
      if (signal) {
        waiter.onAbort = () => {
          if (removeWaiter(waiter)) reject(new SttCancelledError());
        };
        signal.addEventListener("abort", waiter.onAbort, { once: true });
      }
      queue.push(waiter);
    });
  };

  const release = () => {
    active--;
    drain();
  };

  return {
    async run<T>(task: (signal: AbortSignal) => Promise<T>, requestSignal?: AbortSignal): Promise<T> {
      await acquire(requestSignal);
      if (requestSignal?.aborted) {
        release();
        throw new SttCancelledError();
      }

      const controller = new AbortController();
      const onRequestAbort = () => controller.abort(new SttCancelledError());
      requestSignal?.addEventListener("abort", onRequestAbort, { once: true });
      const timeout = setTimeout(() => controller.abort(new SttRunTimeoutError()), options.runTimeoutMs);
      const aborted = new Promise<never>((_resolve, reject) => {
        controller.signal.addEventListener("abort", () => reject(controller.signal.reason), { once: true });
      });
      const running = Promise.resolve().then(() => task(controller.signal));
      try {
        return await Promise.race([running, aborted]);
      } catch (error) {
        if (controller.signal.aborted) throw controller.signal.reason;
        throw error;
      } finally {
        clearTimeout(timeout);
        requestSignal?.removeEventListener("abort", onRequestAbort);
        release();
      }
    },
  };
}
