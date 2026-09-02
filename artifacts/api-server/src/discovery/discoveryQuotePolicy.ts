import type { DiscoveryConfig } from "./config";

export interface DiscoveryQuotePolicy {
  quoteEnabled: boolean;
  quoteMode: "internal_preview";
  chargeEnabled: false;
  marginMultiplier: number;
  riskBufferPercent: number;
  maxAutoVerificationCandidates: number;
  quoteUnitConversionFactor: number;
  candidateVerificationUnitCostUsd: number;
  supportOnly: true;
  decisionRole: "discovery_quote_policy_no_vault_no_confirmed";
  canOpenVault: false;
  confirmed: false;
  final: false;
}

function safePositive(value: number, fallback: number): number {
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function buildDiscoveryQuotePolicy(config: DiscoveryConfig): DiscoveryQuotePolicy {
  return {
    quoteEnabled: config.quoteEnabled,
    quoteMode: "internal_preview",
    chargeEnabled: false,
    marginMultiplier: safePositive(config.marginMultiplierDefault, 1.8),
    riskBufferPercent: safePositive(config.riskBufferPercentDefault, 0.15),
    maxAutoVerificationCandidates: Math.max(1, Math.floor(config.maxAutoVerificationCandidates)),
    quoteUnitConversionFactor: safePositive(config.quoteUnitConversionFactor, 100),
    candidateVerificationUnitCostUsd: safePositive(config.candidateVerificationUnitCostUsd, 0.0005),
    supportOnly: true,
    decisionRole: "discovery_quote_policy_no_vault_no_confirmed",
    canOpenVault: false,
    confirmed: false,
    final: false,
  };
}

