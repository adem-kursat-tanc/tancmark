import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  signVaultAnchor,
  verifyVaultAnchorRaw,
  type VaultAnchor,
  type VaultAnchorPayload,
} from "@workspace/aegis-core";

export interface DemoRegistryRecord {
  recordHandle: string;
  tenantId: string;
  clientId: string;
  docId: string;
  idHex: string;
  anchor: VaultAnchor;
  demoOnly: true;
}

export interface DemoRegistryVerification {
  exactRecord: boolean;
  tenantMatched: boolean;
  signatureVerified: boolean;
  demoOnly: true;
  canOpenProductionVault: false;
}

export class EphemeralDemoRegistry {
  readonly tenantId = `demo-tenant-${randomUUID()}`;
  readonly clientId = `demo-client-${randomUUID()}`;
  readonly principalId = `demo-principal-${randomUUID()}`;
  readonly #masterSecret = randomBytes(32);
  readonly #tenantSalt = randomBytes(24).toString("hex");
  readonly #records = new Map<string, DemoRegistryRecord>();

  createRecord(mediaKind: string): DemoRegistryRecord {
    const idHex = randomBytes(32).toString("hex");
    const docId = `demo-${mediaKind}-${randomUUID()}`;
    const issuedAt = new Date().toISOString();
    const payload: VaultAnchorPayload = {
      cloakId: idHex,
      clientId: this.clientId,
      docId,
      keyVersion: "demo-ephemeral-v1",
      pipelineVersion: `codespaces-linux-demo-${mediaKind}-v1`,
      protectionHash: null,
      cascadeRoot: null,
      issuedAt,
    };
    const anchor = signVaultAnchor({
      masterSecret: this.#masterSecret,
      tenantSalt: this.#tenantSalt,
      clientId: this.clientId,
      docId,
      cloakId: idHex,
      payload,
    });
    const recordHandle = createHash("sha256")
      .update(`${this.tenantId}\0${docId}\0${idHex}`, "utf8")
      .digest("hex")
      .slice(0, 16);
    const record: DemoRegistryRecord = {
      recordHandle,
      tenantId: this.tenantId,
      clientId: this.clientId,
      docId,
      idHex,
      anchor,
      demoOnly: true,
    };
    this.#records.set(idHex, record);
    return record;
  }

  verify(idHex: string, tenantId = this.tenantId): DemoRegistryVerification {
    const record = this.#records.get(idHex);
    const exactRecord = record?.idHex === idHex;
    const tenantMatched = record?.tenantId === tenantId;
    const signatureVerified = Boolean(
      record &&
        verifyVaultAnchorRaw({
          publicKey: record.anchor.publicKey,
          payloadCanonical: record.anchor.payloadCanonical,
          signature: record.anchor.signature,
        }),
    );
    return {
      exactRecord,
      tenantMatched,
      signatureVerified,
      demoOnly: true,
      canOpenProductionVault: false,
    };
  }

  verifyTamperedRecord(idHex: string): boolean {
    const record = this.#records.get(idHex);
    if (!record) return false;
    return verifyVaultAnchorRaw({
      publicKey: record.anchor.publicKey,
      payloadCanonical: `${record.anchor.payloadCanonical} `,
      signature: record.anchor.signature,
    });
  }

  verifyWrongSignature(idHex: string): boolean {
    const record = this.#records.get(idHex);
    if (!record) return false;
    const signature = record.anchor.signature.slice();
    signature[0] = (signature[0] ?? 0) ^ 0xff;
    return verifyVaultAnchorRaw({
      publicKey: record.anchor.publicKey,
      payloadCanonical: record.anchor.payloadCanonical,
      signature,
    });
  }

  reset(): void {
    this.#records.clear();
    this.#masterSecret.fill(0);
  }

  get rowCount(): number {
    return this.#records.size;
  }
}
