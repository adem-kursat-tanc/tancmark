import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

import {
  evaluateLiveHlsEvidencePdfClaimSafety,
  type LiveHlsEvidencePdfClaimSafetyGuardResult,
} from "./liveHlsEvidencePdfClaimSafetyGuard";
import { getLiveHlsEvidencePdfTemplatePolicy } from "./liveHlsEvidencePdfTemplatePolicy";

export const LIVE_HLS_EVIDENCE_PDF_ARTIFACT_EXPORT_ROLE =
  "live_hls_evidence_pdf_artifact_export_support_only_no_vault_no_confirmed" as const;

export const LIVE_HLS_EVIDENCE_PDF_ARTIFACT_PATH =
  "runtime/validation/live_actual_local_smoke/hls_evidence_report_export/live_hls_evidence_report.pdf" as const;

export interface LiveHlsEvidencePdfArtifactSection {
  title: string;
  lines: string[];
}

export interface LiveHlsEvidencePdfArtifactExport {
  pdfArtifactGenerated: boolean;
  pdfArtifactPath: typeof LIVE_HLS_EVIDENCE_PDF_ARTIFACT_PATH;
  pdfArtifactSizeBytes: number;
  pdfArtifactSha256: string | null;
  usedDedicatedTemplate: true;
  usedExistingPdfInfrastructureSafely: true;
  claimSafetyGuardPassedBeforeRender: boolean;
  claimSafetyGuardPassedAfterRender: boolean;
  forbiddenClaimsFound: string[];
  requiredWarningsPresent: boolean;
  reasonIfNotGenerated: string | null;
  sourceBoundary: "synthetic_local_only";
  reportBoundary: "read_only_lab_result";
  title: "TancMark Live HLS Evidence Report - Local Synthetic Lab Result";
  sections: LiveHlsEvidencePdfArtifactSection[];
  footerSafetyNotice:
    "supportOnly=true | vaultEligible=false | confirmed=false | final=false | not final legal proof";
  realBroadcastStarted: false;
  realApiCalled: false;
  realSecretAccepted: false;
  realExternalTargetPush: false;
  realCustomerContentUsed: false;
  newExternalDependencyAdded: false;
  supportOnly: true;
  vaultEligible: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_HLS_EVIDENCE_PDF_ARTIFACT_EXPORT_ROLE;
}

export function getLiveHlsEvidencePdfArtifactSections(): LiveHlsEvidencePdfArtifactSection[] {
  return [
    {
      title: "Cover",
      lines: [
        "TancMark Live HLS Evidence Report - Local Synthetic Lab Result.",
        "This document is local synthetic lab evidence and a read-only lab result.",
        "supportOnly=true; vaultEligible=false; confirmed=false; final=false.",
      ],
    },
    {
      title: "Executive Summary",
      lines: [
        "HLS capture is the preferred local evidence path observed in this lab.",
        "RTMP direct capture remains diagnostic-only.",
        "Post-live re-seal is the safest local re-seal strategy observed in this synthetic lab chain.",
      ],
    },
    {
      title: "Source Boundary",
      lines: [
        "sourceBoundary=synthetic_local_only.",
        "Real customer content not tested.",
        "No social platform, public target, stream key, secret, or external API was used for this PDF artifact.",
      ],
    },
    {
      title: "Test Chain Summary",
      lines: [
        "Local custom RTMP smoke and repeatability were completed in prior local lab phases.",
        "HLS playback probe, VOD capture, post-live re-seal, and ID-read lab checks were summarized.",
        "Pre-sealed HLS survival succeeded in the local synthetic path; RTMP direct capture stayed unstable.",
      ],
    },
    {
      title: "HLS Evidence Path",
      lines: [
        "HLS capture is preferred for local evidence packaging.",
        "This PDF records the lab summary only and does not run a new live test.",
        "A product decision requires embedded TancMark ID read and system record match.",
      ],
    },
    {
      title: "RTMP Diagnostic-Only Note",
      lines: [
        "RTMP direct capture is diagnostic-only because capture windows showed inconsistent ID-read behavior.",
        "RTMP direct evidence is not promoted to a final product decision in this PDF.",
      ],
    },
    {
      title: "Post-Live Re-Seal Strategy",
      lines: [
        "Post-live re-seal remains the safest local re-seal strategy observed in this lab.",
        "This summary does not alter the existing watermarking, reading, threshold, ownership, or DNA decision gates.",
      ],
    },
    {
      title: "Wrong ID / No ID Safety",
      lines: [
        "Wrong ID remains rejected.",
        "No ID means no VAULT.",
        "Candidate/advisory/support signals do not open VAULT/confirmed/final.",
      ],
    },
    {
      title: "Decision Boundary",
      lines: [
        "This PDF does not open VAULT/confirmed/final.",
        "It is not final legal proof.",
        "Final decision requires embedded TancMark ID read and system record match.",
      ],
    },
    {
      title: "Limitations",
      lines: [
        "External custom RTMP target not tested in this PDF artifact phase.",
        "YouTube/social transcode not tested.",
        "Real customer content not tested.",
        "Legal-grade review and customer-facing PDF export remain deferred.",
      ],
    },
    {
      title: "Next Steps",
      lines: [
        "Deferred: legal-grade PDF review.",
        "Deferred: real customer-content Live evidence PDF.",
        "Deferred: Secure Room product PDF export.",
        "Deferred: external custom RTMP and social-platform evidence PDF phases.",
      ],
    },
    {
      title: "Footer Safety Notice",
      lines: ["supportOnly=true | vaultEligible=false | confirmed=false | final=false | not final legal proof"],
    },
  ];
}

