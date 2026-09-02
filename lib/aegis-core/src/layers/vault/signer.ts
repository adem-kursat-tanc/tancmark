import { createHash } from "node:crypto";
import { ml_dsa65 } from "@noble/post-quantum/ml-dsa.js";
import {
  deriveVaultKeypair,
  VAULT_DSA_ALG,
  VAULT_KEY_DERIVATION,
  type DeriveVaultKeypairInput,
  type VaultKeyDerivation,
} from "./keypair.js";

export interface VaultAnchorPayload {
  cloakId: string;
  clientId: string;
  docId: string;
  keyVersion: string;
  pipelineVersion: string;
  protectionHash: string | null;
  cascadeRoot: string | null;
  issuedAt: string;
}

export interface SignVaultAnchorInput extends DeriveVaultKeypairInput {
  payload: VaultAnchorPayload;
}

export interface VaultAnchor {
  algorithm: typeof VAULT_DSA_ALG;
  keyDerivation: VaultKeyDerivation;
  publicKey: Uint8Array;
  signature: Uint8Array;
  payload: VaultAnchorPayload;
  payloadCanonical: string;
  payloadDigestSha256: string;
  signedAt: string;
}

export function canonicalizePayload(p: VaultAnchorPayload): string {
  const ordered: Record<string, unknown> = {
    cascadeRoot: p.cascadeRoot,
    clientId: p.clientId,
    cloakId: p.cloakId,
    docId: p.docId,
    issuedAt: p.issuedAt,
    keyVersion: p.keyVersion,
    pipelineVersion: p.pipelineVersion,
    protectionHash: p.protectionHash,
  };
  return JSON.stringify(ordered);
}

export function signVaultAnchor(input: SignVaultAnchorInput): VaultAnchor {
  const kp = deriveVaultKeypair(input);
  const canonical = canonicalizePayload(input.payload);
  const msg = Buffer.from(canonical, "utf8");
  const signature = ml_dsa65.sign(msg, kp.secretKey);
  const digest = createHash("sha256").update(msg).digest("hex");
  return {
    algorithm: VAULT_DSA_ALG,
    keyDerivation: VAULT_KEY_DERIVATION,
    publicKey: kp.publicKey,
    signature,
    payload: input.payload,
    payloadCanonical: canonical,
    payloadDigestSha256: digest,
    signedAt: new Date().toISOString(),
  };
}

export interface VerifyVaultAnchorInput {
  publicKey: Uint8Array;
  payload: VaultAnchorPayload;
  signature: Uint8Array;
}

export function verifyVaultAnchor(input: VerifyVaultAnchorInput): boolean {
  const canonical = canonicalizePayload(input.payload);
  const msg = Buffer.from(canonical, "utf8");
  try {
    return ml_dsa65.verify(input.signature, msg, input.publicKey);
  } catch {
    return false;
  }
}

/**
 * Step 3 Bölüm 2 — analyze-text verify yolu için. DB'de saklı
 * `payload_canonical` byte'larını yeniden imzalama yapmadan doğrudan
 * `ml_dsa65.verify` ile doğrular. JSON parse + recanonicalize roundtrip'i
 * gereksiz olduğundan tampering yüzeyi daraltılır (saklanan canonical
 * string'i bozan herhangi bir değişiklik signature mismatch üretir).
 */
export interface VerifyVaultAnchorRawInput {
  publicKey: Uint8Array;
  payloadCanonical: string;
  signature: Uint8Array;
}

export function verifyVaultAnchorRaw(input: VerifyVaultAnchorRawInput): boolean {
  try {
    return ml_dsa65.verify(
      input.signature,
      Buffer.from(input.payloadCanonical, "utf8"),
      input.publicKey,
    );
  } catch {
    return false;
  }
}
