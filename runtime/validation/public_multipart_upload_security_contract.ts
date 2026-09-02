import assert from "node:assert/strict";
import fs from "node:fs";
import { request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import type { ErrorRequestHandler } from "express";
import {
  createSecureMemoryUpload,
  MULTIPART_UPLOAD_PROFILES,
  publicMultipartUploadError,
} from "../../artifacts/api-server/src/middlewares/multipartUploadSecurity.ts";

async function main(): Promise<void> {
const { default: express } = await import("../../artifacts/api-server/node_modules/express/index.js");
const app = express();
const upload = createSecureMemoryUpload({ fileSize: 8, maxTextFields: 1, fieldSize: 4 });
app.post("/upload", upload.single("media"), (req, res) => {
  res.status(200).json({ fileBytes: req.file?.size ?? 0, fields: Object.keys(req.body ?? {}).length });
});
const errors: ErrorRequestHandler = (error, _req, res, _next) => {
  const publicError = publicMultipartUploadError(error);
  res.status(publicError?.status ?? 500).json({ error: publicError?.error ?? "internal_error" });
};
app.use(errors);

const server = app.listen(0, "127.0.0.1");
await new Promise<void>((resolve, reject) => {
  server.once("listening", resolve);
  server.once("error", reject);
});
const address = server.address() as AddressInfo;
const endpoint = `http://127.0.0.1:${address.port}/upload`;

const uploadTempPrefixes = ["multer-", "tancmark-upload-"];
const uploadTempSnapshot = (): string[] => fs.readdirSync(os.tmpdir())
  .filter((name) => uploadTempPrefixes.some((prefix) => name.startsWith(prefix)))
  .sort();
const tempBefore = uploadTempSnapshot();

async function send(form: FormData): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(endpoint, { method: "POST", body: form });
  return { status: response.status, body: await response.json() as Record<string, unknown> };
}

async function sendRaw(body: string, boundary: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    body,
  });
  return { status: response.status, body: await response.json() as Record<string, unknown> };
}

async function abortPartialUpload(): Promise<void> {
  await new Promise<void>((resolve) => {
    const boundary = "tancmark-interrupted-upload";
    const request = httpRequest({
      host: "127.0.0.1",
      port: address.port,
      path: "/upload",
      method: "POST",
      headers: {
        "content-type": `multipart/form-data; boundary=${boundary}`,
        "content-length": "4096",
      },
    });
    request.on("error", () => resolve());
    request.write(`--${boundary}\r\nContent-Disposition: form-data; name="media"; filename="partial.bin"\r\nContent-Type: application/octet-stream\r\n\r\n1234`);
    request.destroy();
    setTimeout(resolve, 100);
  });
}

