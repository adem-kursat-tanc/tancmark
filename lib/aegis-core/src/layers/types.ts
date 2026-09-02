/**
 * AEGIS v4.1 — Three-Tier Defense (Decoy / Mid / Vault)
 *
 * Common contract that each tier's protection adapter implements. Step 1
 * (this commit) introduces the interface and wires the existing protection
 * stack as the `mid` tier WITHOUT rewriting it. Steps 2 and 3 add the
 * `decoy` and `vault` tiers behind the same interface.
 *
 * Design invariants:
 *   - Each tier writes one row to `cloak_layers` keyed by (cloakId, tier).
 *   - `LayerApplyResult.protectedText` is the text passed to the next tier
 *     downstream (decoy → mid → vault). For Step 1 only `mid` exists; its
 *     protectedText is the canonical outbound carrier.
 *   - `LayerApplyResult.layerData` is the JSON manifest persisted to
 *     `cloak_layers.layer_data` — tier-specific blob, opaque to the caller.
 *   - `verify` is best-effort and MUST NOT throw; failures return
 *     `{present:false, intact:false}` with the error in `details`.
 *
 * Backwards compatibility: legacy `cloaked_documents` rows continue to be
 * the authoritative storage for mid-tier payloads (cascade chain, semantic
 * positional plan, layer flags). The `cloak_layers` row is a forward-
 * compatible manifest pointer; analyze-text reads stay on
 * `cloaked_documents` in Step 1 (no read-path changes).
 */

export const LAYER_TIERS = ["decoy", "mid", "vault"] as const;
export type LayerTier = (typeof LAYER_TIERS)[number];

export interface LayerContext {
  clientId: string;
  docId: string;
  cloakId: string;
  keyVersion: string;
}

export interface LayerApplyResult {
  tier: LayerTier;
  /** Text to pass to the next tier downstream. */
  protectedText: string;
  /** Manifest persisted to `cloak_layers.layer_data` (tier-specific). */
  layerData: Record<string, unknown>;
}

export interface LayerVerifyResult {
  tier: LayerTier;
  /** Did this tier's marks appear in the suspect text? */
  present: boolean;
  /** Are the present marks consistent with the manifest? */
  intact: boolean;
  details: Record<string, unknown>;
}

export interface Layer<TInput = unknown> {
  readonly tier: LayerTier;
  apply(input: TInput, ctx: LayerContext): Promise<LayerApplyResult> | LayerApplyResult;
  verify(
    suspectText: string,
    manifest: Record<string, unknown>,
    ctx: LayerContext,
  ): Promise<LayerVerifyResult> | LayerVerifyResult;
}
