// SPDX-License-Identifier: AGPL-3.0-only
import { chmod, lstat, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const OPENSSL = "/usr/bin/openssl";
const outputDirectory = process.argv[2];
const expired = process.argv.includes("--expired");

if (
  process.platform !== "linux" ||
  process.env.NODE_ENV !== "test" ||
  process.env.TANCMARK_C2PA_ALLOW_TEST_SIGNING !== "1" ||
  process.env.TANCMARK_DEMO_ONLY !== "1" ||
  process.env.AEGIS_PRODUCT_RUNTIME === "1"
) {
  throw new Error("c2pa_linux_demo_test_signing_not_allowed");
}
if (!outputDirectory || !path.isAbsolute(outputDirectory)) {
  throw new Error("c2pa_test_output_directory_invalid");
}

const directory = await lstat(outputDirectory);
if (!directory.isDirectory() || directory.isSymbolicLink()) {
  throw new Error("c2pa_test_output_directory_invalid");
}

const names = {
  rootKey: path.join(outputDirectory, ".root-key.pem"),
  rootCertificate: path.join(outputDirectory, ".root-cert.pem"),
  leafRequest: path.join(outputDirectory, ".leaf.csr"),
  database: path.join(outputDirectory, ".index.txt"),
  serial: path.join(outputDirectory, ".serial"),
  config: path.join(outputDirectory, ".openssl.cnf"),
  certificate: path.join(outputDirectory, "cert.pem"),
  privateKey: path.join(outputDirectory, "key.pem"),
};

for (const target of [names.certificate, names.privateKey]) {
  try {
    await lstat(target);
    throw new Error("c2pa_test_material_already_exists");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") continue;
    throw error;
  }
}

const safeEnvironment = {
  PATH: "/usr/bin:/bin",
  LANG: "C.UTF-8",
  LC_ALL: "C.UTF-8",
  HOME: outputDirectory,
};

function run(args) {
  const result = spawnSync(OPENSSL, args, {
    cwd: outputDirectory,
    encoding: "utf8",
    env: safeEnvironment,
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(`c2pa_linux_demo_certificate_generation_failed:${args[0]}:${result.status}`);
  }
}

function opensslDate(date) {
  const two = (value) => String(value).padStart(2, "0");
  return `${two(date.getUTCFullYear() % 100)}${two(date.getUTCMonth() + 1)}${two(date.getUTCDate())}${two(date.getUTCHours())}${two(date.getUTCMinutes())}${two(date.getUTCSeconds())}Z`;
}

const configuration = `[ ca ]
default_ca = tancmark_test_ca

[ tancmark_test_ca ]
database = ${names.database}
new_certs_dir = ${outputDirectory}
certificate = ${names.rootCertificate}
private_key = ${names.rootKey}
serial = ${names.serial}
default_md = sha256
policy = tancmark_test_policy
x509_extensions = tancmark_leaf_extensions
unique_subject = no
copy_extensions = none

[ tancmark_test_policy ]
commonName = supplied
organizationName = optional

[ tancmark_leaf_extensions ]
basicConstraints = critical,CA:FALSE
keyUsage = critical,digitalSignature
extendedKeyUsage = emailProtection,1.3.6.1.5.5.7.3.36
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid:always
`;

await writeFile(names.database, "", { flag: "wx", mode: 0o600 });
await writeFile(names.serial, "1000\n", { flag: "wx", mode: 0o600 });
await writeFile(names.config, configuration, { flag: "wx", mode: 0o600 });

try {
  run(["genpkey", "-algorithm", "EC", "-pkeyopt", "ec_paramgen_curve:P-256", "-out", names.rootKey]);
  run([
    "req", "-x509", "-new", "-sha256", "-key", names.rootKey,
    "-out", names.rootCertificate, "-days", "7",
    "-subj", "/CN=TancMark Ephemeral C2PA Test Root/O=TancMark Research",
    "-addext", "basicConstraints=critical,CA:TRUE,pathlen:0",
    "-addext", "keyUsage=critical,keyCertSign,cRLSign",
    "-addext", "subjectKeyIdentifier=hash",
  ]);
  run(["genpkey", "-algorithm", "EC", "-pkeyopt", "ec_paramgen_curve:P-256", "-out", names.privateKey]);
  run([
    "req", "-new", "-sha256", "-key", names.privateKey, "-out", names.leafRequest,
    "-subj", "/CN=TancMark Ephemeral C2PA Test Signer/O=TancMark Research",
  ]);

  const now = Date.now();
  const notBefore = new Date(now - (expired ? 2 * 86_400_000 : 5 * 60_000));
  const notAfter = new Date(now + (expired ? -86_400_000 : 2 * 60 * 60_000));
  run([
    "ca", "-batch", "-notext", "-config", names.config,
    "-startdate", opensslDate(notBefore), "-enddate", opensslDate(notAfter),
    "-in", names.leafRequest, "-out", names.certificate,
  ]);

  const rootPem = await readFile(names.rootCertificate, "utf8");
  await writeFile(names.certificate, `${await readFile(names.certificate, "utf8")}\n${rootPem.trim()}\n`, { flag: "w", mode: 0o644 });
  await chmod(names.privateKey, 0o600);
  process.stdout.write('{"ok":true,"algorithm":"es256","testOnly":true,"officiallyTrusted":false,"profile":"CODESPACES_LINUX_DEMO_PROFILE_V1"}\n');
} finally {
  await Promise.all([
    rm(names.rootKey, { force: true }),
    rm(names.rootCertificate, { force: true }),
    rm(names.leafRequest, { force: true }),
    rm(names.database, { force: true }),
    rm(`${names.database}.attr`, { force: true }),
    rm(`${names.database}.old`, { force: true }),
    rm(names.serial, { force: true }),
    rm(`${names.serial}.old`, { force: true }),
    rm(names.config, { force: true }),
  ]);
}
