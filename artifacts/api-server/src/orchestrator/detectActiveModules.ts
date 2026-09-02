/**
 * AEGIS Orchestrator — Modül tespiti (saf fonksiyon)
 * ─────────────────────────────────────────────────────────────────────
 * Girdi tipi ipuçlarına göre HANGİ modüllerin aktif olduğunu döner.
 * Yan etki yok; karar üretmez; mevcut encode/decode/davranışı ETKİLEMEZ.
 *
 * Kullanım amacı:
 *  - Yanlış modülü çalıştırmamak (örn ses dosyasında video pipeline çağırma).
 *  - Modüller-arası koordinasyon kararı için ortak liste.
 *  - audio v0.1 varsa aktif olur; ses yoksa hiç çalıştırılmaz.
 *
 * KIRMIZI ÇİZGİ:
 *  - Bu modül lib/aegis-core'a dokunmaz.
 *  - encode/decode eşiklerine dokunmaz.
 *  - Karar üretmez.
 */

export type AegisModuleKind = "video" | "image" | "text" | "audio";

export type AegisModuleStatus = "active";

export interface ActiveModuleEntry {
  kind: AegisModuleKind;
  status: AegisModuleStatus;
  /** İnsan-okuru not (route response'da görünür). */
  note?: string;
}

export interface DetectActiveModulesInput {
  /** Mime type ipucu (multer file.mimetype gibi). */
  mimeType?: string | null;
  /** Dosya uzantısı ipucu (örn ".mp4", ".png", ".txt"). */
  fileExt?: string | null;
  /** Doğrudan modül tipini belirtmek isteyen caller (test ve route override). */
  explicit?: ReadonlyArray<AegisModuleKind>;
  /** Caller "ses var" diye iddia ediyorsa true. */
  hasAudioTrack?: boolean;
}

export interface DetectActiveModulesResult {
  modules: ActiveModuleEntry[];
  /** Tespit gerekçesi (insan-okuru, debug için). */
  reason: string;
}

const VIDEO_MIME = /^video\//i;
const IMAGE_MIME = /^image\//i;
const TEXT_MIME = /^text\/|^application\/json$/i;
const AUDIO_MIME = /^audio\//i;

const VIDEO_EXT = new Set([".mp4", ".mkv", ".mov", ".webm", ".avi", ".m4v"]);
const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif"]);
const TEXT_EXT = new Set([".txt", ".md", ".json", ".html", ".csv"]);
const AUDIO_EXT = new Set([".mp3", ".wav", ".ogg", ".flac", ".m4a"]);

/** Saf fonksiyon — yan etki yok. */
export function detectActiveModules(
  input: DetectActiveModulesInput,
): DetectActiveModulesResult {
  // 1) Explicit override en yüksek öncelik.
  if (input.explicit && input.explicit.length > 0) {
    const seen = new Set<AegisModuleKind>();
    const modules: ActiveModuleEntry[] = [];
    for (const k of input.explicit) {
      if (seen.has(k)) continue;
      seen.add(k);
      modules.push(buildEntry(k));
    }
    if (seen.has("video") && !seen.has("image")) {
      modules.push(buildEntry("image"));
    }
    return {
      modules,
      reason: `explicit=${input.explicit.join(",")}`,
    };
  }

  const detected = new Set<AegisModuleKind>();
  const mime = (input.mimeType ?? "").trim();
  const ext = (input.fileExt ?? "").trim().toLowerCase();

  if (mime) {
    if (VIDEO_MIME.test(mime)) detected.add("video");
    else if (IMAGE_MIME.test(mime)) detected.add("image");
    else if (AUDIO_MIME.test(mime)) detected.add("audio");
    else if (TEXT_MIME.test(mime)) detected.add("text");
  }

  if (ext) {
    if (VIDEO_EXT.has(ext)) detected.add("video");
    else if (IMAGE_EXT.has(ext)) detected.add("image");
    else if (AUDIO_EXT.has(ext)) detected.add("audio");
    else if (TEXT_EXT.has(ext)) detected.add("text");
  }

  if (input.hasAudioTrack === true) detected.add("audio");
  if (detected.has("video")) detected.add("image");

  const modules: ActiveModuleEntry[] = [];
  for (const k of ["video", "image", "text", "audio"] as const) {
    if (detected.has(k)) modules.push(buildEntry(k));
  }

  return {
    modules,
    reason: modules.length === 0
      ? "no_signal (no mime/ext match, no explicit)"
      : `mime=${mime || "-"} ext=${ext || "-"}`,
  };
}

function buildEntry(kind: AegisModuleKind): ActiveModuleEntry {
  if (kind === "audio") {
    return {
      kind,
      status: "active",
      note:
        "Audio v0.1 starter is available. It only runs when an audio stream " +
        "is detected and still requires exact ID match.",
    };
  }
  return { kind, status: "active" };
}
