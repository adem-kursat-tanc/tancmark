#!/usr/bin/env bash
set -euo pipefail
state_root=/tmp/tancmark-demo
pid_file=${state_root}/server.pid

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

if [[ ! -f "${pid_file}" ]]; then
  exit 0
fi
server_pid=$(<"${pid_file}")
if [[ ! "${server_pid}" =~ ^[0-9]+$ ]]; then
  exit 1
fi
if pid_is_live_demo_server "${server_pid}"; then
  kill -TERM "${server_pid}"
  for _ in $(seq 1 150); do
    if ! pid_is_live_demo_server "${server_pid}"; then
      break
    fi
    sleep 0.1
  done
fi
if pid_is_live_demo_server "${server_pid}"; then
  kill -KILL "${server_pid}"
  exit 1
fi
rm -f "${pid_file}" "${state_root}/server.log"
