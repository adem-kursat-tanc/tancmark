export type ScreenToCameraDisplayStatus =
  | "not_found"
  | "candidate_found"
  | "strong_candidate_found";

export type ScreenToCameraConfidenceBand = "dusuk" | "orta" | "guclu";

export interface ScreenToCameraDisplay {
  title: "Ekran Çekimi Aday İzi";
  present: boolean;
  status: ScreenToCameraDisplayStatus;
  userStatus: "İz bulunmadı" | "Aday iz bulundu" | "Güçlü aday iz bulundu";
  supportLabel: "Aday destek yok" | "Aday destek sinyali";
  nonFinalStatus: "Kesin sonuç değildir";
  safetyNotice: string;
  source: "screen-to-camera";
  confidenceBand: ScreenToCameraConfidenceBand | null;
  displayOnly: true;
  candidateOnly: true;
  canOpenVault: false;
  confirmed: false;
  idMatched: false;
  vaultCapable: false;
}

export const SCREEN_TO_CAMERA_SAFETY_NOTICE =
  "Bu sonuç tek başına kesin delil değildir. Kesin sonuç yalnız TancMark ID okunup sistem kaydıyla eşleşirse oluşur.";

const EMPTY_SCREEN_TO_CAMERA_DISPLAY: ScreenToCameraDisplay = {
  title: "Ekran Çekimi Aday İzi",
  present: false,
  status: "not_found",
  userStatus: "İz bulunmadı",
  supportLabel: "Aday destek yok",
  nonFinalStatus: "Kesin sonuç değildir",
  safetyNotice: SCREEN_TO_CAMERA_SAFETY_NOTICE,
  source: "screen-to-camera",
  confidenceBand: null,
  displayOnly: true,
  candidateOnly: true,
  canOpenVault: false,
  confirmed: false,
  idMatched: false,
  vaultCapable: false,
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function cleanString(value: unknown, max = 120): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function bool(value: unknown): boolean {
  return value === true;
}

function confidenceBand(value: unknown): ScreenToCameraConfidenceBand | null {
  const text = cleanString(value, 32)?.toLowerCase();
  if (text === "guclu" || text === "güçlü" || text === "strong") return "guclu";
  if (text === "orta" || text === "medium") return "orta";
  if (text === "dusuk" || text === "düşük" || text === "low") return "dusuk";
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  if (value >= 0.75) return "guclu";
  if (value >= 0.4) return "orta";
  return "dusuk";
}

function normalizeStatus(
  rec: Record<string, unknown>,
  band: ScreenToCameraConfidenceBand | null,
): ScreenToCameraDisplayStatus {
  const rawStatus = cleanString(
    rec["status"] ?? rec["result"] ?? rec["decision"] ?? rec["finalDecision"],
    80,
  )
    ?.toLowerCase()
    .replace(/\s+/g, "_");
  if (
    rawStatus === "strong_candidate_found" ||
    rawStatus === "strong_candidate" ||
    rawStatus === "guclu_aday_iz_bulundu" ||
    rawStatus === "güçlü_aday_iz_bulundu" ||
    band === "guclu"
  ) {
    return "strong_candidate_found";
  }
  if (
    rawStatus === "candidate_found" ||
    rawStatus === "candidate" ||
    rawStatus === "screen_light_candidate_only" ||
    rawStatus === "screen_light_candidate_only".toLowerCase() ||
    rawStatus === "aday_iz_bulundu" ||
    bool(rec["present"]) ||
    bool(rec["candidateSupport"]) ||
    bool(rec["detected"])
  ) {
    return "candidate_found";
  }
  return "not_found";
}

function userStatusFor(status: ScreenToCameraDisplayStatus): ScreenToCameraDisplay["userStatus"] {
  if (status === "strong_candidate_found") return "Güçlü aday iz bulundu";
  if (status === "candidate_found") return "Aday iz bulundu";
  return "İz bulunmadı";
}

export function buildScreenToCameraDisplay(value: unknown): ScreenToCameraDisplay {
  const rec = asRecord(value);
  if (Object.keys(rec).length === 0) return { ...EMPTY_SCREEN_TO_CAMERA_DISPLAY };

  const band = confidenceBand(rec["confidenceBand"] ?? rec["confidence"]);
  const status = normalizeStatus(rec, band);
  const present = status !== "not_found";

  return {
    title: "Ekran Çekimi Aday İzi",
    present,
    status,
    userStatus: userStatusFor(status),
    supportLabel: present ? "Aday destek sinyali" : "Aday destek yok",
    nonFinalStatus: "Kesin sonuç değildir",
    safetyNotice: SCREEN_TO_CAMERA_SAFETY_NOTICE,
    source: "screen-to-camera",
    confidenceBand: present ? band : null,
    displayOnly: true,
    candidateOnly: true,
    canOpenVault: false,
    confirmed: false,
    idMatched: false,
    vaultCapable: false,
  };
}

export function screenToCameraFromDetails(
  details: Record<string, unknown>,
): ScreenToCameraDisplay {
  const supportDetails = asRecord(details["supportDetails"]);
  const candidate =
    supportDetails["screenToCamera"] ??
    supportDetails["screenToCameraCandidate"] ??
    supportDetails["presentationSignature"] ??
    details["screenToCamera"] ??
    details["screenToCameraCandidate"] ??
    details["presentationSignature"];

  if (candidate) return buildScreenToCameraDisplay(candidate);

  const eventType = cleanString(details["eventType"], 80);
  if (
    eventType === "screen_to_camera_candidate" ||
    eventType === "presentation_signature_candidate" ||
    eventType === "screen_light_candidate"
  ) {
    return buildScreenToCameraDisplay(details);
  }

  return { ...EMPTY_SCREEN_TO_CAMERA_DISPLAY };
}
