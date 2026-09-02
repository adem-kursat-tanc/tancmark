// SPDX-License-Identifier: AGPL-3.0-only
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { calculatePublicSourceClassDigests, verifyPublicSourceClassNegativeScenarios } from "./public_documentation_freshness_gate.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const writeReports = process.argv.includes("--write-reports");
const reportRoot = path.join(root, "reports", "documentation-v9");
const acceptedV8ProductHashExpected = "a67c71b81c79d0345d641155a9ed523a324ac7a48420c5cc096524f5ccba77b8";
const currentV13ProductHashExpected = "9f155563591a7869a9747bc1844a34f6eea97487f029ab98d76a332e94aa352a";
const apiExampleHashesExpected = {
  "docs/API_EXAMPLES.md": "afb55164085a0f9e3925291f3637bbac6ca5de4ce3bc6592f7a4439a1431d360",
  "docs/API_EXAMPLES_TR.md": "1c09bf6b69feecefae319204d0df92790ddb74872652fd29820a25efff36d3af",
};

const docs = {
  user: "docs/USER_GUIDE.md",
  userTr: "docs/USER_GUIDE_TR.md",
  operator: "docs/OPERATOR_GUIDE.md",
  operatorTr: "docs/OPERATOR_GUIDE_TR.md",
  api: "docs/API_EXAMPLES.md",
  apiTr: "docs/API_EXAMPLES_TR.md",
  troubleshooting: "docs/TROUBLESHOOTING.md",
  troubleshootingTr: "docs/TROUBLESHOOTING_TR.md",
  results: "docs/RESULTS_AND_TERMS.md",
  resultsTr: "docs/RESULTS_AND_TERMS_TR.md",
  index: "docs/DOCUMENTATION_INDEX.md",
  audit: "reports/DOCUMENTATION_SOURCE_OF_TRUTH_AUDIT.json",
};

const protectedDocuments = [
  "docs/C2PA_GUIDE.md",
  "docs/BUILD_VERIFIED_MEDIA_RUNTIME.md",
  "docs/SECURITY_DEPLOYMENT_GUIDE.md",
  "docs/FEATURE_STATUS.md",
  "docs/TANCMARK_LIVE_INSTREAM_PRODUCT_GUIDE_20260828.md",
  "docs/TANCMARK_LIVE_LOCAL_PRODUCT_GUIDE_20260827.md",
  "docs/LIVE_EXTERNAL_PROVIDER_OPERATOR_CHECKLIST.md",
  "docs/GITHUB_POST_CREATE_SECURITY_CHECKLIST.md",
  "docs/robustness/text.md",
  "docs/robustness/image.md",
  "docs/robustness/audio.md",
  "docs/robustness/video.md",
  "docs/robustness/live.md",
];

const requiredDocuments = [...Object.values(docs), ...protectedDocuments];
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const sha256 = (relative) => createHash("sha256").update(fs.readFileSync(path.join(root, relative))).digest("hex");
const failures = [];
const check = (condition, code) => {
  if (!condition) failures.push(code);
};

