import { createHmac, randomBytes } from "node:crypto";
import { db, clientsTable, apiKeysTable } from "@workspace/db";

const KEY_PREFIX = "ak_";
const API_KEY_HMAC_HASH_VERSION = "hmac-sha256-pepper-v1";
const API_KEY_HMAC_HASH_PREFIX = `${API_KEY_HMAC_HASH_VERSION}:`;
const MIN_PEPPER_LENGTH = 16;
const DEV_TEST_PEPPER = "tancmark-dev-test-api-key-pepper-not-for-product";

function productRuntimeActive(): boolean {
  return process.env["NODE_ENV"] === "production" || process.env["AEGIS_PRODUCT_RUNTIME"] === "1";
}

function resolveSeedPepper(): string {
  const configured = (process.env["AEGIS_API_KEY_PEPPER"] ?? process.env["TANCMARK_API_KEY_PEPPER"] ?? "").trim();
  if (configured.length >= MIN_PEPPER_LENGTH) return configured;
  if (productRuntimeActive()) throw new Error("api_key_pepper_required_in_product");
  return DEV_TEST_PEPPER;
}

function hashSeedApiKey(plaintext: string): string {
  return `${API_KEY_HMAC_HASH_PREFIX}${createHmac("sha256", resolveSeedPepper())
    .update(plaintext, "utf8")
    .digest("hex")}`;
}

async function main(): Promise<void> {
  const slug = process.argv[2] ?? "demo";
  const name = process.argv[3] ?? "Demo Client";
  const label = process.argv[4] ?? "default";

  const existing = await db.query.clientsTable.findFirst({
    where: (c, { eq }) => eq(c.slug, slug),
  });
  const client = existing
    ? existing
    : (await db.insert(clientsTable).values({ slug, name }).returning())[0];
  if (!client) throw new Error("client insert failed");

  const raw = randomBytes(24).toString("base64url");
  const plaintext = `${KEY_PREFIX}${raw}`;
  const hash = hashSeedApiKey(plaintext);
  const prefix = plaintext.slice(0, 10);

  const [apiKey] = await db
    .insert(apiKeysTable)
    .values({ clientId: client.id, label, keyHash: hash, keyPrefix: prefix })
    .returning();
  if (!apiKey) throw new Error("api key insert failed");

  // codeql[js/clear-text-logging] This owner-run provisioning CLI deliberately hands off a new secret once on local stdout; server logs never receive it.
  console.log(JSON.stringify({
    client: { id: client.id, slug: client.slug, name: client.name },
    apiKey: { id: apiKey.id, label: apiKey.label, prefix: apiKey.keyPrefix, plaintext },
    note: "Save the plaintext now — it is not stored.",
  }, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
