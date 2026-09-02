import { hkdfSync } from "node:crypto";
import { ml_dsa65 } from "@noble/post-quantum/ml-dsa.js";

export const VAULT_DSA_ALG = "ml-dsa-65" as const;
export const VAULT_DSA_SEED_BYTES = 32;
export const VAULT_KEY_DERIVATION = "hkdf-v1" as const;

export type VaultKeyDerivation = typeof VAULT_KEY_DERIVATION;

export interface DeriveVaultKeypairInput {
  masterSecret: Buffer | Uint8Array;
  tenantSalt: string;
  clientId: string;
  docId: string;
  cloakId: string;
}

export interface VaultKeypair {
  algorithm: typeof VAULT_DSA_ALG;
  publicKey: Uint8Array;
  secretKey: Uint8Array;
  keyDerivation: VaultKeyDerivation;
  seedInfo: string;
}

export function deriveVaultKeypair(
  input: DeriveVaultKeypairInput,
): VaultKeypair {
  const { masterSecret, tenantSalt, clientId, docId, cloakId } = input;
  const info = `aegis-vault-mldsa65-v1|client=${clientId}|doc=${docId}|cloak=${cloakId}`;
  const seed = Buffer.from(
    hkdfSync(
      "sha256",
      masterSecret,
      Buffer.from(`vault|${tenantSalt}`, "utf8"),
      Buffer.from(info, "utf8"),
      VAULT_DSA_SEED_BYTES,
    ),
  );
  const kp = ml_dsa65.keygen(seed);
  return {
    algorithm: VAULT_DSA_ALG,
    publicKey: kp.publicKey,
    secretKey: kp.secretKey,
    keyDerivation: VAULT_KEY_DERIVATION,
    seedInfo: info,
  };
}
