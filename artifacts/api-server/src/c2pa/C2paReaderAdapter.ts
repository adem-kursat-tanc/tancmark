// SPDX-License-Identifier: AGPL-3.0-only

import { Reader } from "@contentauth/c2pa-node";
import type { Manifest, ManifestAssertion, ManifestStore, ValidationStatus } from "@contentauth/c2pa-types";
import { readRegularFileBounded } from "./safeLocalFiles";
import {
  MAX_C2PA_ASSET_BYTES,
  TANCMARK_C2PA_ASSERTION_LABEL,
  c2paMimeTypeForPath,
  parseTancMarkSupportAssertion,
} from "./C2paSecurityPolicy";
import {
  c2paSafetyBoundary,
  type C2paInspectionResult,
  type C2paResultStatus,
  type C2paTrustMode,
  type TancMarkC2paAssertion,
} from "./C2paResultTypes";
import { C2paTrustAdapter } from "./C2paTrustAdapter";

type ReaderInput = Readonly<{
  bytes: Buffer;
  mimeType: string;
  trustMode: C2paTrustMode;
  customTrustAnchorPem?: string;
}>;

const ASSET_FAILURE = /(?:dataHash|bmffHash|boxHash|asset|assertion)[A-Za-z.]*?(?:mismatch|invalid)|hash\.mismatch/i;
const SIGNATURE_FAILURE = /(?:claimSignature|signingCredential|signature)[A-Za-z.]*?(?:mismatch|invalid|missing|expired|revoked|unsupported)/i;

function safeUnknownResult(status: C2paResultStatus, trustMode: C2paTrustMode): C2paInspectionResult {
  return Object.freeze({
    ok: status === "NO_C2PA",
    status,
    trustMode,
    trustStatus: status === "NO_C2PA" ? "NO_SIGNING_CREDENTIAL" : "INVALID_OR_UNVERIFIED",
    c2paPresent: false,
    c2paValid: false,
    signatureCryptographicallyValid: false,
    assetIntegrityValid: false,
    manifestEmbedded: false,
    remoteManifestUrlPresent: false,
    validationState: "Unknown",
    claimVersion: null,
    validationCodes: Object.freeze([]),
    claimGeneratorNames: Object.freeze([]),
    actionNames: Object.freeze([]),
    assertionLabels: Object.freeze([]),
    ingredientCount: 0,
    tancmarkAssertion: null,
    tancmarkAssertionCount: 0,
    provenanceAvailable: false,
    supportEvidence: Object.freeze([]),
    safety: c2paSafetyBoundary(),
  });
}

function statuses(store: ManifestStore): ValidationStatus[] {
  const rows: ValidationStatus[] = [];
  if (Array.isArray(store.validation_status)) rows.push(...store.validation_status);
  const active = store.validation_results?.activeManifest;
  if (active) rows.push(...active.success, ...active.informational, ...active.failure);
  return rows;
}

function activeManifest(store: ManifestStore, reader: Reader): Manifest | undefined {
  return reader.getActive() ?? (store.active_manifest && store.manifests
    ? store.manifests[store.active_manifest] ?? undefined
    : undefined);
}

function assertionValue(assertion: ManifestAssertion): unknown {
  if (typeof assertion.data !== "string") return assertion.data;
  try { return JSON.parse(assertion.data); } catch { return null; }
}

function actionNames(manifest: Manifest | undefined): string[] {
  const result: string[] = [];
  for (const assertion of manifest?.assertions ?? []) {
    if (!assertion.label.startsWith("c2pa.actions")) continue;
    const data = assertionValue(assertion);
    if (!data || typeof data !== "object" || !Array.isArray((data as { actions?: unknown }).actions)) continue;
    for (const action of (data as { actions: unknown[] }).actions) {
      if (action && typeof action === "object" && typeof (action as { action?: unknown }).action === "string") {
        result.push((action as { action: string }).action);
      }
    }
  }
  return [...new Set(result)].sort();
}

function tancmarkAssertions(manifest: Manifest | undefined): {
  count: number;
  parsed: TancMarkC2paAssertion | null;
  malformed: boolean;
} {
  // The official SDK normalizes the final `.v1` assertion version suffix to
  // the base label in its JSON Reader representation.
  const normalizedLabel = TANCMARK_C2PA_ASSERTION_LABEL.replace(/\.v1$/, "");
  const matches = (manifest?.assertions ?? []).filter((row) =>
    row.label === TANCMARK_C2PA_ASSERTION_LABEL || row.label === normalizedLabel);
  if (matches.length !== 1) return { count: matches.length, parsed: null, malformed: matches.length > 1 };
  const parsed = parseTancMarkSupportAssertion(assertionValue(matches[0]!));
  return { count: 1, parsed, malformed: parsed === null };
}

function classifyStatus(input: {
  trustMode: C2paTrustMode;
  state: "Invalid" | "Valid" | "Trusted" | "Unknown";
  codes: readonly string[];
  failureCodes: readonly string[];
  hasActive: boolean;
  malformedAssertion: boolean;
}): C2paResultStatus {
  if (input.malformedAssertion) return "C2PA_MALFORMED";
  if (input.failureCodes.some((code) => ASSET_FAILURE.test(code))) return "C2PA_ASSET_TAMPERED";
  if (input.failureCodes.some((code) => SIGNATURE_FAILURE.test(code))) return "C2PA_INVALID_SIGNATURE";
  if (input.state === "Invalid") return "C2PA_INVALID_SIGNATURE";
  if (!input.hasActive) return "C2PA_PRESENT_WELL_FORMED";
  if (input.state === "Trusted" && input.trustMode === "OFFICIAL_C2PA_TRUST_LIST") {
    return "C2PA_VALID_TRUSTED_CERTIFICATE";
  }
  if (input.state === "Valid" || input.state === "Trusted") {
    if (input.trustMode === "OFFLINE_TEST") return "C2PA_VALID_TEST_CERTIFICATE";
    if (input.trustMode === "CUSTOM_TRUST_ANCHOR") return "C2PA_VALID_UNTRUSTED_CERTIFICATE";
    return "C2PA_PRESENT_VALID";
  }
  return "C2PA_PRESENT_WELL_FORMED";
}

