import { extractErrorMessage } from "./http";

export type WhisperModelId = "large-v3-turbo" | "small";
export type DownloadStatus = "idle" | "downloading" | "verifying" | "done" | "error";

export type SetupStatus = {
  status: DownloadStatus;
  model: WhisperModelId | null;
  receivedBytes: number;
  totalBytes: number;
  error: string | null;
  resumable: boolean;
  diskFreeBytes: number;
  models: Record<WhisperModelId, boolean>;
};

export async function getSetupStatus(): Promise<SetupStatus> {
  const res = await fetch("/api/setup/status");
  if (!res.ok) throw new Error(`setup status failed: ${await extractErrorMessage(res)}`);
  return res.json();
}

export async function startWhisperModelDownload(model: WhisperModelId): Promise<SetupStatus> {
  const res = await fetch("/api/setup/whisper-model", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model }),
  });
  if (!res.ok) throw new Error(`start model download failed: ${await extractErrorMessage(res)}`);
  return res.json();
}

export async function cancelWhisperModelDownload(): Promise<SetupStatus> {
  const res = await fetch("/api/setup/whisper-model/cancel", { method: "POST" });
  if (!res.ok) throw new Error(`cancel model download failed: ${await extractErrorMessage(res)}`);
  return res.json();
}
