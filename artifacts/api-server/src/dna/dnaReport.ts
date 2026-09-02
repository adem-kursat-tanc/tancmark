import { eq } from "drizzle-orm";
import { db, aegisDnaRecordsTable } from "@workspace/db";
import type {
  AegisDNA,
  DNALayer,
  DnaCompartments,
} from "@workspace/aegis-core";
import { buildDnaCompartments, detectLayerOverlap } from "@workspace/aegis-core";
import type { DNAOverlapWarning } from "@workspace/aegis-core";
import {
  buildReadOnlyDnaProductReport,
  mediaTypeToReadOnlyDnaModule,
  type DnaReadOnlyProductReport,
} from "./dnaReadOnlyProductReport.js";
import {
  buildDnaActiveAssistNoDecisionChange,
  type DnaActiveAssistNoDecisionChangeReport,
} from "./dnaActiveAssistNoDecisionChange.js";

export type DnaReportLayer = {
  layerId: string;
  mediaType: string;
  active: boolean;
  version: string;
  unitCount: number;
  regionCount: number;
  reservedZoneCount: number;
  freeZoneHint?: string;
};

export type DnaReport = {
  present: boolean;
  dnaId?: string;
  primaryMediaType?: string;
  activeMediaTypes?: ReadonlyArray<string>;
  schemaVersion?: string;
  pipelineVersion?: string;
  contentSizeBytes?: number;
  geometricChecksum?: string;
  layers?: ReadonlyArray<DnaReportLayer>;
  overlapWarnings?: ReadonlyArray<{
    unitKey: number | string;
    layerA: string;
    layerB: string;
    regionA: string;
    regionB: string;
    reason: string;
  }>;
  reservedFutureModules: {
    audio: "not_yet_implemented; dna_slot_reserved";
    secureRoom: "not_yet_implemented; dna_slot_reserved";
    poison: "not_yet_implemented; dna_slot_reserved";
  };
  contract:
    "DNA harita/rapor/öncelik seviyesinde okundu; karar/eşik/decode/A5/Layer B/T6 mantığı DEĞİŞMEDİ.";
  errorReadingDna?: string;
  /** v0.6.9 — 11 bölümlü salt-okuma projeksiyon. Karar mantığı dokunulmaz;
   *  aday sinyal / kurtarma ipucu / karşılaştırma bölümleri finalDecisionGate
   *  üzerinde yetkisizdir (yapısal sözleşme). */
  compartments?: DnaCompartments;
  readOnlyDnaReport?: DnaReadOnlyProductReport;
  readOnlyDnaReportError?: string;
  activeAssistNoDecisionChange?: DnaActiveAssistNoDecisionChangeReport;
  activeAssistNoDecisionChangeError?: string;
};

const RESERVED_FUTURE = {
  audio: "not_yet_implemented; dna_slot_reserved" as const,
  secureRoom: "not_yet_implemented; dna_slot_reserved" as const,
  poison: "not_yet_implemented; dna_slot_reserved" as const,
};

const CONTRACT_NOTE =
  "DNA harita/rapor/öncelik seviyesinde okundu; karar/eşik/decode/A5/Layer B/T6 mantığı DEĞİŞMEDİ." as const;

/**
 * Salt-okuma DNA lookup. Karar zincirine dokunmaz; arama tarafının
 * raporlayabilmesi için harita / öncelik bilgisi döner.
 *
 * DNA yoksa veya DB hata verirse `{present:false, ...}` döner — eski
 * arama yolu hiçbir şekilde bozulmaz (caller try/catch içine almak
 * zorunda değil; helper hata fırlatmaz).
 */
export interface BuildDnaReportOptions {
  /** Compartments projeksiyon dahil edilsin mi? Default `true`. */
  includeCompartments?: boolean;
  /** Compartments mode — default `"summary"` (payload bloat kaçınma).
   *  Admin/telemetry endpoint'leri `"full"` ile detay alabilir. */
  compartmentsMode?: "summary" | "full";
}

