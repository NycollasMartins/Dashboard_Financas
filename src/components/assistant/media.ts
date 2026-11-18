"use client";

/*
 * Mídia no navegador (Fase 6). A foto é REDUZIDA no próprio aparelho (máx.
 * 1600 px, JPEG) antes de sair; o áudio é gravado com o formato que o
 * navegador suporta (Safari iOS: mp4/aac; Chrome/Android: webm/opus).
 * Nada é guardado: vai para o servidor, é lido pela IA e descartado.
 */

const MAX_SIDE = 1600;

const toBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export async function compressImage(file: File): Promise<{ mimeType: "image/jpeg"; base64: string }> {
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas indisponível");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
  if (!blob) throw new Error("falha ao comprimir");
  return { mimeType: "image/jpeg", base64: await toBase64(blob) };
}

export const MAX_AUDIO_SECONDS = 60;

export function pickAudioMime(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"];
  if (typeof MediaRecorder === "undefined") return "";
  return candidates.find((c) => MediaRecorder.isTypeSupported(c)) ?? "";
}

export type Recording = { stop: () => Promise<{ mimeType: string; base64: string; seconds: number } | null>; cancel: () => void };

/** Começa a gravar (pede o microfone no toque). Para sozinho em 60 s. */
export async function startRecording(onAutoStop: () => void): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const mimeType = pickAudioMime();
  const rec = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 32_000 } : undefined);
  const chunks: Blob[] = [];
  const started = Date.now();
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.start(250);
  const timer = setTimeout(onAutoStop, MAX_AUDIO_SECONDS * 1000);
  const release = () => {
    clearTimeout(timer);
    stream.getTracks().forEach((t) => t.stop());
  };
  return {
    stop: () =>
      new Promise((resolve) => {
        rec.onstop = async () => {
          release();
          const type = rec.mimeType || mimeType || "audio/mp4";
          const blob = new Blob(chunks, { type });
          const seconds = Math.min(MAX_AUDIO_SECONDS, Math.round((Date.now() - started) / 1000));
          resolve(blob.size > 0 && seconds >= 1 ? { mimeType: type, base64: await toBase64(blob), seconds } : null);
        };
        rec.stop();
      }),
    cancel: () => {
      rec.onstop = null;
      if (rec.state !== "inactive") rec.stop();
      release();
    },
  };
}
