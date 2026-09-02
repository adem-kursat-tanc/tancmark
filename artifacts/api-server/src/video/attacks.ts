// ============================================================================
// STATUS: experimental / unused (18 May 2026)
// ----------------------------------------------------------------------------
// Bu modül video saldırı senaryolarını standart bir API ile sarmalamak üzere
// tasarlandı, fakat aktif smoke harness'ı (`artifacts/api-server/.smoke/
// video_mvp_test.mjs`) ffmpeg'i kendi içinde doğrudan çağırıyor — bu dosya
// hiçbir runtime ya da test yolundan import edilmiyor (`rg "video/attacks"`
// → 0 referans). Çekirdek video akışına dokunmamak için silinmedi; ileride
// route'tan saldırı uygulamak istenirse hazır iskelet olarak duruyor.
//
// UYARI (cut saldırısı): `-ss 30%` sözdizimi yanlış — ffmpeg `-ss` saniye
// veya HH:MM:SS bekler, yüzde kabul etmez. Aktive edilmeden ÖNCE bu satır
// gerçek saniye hesabına çevrilmelidir (örn. ffprobe ile duration ölç →
// duration * 0.3 → "-ss <sec>"). Bu dosya çağırıldığında düzeltilmedikçe
// `cut` çağrısı runtime'da kırılır.
// ============================================================================

import { runFfmpeg } from "./ffmpegHelper";

export type AttackKind =
  | "baseline"
  | "recompress"
  | "crop"
  | "cut"
  | "screen_record_sim"
  | "phone_camera_sim"
  | "edit_cut";

export interface AttackDef {
  kind: AttackKind;
  label: string;
}

export const ATTACK_LIST: AttackDef[] = [
  { kind: "baseline", label: "Düz (saldırısız)" },
  { kind: "recompress", label: "Yeniden sıkıştırma (libx264 crf=28)" },
  { kind: "crop", label: "Kırpma (orta 75%) + yeniden boyut" },
  { kind: "cut", label: "Baştan %30 kesilmiş" },
  { kind: "screen_record_sim", label: "Ekran kaydı simülasyonu (downscale + crf=30 + gürültü)" },
  { kind: "phone_camera_sim", label: "Telefon kamera simülasyonu (blur + 2° rot + crf=32)" },
  { kind: "edit_cut", label: "Basit montaj (3 parça atlamalı)" },
];

// === DETERMINISTIC ENCODING (18 May 2026) ===
// libx264 default'ta thread sayısına ve hash-derived state'e bağlı küçük
// kuantizasyon varyasyonları üretir. Tek-thread + seed=42 + nodeterministik
// optimizasyonların kapatılması bit-identical çıktı verir.
// kanıtlama: aynı input × aynı attack iki kere → md5 eşit.
const X264_DET_PARAMS = "seed=42:sliced-threads=0:nondeterministic=0:lookahead-threads=1";
const DET_X264 = [
  "-threads", "1",
  "-c:v", "libx264",
  "-x264-params", X264_DET_PARAMS,
  "-pix_fmt", "yuv420p",
];
// noise filtresi de seed almazsa frame-time'a bağlı pseudo-random kullanır.
// `all_seed=42` deterministik per-frame noise pattern.
const NOISE_DET = "noise=alls=8:allf=t:all_seed=42";

export async function applyAttack(
  kind: AttackKind,
  inputPath: string,
  outputPath: string,
): Promise<void> {
  switch (kind) {
    case "baseline":
      // Just remux (no quality loss). `-c copy` zaten deterministik.
      await runFfmpeg(["-i", inputPath, "-c", "copy", outputPath], 60_000);
      return;
    case "recompress":
      await runFfmpeg(
        ["-i", inputPath, ...DET_X264, "-crf", "28", outputPath],
        90_000,
      );
      return;
    case "crop": {
      // Crop center 75% then scale back.
      const filter = "crop=iw*0.75:ih*0.75,scale=iw/0.75:ih/0.75";
      await runFfmpeg(
        ["-i", inputPath, "-vf", filter, ...DET_X264, "-crf", "23", outputPath],
        90_000,
      );
      return;
    }
    case "cut": {
      // Trim first 30% off.
      await runFfmpeg(
        ["-i", inputPath, "-ss", "30%", ...DET_X264, "-crf", "23", outputPath],
        90_000,
      );
      return;
    }
    case "screen_record_sim": {
      // Downscale 80%, add slight noise, recompress harder.
      const filter = `scale=iw*0.8:ih*0.8,${NOISE_DET},scale=iw/0.8:ih/0.8`;
      await runFfmpeg(
        ["-i", inputPath, "-vf", filter, ...DET_X264, "-crf", "30", outputPath],
        90_000,
      );
      return;
    }
    case "phone_camera_sim": {
      // Slight blur + 2° rotation + heavier compression (mimics handheld
      // phone capture of a screen).
      const filter = "gblur=sigma=1.0,rotate=2*PI/180:fillcolor=black";
      await runFfmpeg(
        ["-i", inputPath, "-vf", filter, ...DET_X264, "-crf", "32", outputPath],
        90_000,
      );
      return;
    }
    case "edit_cut": {
      // Compose 3 segments: 0-30%, 50-70%, 85-100% (skip the rest).
      // Achieved with select+setpts; this destroys frame ordering somewhat.
      const filter =
        "select='lt(t,duration*0.3)+between(t,duration*0.5,duration*0.7)+gte(t,duration*0.85)',setpts=N/FRAME_RATE/TB";
      await runFfmpeg(
        ["-i", inputPath, "-vf", filter, ...DET_X264, "-crf", "23", outputPath],
        90_000,
      );
      return;
    }
  }
}
