export {
  deriveVaultKeypair,
  VAULT_DSA_ALG,
  VAULT_DSA_SEED_BYTES,
  VAULT_KEY_DERIVATION,
  type DeriveVaultKeypairInput,
  type VaultKeyDerivation,
  type VaultKeypair,
} from "./keypair.js";

export {
  canonicalizePayload,
  signVaultAnchor,
  verifyVaultAnchor,
  verifyVaultAnchorRaw,
  type VaultAnchor,
  type VaultAnchorPayload,
  type SignVaultAnchorInput,
  type VerifyVaultAnchorInput,
  type VerifyVaultAnchorRawInput,
} from "./signer.js";
