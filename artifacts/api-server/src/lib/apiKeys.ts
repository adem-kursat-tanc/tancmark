import { randomBytes } from "node:crypto";
import { db, apiKeysTable, clientsTable, type ApiKey, type Client } from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import {
  assertApiKeyPepperReadyForProduct,
  hashApiKeyForStorage,
  verifyApiKeyHash,
  resolveApiKeyPepper,
} from "./apiKeyHashing";

const KEY_PREFIX = "ak_";
const API_KEY_LOOKUP_LIMIT = 50;

export function hashApiKey(plaintext: string): string {
  return hashApiKeyForStorage(plaintext);
}

export function generateApiKey(): { plaintext: string; hash: string; prefix: string } {
  assertApiKeyPepperReadyForProduct();
  const raw = randomBytes(24).toString("base64url");
  const plaintext = `${KEY_PREFIX}${raw}`;
  return {
    plaintext,
    hash: hashApiKeyForStorage(plaintext),
    prefix: plaintext.slice(0, 10),
  };
}

export async function lookupApiKey(plaintext: string): Promise<{ apiKey: ApiKey; client: Client } | null> {
  assertApiKeyPepperReadyForProduct();
  const prefix = plaintext.slice(0, 10);
  const pepperState = resolveApiKeyPepper();
  const rows = await db
    .select({ apiKey: apiKeysTable, client: clientsTable })
    .from(apiKeysTable)
    .innerJoin(clientsTable, eq(apiKeysTable.clientId, clientsTable.id))
    .where(and(eq(apiKeysTable.keyPrefix, prefix), isNull(apiKeysTable.revokedAt)))
    .limit(API_KEY_LOOKUP_LIMIT);

  for (const row of rows) {
    const verification = verifyApiKeyHash(plaintext, row.apiKey, pepperState);
    if (!verification.verified) continue;

    if (verification.shouldMigrateToHmacPepper && verification.migrationHash) {
      await db
        .update(apiKeysTable)
        .set({ keyHash: verification.migrationHash })
        .where(and(eq(apiKeysTable.id, row.apiKey.id), eq(apiKeysTable.keyHash, row.apiKey.keyHash)));
      return {
        apiKey: { ...row.apiKey, keyHash: verification.migrationHash },
        client: row.client,
      };
    }

    return row;
  }

  return null;
}

export async function touchApiKey(id: number): Promise<void> {
  await db.update(apiKeysTable).set({ lastUsedAt: new Date() }).where(eq(apiKeysTable.id, id));
}
