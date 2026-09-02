import {
  pgTable,
  bigserial,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * AEGIS DNA — kalıcı matematiksel ikiz / adli hafıza kaydı.
 *
 * Bu tablo bir tek-modül kaydı DEĞİLDİR. Orijinal veriyi saklamadan
 * tutulan, tüm medya türleri (video · görsel · metin · ses · Secure Room
 * · zehir) için kalıcı **matematiksel ikiz** rolü oynar. Her satır bir
 * "mühürlenmiş içerik" için tek bir DNA snapshot'tır.
 *
 * Yapı kuralları:
 *   - Eski mühür kayıtları (cloaked_documents, vault_anchors) bu tabloyu
 *     **zorunlu kılmaz**; eski satırlar boş kalabilir. Yeni mühürleyiciler
 *     yazar.
 *   - `dna` alanı tam `AegisDNA` (lib/aegis-core/dna) JSON snapshot'ıdır;
 *     yapı değişirse `schemaVersion` alanı içinde tutulur (geri uyumluluk).
 *   - `dna_id` benzersizdir; format `<primaryMediaType>:<idHex>` (örn
 *     "video:deadbeef…", "image:…", "text:…").
 *   - `active_media_types` çoklu modül kayıtları için (örn video+ses
 *     birlikte mühürlendiğinde) array kalır.
 *
 * Sıralama / sorgu:
 *   - dna_id uniq → tek doğal anahtar.
 *   - client_id idx → tenant filtreleme (nullable: video lab şu an
 *     admin-only, client bağı zorunlu değil).
 *   - primary_media_type idx → "video kayıtlarını ver" tipi sorgu.
 */
export const aegisDnaRecordsTable = pgTable(
  "aegis_dna_records",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** "<primaryMediaType>:<idHex>" — benzersiz doğal anahtar. */
    dnaId: text("dna_id").notNull(),
    /** Tekil baskın medya türü ("video" | "image" | "text" | "audio" | ...). */
    primaryMediaType: text("primary_media_type").notNull(),
    /** Bu içerikte aktif olan tüm medya türleri (array). */
    activeMediaTypes: jsonb("active_media_types")
      .$type<string[]>()
      .notNull()
      .default([]),
    /** Pipeline sürümü (örn "v0.5A", "v0.6.3"). */
    pipelineVersion: text("pipeline_version").notNull(),
    /** Orijinal içeriğin SHA256 hex'i (saklamadan). Null = ölçülmedi. */
    contentDigestHex: text("content_digest_hex"),
    /** Orijinal içerik byte uzunluğu. Null = ölçülmedi. */
    contentSizeBytes: integer("content_size_bytes"),
    /** Yapısal parmak izi (anchor/region geometri checksum'ı). */
    geometricChecksum: text("geometric_checksum"),
    /** Mühür hex ID'si (örn 32-byte hex, video idBuffer). */
    idHex: text("id_hex").notNull(),
    /** CRC32 / payload4 hex (mühür içeriği). */
    payload4Hex: text("payload4_hex"),
    /** Opsiyonel tenant/client bağı. */
    clientId: text("client_id"),
    /** Tam AegisDNA JSON snapshot — schema şu an `aegis-dna-v1`. */
    dna: jsonb("dna").$type<unknown>().notNull(),
  },
  (t) => [
    uniqueIndex("aegis_dna_records_dna_id_uniq").on(t.dnaId),
    index("aegis_dna_records_created_idx").on(t.createdAt),
    index("aegis_dna_records_primary_media_idx").on(t.primaryMediaType),
    index("aegis_dna_records_client_idx").on(t.clientId),
  ],
);

export const aegisDnaRecordSelectSchema = createSelectSchema(aegisDnaRecordsTable);
export type AegisDnaRecordRow = z.infer<typeof aegisDnaRecordSelectSchema>;
