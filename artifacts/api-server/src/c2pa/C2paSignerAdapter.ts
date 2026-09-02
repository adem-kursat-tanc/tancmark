// SPDX-License-Identifier: AGPL-3.0-only

import { LocalSigner } from "@contentauth/c2pa-node";
import { X509Certificate, createPrivateKey, createPublicKey, timingSafeEqual } from "node:crypto";
import { readRegularFileBounded } from "./safeLocalFiles";
import {
  MAX_C2PA_CERTIFICATE_BYTES,
  MAX_C2PA_PRIVATE_KEY_BYTES,
  assertC2paTestSigningAllowed,
} from "./C2paSecurityPolicy";

export type C2paSigningAlgorithm = "es256" | "es384" | "es512" | "ps256" | "ps384" | "ps512" | "ed25519";

const ALGORITHMS = new Set<C2paSigningAlgorithm>(["es256", "es384", "es512", "ps256", "ps384", "ps512", "ed25519"]);

function algorithm(value: string | undefined): C2paSigningAlgorithm {
  const normalized = (value ?? "es256").toLowerCase() as C2paSigningAlgorithm;
  if (!ALGORITHMS.has(normalized)) throw new Error("c2pa_signing_algorithm_invalid");
  return normalized;
}

function isProductRuntime(environment: NodeJS.ProcessEnv): boolean {
  return environment["NODE_ENV"] === "production"
    || environment["AEGIS_PRODUCT_RUNTIME"] === "1";
}

export function assertConfiguredLocalSigningAlgorithmAllowed(
  selected: C2paSigningAlgorithm,
  environment: NodeJS.ProcessEnv = process.env,
): void {
  if (!selected.startsWith("ps")) return;
  if (isProductRuntime(environment)) {
    throw new Error("c2pa_local_rsa_pss_disabled_in_product");
  }
  if (environment["NODE_ENV"] !== "test"
    || environment["TANCMARK_C2PA_ALLOW_TEST_SIGNING"] !== "1") {
    throw new Error("c2pa_local_rsa_pss_test_flag_required");
  }
}

function firstCertificate(certificate: Buffer): X509Certificate {
  const text = certificate.toString("utf8");
  const match = text.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/);
  return new X509Certificate(match?.[0] ?? certificate);
}

function validateCertificateAndKey(certificate: Buffer, privateKey: Buffer, selected: C2paSigningAlgorithm): void {
  try {
    const x509 = firstCertificate(certificate);
    const now = Date.now();
    if (!Number.isFinite(Date.parse(x509.validFrom)) || !Number.isFinite(Date.parse(x509.validTo))
      || now < Date.parse(x509.validFrom) || now > Date.parse(x509.validTo)) {
      throw new Error("c2pa_certificate_outside_validity");
    }
    const key = createPrivateKey(privateKey);
    const privateSpki = createPublicKey(key).export({ type: "spki", format: "der" });
    const certificateSpki = x509.publicKey.export({ type: "spki", format: "der" });
    try {
      if (privateSpki.length !== certificateSpki.length || !timingSafeEqual(privateSpki, certificateSpki)) {
        throw new Error("c2pa_certificate_private_key_mismatch");
      }
    } finally {
      privateSpki.fill(0);
      certificateSpki.fill(0);
    }
    const keyType = x509.publicKey.asymmetricKeyType;
    if ((selected.startsWith("es") && keyType !== "ec")
      || (selected.startsWith("ps") && keyType !== "rsa")
      || (selected === "ed25519" && keyType !== "ed25519")) {
      throw new Error("c2pa_signing_algorithm_key_type_mismatch");
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("c2pa_")) throw error;
    throw new Error("c2pa_certificate_or_private_key_invalid");
  }
}

export class C2paSignerAdapter {
  readonly signer: LocalSigner;
  readonly algorithm: C2paSigningAlgorithm;
  readonly testOnly: boolean;

  private constructor(signer: LocalSigner, selectedAlgorithm: C2paSigningAlgorithm, testOnly: boolean) {
    this.signer = signer;
    this.algorithm = selectedAlgorithm;
    this.testOnly = testOnly;
  }

  static fromTestMaterial(input: { certificate: Buffer; privateKey: Buffer; algorithm?: string }): C2paSignerAdapter {
    assertC2paTestSigningAllowed();
    if (input.certificate.length <= 0 || input.certificate.length > MAX_C2PA_CERTIFICATE_BYTES) throw new Error("c2pa_certificate_size_invalid");
    if (input.privateKey.length <= 0 || input.privateKey.length > MAX_C2PA_PRIVATE_KEY_BYTES) throw new Error("c2pa_private_key_size_invalid");
    const selected = algorithm(input.algorithm);
    try {
      validateCertificateAndKey(input.certificate, input.privateKey, selected);
      return new C2paSignerAdapter(LocalSigner.newSigner(input.certificate, input.privateKey, selected), selected, true);
    } finally {
      input.privateKey.fill(0);
    }
  }

  static async fromConfiguredPaths(input: {
    certificatePath: string;
    privateKeyPath: string;
    algorithm?: string;
    tsaUrl?: string | null;
  }): Promise<C2paSignerAdapter> {
    if (input.tsaUrl) throw new Error("c2pa_tsa_network_not_enabled_in_r8");
    const selected = algorithm(input.algorithm);
    // Policy is evaluated before certificate/private-key I/O. Product mode
    // never reads a local RSA key for PS256/384/512.
    assertConfiguredLocalSigningAlgorithmAllowed(selected);
    const certificate = await readRegularFileBounded(input.certificatePath, MAX_C2PA_CERTIFICATE_BYTES);
    const privateKey = await readRegularFileBounded(input.privateKeyPath, MAX_C2PA_PRIVATE_KEY_BYTES);
    try {
      validateCertificateAndKey(certificate, privateKey, selected);
      return new C2paSignerAdapter(LocalSigner.newSigner(certificate, privateKey, selected), selected, false);
    } finally {
      privateKey.fill(0);
    }
  }

  static async fromTestPaths(input: {
    certificatePath: string;
    privateKeyPath: string;
    algorithm?: string;
  }): Promise<C2paSignerAdapter> {
    assertC2paTestSigningAllowed();
    const certificate = await readRegularFileBounded(input.certificatePath, MAX_C2PA_CERTIFICATE_BYTES);
    const privateKey = await readRegularFileBounded(input.privateKeyPath, MAX_C2PA_PRIVATE_KEY_BYTES);
    return this.fromTestMaterial({ certificate, privateKey, algorithm: input.algorithm });
  }
}
