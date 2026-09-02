import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { desc, eq, inArray } from "drizzle-orm";
import {
  canaryScopeFor,
  deriveProductSafeProtectionHash,
  protectByClient,
  scanForHoneytokens,
  verifyCanary,
} from "@workspace/aegis-core";
import {
  aegisDnaRecordsTable,
  cloakedDocumentsTable,
  db,
  honeytokensTable,
} from "@workspace/db";
import { aegis } from "./aegis";
import { decodeVideo } from "../video/decodeVideo";

export type PreSealOwnershipAction = "allow" | "block" | "manual_review";
export type PreSealOwnershipMediaType = "text" | "image" | "video";

export interface PreSealOwnershipCheckInput {
  mediaType: PreSealOwnershipMediaType;
  input: string;
  currentClientId: string;
  scanLimit?: number;
}

export interface PreSealOwnershipCheckResult {
  action: PreSealOwnershipAction;
  reason: string;
  exactIdFound: boolean;
  decodedId?: string;
  registeredClientId?: string;
  registeredClientLabel?: string;
  registeredAt?: string;
}

interface RegisteredIdMatch {
  decodedId: string;
  registeredClientId: string | null;
  registeredClientLabel?: string;
  registeredAt?: string;
  source: "explicit_label" | "text_exact_signal" | "video_exact_hidden_id";
}

type CloakedRowForCheck = {
  clientId: string;
  docId: string;
  cloakId: string;
  keyVersion: string;
  protectionHash: string | null;
};

const MAX_SCAN_LIMIT = 1000;
const DEFAULT_SCAN_LIMIT = 200;
const VIDEO_MAX_SCAN_LIMIT = 20;
const DEFAULT_VIDEO_SCAN_LIMIT = 8;
const HEX_ID_RE = "[a-fA-F0-9]{24}|[a-fA-F0-9]{64}";

function nativeOnlyProductBuildActive(): boolean {
  return process.env["AEGIS_NATIVE_ONLY_PRODUCT_BUILD"] === "1";
}

function normalizeScanLimit(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_SCAN_LIMIT;
  return Math.min(MAX_SCAN_LIMIT, Math.max(1, Math.floor(value ?? DEFAULT_SCAN_LIMIT)));
}

function uniqueStrings(values: Iterable<string>): string[] {
  return Array.from(new Set(Array.from(values)));
}

function maskTail(value: string | null | undefined, visible = 4): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  return `****${trimmed.slice(-visible)}`;
}

function maskClientLabel(clientId: string | null | undefined): string | undefined {
  if (!clientId) return undefined;
  const trimmed = clientId.trim();
  if (trimmed.length === 0) return undefined;
  if (trimmed.length <= 2) return `${trimmed[0] ?? "K"}...`;
  return `${trimmed[0]}...${trimmed.slice(-1)}`;
}

function buildRegisteredClientLabel(
  clientId: string | null | undefined,
  decodedId: string,
): string | undefined {
  const clientLabel = maskClientLabel(clientId);
  if (!clientLabel) return undefined;
  return `Kullanici: ${clientLabel} / kayit: ${maskTail(decodedId) ?? "****"}`;
}

function extractExplicitIds(input: string): string[] {
  const ids: string[] = [];
  const labelled = new RegExp(
    `\\b(?:cloakId|cloak_id|aegisId|aegis_id|idHex|dnaId|dna_id)\\s*[:=]\\s*["']?(?:(?:text|image|video):)?(${HEX_ID_RE})["']?`,
    "gi",
  );
  const prefixed = new RegExp(`\\b(?:text|image|video):(${HEX_ID_RE})\\b`, "gi");
  for (const re of [labelled, prefixed]) {
    let match: RegExpExecArray | null;
    while ((match = re.exec(input)) !== null) {
      const id = match[1];
      if (id) ids.push(id.toLowerCase());
    }
  }
  return uniqueStrings(ids);
}

async function lookupRegisteredId(
  decodedId: string,
  mediaType: PreSealOwnershipMediaType,
): Promise<RegisteredIdMatch | null> {
  const cloakRows = await db
    .select({
      cloakId: cloakedDocumentsTable.cloakId,
      clientId: cloakedDocumentsTable.clientId,
    })
    .from(cloakedDocumentsTable)
    .where(eq(cloakedDocumentsTable.cloakId, decodedId))
    .limit(2);
  if (cloakRows.length > 0) {
    return {
      decodedId,
      registeredClientId: cloakRows[0]!.clientId,
      source: "explicit_label",
    };
  }

  const dnaIds =
    mediaType === "text"
      ? [`text:${decodedId}`]
      : mediaType === "image"
        ? [`image:${decodedId}`, `text:${decodedId}`]
        : [`video:${decodedId}`];
  const dnaRows = await db
    .select({
      idHex: aegisDnaRecordsTable.idHex,
      clientId: aegisDnaRecordsTable.clientId,
      createdAt: aegisDnaRecordsTable.createdAt,
    })
    .from(aegisDnaRecordsTable)
    .where(inArray(aegisDnaRecordsTable.dnaId, dnaIds))
    .limit(2);
  if (dnaRows.length > 0) {
    return {
      decodedId,
      registeredClientId: dnaRows[0]!.clientId,
      registeredClientLabel: buildRegisteredClientLabel(
        dnaRows[0]!.clientId,
        decodedId,
      ),
      registeredAt: dnaRows[0]!.createdAt.toISOString(),
      source: "explicit_label",
    };
  }
  return null;
}

