export type HeavyOcrSource =
  | "image_ocr"
  | "video_subtitle"
  | "text_scan";

export type HeavyOcrActivationReason =
  | "candidate_support_unresolved"
  | "text_signal_low_confidence"
  | "id_unread"
  | "selected_problem_area"
  | "problem_area_without_readable_text";

export interface HeavyOcrCandidateTarget {
  targetId: string;
  kind: "image_region" | "video_frame_region" | "text_stream_segment" | "problem_area";
  source: HeavyOcrSource;
  note: string;
}

export interface HeavyOcrCandidateSupport {
  status: "HEAVY_OCR_CANDIDATE_ONLY" | "HEAVY_OCR_NOT_RUN";
  layer: "last_resort_text_support";
  source: HeavyOcrSource;
  triggered: boolean;
  officialDecision: "TEXT_CANDIDATE_SUPPORT" | "TEXT_NOT_FOUND";
  candidateSupport: boolean;
  confirmed: false;
  idRead: false;
  idMatched: false;
  canOpenVault: false;
  vaultCapable: false;
  activationReasons: HeavyOcrActivationReason[];
  selectedTargets: HeavyOcrCandidateTarget[];
  observedTextLength: number;
  observedConfidence: number | null;
  readStatus:
    | "text_signal_observed_but_unconfirmed"
    | "no_readable_text_observed"
    | "not_escalated";
  performance: {
    fullFileScan: false;
    everyFrameScan: false;
    maxTargets: number;
    selectedTargetCount: number;
  };
  safety: {
    candidateOnly: true;
    officialResultRequiresIdMatch: true;
    ocrSignalCannotConfirm: true;
    dnaSignalCannotConfirm: true;
    fuzzySignalCannotConfirm: true;
    moduleIdsAreNotCombined: true;
    thresholdsUnchanged: true;
    opensVault: false;
  };
  note: string;
}

export interface HeavyOcrCandidateInput {
  source: HeavyOcrSource;
  textLength?: number | null;
  confidence?: number | null;
  lowConfidence?: boolean | null;
  textSignal?: boolean | null;
  candidateSupport?: boolean | null;
  idRead?: boolean | null;
  idMatched?: boolean | null;
  finalDecision?: string | null;
  problemTargets?: unknown;
  maxTargets?: number;
}

function cleanString(value: unknown, max = 160): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, max) : null;
}

function sourceDefaultTarget(input: HeavyOcrCandidateInput): HeavyOcrCandidateTarget {
  if (input.source === "video_subtitle") {
    return {
      targetId: "video.text_stream.problem_segment",
      kind: "text_stream_segment",
      source: input.source,
      note: "Existing video text/subtitle signal stayed unresolved; heavy OCR is limited to this text candidate segment.",
    };
  }
  if (input.source === "text_scan") {
    return {
      targetId: "text.scan.unresolved_candidate",
      kind: "problem_area",
      source: input.source,
      note: "Text scan stayed candidate/support only; heavy OCR records this unresolved text target.",
    };
  }
  return {
    targetId: "image.ocr.problem_region",
    kind: "image_region",
    source: input.source,
    note: "Existing image OCR stayed unresolved; heavy OCR is limited to the selected image problem region.",
  };
}

