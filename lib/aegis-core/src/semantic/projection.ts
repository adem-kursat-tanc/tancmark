/**
 * Per-sentence projection direction üretimi (HKDF-SHA256 tabanlı).
 *
 * d_i = HKDF(ikm=secret, salt=clientId, info="aegis-semanticpos-v1|docId|idx",
 *            length=DIM*4 bytes) → Float32 normalize edilir.
 *
 * Aynı (secret, clientId, docId, idx) → her zaman aynı d. Verify yan
 * sadece bu üçlüyü bilir; suspect text'in içeriğine bağlı değildir →
 * paraphrase saldırısına dirençli.
 *
 * targetBit_i = HMAC(secret, "spbit|clientId|docId|idx") → ilk byte LSB.
 * Mesaj-bağımsız deterministik bit zinciri (mesaj-encode varyantı ileride
 * eklenebilir). Verify aynı türetmeyi yapar.
 */

import { createHmac, createHash } from "node:crypto";
import { SEMANTIC_KEY_INFO } from "./types.js";

const DIM = 768;

/** RFC 5869 HKDF-SHA256. */
function hkdf(
  ikm: Buffer,
  salt: Buffer,
  info: Buffer,
  length: number,
): Buffer {
  const prk = createHmac("sha256", salt).update(ikm).digest();
  const blocks: Buffer[] = [];
  let prev = Buffer.alloc(0);
  let counter = 1;
  while (Buffer.concat(blocks).length < length) {
    const h = createHmac("sha256", prk);
    h.update(prev);
    h.update(info);
    h.update(Buffer.from([counter]));
    prev = h.digest();
    blocks.push(prev);
    counter++;
  }
  return Buffer.concat(blocks).subarray(0, length);
}

export function projectionDirection(
  secret: string,
  clientId: string,
  docId: string,
  idx: number,
): Float32Array {
  const ikm = Buffer.from(secret, "utf8");
  const salt = Buffer.from(clientId, "utf8");
  const info = Buffer.from(`${SEMANTIC_KEY_INFO}|${docId}|${idx}`, "utf8");
  const need = DIM * 4;
  const buf = hkdf(ikm, salt, info, need);
  const v = new Float32Array(DIM);
  for (let i = 0; i < DIM; i++) {
    const u = buf.readUInt32BE(i * 4);
    v[i] = (u / 0xffffffff) * 2 - 1;
  }
  let n = 0;
  for (let i = 0; i < DIM; i++) n += v[i]! * v[i]!;
  n = Math.sqrt(n) || 1;
  for (let i = 0; i < DIM; i++) v[i]! /= n;
  return v;
}

export function targetBitFor(
  secret: string,
  clientId: string,
  docId: string,
  idx: number,
): 0 | 1 {
  const h = createHmac("sha256", secret)
    .update(`spbit|${clientId}|${docId}|${idx}`)
    .digest();
  return ((h[0]! & 1) === 1 ? 1 : 0) as 0 | 1;
}

export function dot(a: Float32Array, b: Float32Array): number {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i]! * b[i]!;
  return s;
}

export function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}
