export type AuthorizedLayerEvidenceV2 = {
  present: boolean;
  exactPhysicalIdMatched: boolean;
  presentedFullIdentityMatched: boolean;
  registryVerified: boolean;
  signatureVerified: boolean;
  uniqueActiveRecord: boolean;
  tenantId?: string;
  accountId?: string;
  registryRecordId?: string;
  registryRevision?: number;
};

export type MultichannelProvenanceDecisionV2 = {
  decision:
    | "MULTI_CHANNEL_VAULT"
    | "MIXED_MEDIA_PROVENANCE"
    | "VIDEO_LAYER_VAULT"
    | "AUDIO_VAULT"
    | "CANDIDATE_SUPPORT_ONLY"
    | "NOT_FOUND"
    | "MANUAL_REVIEW";
  videoLayerOwnership: boolean;
  audioLayerOwnership: boolean;
  wholeVideoOwnership: boolean;
  multiChannelVault: boolean;
  manualReview: boolean;
  candidateSupportOnly: boolean;
  reason: string;
};

function exactAuthorizedLayer(evidence: AuthorizedLayerEvidenceV2): boolean {
  return evidence.present && evidence.exactPhysicalIdMatched &&
    evidence.presentedFullIdentityMatched && evidence.registryVerified &&
    evidence.signatureVerified && evidence.uniqueActiveRecord &&
    Boolean(evidence.tenantId && evidence.accountId &&
      evidence.registryRecordId && evidence.registryRevision &&
      evidence.registryRevision > 0);
}

function sameRecord(
  video: AuthorizedLayerEvidenceV2,
  audio: AuthorizedLayerEvidenceV2,
): boolean {
  return video.tenantId === audio.tenantId &&
    video.accountId === audio.accountId &&
    video.registryRecordId === audio.registryRecordId &&
    video.registryRevision === audio.registryRevision;
}

export function decideMultichannelProvenanceV2(input: {
  video: AuthorizedLayerEvidenceV2;
  audio: AuthorizedLayerEvidenceV2;
  candidateSupportObserved: boolean;
  shortLocatorAmbiguous: boolean;
}): MultichannelProvenanceDecisionV2 {
  const videoExact = exactAuthorizedLayer(input.video);
  const audioExact = exactAuthorizedLayer(input.audio);
  if (input.shortLocatorAmbiguous ||
      (input.video.present && !input.video.uniqueActiveRecord) ||
      (input.audio.present && !input.audio.uniqueActiveRecord)) {
    return {
      decision: "MANUAL_REVIEW",
      videoLayerOwnership: false,
      audioLayerOwnership: false,
      wholeVideoOwnership: false,
      multiChannelVault: false,
      manualReview: true,
      candidateSupportOnly: false,
      reason: "AMBIGUOUS_RECORD_NO_AUTOMATIC_SELECTION",
    };
  }
  if (videoExact && audioExact) {
    if (sameRecord(input.video, input.audio)) {
      return {
        decision: "MULTI_CHANNEL_VAULT",
        videoLayerOwnership: true,
        audioLayerOwnership: true,
        wholeVideoOwnership: true,
        multiChannelVault: true,
        manualReview: false,
        candidateSupportOnly: false,
        reason: "AUTHORIZED_VIDEO_AND_AUDIO_EXACT_SAME_RECORD",
      };
    }
    return {
      decision: "MIXED_MEDIA_PROVENANCE",
      videoLayerOwnership: false,
      audioLayerOwnership: false,
      wholeVideoOwnership: false,
      multiChannelVault: false,
      manualReview: true,
      candidateSupportOnly: false,
      reason: "AUTHORIZED_VIDEO_AND_AUDIO_EXACT_DIFFERENT_RECORDS",
    };
  }
  if (videoExact) {
    return {
      decision: "VIDEO_LAYER_VAULT",
      videoLayerOwnership: true,
      audioLayerOwnership: false,
      wholeVideoOwnership: false,
      multiChannelVault: false,
      manualReview: false,
      candidateSupportOnly: false,
      reason: "AUTHORIZED_VIDEO_EXACT_AUDIO_NOT_EXACT",
    };
  }
  if (audioExact) {
    return {
      decision: "AUDIO_VAULT",
      videoLayerOwnership: false,
      audioLayerOwnership: true,
      wholeVideoOwnership: false,
      multiChannelVault: false,
      manualReview: false,
      candidateSupportOnly: false,
      reason: "AUTHORIZED_AUDIO_EXACT_NO_VIDEO_OWNERSHIP",
    };
  }
  if (input.candidateSupportObserved) {
    return {
      decision: "CANDIDATE_SUPPORT_ONLY",
      videoLayerOwnership: false,
      audioLayerOwnership: false,
      wholeVideoOwnership: false,
      multiChannelVault: false,
      manualReview: false,
      candidateSupportOnly: true,
      reason: "LOCATOR_OR_WITNESS_WITHOUT_AUTHORIZED_EXACT_ID",
    };
  }
  return {
    decision: "NOT_FOUND",
    videoLayerOwnership: false,
    audioLayerOwnership: false,
    wholeVideoOwnership: false,
    multiChannelVault: false,
    manualReview: false,
    candidateSupportOnly: false,
    reason: "NO_AUTHORIZED_EXACT_LAYER_ID",
  };
}
