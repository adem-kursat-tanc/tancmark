import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";

export type C2paReadOnlyStatus =
  | "not_found"
  | "found"
  | "unreadable"
  | "invalid_or_unverified";

export interface C2paReadOnlyStatusReport {
  status: C2paReadOnlyStatus;
  userLabel: string;
  supportNote: typeof C2PA_STATUS_SUPPORT_NOTE;
  checked: boolean;
  source: "read_only_marker_scan_v0.1";
  fileName: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  bytesScanned: number;
  markersFound: string[];
  verification: {
    manifestRead: false;
    signatureVerified: false;
    certificateUsed: false;
    externalServiceCalled: false;
    manifestWritten: false;
    fileMetadataWritten: false;
  };
  safety: {
    c2paDoesNotDecide: true;
    c2paDoesNotBlockSeal: true;
    c2paDoesNotOpenVault: true;
    c2paDoesNotConfirm: true;
    canOpenVault: false;
    vaultEligible: false;
    confirmed: false;
    idMatched: false;
  };
  note: string;
}

export interface DetectC2paReadOnlyStatusInput {
  sourcePath?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
}

export const C2PA_STATUS_SUPPORT_NOTE =
  "Bu bilgi içerik geçmişini destekler. Kesin TancMark sonucu yalnız gizli TancMark ID okunup sistem kaydıyla eşleşirse oluşur.";

const C2PA_MARKERS = [
  "c2pa",
  "content credentials",
  "contentcredentials",
  "contentauth",
  "manifest_store",
  "claim_generator",
  "assertions",
  "ingredients",
  "application/c2pa",
];

const C2PA_INVALID_MARKERS = [
  "c2pa_invalid",
  "invalid_or_unverified",
  "invalid c2pa",
  "unverified c2pa",
  "signature invalid",
];

function labelForStatus(status: C2paReadOnlyStatus): string {
  if (status === "found") return "Content Credentials bilgisi bulundu.";
  if (status === "unreadable") return "Content Credentials bilgisi okunamadı.";
  if (status === "invalid_or_unverified") {
    return "Content Credentials bilgisi doğrulanamadı.";
  }
  return "Content Credentials bilgisi bulunmadı.";
}

function safeFileName(value: string | null | undefined): string | null {
  if (!value) return null;
  const base = path.basename(value).replace(/[^\w .()[\]-]+/g, "_").slice(0, 180);
  return base || null;
}

function report(
  status: C2paReadOnlyStatus,
  input: {
    checked: boolean;
    fileName: string | null;
    mimeType: string | null;
    fileSizeBytes: number | null;
    bytesScanned: number;
    markersFound: string[];
    note: string;
  },
): C2paReadOnlyStatusReport {
  return {
    status,
    userLabel: labelForStatus(status),
    supportNote: C2PA_STATUS_SUPPORT_NOTE,
    checked: input.checked,
    source: "read_only_marker_scan_v0.1",
    fileName: input.fileName,
    mimeType: input.mimeType,
    fileSizeBytes: input.fileSizeBytes,
    bytesScanned: input.bytesScanned,
    markersFound: input.markersFound,
    verification: {
      manifestRead: false,
      signatureVerified: false,
      certificateUsed: false,
      externalServiceCalled: false,
      manifestWritten: false,
      fileMetadataWritten: false,
    },
    safety: {
      c2paDoesNotDecide: true,
      c2paDoesNotBlockSeal: true,
      c2paDoesNotOpenVault: true,
      c2paDoesNotConfirm: true,
      canOpenVault: false,
      vaultEligible: false,
      confirmed: false,
      idMatched: false,
    },
    note: input.note,
  };
}

function collectMarkers(text: string, markers: string[]): string[] {
  const lower = text.toLowerCase();
  return markers.filter((marker) => lower.includes(marker));
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values)).sort();
}

export async function detectC2paReadOnlyStatus(
  input: DetectC2paReadOnlyStatusInput,
): Promise<C2paReadOnlyStatusReport> {
  const fileName = safeFileName(input.fileName ?? input.sourcePath);
  const mimeType = input.mimeType?.slice(0, 120) ?? null;
  if (!input.sourcePath) {
    return report("unreadable", {
      checked: false,
      fileName,
      mimeType,
      fileSizeBytes: null,
      bytesScanned: 0,
      markersFound: [],
      note: "No file path was provided for the read-only C2PA status scan.",
    });
  }

  const sourcePath = path.resolve(input.sourcePath);
  let fileSizeBytes: number | null = null;
  try {
    const stats = await stat(sourcePath);
    if (!stats.isFile()) {
      return report("unreadable", {
        checked: false,
        fileName,
        mimeType,
        fileSizeBytes: stats.size,
        bytesScanned: 0,
        markersFound: [],
        note: "The provided source path is not a regular file.",
      });
    }
    fileSizeBytes = stats.size;
  } catch {
    return report("unreadable", {
      checked: false,
      fileName,
      mimeType,
      fileSizeBytes: null,
      bytesScanned: 0,
      markersFound: [],
      note: "The provided source file could not be opened for read-only C2PA status scan.",
    });
  }

  const markersFound: string[] = [];
  const invalidMarkersFound: string[] = [];
  let bytesScanned = 0;
  let tail = "";

  try {
    for await (const rawChunk of createReadStream(sourcePath, {
      highWaterMark: 64 * 1024,
    })) {
      const chunk = Buffer.isBuffer(rawChunk) ? rawChunk : Buffer.from(rawChunk);
      bytesScanned += chunk.byteLength;
      const text = `${tail}${chunk.toString("latin1")}`;
      markersFound.push(...collectMarkers(text, C2PA_MARKERS));
      invalidMarkersFound.push(...collectMarkers(text, C2PA_INVALID_MARKERS));
      tail = text.slice(-512);
    }
  } catch {
    return report("unreadable", {
      checked: false,
      fileName,
      mimeType,
      fileSizeBytes,
      bytesScanned,
      markersFound: unique(markersFound),
      note: "The source file became unreadable during read-only C2PA status scan.",
    });
  }

  const uniqueMarkers = unique(markersFound);
  const uniqueInvalidMarkers = unique(invalidMarkersFound);
  if (uniqueInvalidMarkers.length > 0) {
    return report("invalid_or_unverified", {
      checked: true,
      fileName,
      mimeType,
      fileSizeBytes,
      bytesScanned,
      markersFound: unique([...uniqueMarkers, ...uniqueInvalidMarkers]),
      note:
        "C2PA-like data was detected, but the read-only phase does not verify signatures and the data is marked invalid or unverified.",
    });
  }
  if (uniqueMarkers.length > 0) {
    return report("found", {
      checked: true,
      fileName,
      mimeType,
      fileSizeBytes,
      bytesScanned,
      markersFound: uniqueMarkers,
      note:
        "C2PA-like data was detected. This phase is read-only marker detection; it does not verify a manifest or signature.",
    });
  }
  return report("not_found", {
    checked: true,
    fileName,
    mimeType,
    fileSizeBytes,
    bytesScanned,
    markersFound: [],
    note: "No C2PA-like markers were detected in the read-only status scan.",
  });
}
