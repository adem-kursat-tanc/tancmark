/**
 * AEGIS DNA — Çekirdek Tipler
 * ─────────────────────────────────────────────────────────────────────
 * AEGIS DNA, orijinal verinin tamamını saklamadan, onun küçük ve kalıcı
 * matematiksel ikizini tutan çekirdek kayıt yapısıdır. Tüm medya türleri
 * (video / görsel / metin / ses / Secure Room / zehir / gelecek modüller)
 * aynı struct'a bağlanır.
 *
 * Bu tip yalnız KAYIT şemasıdır — mühür mantığı, eşik, decode kararı
 * içermez. Mevcut modüller bu struct'ı üretip kalıcı saklamaya hazırlar;
 * arama tarafı ileride okur.
 *
 * Tasarım hedefleri:
 *   1. Medya-agnostik: aynı struct video / image / text / audio / secureRoom
 *      / poison için yeniden kullanılabilsin. `primaryMediaType` +
 *      `activeMediaTypes[]` discriminator.
 *   2. Çok-amaçlı: mühür basma + arama + karşılaştırma + kurtarma +
 *      delil paketi + modül-yönlendirme için tek kayıt. `purposes[]`
 *      kayıt amacını açıklar.
 *   3. Matematiksel ikiz: `contentDigest` orijinalin hash'i (adli hafıza),
 *      `structuralFingerprint` perceptual / geometrik / linguistik
 *      yapı parmak izi.
 *   4. Çok-katmanlı: ana mühür + T6 + ileride zehir / Secure Room ayrı
 *      `DNALayer` olarak girer; alanlar `reservedZones` ile disjoint.
 *   5. Encode + decode haritası: her katman kendi mührünü kendi haritası
 *      üzerinden bulsun → `maps.encodeMap` (kayıt-yönlü), `maps.decodeMap`
 *      (arama-yönlü) ayrı.
 *   6. Geriye dönük uyum: `schemaVersion` ileri sürümlerde tüketici kontrolü.
 */

/** AEGIS'in tanıdığı medya türleri. İleride eklenir. */
export type AegisMediaType =
  | "video"
  | "image"
  | "text"
  | "audio"
  | "secureRoom"
  | "poison";

/** Bu DNA kaydının ne için kullanılabileceği. Bir kayıt birden fazla
 *  amaca hizmet edebilir; tüketici kendi alanını okur. */
export type AegisDNAPurpose =
  | "seal" //         mühür basma haritası
  | "search" //       mühür arama haritası
  | "compare" //      iki içerik karşılaştırma (sızıntı → orijinal)
  | "recover" //      hasarlı izi kurtarma / parçalı sinyal birleştirme
  | "evidence" //     adli delil paketine bağlanma
  | "moduleRouter" // hangi modülün devreye gireceğine karar verme
  | "forensicMemory"; // orijinali saklamadan matematiksel hafıza

/** Bir mühür/iz bölgesinin geometrik şekli — medyaya göre değişir. */
export type DNARegionShape =
  | "patch" //      kare/dikdörtgen piksel patch (image/video)
  | "ring" //       anchor halkası (image/video)
  | "dctBand" //    DCT frekans bandı (image/video)
  | "lowBand" //    DC/low-band carrier (video)
  | "tokenSpan" //  metin token aralığı (text)
  | "audioBin" //   ses freq×time hücresi (audio)
  | "other";

/** Bir tek mühür/iz bölgesi. Geometri alanları MEDYAYA GÖRE opsiyoneldir;
 *  görsel/video patch için (cx,cy,width,height) doludur, metin için
 *  (charStart,charEnd), ses için (timeStart..timeEnd, freqBinStart..End). */
export interface DNARegion {
  /** İnsan-okunur etiket (örn "C00", "C01", "T6N", "para3.tok7"). */
  regionId: string;
  /** Geometrik şekil discriminator. */
  shape: DNARegionShape;
  // Görsel / video geometri (piksel)
  cx?: number;
  cy?: number;
  width?: number;
  height?: number;
  // Video zamansal (saniye veya frame)
  frameIdx?: number;
  tsSec?: number;
  // Metin karakter aralığı
  charStart?: number;
  charEnd?: number;
  // Ses zaman + freq grid
  timeStart?: number;
  timeEnd?: number;
  freqBinStart?: number;
  freqBinEnd?: number;
  /** Bu bölgenin taşıdığı veri tipi (forensics için açıklayıcı). */
  carries?: string;
  /** Genişleme noktası: katmana özel meta. */
  meta?: Record<string, unknown>;
}

/** Bir "mühürlü ünite" — medyaya göre frame (video), paragraf (text),
 *  audio window (ses), tek görsel (image). */
export interface DNASealedUnit {
  /** Birim anahtarı: video frameIdx, text paragraphIdx, audio windowIdx, … */
  unitKey: number | string;
  /** Birim ek meta — örn video için tsSec, text için tokenCount. */
  unitMeta?: Record<string, unknown>;
  /** Bu birimde bu katmanın bastığı bölgeler. */
  regions: DNARegion[];
}

/** Bir alanın "yasaklı / sahipli" olduğunu söyleyen kayıt. Başka
 *  katmanlar bu alanı tüketmez. */
export interface DNAReservedZone {
  /** Hangi ünite scope'unda — belirli unitKey veya "all" (uzaysal-tüm). */
  unitScope: number | string | "all";
  /** Yasaklı bölge geometrisi. */
  region: DNARegion;
  /** Bu alanı tutan katman id'si. */
  ownerLayer: string;
  /** Neden tutuldu (decode/karar zinciri için bilgi). */
  reason: string;
}

