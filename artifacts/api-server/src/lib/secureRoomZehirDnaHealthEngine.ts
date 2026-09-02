import {
  buildHierarchicalDnaHealthSummary,
  type HierarchicalDnaBaseEngineInput,
  type HierarchicalDnaHealthSummary,
} from "./hierarchicalDnaBaseEngine";

export const SECURE_ROOM_ZEHIR_DNA_HEALTH_ENGINE_VERSION =
  "secure-room-zehir-dna-health-engine-v0.1" as const;

export interface SecureRoomZehirDnaHealthSummary extends HierarchicalDnaHealthSummary {
  secureRoomZehirEngineVersion: typeof SECURE_ROOM_ZEHIR_DNA_HEALTH_ENGINE_VERSION;
  learnsFromSignals: readonly string[];
  viewerLayerSignals: string[];
  screenSessionSignals: string[];
  suspiciousBehaviorSignals: string[];
  evidenceSupportSignals: string[];
  canAccuseOrDecideLeak: false;
  nextSecureRoomZehirWork: string;
}

const SECURE_ROOM_ZEHIR_LEARNS_FROM_SIGNALS = [
  "file viewed",
  "copy viewed",
  "session started",
  "session ended",
  "screen recording candidate",
  "suspicious behavior",
  "viewer layer candidate",
  "screen session candidate",
  "evidence support signals",
] as const;

const SECURE_ROOM_ZEHIR_ENGINE_CONFIG = {
  dnaName: "Secure Room/Zehir DNA",
  modules: ["secure_room", "evidence", "security", "visual", "video", "watermark"] as const,
  eventTypes: [
    "secure_room_signal",
    "evidence_signal",
    "security_signal",
    "read_attempt",
    "recovery_attempt",
    "debt_signal",
    "recommendation_signal",
  ] as const,
  debtKeywords: [
    "secure room",
    "zehir",
    "poison",
    "file viewed",
    "copy viewed",
    "viewer",
    "screen",
    "session",
    "recording",
    "suspicious",
    "evidence",
    "leak",
  ] as const,
  readinessNote:
    "Secure Room/Zehir DNA summarizes viewer/session/evidence hints only; it cannot accuse, identify a leaker or open VAULT.",
  defaultActions: [
    {
      riskLevel: "high" as const,
      title: "Keep Secure Room leak signals evidence-support only",
      reason:
        "Viewer, screen-session and suspicious-behavior signals can affect people and must never become automatic accusations.",
      nextStep:
        "Require APPROVE_CHIEF_BRAIN_SAFE_ACTION before any high-risk Secure Room/Zehir implementation task.",
      requiresHumanApproval: true,
    },
  ],
};

export function buildSecureRoomZehirDnaHealth(
  input: HierarchicalDnaBaseEngineInput = {},
): SecureRoomZehirDnaHealthSummary {
  const base = buildHierarchicalDnaHealthSummary(SECURE_ROOM_ZEHIR_ENGINE_CONFIG, input);

  return {
    ...base,
    secureRoomZehirEngineVersion: SECURE_ROOM_ZEHIR_DNA_HEALTH_ENGINE_VERSION,
    learnsFromSignals: SECURE_ROOM_ZEHIR_LEARNS_FROM_SIGNALS,
    viewerLayerSignals: [
      "viewer layer candidate summary",
      "copy viewed support signal",
      "file viewed support signal",
    ],
    screenSessionSignals: [
      "session started/ended summary",
      "screen session candidate summary",
      "screen recording candidate summary",
    ],
    suspiciousBehaviorSignals: [
      "unusual view/copy pattern summary",
      "repeated screen-session candidate summary",
      "high-risk behavior requires human review",
    ],
    evidenceSupportSignals: [
      "support evidence only",
      "not final proof",
      "no personal accusation without human-reviewed evidence package",
    ],
    canAccuseOrDecideLeak: false,
    nextSecureRoomZehirWork:
      "Create a read-only Secure Room/Zehir matrix for viewer, session, screen-candidate and evidence-support signals.",
  };
}
