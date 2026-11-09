import assert from "node:assert/strict";
import { createRequire } from "node:module";

// Resolve through installed workspace consumers, not a hardcoded pnpm store
// path: old cached versions can coexist without being active dependencies.
const apiRequire = createRequire(new URL("../../artifacts/api-server/package.json", import.meta.url));
const expressRequire = createRequire(apiRequire.resolve("express"));
const proxyAddr = expressRequire("proxy-addr");
const qs = expressRequire("qs");
const rateLimitRequire = createRequire(apiRequire.resolve("express-rate-limit"));
const { Address4, Address6 } = rateLimitRequire("ip-address");
const specRequire = createRequire(new URL("../../lib/api-spec/package.json", import.meta.url));
const orvalRequire = createRequire(specRequire.resolve("orval"));
const parserRequire = createRequire(orvalRequire.resolve("@scalar/openapi-parser"));
const ajvRequire = createRequire(parserRequire.resolve("ajv"));
const uri = ajvRequire("fast-uri");

for (const subnet of ["10.0.0.0/8", "::ffff:10.0.0.0/104"]) {
  // Exercise both single-subnet and multi-subnet optimized trust paths.
  for (const trust of [proxyAddr.compile(subnet), proxyAddr.compile([subnet, "192.168.0.0/16"])]) {
    for (const allowed of ["10.1.2.3", "::ffff:10.1.2.3"]) assert.equal(trust(allowed), true, `${subnet}: ${allowed}`);
    for (const rejected of ["8.8.8.8", "::ffff:8.8.8.8", "2001:db8::1", "not-an-ip"]) {
      assert.equal(trust(rejected), false, `${subnet}: ${rejected}`);
    }
  }
}
for (const trust of [proxyAddr.compile("::ffff:10.0.0.0/8"), proxyAddr.compile(["::ffff:10.0.0.0/8", "127.0.0.1/32"])]) {
  for (const rejected of ["8.8.8.8", "10.1.2.3", "192.0.2.1", "::ffff:8.8.8.8", "::ffff:10.1.2.3", "2001:db8::1"]) {
    assert.equal(trust(rejected), false, `invalid mapped /8 must not trust ${rejected}`);
  }
}
console.log("PASS proxy-addr: valid IPv4/mapped /104 trust boundaries preserved; mapped /8 cannot expand trust");

for (const malformed of ["%6Aavascript:alert(1)", "h%74tps://example.com/"]) {
  const parsed = uri.parse(malformed);
  assert.equal(parsed.error, "URI scheme is malformed.");
  assert.equal(uri.normalize(malformed), malformed);
  assert.equal(uri.equal(malformed, malformed), false);
  assert.throws(() => uri.resolve("https://example.com/", malformed));
  assert.throws(() => uri.serialize(parsed));
}
assert.equal(uri.parse("https://example.com/a%2Fb").error, undefined);
assert.equal(uri.resolve("https://example.com/a/", "../b"), "https://example.com/b");
console.log("PASS fast-uri: percent-encoded schemes rejected; valid resolution preserved");

const untrusted = JSON.parse('{"a":["b",{"toString":"x"},"c"]}');
assert.equal(qs.stringify(untrusted, { arrayFormat: "comma" }), "a=b%2C%5Bobject%20Object%5D%2Cc");
assert.equal(qs.stringify(untrusted, { arrayFormat: "comma", encode: false }), "a=b,[object Object],c");
assert.equal(qs.stringify(qs.parse("a[0][toString]=x", { allowPrototypes: true }), { arrayFormat: "comma" }), "a=%5Bobject%20Object%5D");
assert.equal(qs.stringify({ a: ["b", "c"] }, { arrayFormat: "comma" }), "a=b%2Cc");
console.log("PASS qs: JSON own toString and parser-to-comma serialization do not crash; normal arrays preserved");

const v4 = new Address4("10.1.2.3");
const v6 = new Address6("a00::1");
const net4 = new Address4("10.0.0.0/8");
const net6 = new Address6("a00::/8");
for (const method of ["isInSubnet", "isHostInSubnet"]) {
  assert.equal(v4[method](net4), true);
  assert.equal(v6[method](net6), true);
  assert.equal(v4[method](net6), false, `${method}: IPv4 cannot match an IPv6 network`);
  assert.equal(v6[method](net4), false, `${method}: coincident prefix bits cannot cross address families`);
  assert.equal(new Address6("::ffff:10.1.2.3")[method](net4), false);
  assert.equal(new Address4("192.0.2.1")[method](net4), false);
}
console.log("PASS ip-address: cross-family subnet confusion rejected; same-family checks preserved");
console.log("PASS dependency security regression contract");

await import("./public_sharp_manifest_alignment_smoke.mjs");
