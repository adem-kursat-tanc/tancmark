#!/usr/bin/env bash
set -euo pipefail
umask 077

repo_root=$(git rev-parse --show-toplevel)
runtime_root=/opt/tancmark-demo
ready_root="${HOME}/.cache/tancmark-demo"
ready_commit_file="${ready_root}/prebuild-ready.commit"
current_commit=$(git -C "${repo_root}" rev-parse HEAD)

test "$(uname -s)" = Linux
test -f "${runtime_root}/runtime-provenance.json"
test -f "${ready_commit_file}"
test "$(<"${ready_commit_file}")" = "${current_commit}"
test -d "${repo_root}/node_modules"
test -f "${repo_root}/fixtures/demo-public/manifest.json"
test -f "${repo_root}/artifacts/tancmark-demo/dist/server.mjs"
test -f "${repo_root}/artifacts/tancmark-demo/dist/public/app.js"
test -f "${repo_root}/artifacts/tancmark-demo/dist/public/styles.css"

PATH="${runtime_root}/node-v24.19.0-linux-x64/bin:/usr/bin:/bin" \
  node --check "${repo_root}/artifacts/tancmark-demo/dist/public/app.js"

printf '%s\n' '{"status":"TANCMARK_DEMO_FAST_START_READY","prebuiltSetupVerified":true}'
