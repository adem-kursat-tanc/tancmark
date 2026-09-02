// SPDX-License-Identifier: AGPL-3.0-only

import { createHmac } from "node:crypto";
import { lstat, realpath } from "node:fs/promises";
import path from "node:path";

export const C2PA_REMOTE_MANIFEST_FETCH_ENV = "C2PA_REMOTE_MANIFEST_FETCH" as const;
export const C2PA_TENANT_ROOTS_ENV = "TANCMARK_C2PA_TENANT_ROOTS_JSON" as const;
export const C2PA_SIGNING_PROFILES_ENV = "TANCMARK_C2PA_SIGNING_PROFILES_JSON" as const;
export const C2PA_SIGNING_ENABLED_ENV = "TANCMARK_C2PA_SIGNING_ENABLED" as const;
export const C2PA_REGISTRY_REFERENCE_HMAC_KEYS_ENV = "TANCMARK_C2PA_REGISTRY_REFERENCE_HMAC_KEYS_JSON" as const;

const SAFE_ASSET_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,179}$/;
const SAFE_RECORD_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/;

export type C2paSigningProfile = Readonly<{
  certificatePath: string;
  privateKeyPath: string;
  algorithm: string;
  secretManagerReference: string | null;
}>;

function objectFromJsonEnv(name: string, env: NodeJS.ProcessEnv): Record<string, unknown> {
  const raw = env[name];
  if (!raw || raw.length > 64 * 1024) throw new Error(`${name.toLowerCase()}_not_configured`);
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error(`${name.toLowerCase()}_invalid`); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${name.toLowerCase()}_invalid`);
  }
  return parsed as Record<string, unknown>;
}

function normalizedForCompare(value: string): string {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function isWithin(candidate: string, root: string): boolean {
  const normalizedCandidate = normalizedForCompare(candidate);
  const normalizedRoot = normalizedForCompare(root);
  return normalizedCandidate === normalizedRoot
    || normalizedCandidate.startsWith(`${normalizedRoot}${path.sep}`);
}

export function c2paAssetName(value: unknown): string {
  if (typeof value !== "string" || !SAFE_ASSET_NAME.test(value)
    || value === "." || value === ".." || path.basename(value) !== value) {
    throw new Error("c2pa_asset_reference_invalid");
  }
  return value;
}

export function c2paRegistryRecordIdentity(
  tenantId: string,
  value: unknown,
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (typeof value !== "string" || !SAFE_RECORD_ID.test(value)) {
    throw new Error("c2pa_registry_record_reference_invalid");
  }
  const keys = objectFromJsonEnv(C2PA_REGISTRY_REFERENCE_HMAC_KEYS_ENV, env);
  const encodedKey = keys[tenantId];
  if (typeof encodedKey !== "string" || !/^[A-Za-z0-9_-]{43,}$/.test(encodedKey)) {
    throw new Error("c2pa_registry_reference_hmac_key_not_configured");
  }
  const key = Buffer.from(encodedKey, "base64url");
  if (key.length < 32 || key.toString("base64url") !== encodedKey) {
    throw new Error("c2pa_registry_reference_hmac_key_invalid");
  }
  const digest = createHmac("sha256", key)
    .update("tancmark:c2pa:private-registry-handle:v1\0", "utf8")
    .update(tenantId, "utf8")
    .update("\0", "utf8")
    .update(value, "utf8")
    .digest("base64url");
  return `tmr-input-v1_${digest}`;
}

async function tenantRoot(tenantId: string, env: NodeJS.ProcessEnv): Promise<string> {
  const roots = objectFromJsonEnv(C2PA_TENANT_ROOTS_ENV, env);
  const configured = roots[tenantId];
  if (typeof configured !== "string" || !path.isAbsolute(configured)) {
    throw new Error("c2pa_tenant_root_not_configured");
  }
  const stats = await lstat(configured);
  if (!stats.isDirectory() || stats.isSymbolicLink()) throw new Error("c2pa_tenant_root_invalid");
  const resolved = await realpath(configured);
  if (!isWithin(resolved, configured) || !isWithin(configured, resolved)) {
    throw new Error("c2pa_tenant_root_invalid");
  }
  return resolved;
}

export async function resolveC2paTenantInput(input: {
  tenantId: string;
  assetName: unknown;
  env?: NodeJS.ProcessEnv;
}): Promise<string> {
  const root = await tenantRoot(input.tenantId, input.env ?? process.env);
  const candidate = path.join(root, c2paAssetName(input.assetName));
  const candidateStats = await lstat(candidate);
  if (!candidateStats.isFile() || candidateStats.isSymbolicLink() || candidateStats.nlink !== 1) {
    throw new Error("c2pa_asset_must_be_regular_unlinked_file");
  }
  const resolved = await realpath(candidate);
  if (!isWithin(resolved, root)) throw new Error("c2pa_asset_outside_tenant_root");
  const stats = await lstat(resolved);
  if (!stats.isFile() || stats.isSymbolicLink() || stats.nlink !== 1) {
    throw new Error("c2pa_asset_must_be_regular_unlinked_file");
  }
  return resolved;
}

export async function resolveC2paTenantOutput(input: {
  tenantId: string;
  outputName: unknown;
  env?: NodeJS.ProcessEnv;
}): Promise<string> {
  const root = await tenantRoot(input.tenantId, input.env ?? process.env);
  const candidate = path.join(root, c2paAssetName(input.outputName));
  if (!isWithin(candidate, root)) throw new Error("c2pa_output_outside_tenant_root");
  try {
    await lstat(candidate);
    throw new Error("c2pa_output_already_exists");
  } catch (error) {
    if (error instanceof Error && error.message === "c2pa_output_already_exists") throw error;
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new Error("c2pa_output_invalid");
  }
  return candidate;
}

export function c2paSigningProfile(tenantId: string, env: NodeJS.ProcessEnv = process.env): C2paSigningProfile {
  if (env[C2PA_SIGNING_ENABLED_ENV] !== "1") throw new Error("c2pa_signing_not_enabled");
  const profiles = objectFromJsonEnv(C2PA_SIGNING_PROFILES_ENV, env);
  const raw = profiles[tenantId];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("c2pa_signing_profile_not_configured");
  const row = raw as Record<string, unknown>;
  if (typeof row["secretManagerReference"] === "string") {
    throw new Error("c2pa_secret_manager_adapter_not_configured");
  }
  const certificatePath = row["certificatePath"];
  const privateKeyPath = row["privateKeyPath"];
  const algorithm = row["algorithm"] ?? "es256";
  if (typeof certificatePath !== "string" || !path.isAbsolute(certificatePath)
    || typeof privateKeyPath !== "string" || !path.isAbsolute(privateKeyPath)
    || typeof algorithm !== "string") {
    throw new Error("c2pa_signing_profile_invalid");
  }
  return Object.freeze({ certificatePath, privateKeyPath, algorithm, secretManagerReference: null });
}

export function assertC2paNoNetwork(env: NodeJS.ProcessEnv = process.env): void {
  if (env[C2PA_REMOTE_MANIFEST_FETCH_ENV] === "true") {
    throw new Error("c2pa_remote_manifest_fetch_not_supported");
  }
}