/** Bir mühür/iz katmanı — ana mühür, T6, zehir, vb. */
export interface DNALayer {
  /** Sabit katman tanımlayıcısı. */
  layerId: string;
  /** Bu katmanın hangi medya tipinde çalıştığı (multi-modal kayıtta önemli). */
  mediaType: AegisMediaType;
  /** Bu katmanı bu kayda yazan modülün sürümü. */
  version: string;
  /** Aktif mi yoksa iskelet mi (active=false ise units boş olabilir). */
  active: boolean;
  /** Bu katmanın bastığı/işaret ettiği üniteler. */
  units: DNASealedUnit[];
  /** Bu katmanın kapadığı yasaklı alanlar. */
  reservedZones: DNAReservedZone[];
  /** İnsan okuru için boş alan ipucu. */
  freeZoneHint?: string;
  /** Genişleme noktası: katmana özel meta. */
  meta?: Record<string, unknown>;
}

/** İçerik matematiksel özeti — adli hafıza. Orijinali saklamadan
 *  tekrar üretilebilir parmak izi. */
export interface DNAContentDigest {
  /** Hash algoritması. */
  algo: "sha256" | "blake3" | "sha512";
  /** Hex string. */
  hex: string;
  /** Orijinalin byte boyutu (varsa). */
  sizeBytes?: number;
  /** Hash girdisi — `bytes` (ham dosya), `normalized` (normalize edilmiş
   *  metin), `frameSample` (video temsil frame hash'leri). */
  source?: "bytes" | "normalized" | "frameSample" | "audioPcm" | "other";
}

/** Yapısal parmak izi — perceptual / structural hash. Medyaya göre
 *  alanlar kısmi doldurulur, eksik olanlar `null` veya `undefined`. */
export interface DNAStructuralFingerprint {
  /** Görsel/video pHash veya dHash (hex). */
  perceptualHash?: string;
  /** Ses fingerprint (chromaprint vb.). */
  audioFingerprint?: string;
  /** Metin stilometrik/linguistik parmak izi (yapı, n-gram, vb.). */
  linguisticFingerprint?: string;
  /** Geometrik checksum — anchor harita / region yerleşimi SHA. */
  geometricChecksum?: string;
  /** Frame sayısı, fps, sample rate, sentence count gibi yapısal
   *  istatistikler (free-form). */
  structuralStats?: Record<string, number | string>;
  /** Ek notlar. */
  notes?: string;
}

/** Encode/decode haritaları — her katman kendi mührünü kendi haritasıyla
 *  bulsun. Modüle özel struct'lar (free-form). */
export interface DNAMaps {
  /** Mühür basarken kullanılan harita (örn frame seçim listesi, T6 slot
   *  haritası, token-shuffle plan). */
  encodeMap?: Record<string, unknown>;
  /** Mühür ararken kullanılacak harita (örn deterministic frame map,
   *  decode-side parser plan). */
  decodeMap?: Record<string, unknown>;
  /** Genel notlar. */
  notes?: string;
}

/** Delil paketi bağlantısı. */
export interface DNAEvidenceRef {
  /** Kayıt eden tarafı tanımlayan ID (cloakId hex). */
  idHex: string;
  /** payload4 hex (varsa) — örn video CRC32(ID) 4-byte. */
  payload4Hex?: string;
  /** İleride delil paketi UUID'sine bağlanacak — şimdilik null. */
  evidencePackId: string | null;
  /** Yasal zaman damgası (RFC3161 / OTS) — varsa hex. */
  legalTimestampHex?: string | null;
}

/** AEGIS DNA — ortak çekirdek kayıt yapısı. */
export interface AegisDNA {
  /** Schema sürümü — geriye dönük uyum için tüketici kontrolü. */
  schemaVersion: "aegis-dna-v1";
  /** Bu kaydı benzersiz tanımlayan id (cloakId veya cloakId+contentDigest
   *  kombinasyonu). */
  dnaId: string;
  /** Bu kayıttaki birincil medya türü (örn video=primary, audio=secondary). */
  primaryMediaType: AegisMediaType;
  /** Bu içerikte aktif olan tüm medya türleri (multi-modal). */
  activeMediaTypes: AegisMediaType[];
  /** Bu kaydın hangi amaçlar için kullanılabileceği. */
  purposes: AegisDNAPurpose[];
  /** Medyaya göre boyut/geometri (free-form opsiyonel). */
  geometry?: {
    width?: number;
    height?: number;
    fps?: number;
    totalFrames?: number;
    durationSec?: number;
    sampleRate?: number;
    channelCount?: number;
    textLength?: number;
    sentenceCount?: number;
    tokenCount?: number;
  };
  /** İçerik matematiksel özeti — adli hafıza. */
  contentDigest: DNAContentDigest;
  /** Yapısal parmak izi — perceptual / structural hash. */
  structuralFingerprint: DNAStructuralFingerprint;
  /** Aktif + iskelet katmanlar. */
  layers: DNALayer[];
  /** Encode/decode haritaları. */
  maps: DNAMaps;
  /** Boş alan ipuçları (genel — başka medya/katmanlar için). */
  freeZoneHints: string[];
  /** Pipeline sürümü (örn "v0.5A", "v0.6.3", "v4.1"). */
  pipelineVersion: string;
  /** Delil paketi bağlantısı. */
  evidence: DNAEvidenceRef;
  /** Üretim zamanı (ISO 8601). */
  createdAt: string;
  /** Genişleme noktası: bağlam meta. */
  meta?: Record<string, unknown>;
}
