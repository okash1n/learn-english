import { afterEach, describe, expect, mock, test } from "bun:test";
import { playTtsCached, prefetchTts } from "./api/tts";
import { isDesktopContext, pickRecorderMimeType, playBlob, Recorder, stopPlayback } from "./audio";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function fakeStream() {
  const stop = mock(() => {});
  return {
    stop,
    stream: { getTracks: () => [{ stop }] } as unknown as MediaStream,
  };
}

class FakeMediaRecorder {
  state: RecordingState = "inactive";
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onstop: (() => void) | null = null;
  stream: MediaStream;

  constructor(stream: MediaStream) { this.stream = stream; }
  start() { this.state = "recording"; }
  stop() {
    this.state = "inactive";
    queueMicrotask(() => this.onstop?.());
  }
}

const realAudio = globalThis.Audio;
const realFetch = globalThis.fetch;
const realCreateObjectURL = URL.createObjectURL;
const realRevokeObjectURL = URL.revokeObjectURL;

afterEach(() => {
  stopPlayback();
  globalThis.fetch = realFetch;
  if (realAudio === undefined) delete (globalThis as { Audio?: unknown }).Audio;
  else globalThis.Audio = realAudio;
  URL.createObjectURL = realCreateObjectURL;
  URL.revokeObjectURL = realRevokeObjectURL;
});

describe("isDesktopContext", () => {
  test("UAにsolo-eikaiwa-desktopマーカーが含まれていればtrue", () => {
    expect(isDesktopContext("Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 solo-eikaiwa-desktop")).toBe(true);
  });

  test("通常ブラウザのUA（マーカー無し）はfalse", () => {
    expect(
      isDesktopContext(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      ),
    ).toBe(false);
  });
});

describe("pickRecorderMimeType", () => {
  test("ブラウザ文脈は常にaudio/webm（現行どおり不変）", () => {
    expect(pickRecorderMimeType({ isDesktop: false })).toBe("audio/webm");
    expect(pickRecorderMimeType({ isDesktop: false, isTypeSupported: () => false })).toBe("audio/webm");
  });

  test("デスクトップ文脈でmp4対応ならaudio/mp4を優先する", () => {
    expect(pickRecorderMimeType({ isDesktop: true, isTypeSupported: () => true })).toBe("audio/mp4");
  });

  test("デスクトップ文脈でもmp4非対応ならaudio/webmにフォールバックする", () => {
    expect(
      pickRecorderMimeType({ isDesktop: true, isTypeSupported: (t) => t !== "audio/mp4" }),
    ).toBe("audio/webm");
  });
});

describe("Recorder の非同期所有権", () => {
  test("getUserMedia待ちでcancelされた後に解決したstreamを即停止する", async () => {
    const media = deferred<MediaStream>();
    const { stream, stop } = fakeStream();
    let created = 0;
    const recorder = new Recorder({
      getUserMedia: () => media.promise,
      createMediaRecorder: (s) => { created++; return new FakeMediaRecorder(s) as unknown as MediaRecorder; },
      pickMimeType: () => "audio/webm",
    });

    const starting = recorder.start();
    recorder.cancel();
    media.resolve(stream);
    await expect(starting).rejects.toThrow(/cancelled/);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(created).toBe(0);
  });

  test("starting中の二重startを拒否し、有効streamを1組だけ作る", async () => {
    const media = deferred<MediaStream>();
    const { stream } = fakeStream();
    let created = 0;
    const recorder = new Recorder({
      getUserMedia: () => media.promise,
      createMediaRecorder: (s) => { created++; return new FakeMediaRecorder(s) as unknown as MediaRecorder; },
      pickMimeType: () => "audio/webm",
    });

    const first = recorder.start();
    await expect(recorder.start()).rejects.toThrow(/busy/);
    media.resolve(stream);
    await first;
    expect(created).toBe(1);
    recorder.cancel();
  });

  test("stopTimedはmonotonic clockの実時間を返す", async () => {
    const { stream } = fakeStream();
    let now = 1_000;
    const recorder = new Recorder({
      getUserMedia: async () => stream,
      createMediaRecorder: (s) => new FakeMediaRecorder(s) as unknown as MediaRecorder,
      pickMimeType: () => "audio/webm",
      now: () => now,
    });
    await recorder.start();
    now = 4_100;
    const result = await recorder.stopTimed();
    expect(result.durationSec).toBe(3.1);
  });

  test("stop待ちのcancelは保留Promiseを解除してstreamを停止する", async () => {
    const { stream, stop } = fakeStream();
    const recorder = new Recorder({
      getUserMedia: async () => stream,
      createMediaRecorder: (s) => new FakeMediaRecorder(s) as unknown as MediaRecorder,
      pickMimeType: () => "audio/webm",
    });
    await recorder.start();
    const stopping = recorder.stopTimed();
    recorder.cancel();
    await expect(stopping).rejects.toBeInstanceOf(Error);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(recorder.getState()).toBe("idle");
  });
});

