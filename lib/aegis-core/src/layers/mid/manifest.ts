import type { CloakResult } from "../../dataCloak";
import type { CloakStrength } from "../../types-shared";
import type { LayerApplyResult, LayerContext } from "../types";

/**
 * AEGIS v4.1 Step 1 — Mid-tier manifest builder.
 *
 * Wraps the existing `cloakText` result into a `LayerApplyResult` so we can
 * persist a forward-compatible row in `cloak_layers` (tier="mid") alongside
 * the legacy `cloaked_documents` insert. NO rewrite of the cloak pipeline —
 * `cloakText` still owns the actual transformations; this helper only
 * extracts a stable summary into `layerData`.
 *
 * `layerData` shape (frozen contract for v4.1.x):
 *   {
 *     pipelineVersion: "v3" | "v4",
 *     strength: "low" | "medium" | "high",
 *     sensitiveTopic: string,
 *     layersApplied: string[],          // technique flags that fired
 *     protectionHash: string,
 *     canaryTerm: string,
 *     canarySignature: string,
 *     honeytokenCount: number,
 *     cascadeNodeCount: number,         // 0 = no cascade chain persisted
 *     semanticPositionalPresent: boolean,
 *     cloakIdEcho: string,              // diagnostic — must equal cloaked_documents.cloak_id
 *     keyVersion: string
 *   }
 *
 * Authoritative payloads (cascade nodes, semantic plan, honeytoken records)
 * stay in their existing tables. analyze-text continues to read those
 * tables directly in Step 1; the manifest is informational + forward-
 * compatible (Steps 2/3 will store decoy/vault payloads here).
 */
export interface BuildMidManifestExtras {
  pipelineVersion: "v3" | "v4";
  /** Effective strength after sensitive-topic downgrade (route owns this). */
  strength: CloakStrength;
  cascadeNodeCount: number;
  semanticPositionalPresent: boolean;
}

export interface MidLayerManifestData {
  pipelineVersion: "v3" | "v4";
  strength: CloakStrength;
  sensitiveTopic: string;
  layersApplied: string[];
  protectionHash: string;
  canaryTerm: string;
  canarySignature: string;
  honeytokenCount: number;
  cascadeNodeCount: number;
  semanticPositionalPresent: boolean;
  cloakIdEcho: string;
  keyVersion: string;
}

export function buildMidLayerManifest(
  cloak: CloakResult,
  extras: BuildMidManifestExtras,
  ctx: LayerContext,
): LayerApplyResult {
  const layers = (cloak.layers ?? {}) as unknown as Record<string, boolean>;
  const layersApplied = Object.entries(layers)
    .filter(([, on]) => on === true)
    .map(([name]) => name);

  const layerData: MidLayerManifestData = {
    pipelineVersion: extras.pipelineVersion,
    strength: extras.strength,
    sensitiveTopic: cloak.sensitiveTopic,
      layersApplied,
      protectionHash: cloak.protectionHash,
      canaryTerm: cloak.canary.term,
      canarySignature: cloak.canary.signature,
    honeytokenCount: cloak.honeytokens?.length ?? 0,
    cascadeNodeCount: extras.cascadeNodeCount,
    semanticPositionalPresent: extras.semanticPositionalPresent,
    cloakIdEcho: ctx.cloakId,
    keyVersion: ctx.keyVersion,
  };

  return {
    tier: "mid",
    protectedText: cloak.protectedText,
    layerData: layerData as unknown as Record<string, unknown>,
  };
}