async function honeytokenHasDecisiveMatch(
  suspectText: string,
  row: CloakedRowForCheck,
): Promise<boolean> {
  if (!row.protectionHash) return false;
  const tokens = await db
    .select({
      fakeValue: honeytokensTable.fakeValue,
    })
    .from(honeytokensTable)
    .where(eq(honeytokensTable.protectionHash, row.protectionHash));
  if (tokens.length === 0) return false;

  const stripped = aegis.strip(suspectText);
  const hits = scanForHoneytokens(
    stripped,
    tokens.map((t) => t.fakeValue),
  );
  if (hits.length === 0) return false;

  const hitFakes = uniqueStrings(hits.map((h) => h.fakeValue));
  const ambiguityRows = await db
    .select({
      fakeValue: honeytokensTable.fakeValue,
      clientId: honeytokensTable.clientId,
    })
    .from(honeytokensTable)
    .where(inArray(honeytokensTable.fakeValue, hitFakes));
  const byFake = new Map<string, Set<string>>();
  for (const r of ambiguityRows) {
    if (!byFake.has(r.fakeValue)) byFake.set(r.fakeValue, new Set());
    byFake.get(r.fakeValue)!.add(r.clientId);
  }
  return hitFakes.some((fakeValue) => (byFake.get(fakeValue)?.size ?? 0) === 1);
}

async function rowHasExactTextSignal(
  suspectText: string,
  row: CloakedRowForCheck,
): Promise<boolean> {
  const secret = aegis.getSecretForVersion(row.keyVersion);
  if (secret) {
    const canaryScope = canaryScopeFor(row.clientId, row.docId);
    if (verifyCanary(suspectText, canaryScope, secret).found) return true;

    if (row.protectionHash) {
      const productSafeHash = deriveProductSafeProtectionHash(suspectText, row.clientId, {
        secret,
        docId: row.docId,
        keyVersion: row.keyVersion,
      });
      if (productSafeHash === row.protectionHash) return true;
      try {
        const reproduced = protectByClient(suspectText, row.clientId, { secret });
        if (reproduced.protectionHash === row.protectionHash) return true;
      } catch {
        // Exact pre-seal detection is conservative; failures become no match.
      }
    }
  }
  return honeytokenHasDecisiveMatch(suspectText, row);
}

async function findRegisteredExactTextMatches(
  input: string,
  scanLimit: number,
): Promise<RegisteredIdMatch[]> {
  const rows = await db
    .select({
      clientId: cloakedDocumentsTable.clientId,
      docId: cloakedDocumentsTable.docId,
      cloakId: cloakedDocumentsTable.cloakId,
      keyVersion: cloakedDocumentsTable.keyVersion,
      protectionHash: cloakedDocumentsTable.protectionHash,
    })
    .from(cloakedDocumentsTable)
    .orderBy(desc(cloakedDocumentsTable.createdAt))
    .limit(scanLimit);

  const matches: RegisteredIdMatch[] = [];
  for (const row of rows) {
    if (await rowHasExactTextSignal(input, row)) {
      matches.push({
        decodedId: row.cloakId,
        registeredClientId: row.clientId,
        source: "text_exact_signal",
      });
    }
  }
  return matches;
}

function normalizeVideoScanLimit(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_VIDEO_SCAN_LIMIT;
  return Math.min(
    VIDEO_MAX_SCAN_LIMIT,
    Math.max(1, Math.floor(value ?? DEFAULT_VIDEO_SCAN_LIMIT)),
  );
}