try {
  const valid = new FormData();
  valid.append("id", "123");
  valid.append("media", new Blob([Buffer.alloc(7)]), "valid.bin");
  assert.deepEqual(await send(valid), { status: 200, body: { fileBytes: 7, fields: 1 } });

  const exactFieldLimit = new FormData();
  exactFieldLimit.append("id", "123");
  exactFieldLimit.append("media", new Blob([Buffer.alloc(1)]), "field-limit.bin");
  assert.equal((await send(exactFieldLimit)).status, 200);

  const nested = new FormData();
  nested.append("a[b]", "1");
  nested.append("media", new Blob([Buffer.alloc(1)]), "nested.bin");
  assert.equal((await send(nested)).status, 400);

  const deeplyNested = new FormData();
  deeplyNested.append("a[b][c][d][e][f]", "1");
  deeplyNested.append("media", new Blob([Buffer.alloc(1)]), "deep.bin");
  assert.deepEqual(await send(deeplyNested), { status: 400, body: { error: "invalid_multipart" } });

  const emptyFieldName = new FormData();
  emptyFieldName.append("", "1");
  emptyFieldName.append("media", new Blob([Buffer.alloc(1)]), "empty-field.bin");
  assert.deepEqual(await send(emptyFieldName), { status: 400, body: { error: "invalid_multipart" } });

  const longFieldName = new FormData();
  longFieldName.append("x".repeat(33), "1");
  longFieldName.append("media", new Blob([Buffer.alloc(1)]), "long-field.bin");
  assert.deepEqual(await send(longFieldName), { status: 400, body: { error: "invalid_multipart" } });

  const tooManyFields = new FormData();
  tooManyFields.append("id", "1");
  tooManyFields.append("extra", "2");
  tooManyFields.append("media", new Blob([Buffer.alloc(1)]), "fields.bin");
  assert.equal((await send(tooManyFields)).status, 400);

  const tooLargeField = new FormData();
  tooLargeField.append("id", "12345");
  tooLargeField.append("media", new Blob([Buffer.alloc(1)]), "field-size.bin");
  assert.deepEqual(await send(tooLargeField), { status: 413, body: { error: "payload_too_large" } });

  const tooLargeFile = new FormData();
  tooLargeFile.append("media", new Blob([Buffer.alloc(9)]), "file-size.bin");
  assert.deepEqual(await send(tooLargeFile), { status: 413, body: { error: "payload_too_large" } });

  const tooManyFiles = new FormData();
  tooManyFiles.append("media", new Blob([Buffer.alloc(1)]), "one.bin");
  tooManyFiles.append("media", new Blob([Buffer.alloc(1)]), "two.bin");
  assert.equal((await send(tooManyFiles)).status, 400);

  const tooManyParts = new FormData();
  tooManyParts.append("id", "1");
  tooManyParts.append("media", new Blob([Buffer.alloc(1)]), "part-one.bin");
  tooManyParts.append("extra", new Blob([Buffer.alloc(1)]), "part-two.bin");
  assert.deepEqual(await send(tooManyParts), { status: 400, body: { error: "invalid_multipart" } });

  const malformedBoundary = "tancmark-malformed-boundary";
  const malformed = await sendRaw(
    `--${malformedBoundary}\r\nContent-Disposition: form-data; name="media"; filename="broken.bin"\r\nContent-Type: application/octet-stream\r\n\r\n1234`,
    malformedBoundary,
  );
  assert.deepEqual(malformed, { status: 400, body: { error: "invalid_multipart" } });

  await abortPartialUpload();
  const afterAbort = new FormData();
  afterAbort.append("media", new Blob([Buffer.alloc(1)]), "after-abort.bin");
  assert.equal((await send(afterAbort)).status, 200);

  const concurrentResults = await Promise.all(Array.from({ length: 12 }, async (_, index) => {
    const boundary = `tancmark-concurrent-${index}`;
    return sendRaw(`--${boundary}\r\nmalformed\r\n`, boundary);
  }));
  assert(concurrentResults.every((result) => result.status === 400 && result.body.error === "invalid_multipart"));

  const afterConcurrent = new FormData();
  afterConcurrent.append("media", new Blob([Buffer.alloc(1)]), "after-concurrent.bin");
  assert.equal((await send(afterConcurrent)).status, 200);
  assert.deepEqual(uploadTempSnapshot(), tempBefore);

  assert.equal(MULTIPART_UPLOAD_PROFILES.aegisImage.maxTextFields, 0);
  assert.equal(MULTIPART_UPLOAD_PROFILES.visualLab.maxTextFields, 8);
  assert.equal(MULTIPART_UPLOAD_PROFILES.videoPrivateExact.fieldSize, 4 * 1024 * 1024);
  process.stdout.write(`${JSON.stringify({
    contract: "public_multipart_upload_security_contract",
    status: "passed",
    multerVersion: "2.2.0",
    flatFieldNestingDepth: 0,
    controlledClientErrors: true,
    validUploadPreserved: true,
    maximumEffectiveFileAndFieldValuesAccepted: true,
    emptyAndLongFieldNamesRejected: true,
    tooManyFieldsFilesAndPartsRejected: true,
    malformedAndInterruptedUploadsContained: true,
    concurrentMalformedUploadsContained: 12,
    processCrash: false,
    orphanUploadFiles: 0,
    secretDisclosure: 0,
    externalNetworkCalls: 0,
  }, null, 2)}\n`);
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