function normalizeTarget(
  value: unknown,
  source: HeavyOcrSource,
  index: number,
): HeavyOcrCandidateTarget | null {
  const fallbackId = `${source}.problem_target.${index + 1}`;
  if (typeof value === "string") {
    const targetId = cleanString(value, 120);
    if (!targetId) return null;
    return {
      targetId,
      kind: "problem_area",
      source,
      note: "Caller-selected problem target. Heavy OCR may inspect only this target, not the whole file.",
    };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const rec = value as Record<string, unknown>;
  const targetId =
    cleanString(rec["targetId"], 120) ??
    cleanString(rec["regionId"], 120) ??
    cleanString(rec["frameId"], 120) ??
    fallbackId;
  const rawKind = cleanString(rec["kind"], 80);
  const kind: HeavyOcrCandidateTarget["kind"] =
    rawKind === "image_region" ||
    rawKind === "video_frame_region" ||
    rawKind === "text_stream_segment" ||
    rawKind === "problem_area"
      ? rawKind
      : "problem_area";
  return {
    targetId,
    kind,
    source,
    note:
      cleanString(rec["note"], 220) ??
      "Selected problem target. Heavy OCR stays bounded to candidate-only support.",
  };
}

function normalizeTargets(
  value: unknown,
  source: HeavyOcrSource,
  maxTargets: number,
): HeavyOcrCandidateTarget[] {
  const raw = Array.isArray(value) ? value : value === undefined ? [] : [value];
  return raw
    .map((item, index) => normalizeTarget(item, source, index))
    .filter((item): item is HeavyOcrCandidateTarget => item !== null)
    .slice(0, maxTargets);
}

export function buildHeavyOcrCandidateSupport(
  input: HeavyOcrCandidateInput,
): HeavyOcrCandidateSupport {
  const textLength =
    typeof input.textLength === "number" && Number.isFinite(input.textLength)
      ? Math.max(0, Math.floor(input.textLength))
      : 0;
  const confidence =
    typeof input.confidence === "number" && Number.isFinite(input.confidence)
      ? input.confidence
      : null;
  const maxTargets =
    typeof input.maxTargets === "number" && Number.isFinite(input.maxTargets)
      ? Math.max(1, Math.min(3, Math.floor(input.maxTargets)))
      : 3;
  const textSignal = input.textSignal === true || textLength > 0;
  const candidateSupport = input.candidateSupport === true;
  const solved = input.idMatched === true;
  const selectedTargets = normalizeTargets(
    input.problemTargets,
    input.source,
    maxTargets,
  );
  const finalDecision = cleanString(input.finalDecision, 80);
  const unresolvedFinal =
    finalDecision === null ||
    finalDecision === "NOT_FOUND" ||
    finalDecision === "TEXT_NOT_FOUND" ||
    finalDecision === "TEXT_CANDIDATE_SUPPORT";

  const activationReasons: HeavyOcrActivationReason[] = [];
  if (!solved && candidateSupport && unresolvedFinal) {
    activationReasons.push("candidate_support_unresolved");
  }
  if (!solved && textSignal && input.lowConfidence === true) {
    activationReasons.push("text_signal_low_confidence");
  }
  if (!solved && textSignal && input.idRead !== true) {
    activationReasons.push("id_unread");
  }
  if (!solved && selectedTargets.length > 0) {
    activationReasons.push("selected_problem_area");
  }
  if (!solved && !textSignal && selectedTargets.length > 0) {
    activationReasons.push("problem_area_without_readable_text");
  }

  const triggered = activationReasons.length > 0;
  const targets = triggered
    ? selectedTargets.length > 0
      ? selectedTargets
      : [sourceDefaultTarget(input)]
    : [];

  return {
    status: triggered ? "HEAVY_OCR_CANDIDATE_ONLY" : "HEAVY_OCR_NOT_RUN",
    layer: "last_resort_text_support",
    source: input.source,
    triggered,
    officialDecision: triggered ? "TEXT_CANDIDATE_SUPPORT" : "TEXT_NOT_FOUND",
    candidateSupport: triggered,
    confirmed: false,
    idRead: false,
    idMatched: false,
    canOpenVault: false,
    vaultCapable: false,
    activationReasons,
    selectedTargets: targets,
    observedTextLength: textLength,
    observedConfidence: confidence,
    readStatus: triggered
      ? textSignal
        ? "text_signal_observed_but_unconfirmed"
        : "no_readable_text_observed"
      : "not_escalated",
    performance: {
      fullFileScan: false,
      everyFrameScan: false,
      maxTargets,
      selectedTargetCount: targets.length,
    },
    safety: {
      candidateOnly: true,
      officialResultRequiresIdMatch: true,
      ocrSignalCannotConfirm: true,
      dnaSignalCannotConfirm: true,
      fuzzySignalCannotConfirm: true,
      moduleIdsAreNotCombined: true,
      thresholdsUnchanged: true,
      opensVault: false,
    },
    note: triggered
      ? "Heavy OCR last-resort layer is active only for unresolved selected text/problem targets. It reports candidate/support only and cannot open VAULT."
      : "Heavy OCR last-resort layer did not run because the cheap path was solved or no unresolved text/problem target was selected.",
  };
}