export async function buildDnaReport(
  dnaId: string,
  opts: BuildDnaReportOptions = {},
): Promise<DnaReport> {
  const baseAbsent: DnaReport = {
    present: false,
    reservedFutureModules: RESERVED_FUTURE,
    contract: CONTRACT_NOTE,
  };
  if (typeof dnaId !== "string" || dnaId.length === 0 || dnaId.length > 256) {
    return baseAbsent;
  }
  let rows: ReadonlyArray<typeof aegisDnaRecordsTable.$inferSelect>;
  try {
    rows = await db
      .select()
      .from(aegisDnaRecordsTable)
      .where(eq(aegisDnaRecordsTable.dnaId, dnaId))
      .limit(1);
  } catch (e) {
    return {
      ...baseAbsent,
      errorReadingDna: e instanceof Error ? e.message : String(e),
    };
  }
  if (rows.length === 0) return baseAbsent;
  const row = rows[0]!;
  const dna = row.dna as AegisDNA;
  const layers: DnaReportLayer[] = dna.layers.map((l: DNALayer) => ({
    layerId: l.layerId,
    mediaType: l.mediaType,
    active: l.active,
    version: l.version,
    unitCount: l.units.length,
    regionCount: l.units.reduce(
      (acc: number, u: { regions: ReadonlyArray<unknown> }) =>
        acc + u.regions.length,
      0,
    ),
    reservedZoneCount: l.reservedZones.length,
    freeZoneHint: l.freeZoneHint,
  }));
  const overlaps = detectLayerOverlap(dna).map((w: DNAOverlapWarning) => ({
    unitKey: w.unitKey,
    layerA: w.layerAId,
    layerB: w.layerBId,
    regionA: w.regionAId,
    regionB: w.regionBId,
    reason: w.reason,
  }));
  // v0.6.9 — 11 bölümlü compartment projeksiyon. Salt-okuma; karar zincirine
  // dokunmaz. Overlap warnings reservedZones bölümüne enjekte edilir.
  // Opt-out: includeCompartments=false. Default summary mode (payload bloat
  // kaçınma); admin/telemetry "full" mode'u açabilir.
  const includeCompartments = opts.includeCompartments !== false;
  let compartments: DnaCompartments | undefined;
  if (includeCompartments) {
    try {
      const c = buildDnaCompartments(dna, {
        mode: opts.compartmentsMode ?? "summary",
      });
      compartments = {
        ...c,
        reservedZones: {
          ...c.reservedZones,
          overlapWarnings: overlaps,
        },
      };
    } catch {
      compartments = undefined;
    }
  }
  const reportModule = mediaTypeToReadOnlyDnaModule(row.primaryMediaType);
  let readOnlyDnaReport: DnaReadOnlyProductReport | undefined;
  let readOnlyDnaReportError: string | undefined;
  let activeAssistNoDecisionChange:
    | DnaActiveAssistNoDecisionChangeReport
    | undefined;
  let activeAssistNoDecisionChangeError: string | undefined;
  if (reportModule !== undefined) {
    try {
      readOnlyDnaReport = buildReadOnlyDnaProductReport({
        module: reportModule,
        dna,
      });
    } catch (e) {
      readOnlyDnaReportError = e instanceof Error ? e.message : String(e);
    }
    if (readOnlyDnaReport !== undefined) {
      try {
        activeAssistNoDecisionChange = buildDnaActiveAssistNoDecisionChange({
          module: reportModule,
          readOnlyReport: readOnlyDnaReport,
        });
      } catch (e) {
        activeAssistNoDecisionChangeError =
          e instanceof Error ? e.message : String(e);
      }
    }
  }
  return {
    present: true,
    dnaId: row.dnaId,
    primaryMediaType: row.primaryMediaType,
    activeMediaTypes: (row.activeMediaTypes as ReadonlyArray<string>) ?? [],
    schemaVersion: dna.schemaVersion,
    pipelineVersion: row.pipelineVersion ?? undefined,
    contentSizeBytes: row.contentSizeBytes ?? undefined,
    geometricChecksum: row.geometricChecksum ?? undefined,
    layers,
    overlapWarnings: overlaps,
    reservedFutureModules: RESERVED_FUTURE,
    contract: CONTRACT_NOTE,
    compartments,
    readOnlyDnaReport,
    readOnlyDnaReportError,
    activeAssistNoDecisionChange,
    activeAssistNoDecisionChangeError,
  };
}