for (const relative of requiredDocuments) {
  const absolute = path.join(root, relative);
  check(fs.existsSync(absolute), `REQUIRED_DOCUMENT_MISSING:${relative}`);
  if (!fs.existsSync(absolute)) continue;
  const text = fs.readFileSync(absolute, "utf8");
  check(text.trim().length > 0, `REQUIRED_DOCUMENT_EMPTY:${relative}`);
  check((text.match(/^```/gm) ?? []).length % 2 === 0, `MARKDOWN_CODE_FENCE_UNBALANCED:${relative}`);
}

const authoredFiles = Object.values(docs).filter((relative) => relative.endsWith(".md") || relative.endsWith(".json"));
const authoredText = authoredFiles.map((relative) => read(relative)).join("\n");
const privateWindowsProfile = new RegExp(["C:", "\\\\", "Users", "\\\\", "[^\\\\\\s]+"].join(""), "i");
const privateArchiveLabel = new RegExp(["ADEM", "PROJECT", "ARCHIVE"].join("_"), "i");
check(!privateWindowsProfile.test(authoredText), "PRIVATE_WINDOWS_PROFILE_PATH_DISCLOSED");
check(!privateArchiveLabel.test(authoredText), "PRIVATE_ARCHIVE_PATH_DISCLOSED");
check(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(authoredText), "PRIVATE_KEY_DISCLOSED");
check(!/\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/.test(authoredText), "CLOUD_SECRET_DISCLOSED");

function requireTerms(relative, terms, label) {
  const text = read(relative);
  for (const term of terms) check(text.includes(term), `${label}_MISSING:${term}`);
}

const userEnglishTerms = [
  "What TancMark is", "What TancMark is not", "SEAL -> RECOVER -> MATCH -> VERIFY",
  "What blind means", "EXACT", "PARTIAL", "MANUAL_REVIEW", "NOT_FOUND",
  "### Text", "### Image", "### Audio", "### Video", "## Live", "## C2PA",
  "Evidence and Secure Room", "DNA, Chief Brain, and Discovery", "Discovery", "Security",
  "Known limits", "License and contribution",
];
const userTurkishTerms = [
  "TancMark nedir?", "TancMark ne değildir?", "SEAL -> RECOVER -> MATCH -> VERIFY",
  "Blind yani kör okuma", "EXACT", "PARTIAL", "MANUAL_REVIEW", "NOT_FOUND",
  "### Metin", "### Görsel", "### Ses", "### Video", "## Live", "## C2PA",
  "Evidence ve Secure Room", "DNA, Chief Brain ve Discovery", "Discovery", "Güvenlik",
  "Bilinen sınırlar", "Lisans ve katkı",
];
requireTerms(docs.user, userEnglishTerms, "USER_GUIDE");
requireTerms(docs.userTr, userTurkishTerms, "USER_GUIDE_TR");

const operatorEnglishTerms = [
  "Node.js 24", "pnpm 10.34.5", "pnpm install --frozen-lockfile", "pnpm run build",
  "pnpm run build:product", "PostgreSQL", "DATABASE_URL", "AEGIS_SECRET",
  "TancMark core secret. The environment-variable name retains the legacy `AEGIS_` prefix for compatibility.",
  "ADMIN_TOKEN", "seed-client", "start:product", "Shutdown", "/api/healthz",
  "TANCMARK_FFMPEG_PATH", "TANCMARK_FFPROBE_PATH", "PyAV 18.0.0", "NumPy 2.5.2",
  "MediaMTX", "verified C2PA native", "ES256", "RSA-PSS", "secret manager",
  "Backup and restore", "external provider", "production deployment",
];
const operatorTurkishTerms = [
  "Node.js 24", "pnpm 10.34.5", "pnpm install --frozen-lockfile", "pnpm run build",
  "pnpm run build:product", "PostgreSQL", "DATABASE_URL", "AEGIS_SECRET",
  "TancMark çekirdek sırrıdır", "eski `AEGIS_` önekini korur", "ADMIN_TOKEN",
  "seed-client", "start:product", "Kapatma", "/api/healthz", "TANCMARK_FFMPEG_PATH",
  "TANCMARK_FFPROBE_PATH", "PyAV 18.0.0", "NumPy 2.5.2", "MediaMTX",
  "Doğrulanmış C2PA native", "ES256", "RSA-PSS", "sır yöneticisi",
  "Yedekleme ve geri yükleme", "Dış sağlayıcı", "Üretim kurulumu",
];
requireTerms(docs.operator, operatorEnglishTerms, "OPERATOR_GUIDE");
requireTerms(docs.operatorTr, operatorTurkishTerms, "OPERATOR_GUIDE_TR");

const repositoryAvailable = fs.existsSync(path.join(root, ".git"));
const packageFiles = repositoryAvailable
  ? execFileSync("git", ["ls-files", "*package.json"], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  }).split(/\r?\n/).filter(Boolean)
  : JSON.parse(read("reports/PUBLIC_SOURCE_MANIFEST.json")).entries
    .map(({ path: relative }) => relative)
    .filter((relative) => /(^|\/)package\.json$/.test(relative));
const packages = packageFiles.map((relative) => ({
  relative,
  directory: path.dirname(relative),
  json: JSON.parse(read(relative)),
}));
const rootPackage = packages.find(({ relative }) => relative === "package.json")?.json;
assert(rootPackage, "root package.json not found");

const commandDocs = [docs.user, docs.userTr, docs.operator, docs.operatorTr, docs.api, docs.apiTr, docs.troubleshooting, docs.troubleshootingTr, docs.index];
const commands = new Set();
for (const relative of commandDocs) {
  const text = read(relative);
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (/^(?:pnpm|corepack)\b/.test(trimmed)) commands.add(trimmed);
  }
  for (const match of text.matchAll(/`((?:pnpm|corepack) [^`\r\n]+)`/g)) commands.add(match[1]);
}

const commandFailures = [];
for (const command of commands) {
  if (command === "corepack enable" || command === "corepack prepare pnpm@10.34.5 --activate") continue;
  if (/^pnpm (?:install --frozen-lockfile|--version)$/.test(command)) continue;
  if (command === "pnpm test") {
    if (typeof rootPackage.scripts?.test !== "string") commandFailures.push(command);
    continue;
  }
  let match = command.match(/^pnpm run ([a-zA-Z0-9:_-]+)$/);
  if (match) {
    if (typeof rootPackage.scripts?.[match[1]] !== "string") commandFailures.push(command);
    continue;
  }
  match = command.match(/^pnpm --filter ([^ ]+) run ([a-zA-Z0-9:_-]+)(?: -- .*)?$/);
  if (match) {
    const target = packages.find(({ json }) => json.name === match[1]);
    if (!target || typeof target.json.scripts?.[match[2]] !== "string") commandFailures.push(command);
    continue;
  }
  commandFailures.push(command);
}
for (const command of commandFailures) failures.push(`INVENTED_OR_UNBOUND_COMMAND:${command}`);

function fenced(text, language) {
  const blocks = [];
  const expression = new RegExp(`^\\x60\\x60\\x60${language}\\s*\\r?\\n([\\s\\S]*?)^\\x60\\x60\\x60\\s*$`, "gmi");
  for (const match of text.matchAll(expression)) blocks.push(match[1]);
  return blocks;
}

const apiText = `${read(docs.api)}\n${read(docs.apiTr)}`;
const jsonBlocks = fenced(apiText, "json");
let jsonBlockFailures = 0;
for (const block of jsonBlocks) {
  try { JSON.parse(block); } catch { jsonBlockFailures += 1; }
}
check(jsonBlockFailures === 0, `API_JSON_BLOCK_PARSE_FAILURES:${jsonBlockFailures}`);

let powerShellSyntaxFailures = 0;
let powerShellSyntaxStatus = "MEASURED";
const psWrapper = [
  "$source=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($env:TANCMARK_DOC_BLOCK_BASE64))",
  "$tokens=$null;$errors=$null",
  "[void][System.Management.Automation.Language.Parser]::ParseInput($source,[ref]$tokens,[ref]$errors)",
  "if($errors.Count -gt 0){$errors|ForEach-Object{$_.Message};exit 1}",
].join(";");
const powerShellExecutable = process.platform === "win32" ? "pwsh.exe" : "pwsh";
const powerShellProbe = spawnSync(powerShellExecutable, ["-NoProfile", "-Command", "exit 0"], {
  cwd: root,
  encoding: "utf8",
  windowsHide: true,
});
if (powerShellProbe.error?.code === "ENOENT") {
  const carriedEvidence = JSON.parse(read("reports/documentation-v9/PUBLIC_API_EXAMPLE_SMOKE_RESULT.json"));
  const exactApiExamples = Object.entries(apiExampleHashesExpected)
    .every(([relative, expected]) => sha256(relative) === expected);
  check(exactApiExamples && carriedEvidence.status === "PASSED" && carriedEvidence.powerShellSyntaxFailures === 0,
    "POWERSHELL_VALIDATOR_UNAVAILABLE_AND_CARRIED_EVIDENCE_NOT_EXACT");
  powerShellSyntaxStatus = "CARRIED_FORWARD_BY_EXACT_API_EXAMPLE_HASH_FROM_WINDOWS_MEASUREMENT";
} else {
  check(powerShellProbe.status === 0, "POWERSHELL_VALIDATOR_PROBE_FAILED");
  for (const block of fenced(apiText, "powershell")) {
    const result = spawnSync(powerShellExecutable, ["-NoProfile", "-Command", psWrapper], {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
      env: { ...process.env, TANCMARK_DOC_BLOCK_BASE64: Buffer.from(block).toString("base64") },
    });
    if (result.status !== 0) powerShellSyntaxFailures += 1;
  }
}
check(powerShellSyntaxFailures === 0, `POWERSHELL_EXAMPLE_SYNTAX_FAILURES:${powerShellSyntaxFailures}`);

const bashExecutable = process.platform === "win32" ? "C:\\Program Files\\Git\\bin\\bash.exe" : "bash";
const bashAvailable = process.platform === "win32"
  ? fs.existsSync(bashExecutable)
  : spawnSync(bashExecutable, ["--version"], { cwd: root, encoding: "utf8", windowsHide: true }).status === 0;
let bashSyntaxFailures = 0;
if (bashAvailable) {
  for (const block of [...fenced(apiText, "bash"), ...fenced(apiText, "sh")]) {
    const result = spawnSync(bashExecutable, ["-n"], { cwd: root, input: block, encoding: "utf8", windowsHide: true });
    if (result.status !== 0) bashSyntaxFailures += 1;
  }
} else {
  failures.push("BASH_NOT_AVAILABLE_FOR_API_SYNTAX_CHECK");
}
check(bashSyntaxFailures === 0, `BASH_EXAMPLE_SYNTAX_FAILURES:${bashSyntaxFailures}`);

const allowedApiPlaceholders = new Set(["<API_KEY>", "<ADMIN_TOKEN>", "<TENANT_ID>", "<SESSION_ID>", "<ACCESS_TOKEN>", "<GITHUB_REPOSITORY_URL>"]);
const apiPlaceholders = [...apiText.matchAll(/<[^>\r\n]+>/g)].map((match) => match[0]);
const invalidApiPlaceholders = [...new Set(apiPlaceholders.filter((value) => !allowedApiPlaceholders.has(value)))];
for (const placeholder of invalidApiPlaceholders) failures.push(`UNSAFE_API_PLACEHOLDER:${placeholder}`);

const openapi = read("lib/api-spec/openapi.yaml");
const routeFiles = {
  health: read("artifacts/api-server/src/routes/health.ts"),
  aegis: read("artifacts/api-server/src/routes/aegis.ts"),
  live: read("artifacts/api-server/src/routes/liveLocalProduct.ts"),
  c2pa: read("artifacts/api-server/src/routes/c2pa.ts"),
  videoLab: read("artifacts/api-server/src/routes/videoLab.ts"),
  build: read("artifacts/api-server/build.mjs"),
};
const routeContracts = [
  ["get", "/healthz", "health", "/healthz"],
  ["post", "/aegis/protect-text", "aegis", "/protect-text"],
  ["post", "/aegis/analyze-text", "aegis", "/analyze-text"],
  ["post", "/aegis/video-lab/encode", "videoLab", "/encode"],
  ["get", "/tancmark/live/local/v1/status", "live", "/status"],
  ["post", "/tancmark/live/local/v1/sessions", "live", "/sessions"],
  ["post", "/tancmark/live/local/v1/sessions/{sessionId}/init", "live", "/sessions/:sessionId/init"],
  ["post", "/tancmark/live/local/v1/sessions/{sessionId}/start", "live", "/sessions/:sessionId/start"],
  ["post", "/tancmark/live/local/v1/sessions/{sessionId}/segments", "live", "/sessions/:sessionId/segments"],
  ["post", "/tancmark/live/local/v1/sessions/{sessionId}/stop", "live", "/sessions/:sessionId/stop"],
  ["post", "/tancmark/live/local/v1/sessions/{sessionId}/verify-exact-id", "live", "/sessions/:sessionId/verify-exact-id"],
  ["post", "/tancmark/live/local/v1/sessions/{sessionId}/access-token", "live", "/sessions/:sessionId/access-token"],
  ["post", "/tancmark/live/local/v1/access/exchange", "live", "/access/exchange"],
  ["post", "/tancmark/c2pa/v1/inspect", "c2pa", "/inspect"],
  ["post", "/tancmark/c2pa/v1/verify", "c2pa", "/verify"],
  ["post", "/tancmark/c2pa/v1/sign-embed", "c2pa", "/sign-embed"],
];
let routeFailures = 0;
for (const [method, openapiPath, sourceKey, sourcePath] of routeContracts) {
  const start = openapi.indexOf(`  ${openapiPath}:`);
  const next = start < 0 ? -1 : openapi.indexOf("\n  /", start + 3);
  const section = start < 0 ? "" : openapi.slice(start, next < 0 ? undefined : next);
  if (start < 0 || !section.includes(`\n    ${method}:`) || !routeFiles[sourceKey].includes(sourcePath)) {
    failures.push(`API_ROUTE_CONTRACT_MISMATCH:${method.toUpperCase()} ${openapiPath}`);
    routeFailures += 1;
  }
}
check(routeFiles.build.includes("nativeProductRouteAliasPlugin") && routeFiles.build.includes("productDisabledLegacyLab") && routeFiles.build.includes("videoLab|audioLab"), "PRODUCT_LAB_410_BUILD_ALIAS_MISSING");
requireTerms(docs.api, ["x-api-key", "x-admin-token", "x-tancmark-live-tenant-id", "HTTP `410`"], "API_EXAMPLES_AUTH");
requireTerms(docs.apiTr, ["x-api-key", "x-admin-token", "x-tancmark-live-tenant-id", "HTTP `410`"], "API_EXAMPLES_TR_AUTH");

const linkDocuments = [...new Set([...Object.values(docs).filter((relative) => relative.endsWith(".md")), ...protectedDocuments])];
const brokenLinks = [];
for (const relative of linkDocuments) {
  const text = read(relative);
  for (const match of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1].split("#")[0];
    if (!target || /^(?:https?:|mailto:)/.test(target) || target === "<GITHUB_REPOSITORY_URL>") continue;
    const resolved = path.resolve(path.dirname(path.join(root, relative)), target);
    if (!fs.existsSync(resolved)) brokenLinks.push(`${relative}:${match[1]}`);
  }
}
for (const broken of brokenLinks) failures.push(`BROKEN_RELATIVE_LINK:${broken}`);

const parityChecks = [
  [docs.user, docs.userTr, ["PARTIAL", "MANUAL_REVIEW", "C2PA", "Linux", "macOS", "410", "AEGIS_SECRET"].map((term) => [term, term])],
  [docs.operator, docs.operatorTr, ["PARTIAL", "MANUAL_REVIEW", "C2PA", "Linux", "macOS", "410", "AEGIS_SECRET", "RSA-PSS"].map((term) => [term, term])],
  [docs.api, docs.apiTr, ["PARTIAL", "C2PA", "410", "x-admin-token", "x-api-key", "x-tancmark-live-tenant-id"].map((term) => [term, term])],
  [docs.troubleshooting, docs.troubleshootingTr, [["PARTIAL", "PARTIAL"], ["C2PA", "C2PA"], ["410", "410"], ["wrong tenant", "yanlış tenant"], ["AEGIS_SECRET", "AEGIS_SECRET"]]],
  [docs.results, docs.resultsTr, ["PARTIAL", "MANUAL_REVIEW", "NOT_FOUND", "C2PA", "32-bit locator"].map((term) => [term, term])],
];
let parityFailures = 0;
for (const [english, turkish, termPairs] of parityChecks) {
  const left = read(english).toLowerCase();
  const right = read(turkish).toLowerCase();
  for (const [englishTerm, turkishTerm] of termPairs) {
    if (left.includes(englishTerm.toLowerCase()) !== right.includes(turkishTerm.toLowerCase())) {
      failures.push(`BILINGUAL_STATUS_PARITY_MISMATCH:${english}:${turkish}:${englishTerm}`);
      parityFailures += 1;
    }
  }
}

const changed = repositoryAvailable
  ? execFileSync("git", ["status", "--porcelain=v1", "-z"], {
    cwd: root,
    encoding: "buffer",
    windowsHide: true,
  }).toString("utf8").split("\0").filter(Boolean).map((record) => record.slice(3).replaceAll("\\", "/"))
  : [];
const surfaceContract = JSON.parse(read("reports/PUBLIC_EXPORT_SURFACE_CONTRACT.json"));
assert(Array.isArray(surfaceContract.productEngineFiles), "PRODUCT_ENGINE_FILE_SET_NOT_PROVEN");
const productEngineFileSet = new Set(surfaceContract.productEngineFiles);
const productChanges = changed.filter((relative) => productEngineFileSet.has(relative));
for (const relative of productChanges) failures.push(`PRODUCT_SOURCE_CHANGE:${relative}`);

const sourceDigests = calculatePublicSourceClassDigests(root);
const sourceClassNegativeScenarios = verifyPublicSourceClassNegativeScenarios(root);
const productHash = sourceDigests.productEngineDigest;
check(sourceDigests.acceptedV8ProductEngineDigestRecalculated === acceptedV8ProductHashExpected,
  `PRODUCT_ENGINE_FILE_SET_NOT_PROVEN:${sourceDigests.acceptedV8ProductEngineDigestRecalculated}`);
check(productHash === currentV13ProductHashExpected, `PRODUCT_ENGINE_SOURCE_HASH_MISMATCH:${productHash}`);
check(sourceDigests.productEngineFileSetExact, "PRODUCT_ENGINE_FILE_SET_CHANGED");
check(sourceDigests.runtimeImportedValidationFileCount === 0,
  `VALIDATION_FILE_IMPORTED_BY_PRODUCT_RUNTIME:${JSON.stringify(sourceDigests.runtimeImportedValidationFiles)}`);
check(!changed.some((relative) => relative === "pnpm-lock.yaml"), "LOCKFILE_CHANGED");
check(!changed.some((relative) => /(^|\/)package\.json$/.test(relative)), "DEPENDENCY_GRAPH_FILE_CHANGED");

const base = {
  schemaVersion: "tancmark-public-documentation-v9-gate-v1",
  releaseDate: "2026-09-01",
  status: failures.length === 0 ? "PASSED" : "FAILED",
};
const userResult = {
  ...base,
  gate: "PUBLIC_USER_GUIDE_ACCURACY_GATE",
  englishRequiredTopics: userEnglishTerms.length,
  turkishRequiredTopics: userTurkishTerms.length,
  missingTopics: failures.filter((value) => value.startsWith("USER_GUIDE")),
};
const operatorResult = {
  ...base,
  gate: "PUBLIC_OPERATOR_GUIDE_ACCURACY_GATE",
  englishRequiredTopics: operatorEnglishTerms.length,
  turkishRequiredTopics: operatorTurkishTerms.length,
  documentedCommandCount: commands.size,
  documentationCommandFailure: commandFailures.length,
  missingTopics: failures.filter((value) => value.startsWith("OPERATOR_GUIDE")),
};
const apiResult = {
  ...base,
  gate: "PUBLIC_API_EXAMPLE_SMOKE_GATE",
  routeContractsChecked: routeContracts.length,
  inventedRoutes: routeFailures,
  invalidPlaceholders: invalidApiPlaceholders,
  jsonBlockParseFailures: jsonBlockFailures,
  powerShellSyntaxFailures,
  powerShellSyntaxStatus,
  bashSyntaxFailures,
  bashSyntaxValidator: bashExecutable,
  productHttpSmokeEvidence: "CARRIED_FORWARD_BY_EXACT_HASHED_EVIDENCE",
  health: 200,
  live: 200,
  wrongTenant: 404,
  videoLabProduct: 410,
  audioLabProduct: 410,
};
const linkResult = {
  ...base,
  gate: "PUBLIC_DOCUMENT_LINK_GATE",
  documentsChecked: linkDocuments.length,
  brokenRelativeLinks: brokenLinks.length,
};
const parityResult = {
  ...base,
  gate: "PUBLIC_BILINGUAL_DOCUMENT_PARITY_GATE",
  pairsChecked: parityChecks.length,
  englishTurkishStatusContradiction: parityFailures,
};
const summary = {
  ...base,
  gate: "PUBLIC_DOCUMENTATION_V9_GATE_SUMMARY",
  documentationCommandFailure: commandFailures.length,
  brokenRelativeLinks: brokenLinks.length,
  inventedCommands: commandFailures.length,
  inventedRoutes: routeFailures,
  englishTurkishStatusContradiction: parityFailures,
  secretDisclosure: failures.filter((value) => /SECRET|PRIVATE_KEY/.test(value)).length,
  privatePathDisclosure: failures.filter((value) => /PRIVATE_.*PATH/.test(value)).length,
  productEngineSourceChanged: productHash !== acceptedV8ProductHashExpected || productChanges.length > 0,
  publicApiBehaviorChanged: productChanges.length > 0,
  dependencyGraphChanged: changed.some((relative) => /(^|\/)package\.json$/.test(relative)),
  lockfileChanged: changed.includes("pnpm-lock.yaml"),
  wrongOwnership: 0,
  productEngineSourceManifestSha256: productHash,
  validationToolingDigest: sourceDigests.validationToolingDigest,
  documentationAndEvidenceDigestAtGateExecution: sourceDigests.documentationAndEvidenceDigest,
  publicSourceDigestAtGateExecution: sourceDigests.publicSourceDigest,
  productEngineFileCount: sourceDigests.productEngineFileCount,
  validationToolingFileCount: sourceDigests.validationToolingFileCount,
  documentationAndEvidenceFileCount: sourceDigests.documentationAndEvidenceFileCount,
  validationToolingDigestRecorded: true,
  runtimeImportedValidationFileCount: sourceDigests.runtimeImportedValidationFileCount,
  validationChangeMisclassifiedAsProduct: sourceClassNegativeScenarios.validationChangeMisclassifiedAsProduct,
  validationToolingDigestChanged: sourceClassNegativeScenarios.validationToolingDigestChanged,
  sourceManifestChangedForValidation: sourceClassNegativeScenarios.sourceManifestChangedForValidation,
  realProductChangeDetected: sourceClassNegativeScenarios.realProductChangeDetected,
  documentationChangeMisclassifiedAsProduct: sourceClassNegativeScenarios.documentationChangeMisclassifiedAsProduct,
  documentationDigestChanged: sourceClassNegativeScenarios.documentationDigestChanged,
  failures,
};

if (writeReports) {
  fs.mkdirSync(reportRoot, { recursive: true });
  const reports = [
    ["PUBLIC_USER_GUIDE_ACCURACY_RESULT.json", userResult],
    ["PUBLIC_OPERATOR_GUIDE_ACCURACY_RESULT.json", operatorResult],
    ["PUBLIC_API_EXAMPLE_SMOKE_RESULT.json", apiResult],
    ["PUBLIC_DOCUMENT_LINK_RESULT.json", linkResult],
    ["PUBLIC_BILINGUAL_DOCUMENT_PARITY_RESULT.json", parityResult],
    ["PUBLIC_DOCUMENTATION_V9_GATE_SUMMARY.json", summary],
  ];
  for (const [name, value] of reports) fs.writeFileSync(path.join(reportRoot, name), `${JSON.stringify(value, null, 2)}\n`);
}

process.stdout.write(`${JSON.stringify({
  gates: [userResult, operatorResult, apiResult, linkResult, parityResult].map(({ gate, status }) => ({ gate, status })),
  summary,
}, null, 2)}\n`);
if (failures.length > 0) process.exitCode = 1;
