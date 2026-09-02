// SPDX-License-Identifier: AGPL-3.0-only

import { randomUUID } from "node:crypto";
import path from "node:path";
import { Builder } from "@contentauth/c2pa-node";
import type { Manifest } from "@contentauth/c2pa-types";
import { atomicWriteNewFile, readRegularFileBounded } from "./safeLocalFiles";
import {
  MAX_C2PA_ASSET_BYTES,
  MAX_C2PA_OUTPUT_BYTES,
  buildTancMarkSupportAssertion,
  TANCMARK_C2PA_ASSERTION_LABEL,
  c2paMimeTypeForPath,
} from "./C2paSecurityPolicy";
import { c2paSafetyBoundary, type C2paEmbedResult, type C2paTrustMode } from "./C2paResultTypes";
import { C2paReaderAdapter } from "./C2paReaderAdapter";
import { C2paSignerAdapter } from "./C2paSignerAdapter";
import { C2paTrustAdapter } from "./C2paTrustAdapter";

export type C2paBuilderIntent = "CREATE" | "EDIT" | "UPDATE";
export const C2PA_DIGITAL_SOURCE_TYPES = Object.freeze({
  DIGITAL_CAPTURE: "http://cv.iptc.org/newscodes/digitalsourcetype/digitalCapture",
  HUMAN_DIGITAL_CREATION: "http://cv.iptc.org/newscodes/digitalsourcetype/digitalCreation",
  TRAINED_ALGORITHMIC_MEDIA: "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia",
  COMPOSITE: "http://cv.iptc.org/newscodes/digitalsourcetype/composite",
} as const);

const ALLOWED_DIGITAL_SOURCE_TYPES = new Set<string>(Object.values(C2PA_DIGITAL_SOURCE_TYPES));

function samePath(left: string, right: string): boolean {
  return path.resolve(left).toLocaleLowerCase("en-US") === path.resolve(right).toLocaleLowerCase("en-US");
}

export function createManifestDefinition(input: {
  mimeType: string;
  recordIdentity: string;
  recordVersion: string;
  algorithmVersion: string;
  createdAt: string;
  publicVerificationUrl?: string;
}): Manifest {
  buildTancMarkSupportAssertion(input);
  return Object.freeze({
    claim_version: 2,
    vendor: "com.tancmark",
    claim_generator_info: [{
      name: "TancMark C2PA Research Adapter",
      version: "0.1.0-rc.1",
    }],
    title: "TancMark research asset",
    format: input.mimeType,
    instance_id: `urn:uuid:${randomUUID()}`,
    hash_alg: "sha256",
  }) as Manifest;
}

export class C2paBuilderAdapter {
  static async signAndEmbedManifest(input: {
    inputPath: string;
    outputPath: string;
    intent: C2paBuilderIntent;
    digitalSourceType?: string;
    recordIdentity: string;
    recordVersion: string;
    algorithmVersion: string;
    createdAt: string;
    publicVerificationUrl?: string;
    signer: C2paSignerAdapter;
    trustMode?: C2paTrustMode;
    customTrustAnchorPem?: string;
  }): Promise<C2paEmbedResult> {
    if (samePath(input.inputPath, input.outputPath)) throw new Error("c2pa_output_must_differ_from_input");
    const mimeType = c2paMimeTypeForPath(input.inputPath);
    const outputMimeType = c2paMimeTypeForPath(input.outputPath);
    if (!mimeType || outputMimeType !== mimeType) throw new Error("c2pa_format_unsupported_or_output_mismatch");
    if (input.intent === "CREATE") {
      if (!input.digitalSourceType || !ALLOWED_DIGITAL_SOURCE_TYPES.has(input.digitalSourceType)) {
        throw new Error("c2pa_create_digital_source_type_required");
      }
    } else if (input.digitalSourceType) {
      throw new Error("c2pa_digital_source_type_only_valid_for_create");
    }
    const bytes = await readRegularFileBounded(input.inputPath, MAX_C2PA_ASSET_BYTES);
    const trustMode = input.trustMode ?? "OFFLINE_TEST";
    if (input.intent === "UPDATE") {
      const prior = await C2paReaderAdapter.readBytes({
        bytes,
        mimeType,
        trustMode,
        customTrustAnchorPem: input.customTrustAnchorPem,
      });
      if (!prior.c2paPresent || !prior.c2paValid) throw new Error("c2pa_update_requires_valid_existing_manifest");
    }

    const definition = createManifestDefinition({
      mimeType,
      recordIdentity: input.recordIdentity,
      recordVersion: input.recordVersion,
      algorithmVersion: input.algorithmVersion,
      createdAt: input.createdAt,
      publicVerificationUrl: input.publicVerificationUrl,
    });
    const settings = C2paTrustAdapter.settings(trustMode, input.customTrustAnchorPem);
    const builder = Builder.withJson(definition, settings);
    builder.addAssertion(TANCMARK_C2PA_ASSERTION_LABEL, JSON.stringify(buildTancMarkSupportAssertion({
      recordIdentity: input.recordIdentity,
      recordVersion: input.recordVersion,
      algorithmVersion: input.algorithmVersion,
      createdAt: input.createdAt,
      publicVerificationUrl: input.publicVerificationUrl,
    })), "Json");
    builder.setNoEmbed(false);
    if (input.intent === "CREATE") builder.setIntent({ create: input.digitalSourceType! });
    else builder.setIntent(input.intent.toLowerCase() as "edit" | "update");

    const destination: { buffer: Buffer | null } = { buffer: null };
    const manifest = builder.sign(input.signer.signer, { buffer: bytes, mimeType }, destination);
    const outputBytes = destination.buffer;
    if (!outputBytes || outputBytes.length <= 0 || outputBytes.length > MAX_C2PA_OUTPUT_BYTES) {
      throw new Error("c2pa_output_size_invalid");
    }
    const bufferValidation = await C2paReaderAdapter.readBytes({
      bytes: outputBytes,
      mimeType,
      trustMode,
      customTrustAnchorPem: input.customTrustAnchorPem,
    });
    if (!bufferValidation.c2paValid || !bufferValidation.signatureCryptographicallyValid
      || !bufferValidation.assetIntegrityValid || bufferValidation.tancmarkAssertionCount !== 1) {
      throw new Error("c2pa_write_read_validate_failed_before_output");
    }
    if (input.intent === "EDIT" && bufferValidation.ingredientCount < 1) {
      throw new Error("c2pa_edit_parent_ingredient_missing");
    }
    await atomicWriteNewFile(input.outputPath, outputBytes);
    const diskValidation = await C2paReaderAdapter.readManifest(input.outputPath, {
      trustMode,
      customTrustAnchorPem: input.customTrustAnchorPem,
    });
    if (!diskValidation.c2paValid || !diskValidation.signatureCryptographicallyValid
      || !diskValidation.assetIntegrityValid || diskValidation.tancmarkAssertionCount !== 1) {
      throw new Error("c2pa_write_read_validate_failed_after_output");
    }
    return Object.freeze({
      ok: true,
      outputWritten: true,
      manifestBytes: manifest.length,
      intent: input.intent,
      outputValidation: diskValidation,
      safety: c2paSafetyBoundary(),
    });
  }
}

export const signAndEmbedManifest = C2paBuilderAdapter.signAndEmbedManifest.bind(C2paBuilderAdapter);
