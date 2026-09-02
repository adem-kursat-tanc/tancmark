import { buildLiveAppendOnlyApprovalLogMock } from "./liveAppendOnlyApprovalLogMock";

export const LIVE_APPROVAL_HASH_CHAIN_DECISION_ROLE =
  "live_approval_hash_chain_preview_support_only_no_vault_no_confirmed" as const;

export interface LiveApprovalHashChainPreview {
  liveSessionId: string;
  chainIdPreview: string;
  entriesCountPreview: number;
  firstHashPreview: string;
  latestHashPreview: string;
  chainValidPreview: true;
  tamperDetectedPreview: false;
  realHashChainStored: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_APPROVAL_HASH_CHAIN_DECISION_ROLE;
}

export function buildLiveApprovalHashChainPreview(liveSessionId: string): LiveApprovalHashChainPreview {
  const log = buildLiveAppendOnlyApprovalLogMock(liveSessionId);
  const firstHashPreview = log.entries[0]?.currentHashPreview ?? "MOCK_HASH_EMPTY";
  const latestHashPreview = log.entries.at(-1)?.currentHashPreview ?? "MOCK_HASH_EMPTY";
  return {
    liveSessionId,
    chainIdPreview: `approval_chain_preview_${liveSessionId}`,
    entriesCountPreview: log.entries.length,
    firstHashPreview,
    latestHashPreview,
    chainValidPreview: true,
    tamperDetectedPreview: false,
    realHashChainStored: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_APPROVAL_HASH_CHAIN_DECISION_ROLE,
  };
}
