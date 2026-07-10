import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dir, "../../..");
const ROTATOR = path.join(REPO_ROOT, "scripts", "rotate-log-stream.sh");
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

async function rotate(lines: string[], opts: { maxBytes?: number; generations?: number; initial?: string } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "solo-diagnostic-log-"));
  tempDirs.push(dir);
  const log = path.join(dir, "server.stdout.log");
  if (opts.initial !== undefined) writeFileSync(log, opts.initial);
  const proc = Bun.spawn({
    cmd: ["/bin/bash", ROTATOR, log],
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      SOLO_EIKAIWA_LOG_MAX_BYTES: String(opts.maxBytes ?? 96),
      SOLO_EIKAIWA_LOG_GENERATIONS: String(opts.generations ?? 2),
    },
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });
  proc.stdin.write(`${lines.join("\n")}\n`);
  proc.stdin.end();
  const [exitCode, stderr] = await Promise.all([proc.exited, new Response(proc.stderr).text()]);
  expect(exitCode, stderr).toBe(0);
  return { dir, log };
}

function retained(log: string, generations: number): string[] {
  return [log, ...Array.from({ length: generations }, (_, i) => `${log}.${i + 1}`)].filter(existsSync);
}

describe("LaunchAgent diagnostic log rotation", () => {
  test("書込みを止めずにsize rotationし、現行+指定世代の総容量を上限内に保つ", async () => {
    const lines = Array.from({ length: 12 }, (_, i) => `event-${String(i).padStart(2, "0")}-${"x".repeat(24)}`);
    const { log } = await rotate(lines, { maxBytes: 96, generations: 2, initial: "legacy\n".repeat(100) });
    const files = retained(log, 2);
    expect(files).toHaveLength(3);
    expect(files.reduce((sum, file) => sum + statSync(file).size, 0)).toBeLessThanOrEqual(96 * 3);
    expect(readFileSync(log, "utf8")).toContain("event-11");
    expect(statSync(log).mode & 0o777).toBe(0o600);
  });

  test("API key・Authorization header・発話本文を診断ログへ残さない", async () => {
    const secrets = [
      "Authorization: Bearer bearer-secret-value",
      "apiKey=sk-super-secret-value",
      "ANTHROPIC_API_KEY=env-secret-value",
      "utterance=This speech must stay private",
      'text="This transcript must stay private"',
    ];
    const { log } = await rotate(["safe diagnostic", "task-id=42 context=startup", ...secrets], { maxBytes: 512, generations: 2 });
    const all = retained(log, 2).map((file) => readFileSync(file, "utf8")).join("\n");
    expect(all).toContain("safe diagnostic");
    expect(all).toContain("task-id=42 context=startup");
    expect(all).toContain("[redacted sensitive diagnostic line]");
    for (const secret of ["bearer-secret-value", "sk-super-secret-value", "env-secret-value", "This speech", "This transcript"]) {
      expect(all).not.toContain(secret);
    }
  });
});
