// SPDX-License-Identifier: AGPL-3.0-only

import { createHash } from "node:crypto";
import path from "node:path";
import type { C2paResultStatus, TancMarkC2paAssertion } from "./C2paResultTypes";

export const TANCMARK_C2PA_ASSERTION_LABEL = "com.tancmark.registry.v1" as const;
export const MAX_C2PA_ASSET_BYTES = 64 * 1024 * 1024;
export const MAX_C2PA_OUTPUT_BYTES = 128 * 1024 * 1024;
export const MAX_C2PA_CERTIFICATE_BYTES = 1024 * 1024;
export const MAX_C2PA_PRIVATE_KEY_BYTES = 1024 * 1024;
export const C2PA_REMOTE_MANIFESTS_IMPLEMENTED = false as const;

const MIME_BY_EXTENSION = new Map<string, string>([
  [".jpg", "image/jpeg"], [".jpeg", "image/jpeg"], [".png", "image/png"],
  [".mp4", "video/mp4"], [".mov", "video/quicktime"],
]);

export function c2paMimeTypeForPath(filePath: string): string | null {
  return MIME_BY_EXTENSION.get(path.extname(filePath).toLowerCase()) ?? null;
}

export function assertC2paTestSigningAllowed(environment: NodeJS.ProcessEnv = process.env): void {
  if (environment.NODE_ENV !== "test"
    || environment.TANCMARK_C2PA_ALLOW_TEST_SIGNING !== "1"
    || environment.AEGIS_PRODUCT_RUNTIME === "1") {
    throw new Error("c2pa_test_signing_not_allowed");
  }
}

export function opaquePublicRegistryReference(recordIdentity: string): string {
  if (typeof recordIdentity !== "string" || !/^tmr-input-v1_[A-Za-z0-9_-]{43}$/.test(recordIdentity)) {
    throw new Error("record_identity_invalid");
  }
  return `tmr_v1_${createHash("sha256")
    .update("tancmark:c2pa:registry-reference:v1\0", "utf8")
    .update(recordIdentity, "utf8")
    .digest("base64url")}`;
}

function exactIsoDate(value: string): string {
  if (typeof value !== "string" || value.length < 20 || value.length > 32) throw new Error("record_created_at_invalid");
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) throw new Error("record_created_at_invalid");
  return value;
}

export function buildTancMarkSupportAssertion(input: {
  recordIdentity: string;
  recordVersion: string;
  algorithmVersion: string;
  createdAt: string;
  publicVerificationUrl?: string;
}): TancMarkC2paAssertion {
  if (typeof input.recordVersion !== "string" || input.recordVersion.length < 1 || input.recordVersion.length > 64
    || !/^[A-Za-z0-9._-]+$/.test(input.recordVersion)) throw new Error("record_version_invalid");
  if (typeof input.algorithmVersion !== "string" || input.algorithmVersion.length < 1 || input.algorithmVersion.length > 64
    || !/^[A-Za-z0-9._-]+$/.test(input.algorithmVersion)) throw new Error("algorithm_version_invalid");
  let publicVerificationUrl: string | undefined;
  if (input.publicVerificationUrl !== undefined) {
    if (input.publicVerificationUrl.length > 512) throw new Error("public_verification_url_invalid");
    let parsed: URL;
    try { parsed = new URL(input.publicVerificationUrl); } catch { throw new Error("public_verification_url_invalid"); }
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.hash) {
      throw new Error("public_verification_url_invalid");
    }
    publicVerificationUrl = parsed.toString();
  }
  return Object.freeze({
    schemaVersion: "1",
    publicRegistryReference: opaquePublicRegistryReference(input.recordIdentity),
    recordVersion: input.recordVersion,
    algorithmVersion: input.algorithmVersion,
    createdAt: exactIsoDate(input.createdAt),
    ...(publicVerificationUrl ? { publicVerificationUrl } : {}),
    supportOnly: true,
  });
}

export function parseTancMarkSupportAssertion(value: unknown): TancMarkC2paAssertion | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const keys = Object.keys(row).sort();
  const required = "algorithmVersion,createdAt,publicRegistryReference,recordVersion,schemaVersion,supportOnly";
  const withUrl = "algorithmVersion,createdAt,publicRegistryReference,publicVerificationUrl,recordVersion,schemaVersion,supportOnly";
  if (keys.join(",") !== required && keys.join(",") !== withUrl) return null;
  if (row.schemaVersion !== "1" || row.supportOnly !== true) return null;
  if (typeof row.publicRegistryReference !== "string" || !/^tmr_v1_[A-Za-z0-9_-]{43}$/.test(row.publicRegistryReference)) return null;
  if (typeof row.recordVersion !== "string" || row.recordVersion.length > 64 || !/^[A-Za-z0-9._-]+$/.test(row.recordVersion)) return null;
  if (typeof row.algorithmVersion !== "string" || row.algorithmVersion.length > 64 || !/^[A-Za-z0-9._-]+$/.test(row.algorithmVersion)) return null;
  if (typeof row.createdAt !== "string") return null;
  try { exactIsoDate(row.createdAt); } catch { return null; }
  let publicVerificationUrl: string | undefined;
  if (row.publicVerificationUrl !== undefined) {
    if (typeof row.publicVerificationUrl !== "string" || row.publicVerificationUrl.length > 512) return null;
    try {
      const parsed = new URL(row.publicVerificationUrl);
      if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.hash) return null;
      publicVerificationUrl = parsed.toString();
    } catch { return null; }
  }
  return Object.freeze({
    schemaVersion: "1",
    publicRegistryReference: row.publicRegistryReference,
    recordVersion: row.recordVersion,
    algorithmVersion: row.algorithmVersion,
    createdAt: row.createdAt,
    ...(publicVerificationUrl ? { publicVerificationUrl } : {}),
    supportOnly: true,
  });
}

export function remoteManifestDecision(url: string | null | undefined): {
  allowed: false;
  status: C2paResultStatus;
  reason: string;
} {
  if (!url) return { allowed: false, status: "C2PA_REMOTE_MANIFEST_BLOCKED", reason: "remote_manifest_url_missing" };
  let parsed: URL;
  try { parsed = new URL(url); } catch {
    return { allowed: false, status: "C2PA_REMOTE_MANIFEST_BLOCKED", reason: "remote_manifest_url_invalid" };
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    return { allowed: false, status: "C2PA_REMOTE_MANIFEST_BLOCKED", reason: "remote_manifest_scheme_or_credentials_blocked" };
  }
  return { allowed: false, status: "C2PA_REMOTE_MANIFEST_BLOCKED", reason: "remote_manifest_support_disabled_in_r8" };
}
