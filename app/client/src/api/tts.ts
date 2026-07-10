import { beginPlaybackRequest, isPlaybackRequestCurrent, playBlobForRequest } from "../audio";
import { ttsFetch } from "./converse";
import { fetchModelTalk } from "./coach";

/**
 * テキスト単位のTTS Blobキャッシュ再生。初回押下時のみ /api/tts を叩き（サーバ側にも
 * テキスト単位のキャッシュがある）、以降はタブ内キャッシュから即再生。
 * in-flight Promise を共有し、失敗時はエントリを消して再試行可能にする（prepPackCache と同じパターン）。
 */
const ttsBlobCache = new Map<string, Promise<Blob>>();

export async function playTtsCached(text: string): Promise<void> {
  const generation = beginPlaybackRequest();
  let p = ttsBlobCache.get(text);
  if (!p) {
    p = ttsFetch(text);
    p.catch(() => ttsBlobCache.delete(text));
    ttsBlobCache.set(text, p);
  }
  const blob = await p;
  if (!isPlaybackRequestCurrent(generation)) return;
  await playBlobForRequest(blob, generation);
}

/**
 * ttsBlobCache を温めるだけの先読み（再生はしない）。次段落の音声を現在の再生中に用意しておき、
 * 段落間の無音ギャップを縮めるために使う。失敗は握りつぶす（本再生時に playTtsCached が再試行する）。
 */
export function prefetchTts(text: string): Promise<void> {
  let p = ttsBlobCache.get(text);
  if (!p) {
    p = ttsFetch(text);
    p.catch(() => ttsBlobCache.delete(text));
    ttsBlobCache.set(text, p);
  }
  // 呼び出し側は fire-and-forget でき、テストや準備処理は完了を待てる。
  return p.then(() => undefined, () => undefined);
}

/**
 * モデルトーク（原稿テキスト→TTS Blob）の先読みキャッシュ。準備フェーズ表示時に呼び、
 * 「モデルトークを聞く」押下時には出来上がっている状態を狙う。onStage は初回生成時のみ発火する。
 */
const modelTalkCache = new Map<string, Promise<{ text: string; blob: Blob }>>();

export function prefetchModelTalkAudio(
  topicId: string,
  onStage?: (stage: "script" | "audio") => void,
): Promise<{ text: string; blob: Blob }> {
  let p = modelTalkCache.get(topicId);
  if (!p) {
    p = (async () => {
      onStage?.("script");
      const text = await fetchModelTalk(topicId);
      onStage?.("audio");
      const blob = await ttsFetch(text);
      return { text, blob };
    })();
    p.catch(() => modelTalkCache.delete(topicId));
    modelTalkCache.set(topicId, p);
  }
  return p;
}