export class C2paReaderAdapter {
  static async readManifest(filePath: string, options: {
    trustMode?: C2paTrustMode;
    customTrustAnchorPem?: string;
  } = {}): Promise<C2paInspectionResult> {
    const trustMode = options.trustMode ?? "OFFLINE_TEST";
    const mimeType = c2paMimeTypeForPath(filePath);
    if (!mimeType) return safeUnknownResult("C2PA_UNSUPPORTED_FORMAT", trustMode);
    try {
      const bytes = await readRegularFileBounded(filePath, MAX_C2PA_ASSET_BYTES);
      return await this.readBytes({ bytes, mimeType, trustMode, customTrustAnchorPem: options.customTrustAnchorPem });
    } catch {
      return safeUnknownResult("C2PA_PROCESSING_ERROR", trustMode);
    }
  }

  static async readBytes(input: ReaderInput): Promise<C2paInspectionResult> {
    if (!Buffer.isBuffer(input.bytes) || input.bytes.length <= 0 || input.bytes.length > MAX_C2PA_ASSET_BYTES) {
      return safeUnknownResult("C2PA_PROCESSING_ERROR", input.trustMode);
    }
    try {
      const settings = C2paTrustAdapter.settings(input.trustMode, input.customTrustAnchorPem);
      const reader = await Reader.fromAsset({ buffer: input.bytes, mimeType: input.mimeType }, settings);
      if (!reader) return safeUnknownResult("NO_C2PA", input.trustMode);
      const remoteUrl = reader.remoteUrl();
      if (remoteUrl) {
        const base = safeUnknownResult("C2PA_REMOTE_MANIFEST_BLOCKED", input.trustMode);
        return Object.freeze({ ...base, c2paPresent: true, remoteManifestUrlPresent: true, provenanceAvailable: true });
      }
      const store = reader.json();
      const active = activeManifest(store, reader);
      const allStatuses = statuses(store);
      const codes = [...new Set(allStatuses.map((row) => row.code).filter(Boolean))].sort();
      const failureCodes = [
        ...(store.validation_results?.activeManifest?.failure ?? []).map((row) => row.code),
        ...(store.validation_status ?? []).filter((row) => row.success === false).map((row) => row.code),
      ];
      const state = store.validation_state ?? "Unknown";
      const assertion = tancmarkAssertions(active);
      const status = classifyStatus({
        trustMode: input.trustMode,
        state,
        codes,
        failureCodes,
        hasActive: Boolean(active),
        malformedAssertion: assertion.malformed,
      });
      const signatureValid = (state === "Valid" || state === "Trusted")
        && !failureCodes.some((code) => SIGNATURE_FAILURE.test(code));
      const integrityValid = (state === "Valid" || state === "Trusted")
        && !failureCodes.some((code) => ASSET_FAILURE.test(code));
      const valid = signatureValid && integrityValid && !assertion.malformed;
      const claimGenerators = [...new Set((active?.claim_generator_info ?? [])
        .map((row) => row.name).filter((name): name is string => typeof name === "string"))].sort();
      const actions = actionNames(active);
      const assertionLabels = [...new Set((active?.assertions ?? []).map((row) => row.label))].sort();
      const evidence = ["c2pa_manifest_present"];
      if (signatureValid) evidence.push("c2pa_signature_cryptographically_valid");
      if (integrityValid) evidence.push("c2pa_asset_integrity_valid");
      if (assertion.parsed) evidence.push("tancmark_namespaced_assertion_support_only");
      return Object.freeze({
        ok: status !== "C2PA_INVALID_SIGNATURE" && status !== "C2PA_ASSET_TAMPERED" && status !== "C2PA_MALFORMED",
        status,
        trustMode: input.trustMode,
        trustStatus: C2paTrustAdapter.classify(input.trustMode, state, codes),
        c2paPresent: true,
        c2paValid: valid,
        signatureCryptographicallyValid: signatureValid,
        assetIntegrityValid: integrityValid,
        manifestEmbedded: reader.isEmbedded(),
        remoteManifestUrlPresent: false,
        validationState: state,
        claimVersion: typeof active?.claim_version === "number" ? active.claim_version : null,
        validationCodes: Object.freeze(codes),
        claimGeneratorNames: Object.freeze(claimGenerators),
        actionNames: Object.freeze(actions),
        assertionLabels: Object.freeze(assertionLabels),
        ingredientCount: active?.ingredients?.length ?? 0,
        tancmarkAssertion: assertion.parsed,
        tancmarkAssertionCount: assertion.count,
        provenanceAvailable: true,
        supportEvidence: Object.freeze(evidence),
        safety: c2paSafetyBoundary(),
      });
    } catch {
      return safeUnknownResult("C2PA_PROCESSING_ERROR", input.trustMode);
    }
  }
}

export const readManifest = C2paReaderAdapter.readManifest.bind(C2paReaderAdapter);
export const validateManifest = readManifest;
export const extractProvenanceSummary = readManifest;
export async function verifyAssetIntegrity(filePath: string): Promise<boolean> {
  return (await C2paReaderAdapter.readManifest(filePath)).assetIntegrityValid;
}
