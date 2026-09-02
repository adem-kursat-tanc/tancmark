// SPDX-License-Identifier: AGPL-3.0-only

import { Router, type IRouter, type Request, type Response } from "express";
import { C2paBuilderAdapter, C2PA_DIGITAL_SOURCE_TYPES } from "../c2pa/C2paBuilderAdapter";
import { C2paReaderAdapter } from "../c2pa/C2paReaderAdapter";
import { redactC2paInspection } from "../c2pa/C2paRedaction";
import { C2paSignerAdapter } from "../c2pa/C2paSignerAdapter";
import {
  assertC2paNoNetwork,
  c2paRegistryRecordIdentity,
  c2paSigningProfile,
  resolveC2paTenantInput,
  resolveC2paTenantOutput,
} from "../c2pa/C2paProductPolicy";
import { verifiedLiveTenantFromResponse } from "../middlewares/liveTenantAuth";

const router: IRouter = Router();
const FORBIDDEN_BODY_KEYS = new Set([
  "tenantId", "clientId", "accountId", "privateKey", "privateKeyPem", "privateKeyPath",
  "certificate", "certificatePem", "certificatePath", "rawExpectedId", "registryRow", "exactMap",
  "remoteManifestUrl", "trustAnchors", "tsaUrl",
]);
const INSPECT_BODY_KEYS = new Set(["assetName"]);
const SIGN_BODY_KEYS = new Set([
  "assetName", "outputName", "intent", "digitalSourceType", "registryRecordId", "recordVersion",
  "algorithmVersion", "createdAt", "publicVerificationUrl",
]);

function body(req: Request): Record<string, unknown> {
  return req.body && typeof req.body === "object" && !Array.isArray(req.body)
    ? req.body as Record<string, unknown>
    : {};
}

function rejectForbiddenInput(value: Record<string, unknown>): void {
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_BODY_KEYS.has(key)) throw new Error("c2pa_sensitive_or_authority_input_forbidden");
  }
}

function rejectUnknownInput(value: Record<string, unknown>, allowed: ReadonlySet<string>): void {
  if (Object.keys(value).some((key) => !allowed.has(key))) throw new Error("c2pa_request_body_shape_invalid");
}

function requiredString(value: unknown, code: string, max = 256): string {
  if (typeof value !== "string") throw new Error(code);
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) throw new Error(code);
  return trimmed;
}

function optionalString(value: unknown, code: string, max = 512): string | undefined {
  if (value === undefined || value === null) return undefined;
  return requiredString(value, code, max);
}

function optionalPublicVerificationUrl(value: unknown): string | undefined {
  const text = optionalString(value, "c2pa_public_verification_url_invalid");
  if (text === undefined) return undefined;
  let parsed: URL;
  try { parsed = new URL(text); } catch { throw new Error("c2pa_public_verification_url_invalid"); }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    throw new Error("c2pa_public_verification_url_invalid");
  }
  return parsed.href;
}

function requiredIntent(value: unknown): "CREATE" | "EDIT" | "UPDATE" {
  if (value === "CREATE" || value === "EDIT" || value === "UPDATE") return value;
  throw new Error("c2pa_intent_required");
}

function digitalSourceTypeForIntent(
  intent: "CREATE" | "EDIT" | "UPDATE",
  value: unknown,
): string | undefined {
  if (intent !== "CREATE") {
    if (value !== undefined) throw new Error("c2pa_digital_source_type_only_valid_for_create");
    return undefined;
  }
  const digitalSourceType = requiredString(value, "c2pa_create_digital_source_type_required");
  if (!Object.values(C2PA_DIGITAL_SOURCE_TYPES).includes(
    digitalSourceType as typeof C2PA_DIGITAL_SOURCE_TYPES[keyof typeof C2PA_DIGITAL_SOURCE_TYPES],
  )) {
    throw new Error("c2pa_create_digital_source_type_required");
  }
  return digitalSourceType;
}

function publicError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  return /^c2pa_[a-z0-9_]+$/.test(message) ? message : "c2pa_operation_failed";
}

async function inspect(req: Request, res: Response): Promise<void> {
  try {
    assertC2paNoNetwork();
    const input = body(req);
    rejectForbiddenInput(input);
    rejectUnknownInput(input, INSPECT_BODY_KEYS);
    const tenantId = verifiedLiveTenantFromResponse(res);
    const sourcePath = await resolveC2paTenantInput({ tenantId, assetName: input["assetName"] });
    const result = await C2paReaderAdapter.readManifest(sourcePath);
    res.json({ ok: result.ok, c2pa: redactC2paInspection(result) });
  } catch (error) {
    res.status(400).json({ ok: false, error: publicError(error) });
  }
}

router.post("/inspect", (req, res) => { void inspect(req, res); });
router.post("/verify", (req, res) => { void inspect(req, res); });

router.post("/sign-embed", (req, res) => {
  void (async () => {
    try {
      assertC2paNoNetwork();
      const input = body(req);
      rejectForbiddenInput(input);
      rejectUnknownInput(input, SIGN_BODY_KEYS);
      const tenantId = verifiedLiveTenantFromResponse(res);
      const sourcePath = await resolveC2paTenantInput({ tenantId, assetName: input["assetName"] });
      const outputPath = await resolveC2paTenantOutput({ tenantId, outputName: input["outputName"] });
      const profile = c2paSigningProfile(tenantId);
      const signer = await C2paSignerAdapter.fromConfiguredPaths({
        certificatePath: profile.certificatePath,
        privateKeyPath: profile.privateKeyPath,
        algorithm: profile.algorithm,
      });
      const intent = requiredIntent(input["intent"]);
      const digitalSourceType = digitalSourceTypeForIntent(intent, input["digitalSourceType"]);
      const result = await C2paBuilderAdapter.signAndEmbedManifest({
        inputPath: sourcePath,
        outputPath,
        intent,
        ...(digitalSourceType ? { digitalSourceType } : {}),
        recordIdentity: c2paRegistryRecordIdentity(tenantId, input["registryRecordId"]),
        recordVersion: requiredString(input["recordVersion"], "c2pa_record_version_required", 64),
        algorithmVersion: requiredString(input["algorithmVersion"], "c2pa_algorithm_version_required", 64),
        createdAt: requiredString(input["createdAt"], "c2pa_created_at_required", 32),
        publicVerificationUrl: optionalPublicVerificationUrl(input["publicVerificationUrl"]),
        signer,
      });
      res.status(201).json({
        ok: true,
        signedAndEmbedded: result.outputWritten,
        c2pa: redactC2paInspection(result.outputValidation),
        safety: {
          c2paCanOpenVault: false,
          ownership: false,
          privateKeyDisclosed: false,
          outputPathDisclosed: false,
          externalNetworkCalls: 0,
        },
      });
    } catch (error) {
      res.status(400).json({ ok: false, error: publicError(error) });
    }
  })();
});

export default router;
