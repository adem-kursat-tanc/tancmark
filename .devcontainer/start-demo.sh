#!/usr/bin/env bash
set -euo pipefail
umask 077

repo_root=$(git rev-parse --show-toplevel)
runtime_root=/opt/tancmark-demo
state_root=/tmp/tancmark-demo
mkdir -p "${state_root}"
pid_file=${state_root}/server.pid
log_file=${state_root}/server.log

pid_is_live_demo_server() {
  local candidate_pid=$1
  local process_state
  [[ "${candidate_pid}" =~ ^[0-9]+$ ]] || return 1
  [[ -r "/proc/${candidate_pid}/stat" && -r "/proc/${candidate_pid}/cmdline" ]] || return 1
  process_state=$(awk '{print $3}' "/proc/${candidate_pid}/stat")
  [[ "${process_state}" != "Z" ]] || return 1
  tr '\0' ' ' < "/proc/${candidate_pid}/cmdline" | grep -Fq -- \
    "artifacts/tancmark-demo/dist/server.mjs"
}

if [[ -f "${pid_file}" ]]; then
  old_pid=$(<"${pid_file}")
  if pid_is_live_demo_server "${old_pid}"; then
    exit 0
  fi
  rm -f "${pid_file}" "${log_file}"
fi

cd "${repo_root}"
transport_sha=$(sha256sum "${runtime_root}/ffmpeg-8.1.2-linux-transport/bin/ffmpeg" | awk '{print $1}')
env -i \
  HOME="${state_root}" \
  PATH="${runtime_root}/node-v24.19.0-linux-x64/bin:/usr/bin:/bin" \
  LANG=C.UTF-8 LC_ALL=C.UTF-8 NODE_ENV=demo PORT=4173 \
  TANCMARK_DEMO_ONLY=1 TANCMARK_DEMO_BIND=0.0.0.0 \
  TANCMARK_DEMO_REPO_ROOT="${repo_root}" TANCMARK_DEMO_TEMP_ROOT="${state_root}" \
  TANCMARK_DEMO_FFMPEG="${runtime_root}/ffmpeg-8.1.2-linux-demo/bin/ffmpeg" \
  TANCMARK_DEMO_FFPROBE="${runtime_root}/ffmpeg-8.1.2-linux-demo/bin/ffprobe" \
  TANCMARK_DEMO_PYTHON="${runtime_root}/venv/bin/python-tancmark" \
  TANCMARK_DEMO_ADAPTER_C="${repo_root}/runtime/product-runtime/unified_pts_watermark_adapter_c.py" \
  TANCMARK_DEMO_LD_LIBRARY_PATH="${runtime_root}/python-3.14.7/lib:${runtime_root}/ffmpeg-8.1.2-linux-demo/lib" \
  TANCMARK_DEMO_MEDIAMTX="${runtime_root}/mediamtx-1.19.1/mediamtx" \
  TANCMARK_DEMO_TRANSPORT_FFMPEG="${runtime_root}/ffmpeg-8.1.2-linux-transport/bin/ffmpeg" \
  TANCMARK_DEMO_TRANSPORT_LD_LIBRARY_PATH="${runtime_root}/ffmpeg-8.1.2-linux-transport/lib" \
  TANCMARK_DEMO_TRANSPORT_FFMPEG_SHA256="${transport_sha}" \
  C2PA_REMOTE_MANIFEST_FETCH=false \
  node --enable-source-maps artifacts/tancmark-demo/dist/server.mjs >"${log_file}" 2>&1 &

server_pid=$!
printf '%s\n' "${server_pid}" > "${pid_file}"
for _ in $(seq 1 100); do
  if curl --fail --silent --show-error --max-time 1 http://127.0.0.1:4173/demo/health >/dev/null; then
    exit 0
  fi
  if ! pid_is_live_demo_server "${server_pid}"; then
    tail -n 40 "${log_file}" >&2
    exit 1
  fi
  sleep 0.1
done
kill -TERM "${server_pid}" 2>/dev/null || true
exit 1