function installAudioStub() {
  const plays: Array<ReturnType<typeof deferred<void>>> = [];
  const instances: Array<{
    pauseCalls: number;
    onended: (() => void) | null;
    onerror: (() => void) | null;
  }> = [];
  class FakeAudio {
    onended: (() => void) | null = null;
    onerror: (() => void) | null = null;
    pauseCalls = 0;
    constructor(_url: string) { instances.push(this); }
    play() {
      const d = deferred<void>();
      plays.push(d);
      return d.promise;
    }
    pause() { this.pauseCalls++; }
  }
  globalThis.Audio = FakeAudio as unknown as typeof Audio;
  let url = 0;
  URL.createObjectURL = mock(() => `blob:test-${++url}`);
  URL.revokeObjectURL = mock(() => {});
  return { plays, instances };
}

describe("再生世代", () => {
  test("Aの遅延rejectがBのregistryを消さず、stopPlaybackがBを停止する", async () => {
    const { plays, instances } = installAudioStub();
    const a = playBlob(new Blob(["a"]));
    await Promise.resolve();
    const b = playBlob(new Blob(["b"]));
    await Promise.resolve();

    plays[0].reject(new Error("old play failed"));
    await Promise.resolve();
    stopPlayback();
    plays[1].resolve();
    await Promise.all([a, b]);
    expect(instances[1].pauseCalls).toBe(1);
  });

  test("Aの古いended/error callbackが逆順で来てもBのregistryを消さない", async () => {
    const { plays, instances } = installAudioStub();
    const a = playBlob(new Blob(["a-callback"]));
    await Promise.resolve();
    const staleEnded = instances[0].onended!;
    const staleError = instances[0].onerror!;
    const b = playBlob(new Blob(["b-callback"]));
    await Promise.resolve();

    staleError();
    staleEnded();
    stopPlayback();
    plays[0].resolve();
    plays[1].resolve();
    await Promise.all([a, b]);
    expect(instances[1].pauseCalls).toBe(1);
  });

  test("TTS取得待ちで停止した要求は、取得後に再生を開始しない", async () => {
    const { instances } = installAudioStub();
    const response = deferred<Response>();
    globalThis.fetch = mock(async () => response.promise) as unknown as typeof fetch;

    const playing = playTtsCached("deferred-stop-audio");
    stopPlayback();
    response.resolve(new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
    await playing;
    expect(instances).toHaveLength(0);
  });

  test("先読みcacheは再生世代を変えず、解決後に即再生できる", async () => {
    const { plays, instances } = installAudioStub();
    globalThis.fetch = mock(async () => new Response(new Uint8Array([1]), { status: 200 })) as unknown as typeof fetch;
    await prefetchTts("prefetched-normal-audio");
    const playing = playTtsCached("prefetched-normal-audio");
    await Promise.resolve();
    expect(instances).toHaveLength(1);
    stopPlayback();
    plays[0].resolve();
    await playing;
  });

  test("古いTTS取得の遅延完了が新しい再生を停止・上書きしない", async () => {
    const { plays, instances } = installAudioStub();
    const oldResponse = deferred<Response>();
    const newResponse = deferred<Response>();
    globalThis.fetch = mock(async (_input, init) => {
      const text = JSON.parse(String(init?.body)).text;
      return text === "generation-old-audio" ? oldResponse.promise : newResponse.promise;
    }) as unknown as typeof fetch;

    const oldPlaying = playTtsCached("generation-old-audio");
    const newPlaying = playTtsCached("generation-new-audio");
    newResponse.resolve(new Response(new Uint8Array([2]), { status: 200 }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(instances).toHaveLength(1);
    oldResponse.resolve(new Response(new Uint8Array([1]), { status: 200 }));
    await oldPlaying;
    expect(instances).toHaveLength(1);
    stopPlayback();
    plays[0].resolve();
    await newPlaying;
    expect(instances[0].pauseCalls).toBe(1);
  });
});
