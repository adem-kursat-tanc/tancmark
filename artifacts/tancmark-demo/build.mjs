import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, "dist");
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await build({
  entryPoints: [path.join(here, "src", "server.ts")],
  outfile: path.join(dist, "server.mjs"),
  platform: "node",
  bundle: true,
  format: "esm",
  target: "node24",
  sourcemap: true,
  logLevel: "info",
  external: [
    "*.node",
    "sharp",
    "@contentauth/c2pa-node",
    "@huggingface/transformers",
    "onnxruntime-node",
    "onnxruntime-common",
    "protobufjs",
    "tesseract.js",
    "tesseract.js-core",
  ],
});
await cp(path.join(here, "public"), path.join(dist, "public"), {
  recursive: true,
});
await cp(
  path.join(here, "node_modules", "hls.js", "dist", "hls.min.js"),
  path.join(dist, "public", "hls.min.js"),
);
