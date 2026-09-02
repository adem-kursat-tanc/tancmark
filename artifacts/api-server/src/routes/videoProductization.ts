import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Router, type IRouter } from "express";
import { requireAdminToken } from "../middlewares/adminAuth";
import {
  createSecureMemoryUpload,
  MULTIPART_UPLOAD_PROFILES,
} from "../middlewares/multipartUploadSecurity";
import { recordEvent } from "../lib/auditStore";
import {
  signedExactMapDbRegistry,
  signedExactMapProductKeyResolver,
} from "../video/signedExactMapDbRegistry";
import { runSignedExactMapVideoOwnershipRoute } from "../video/signedExactMapVideoOwnershipRoute";
import { adaptSignedExactMapRouteToVideoPrimaryDecision } from "../video/videoProductizationDecisionAdapter";
import {
  SIGNED_EXACT_SEAL_TIMING_MAP_V2_VIDEO_WATERMARK_VERSION,
  SIGNED_EXACT_SEAL_TIMING_MAP_V2_WATERMARK_ALGORITHM_VERSION,
} from "../video/signedExactSealTimingMapV2";

const router: IRouter = Router();
const upload = createSecureMemoryUpload(MULTIPART_UPLOAD_PROFILES.videoPrivateExact);
const WORK_BASE = path.join(
  os.tmpdir(),
  "tancmark-video-productization-signed-map-v2",
);
fs.mkdirSync(WORK_BASE, { recursive: true });

function requiredString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function decodePrivateReceiptBase64(value: string): Buffer {
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > 4 * 1024 * 1024 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
    throw new Error("PRIVATE_ENCODER_RECEIPT_BASE64_INVALID");
  }
  const decoded = Buffer.from(normalized, "base64");
  const canonicalInput = normalized.replace(/=+$/, "");
  const canonicalDecoded = decoded.toString("base64").replace(/=+$/, "");
  if (canonicalInput !== canonicalDecoded || decoded.length === 0) {
    throw new Error("PRIVATE_ENCODER_RECEIPT_BASE64_INVALID");
  }
  return decoded;
}

router.post(
  "/private/signed-exact-map-v2/verify",
  requireAdminToken,
  upload.single("video"),
  async (req, res, next) => {
    const tenantId = requiredString(req.body?.tenantId);
    const accountId = requiredString(req.body?.accountId);
    const registryRecordId = requiredString(req.body?.registryRecordId);
    const presentedVideoIdentityHex = requiredString(
      req.body?.presentedVideoIdentityHex,
    );
    const encoderReceiptBase64 = requiredString(
      req.body?.encoderReceiptBase64,
    );
    if (!req.file || !tenantId || !accountId || !registryRecordId ||
        !presentedVideoIdentityHex) {
      res.status(400).json({ error: "required_private_video_registry_fields_missing" });
      return;
    }
    if (!/^[0-9a-f]{64}$/i.test(presentedVideoIdentityHex)) {
      res.status(400).json({ error: "presented_video_identity_invalid" });
      return;
    }
    const runId = randomUUID();
    const runRoot = path.join(WORK_BASE, runId);
    const extension = path.extname(req.file.originalname || "") || ".media";
    const videoPath = path.join(runRoot, `input${extension}`);
    try {
      let authenticatedEncoderReceiptBytes: Buffer | undefined;
      if (encoderReceiptBase64) {
        try {
          authenticatedEncoderReceiptBytes = decodePrivateReceiptBase64(
            encoderReceiptBase64,
          );
        } catch {
          res.status(400).json({ error: "private_encoder_receipt_invalid" });
          return;
        }
      }
      fs.mkdirSync(runRoot, { recursive: true });
      fs.writeFileSync(videoPath, req.file.buffer);
      const internalResult = await runSignedExactMapVideoOwnershipRoute({
        videoPath,
        presentedVideoIdentityHex: presentedVideoIdentityHex.toLowerCase(),
        tenantId,
        accountId,
        registryRecordId,
        expectedWatermarkAlgorithmVersion:
          SIGNED_EXACT_SEAL_TIMING_MAP_V2_WATERMARK_ALGORITHM_VERSION,
        expectedVideoWatermarkVersion:
          SIGNED_EXACT_SEAL_TIMING_MAP_V2_VIDEO_WATERMARK_VERSION,
        registry: signedExactMapDbRegistry,
        keyResolver: signedExactMapProductKeyResolver,
        authenticatedEncoderReceiptBytes,
        workDir: path.join(runRoot, "reader"),
      });
      const scopedResult = adaptSignedExactMapRouteToVideoPrimaryDecision({
        internalResult,
        tenantId,
        accountId,
        registryRecordId,
        registryRevision: 1,
      });
      await recordEvent({
        ip: req.ip ?? req.socket.remoteAddress ?? "unknown",
        route: req.originalUrl.split("?")[0] ?? req.originalUrl,
        kind: "Visual_Vault_Verdict",
        details: {
          candidate: "VIDEO_PRIMARY_PROFILE",
          tenantId,
          accountId,
          registryRecordId,
          videoDecision: scopedResult.videoDecision,
          reason: scopedResult.reason,
          videoLayerOwnership: scopedResult.videoLayerOwnership,
          signatureVerified:
            scopedResult.evidence.signatureVerified,
          exactMapVerified: scopedResult.evidence.exactMapVerified,
          physicalVideoIdVerified:
            scopedResult.evidence.channelAMatched,
        },
      });
      res.status(scopedResult.videoDecision === "MANUAL_REVIEW" ? 409 : 200).json({
        ...scopedResult,
        evidence: {
          ...scopedResult.evidence,
          auditEvidencePersisted: true,
        },
      });
    } catch (error) {
      next(error);
    } finally {
      const resolvedRoot = path.resolve(runRoot);
      const resolvedBase = path.resolve(WORK_BASE);
      if (resolvedRoot.startsWith(`${resolvedBase}${path.sep}`)) {
        fs.rmSync(resolvedRoot, { recursive: true, force: true });
      }
    }
  },
);

export default router;
