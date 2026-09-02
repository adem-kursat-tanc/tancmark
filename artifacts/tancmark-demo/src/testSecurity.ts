import assert from "node:assert/strict";

// The complete HTTP matrix is driven by runtime/demo/test-demo-http-security.mjs
// against the built server. This source-level contract prevents accidental
// weakening of the fixed public interface before that live test starts.
const serverSource = await import("node:fs/promises").then((fs) =>
  fs.readFile(new URL("./server.ts", import.meta.url), "utf8"),
);
const browserSource = await import("node:fs/promises").then((fs) =>
  fs.readFile(new URL("../public/app.js", import.meta.url), "utf8"),
);
const browserStyles = await import("node:fs/promises").then((fs) =>
  fs.readFile(new URL("../public/styles.css", import.meta.url), "utf8"),
);
const browserMarkup = await import("node:fs/promises").then((fs) =>
  fs.readFile(new URL("../public/index.html", import.meta.url), "utf8"),
);
for (const required of [
  "Content-Security-Policy",
  "DEMO_JSON_ONLY",
  "DEMO_CSRF_REJECTED",
  "DEMO_CROSS_ORIGIN_REJECTED",
  "DEMO_PATH_OR_URL_REJECTED",
  "DEMO_BODY_TOO_LARGE",
  "DEMO_ROUTE_NOT_FOUND",
  "productionVault: false",
]) {
  assert(serverSource.includes(required), `security contract missing: ${required}`);
}
for (const forbidden of ["child_process.exec(", "eval(", "process.env)", "multipart/form-data"]) {
  assert(!serverSource.includes(forbidden), `forbidden server source pattern: ${forbidden}`);
}
for (const required of [
  "Teknik ayrıntıları göster",
  "modulePassed",
  "renderPanel",
  "DEMO_EXACT_VERIFIED",
  "gerçek üretim sahipliği veya VAULT açılmaz",
]) {
  assert(browserSource.includes(required), `human-readable demo result contract missing: ${required}`);
}
for (const required of ["human-result--success", "technical-details"]) {
  assert(browserStyles.includes(required), `human-readable demo style contract missing: ${required}`);
}
for (const required of ['data-language="en"', 'data-language="tr"', 'aria-label="Language / Dil"']) {
  assert(browserMarkup.includes(required), `bilingual demo markup contract missing: ${required}`);
}
for (const required of ["navigator.language", "applyLanguage", "Show technical details"]) {
  assert(browserSource.includes(required), `bilingual demo runtime contract missing: ${required}`);
}
process.stdout.write(`${JSON.stringify({
  contract: "tancmark-demo-source-security",
  status: "passed",
  runtimeHttpMatrix: "SEPARATE_REQUIRED_GATE",
  externalNetworkCalls: 0,
})}\n`);
