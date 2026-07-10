import { minimalSubprocessEnv } from "./subprocess-env";

export type SpawnFn = (
  cmd: string[], options?: { signal?: AbortSignal },
) => Promise<{ exitCode: number; stderr: string }>;

export const realSpawn: SpawnFn = async (cmd, options = {}) => {
  if (options.signal?.aborted) throw abortReason(options.signal);
  const proc = Bun.spawn(cmd, { env: minimalSubprocessEnv(), stdout: "ignore", stderr: "pipe" });
  const completed = Promise.all([new Response(proc.stderr).text(), proc.exited])
    .then(([stderr, exitCode]) => ({ exitCode, stderr }));
  let rejectAbort!: (error: Error) => void;
  const aborted = new Promise<never>((_resolve, reject) => {
    rejectAbort = reject;
  });
  const onAbort = () => {
    proc.kill();
    rejectAbort(abortReason(options.signal!));
  };
  options.signal?.addEventListener("abort", onAbort, { once: true });
  try {
    return await Promise.race([completed, aborted]);
  } finally {
    options.signal?.removeEventListener("abort", onAbort);
  }
};

function abortReason(signal: AbortSignal): Error {
  if (signal.reason instanceof Error) return signal.reason;
  const error = new Error("subprocess aborted");
  error.name = "AbortError";
  return error;
}
