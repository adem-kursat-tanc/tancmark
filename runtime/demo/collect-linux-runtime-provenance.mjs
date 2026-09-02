import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(
  process.env.TANCMARK_DEMO_REPOSITORY_ROOT ?? resolve(scriptDirectory, "../.."),
);
const runtimeRoot = process.env.TANCMARK_DEMO_RUNTIME_ROOT ?? "/opt/tancmark-demo";
const outputPath = resolve(
  process.argv[2] ?? resolve(repositoryRoot, "DEMO_LINUX_RUNTIME_PROVENANCE.json"),
);

function run(file, args = [], options = {}) {
  try {
    return execFileSync(file, args, {
      encoding: "utf8",
      env: options.env ?? process.env,
      cwd: options.cwd ?? repositoryRoot,
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    const stderr = error?.stderr?.toString?.().trim();
    return `NOT_MEASURED: ${stderr || error.message}`;
  }
}

function sha256(path) {
  if (!existsSync(path)) return "NOT_MEASURED";
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function fileEvidence(path) {
  if (!existsSync(path)) {
    return { path, exists: false, sha256: "NOT_MEASURED", bytes: "NOT_MEASURED" };
  }
  return { path, exists: true, sha256: sha256(path), bytes: statSync(path).size };
}

function firstExisting(paths) {
  return paths.find((path) => existsSync(path)) ?? paths[0];
}

function ffmpegEvidence(prefix, profile) {
  const ffmpeg = `${prefix}/bin/ffmpeg`;
  const ffprobe = `${prefix}/bin/ffprobe`;
  const libraryPath = `${prefix}/lib`;
  const env = { ...process.env, LD_LIBRARY_PATH: libraryPath };
  return {
    profile,
    prefix,
    ffmpeg: fileEvidence(ffmpeg),
    ffprobe: fileEvidence(ffprobe),
    version: run(ffmpeg, ["-version"], { env }),
    buildConfiguration: run(ffmpeg, ["-hide_banner", "-buildconf"], { env }),
    encoders: run(ffmpeg, ["-hide_banner", "-encoders"], { env }),
    decoders: run(ffmpeg, ["-hide_banner", "-decoders"], { env }),
    muxers: run(ffmpeg, ["-hide_banner", "-muxers"], { env }),
    demuxers: run(ffmpeg, ["-hide_banner", "-demuxers"], { env }),
    filters: run(ffmpeg, ["-hide_banner", "-filters"], { env }),
    ffprobeVersion: run(ffprobe, ["-version"], { env }),
    ffmpegDynamicDependencies: run("/usr/bin/ldd", [ffmpeg], { env }),
    ffprobeDynamicDependencies: run("/usr/bin/ldd", [ffprobe], { env }),
  };
}

const nodePath = `${runtimeRoot}/node-v24.19.0-linux-x64/bin/node`;
const pnpmPath = `${runtimeRoot}/node-v24.19.0-linux-x64/bin/pnpm`;
const pythonPath = `${runtimeRoot}/venv/bin/python-tancmark`;
const mediaMtxPath = `${runtimeRoot}/mediamtx-1.19.1/mediamtx`;
const runtimeReceiptPath = `${runtimeRoot}/runtime-provenance.json`;
const runtimeReceipt = existsSync(runtimeReceiptPath)
  ? JSON.parse(readFileSync(runtimeReceiptPath, "utf8"))
  : null;
const sourceFiles = {
  node: firstExisting([`${runtimeRoot}/sources/node.tar.xz`, `${runtimeRoot}/sources/node-v24.19.0-linux-x64.tar.xz`]),
  python: firstExisting([`${runtimeRoot}/sources/python.tar.xz`, `${runtimeRoot}/sources/Python-3.14.7.tar.xz`]),
  ffmpeg: firstExisting([`${runtimeRoot}/sources/ffmpeg.tar.xz`, `${runtimeRoot}/sources/ffmpeg-8.1.2.tar.xz`]),
  numpy: firstExisting([`${runtimeRoot}/sources/numpy.tar.gz`, `${runtimeRoot}/sources/numpy-2.5.2.tar.gz`]),
  pyav: firstExisting([`${runtimeRoot}/sources/av.tar.gz`, `${runtimeRoot}/sources/av-18.0.0.tar.gz`]),
  mediaMtx: firstExisting([`${runtimeRoot}/sources/mediamtx.tar.gz`, `${runtimeRoot}/sources/mediamtx_v1.19.1_linux_amd64.tar.gz`]),
  c2paNodeNative: firstExisting([`${runtimeRoot}/sources/c2pa-node-native.zip`, `${runtimeRoot}/sources/c2pa-node_x86_64-unknown-linux-gnu-v0.9.1.zip`]),
};
const nativeSearchRoots = [repositoryRoot, `${runtimeRoot}/work/candidate-v11`]
  .filter((path, index, values) => existsSync(path) && values.indexOf(path) === index);
const c2paNativeCandidates = nativeSearchRoots.flatMap((root) => run("/usr/bin/find", [
  root,
  "-type",
  "f",
  "-path",
  "*/@contentauth/c2pa-node/*",
  "-name",
  "*.node",
]).split("\n").filter(Boolean)).filter((path, index, values) => values.indexOf(path) === index).sort();

const evidence = {
  schemaVersion: "tancmark-linux-demo-runtime-provenance-v1",
  profile: "CODESPACES_LINUX_DEMO_PROFILE_V1",
  measuredAtUtc: new Date().toISOString(),
  scope: "Linux demo runtime only; not a canonical Windows production certification.",
  platform: {
    osRelease: run("/usr/bin/cat", ["/etc/os-release"]),
    uname: run("/usr/bin/uname", ["-a"]),
    architecture: run("/usr/bin/uname", ["-m"]),
    cpu: run("/usr/bin/lscpu"),
    memory: run("/usr/bin/free", ["-b"]),
    filesystems: run("/usr/bin/df", ["-B1", runtimeRoot, repositoryRoot]),
    aptSources: run("/usr/bin/find", ["/etc/apt", "-maxdepth", "3", "-type", "f", "-name", "*.sources", "-o", "-name", "*.list"]),
    installedDebPackages: run("/usr/bin/dpkg-query", ["-W", "-f=${binary:Package}\t${Version}\t${Architecture}\n"]),
  },
  runtime: {
    verifiedBuildReceipt: {
      ...fileEvidence(runtimeReceiptPath),
      value: runtimeReceipt ?? "NOT_MEASURED",
      sourceArchivesRetainedAfterVerifiedBuild: false,
      retentionReason: "Verified download hashes are retained in this receipt; downloaded archives and build trees are removed from the final image.",
    },
    node: { ...fileEvidence(nodePath), version: run(nodePath, ["--version"]) },
    pnpm: {
      path: pnpmPath,
      version: run(pnpmPath, ["--version"], {
        env: {
          ...process.env,
          COREPACK_HOME: `${runtimeRoot}/corepack`,
          PATH: `${runtimeRoot}/node-v24.19.0-linux-x64/bin:/usr/bin:/bin`,
        },
      }),
    },
    python: {
      path: pythonPath,
      version: run(pythonPath, ["--version"]),
      packages: run(pythonPath, ["-m", "pip", "freeze", "--all"]),
      avAndNumpy: run(pythonPath, ["-c", "import av,numpy; print(f'PyAV={av.__version__} NumPy={numpy.__version__}')"], {
        env: {
          ...process.env,
          LD_LIBRARY_PATH: `${runtimeRoot}/python-3.14.7/lib:${runtimeRoot}/ffmpeg-8.1.2-linux-demo/lib`,
        },
      }),
    },
    ffmpegAuthoritative: ffmpegEvidence(
      `${runtimeRoot}/ffmpeg-8.1.2-linux-demo`,
      "authoritative FFV1+PCM decision path; network disabled",
    ),
    ffmpegTransport: ffmpegEvidence(
      `${runtimeRoot}/ffmpeg-8.1.2-linux-transport`,
      "loopback RTSP/HLS transport and VP9+Opus preview only; never ownership authority",
    ),
    mediaMtx: {
      ...fileEvidence(mediaMtxPath),
      version: run(mediaMtxPath, ["--version"]),
      dynamicDependencies: run("/usr/bin/ldd", [mediaMtxPath]),
    },
    c2paNode: {
      packageVersion: "0.9.1",
      nativeFiles: c2paNativeCandidates.map((path) => ({
        ...fileEvidence(path),
        dynamicDependencies: run("/usr/bin/ldd", [path]),
      })),
    },
    docker: {
      client: run("/usr/bin/docker", ["--version"]),
      server: existsSync("/run/tancmark-docker.sock")
        ? run("/usr/bin/docker", ["-H", "unix:///run/tancmark-docker.sock", "version", "--format", "{{.Server.Version}}"])
        : "NOT_MEASURED",
    },
  },
  sourceArchives: Object.fromEntries(
    Object.entries(sourceFiles).map(([name, path]) => [name, fileEvidence(path)]),
  ),
  upstreamProvenance: {
    node: { version: "24.19.0", source: "https://nodejs.org/dist/v24.19.0/", license: "MIT" },
    pnpm: { version: "10.34.5", source: "https://registry.npmjs.org/pnpm", license: "MIT" },
    python: { version: "3.14.7", source: "https://www.python.org/ftp/python/3.14.7/", license: "PSF-2.0" },
    numpy: { version: "2.5.2", source: "https://files.pythonhosted.org/packages/source/n/numpy/", license: "BSD-3-Clause" },
    pyav: { version: "18.0.0", source: "https://files.pythonhosted.org/packages/source/a/av/", license: "BSD-3-Clause" },
    ffmpeg: { version: "8.1.2", source: "https://ffmpeg.org/releases/", configuredLicense: "LGPL-2.1-or-later", gpl: false, nonfree: false },
    mediaMtx: { version: "1.19.1", source: "https://github.com/bluenviron/mediamtx/releases/tag/v1.19.1", license: "MIT" },
    c2paNode: { version: "0.9.1", source: "https://registry.npmjs.org/@contentauth/c2pa-node", license: "MIT OR Apache-2.0" },
  },
  safety: {
    platformBinariesCommittedToRepository: false,
    curlPipeShellUsed: false,
    latestTagUsed: false,
    ffmpegGplEnabled: false,
    ffmpegNonfreeEnabled: false,
    authoritativeFfmpegNetworkEnabled: false,
    previewCanOpenOwnershipOrVault: false,
    status: "MEASURED",
  },
};

writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
console.log(outputPath);
