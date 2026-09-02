#!/usr/bin/env bash
set -euo pipefail
umask 077

repo_root=$(git rev-parse --show-toplevel)
runtime_root=/opt/tancmark-demo
export PATH="${runtime_root}/node-v24.19.0-linux-x64/bin:/usr/bin:/bin"
export COREPACK_HOME="${HOME}/.cache/corepack"
export TANCMARK_DEMO_FFMPEG="${runtime_root}/ffmpeg-8.1.2-linux-demo/bin/ffmpeg"
export TANCMARK_DEMO_LD_LIBRARY_PATH="${runtime_root}/ffmpeg-8.1.2-linux-demo/lib"

test "$(uname -s)" = Linux
test -f "${runtime_root}/runtime-provenance.json"
corepack prepare pnpm@10.34.5 --activate
test "$(pnpm --version)" = "10.34.5"
cd "${repo_root}"
pnpm install --frozen-lockfile
node runtime/demo/generate-public-fixtures.mjs
pnpm --filter @workspace/tancmark-demo typecheck
pnpm --filter @workspace/tancmark-demo build
pnpm --filter @workspace/tancmark-demo test:security

ready_root="${HOME}/.cache/tancmark-demo"
mkdir -p "${ready_root}"
git rev-parse HEAD > "${ready_root}/prebuild-ready.commit"
chmod 0600 "${ready_root}/prebuild-ready.commit"
printf '%s\n' '{"status":"TANCMARK_DEMO_PREBUILD_READY","setupIncludedInPrebuild":true}'