export function buildLiveHlsEvidencePdfArtifactText(): string {
  const requiredWarnings =
    "Required warnings: local synthetic lab evidence; supportOnly; read-only lab result; " +
    "not final legal proof; does not open VAULT/confirmed/final; real customer content not tested; " +
    "final decision requires embedded TancMark ID read and system record match.";
  return [
    "TancMark Live HLS Evidence Report - Local Synthetic Lab Result",
    requiredWarnings,
    ...getLiveHlsEvidencePdfArtifactSections().map((section) =>
      [`## ${section.title}`, ...section.lines].join("\n"),
    ),
  ].join("\n\n");
}

function artifactExists(): boolean {
  return existsSync(resolve(LIVE_HLS_EVIDENCE_PDF_ARTIFACT_PATH));
}

function artifactSize(): number {
  if (!artifactExists()) return 0;
  return statSync(resolve(LIVE_HLS_EVIDENCE_PDF_ARTIFACT_PATH)).size;
}

function artifactSha256(): string | null {
  if (!artifactExists()) return null;
  return createHash("sha256").update(readFileSync(resolve(LIVE_HLS_EVIDENCE_PDF_ARTIFACT_PATH))).digest("hex");
}

function mergeForbiddenClaims(
  before: LiveHlsEvidencePdfClaimSafetyGuardResult,
  after: LiveHlsEvidencePdfClaimSafetyGuardResult,
): string[] {
  return [...new Set([...before.forbiddenClaimsFound, ...after.forbiddenClaimsFound])];
}

export function getLiveHlsEvidencePdfArtifactExport(): LiveHlsEvidencePdfArtifactExport {
  const policy = getLiveHlsEvidencePdfTemplatePolicy();
  const templateText = buildLiveHlsEvidencePdfArtifactText();
  const before = evaluateLiveHlsEvidencePdfClaimSafety(templateText);
  const generated = artifactExists();
  const after = generated ? evaluateLiveHlsEvidencePdfClaimSafety(templateText) : before;

  return {
    pdfArtifactGenerated: generated,
    pdfArtifactPath: LIVE_HLS_EVIDENCE_PDF_ARTIFACT_PATH,
    pdfArtifactSizeBytes: artifactSize(),
    pdfArtifactSha256: artifactSha256(),
    usedDedicatedTemplate: true,
    usedExistingPdfInfrastructureSafely: true,
    claimSafetyGuardPassedBeforeRender: before.safeForPdfRenderNow,
    claimSafetyGuardPassedAfterRender: generated && after.safeForPdfRenderNow,
    forbiddenClaimsFound: mergeForbiddenClaims(before, after),
    requiredWarningsPresent: before.requiredWarningsPresent && generated && after.requiredWarningsPresent,
    reasonIfNotGenerated: generated
      ? null
      : "Dedicated template and claim guard are ready, but the local PDF artifact has not been generated yet.",
    sourceBoundary: policy.sourceBoundary,
    reportBoundary: "read_only_lab_result",
    title: "TancMark Live HLS Evidence Report - Local Synthetic Lab Result",
    sections: getLiveHlsEvidencePdfArtifactSections(),
    footerSafetyNotice:
      "supportOnly=true | vaultEligible=false | confirmed=false | final=false | not final legal proof",
    realBroadcastStarted: false,
    realApiCalled: false,
    realSecretAccepted: false,
    realExternalTargetPush: false,
    realCustomerContentUsed: false,
    newExternalDependencyAdded: false,
    supportOnly: true,
    vaultEligible: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_HLS_EVIDENCE_PDF_ARTIFACT_EXPORT_ROLE,
  };
}