async function findRegisteredExactVideoMatches(
  videoPath: string,
  scanLimit: number,
): Promise<RegisteredIdMatch[]> {
  // codeql[js/path-injection] Reported flow originates at the text-only route, whose literal mediaType cannot reach this video-only branch.
  if (!fs.existsSync(videoPath)) return [];

  const rows = await db
    .select({
      idHex: aegisDnaRecordsTable.idHex,
      clientId: aegisDnaRecordsTable.clientId,
      createdAt: aegisDnaRecordsTable.createdAt,
    })
    .from(aegisDnaRecordsTable)
    .where(eq(aegisDnaRecordsTable.primaryMediaType, "video"))
    .orderBy(desc(aegisDnaRecordsTable.createdAt))
    .limit(scanLimit);

  const workBase = fs.mkdtempSync(
    path.join(os.tmpdir(), "aegis-video-preseal-"),
  );
  try {
    for (const row of rows) {
      const workDir = path.join(
        workBase,
        row.idHex.replace(/[^a-fA-F0-9]/g, "").slice(0, 16) || "candidate",
      );
      fs.mkdirSync(workDir, { recursive: true });
      try {
        const decoded = await decodeVideo({
          videoPath,
          idInput: row.idHex,
          workDir,
        });
        if (decoded.verdict === "VAULT") {
          return [
            {
              decodedId: row.idHex,
              registeredClientId: row.clientId,
              registeredClientLabel: buildRegisteredClientLabel(
                row.clientId,
                row.idHex,
              ),
              registeredAt: row.createdAt.toISOString(),
              source: "video_exact_hidden_id",
            },
          ];
        }
      } catch {
        // Video pre-seal is conservative: decode failures are not ownership claims.
      }
    }
    return [];
  } finally {
    try {
      fs.rmSync(workBase, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

function decideFromMatches(
  matches: RegisteredIdMatch[],
  currentClientId: string,
): PreSealOwnershipCheckResult {
  if (matches.length === 0) {
    return {
      action: "allow",
      reason: "no_exact_aegis_id_found",
      exactIdFound: false,
    };
  }

  const registeredMatches = matches.filter((m) => m.registeredClientId !== null);
  const unknownMatches = matches.filter((m) => m.registeredClientId === null);
  if (registeredMatches.length === 0 && unknownMatches.length > 0) {
    return {
      action: "manual_review",
      reason: "exact_aegis_id_found_but_owner_record_missing",
      exactIdFound: true,
      decodedId: unknownMatches[0]!.decodedId,
      registeredAt: unknownMatches[0]!.registeredAt,
    };
  }

  const ownerIds = uniqueStrings(
    registeredMatches.map((m) => m.registeredClientId).filter((v): v is string => v !== null),
  );
  if (ownerIds.length > 1) {
    return {
      action: "manual_review",
      reason: "multiple_registered_owners_for_exact_aegis_id_signals",
      exactIdFound: true,
      decodedId: registeredMatches[0]!.decodedId,
      registeredAt: registeredMatches[0]!.registeredAt,
    };
  }

  const ownerId = ownerIds[0]!;
  const match = registeredMatches[0]!;
  const decodedId = match.decodedId;
  if (ownerId === currentClientId) {
    return {
      action: "allow",
      reason: "exact_aegis_id_registered_to_current_client",
      exactIdFound: true,
      decodedId,
      registeredClientId: ownerId,
      registeredClientLabel: match.registeredClientLabel,
      registeredAt: match.registeredAt,
    };
  }

  return {
    action: "block",
    reason: "exact_aegis_id_registered_to_different_client",
    exactIdFound: true,
    decodedId,
    registeredClientId: ownerId,
    registeredClientLabel: match.registeredClientLabel,
    registeredAt: match.registeredAt,
  };
}

export async function preSealOwnershipCheck(
  input: PreSealOwnershipCheckInput,
): Promise<PreSealOwnershipCheckResult> {
  if (input.input.trim().length === 0) {
    return {
      action: "allow",
      reason: "empty_input_has_no_exact_aegis_id",
      exactIdFound: false,
    };
  }

  if (input.mediaType === "video") {
    if (nativeOnlyProductBuildActive()) {
      return {
        action: "manual_review",
        reason: "video_preseal_legacy_reader_removed_from_native_product_bundle",
        exactIdFound: false,
      };
    }
    const videoMatches = await findRegisteredExactVideoMatches(
      input.input,
      normalizeVideoScanLimit(input.scanLimit),
    );
    return decideFromMatches(videoMatches, input.currentClientId);
  }

  const explicitIds = extractExplicitIds(input.input);
  const explicitMatches: RegisteredIdMatch[] = [];
  const missingExplicitIds: string[] = [];
  for (const decodedId of explicitIds) {
    const match = await lookupRegisteredId(decodedId, input.mediaType);
    if (match) explicitMatches.push(match);
    else missingExplicitIds.push(decodedId);
  }
  if (missingExplicitIds.length > 0) {
    return {
      action: "manual_review",
      reason: "explicit_aegis_id_found_but_registry_lookup_missing",
      exactIdFound: true,
      decodedId: missingExplicitIds[0],
    };
  }

  const scanLimit = normalizeScanLimit(input.scanLimit);
  const textMatches = await findRegisteredExactTextMatches(input.input, scanLimit);
  return decideFromMatches([...explicitMatches, ...textMatches], input.currentClientId);
}
