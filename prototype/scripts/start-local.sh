#!/bin/zsh
set -euo pipefail

prototype_dir="$(cd "$(dirname "$0")/.." && pwd)"
workspace_dir="$(cd "$prototype_dir/.." && pwd)"
ollama_bin="$workspace_dir/.local-tools/ollama/ollama"
export OLLAMA_MODELS="$workspace_dir/.local-models/ollama"
export OLLAMA_HOST="127.0.0.1:11434"
started_ollama=0

mkdir -p "$prototype_dir/.local-data"
if ! curl --fail --silent http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
  if [[ ! -x "$ollama_bin" ]]; then
    echo "Local Ollama is not installed in this project."
    exit 1
  fi
  "$ollama_bin" serve >"$prototype_dir/.local-data/ollama.log" 2>&1 &
  ollama_pid=$!
  started_ollama=1
  for _ in {1..30}; do
    curl --fail --silent http://127.0.0.1:11434/api/tags >/dev/null 2>&1 && break
    sleep 0.25
  done
fi

cleanup() {
  if [[ "$started_ollama" == "1" ]]; then kill "$ollama_pid" 2>/dev/null || true; fi
}
trap cleanup EXIT INT TERM
node "$prototype_dir/server.mjs"
