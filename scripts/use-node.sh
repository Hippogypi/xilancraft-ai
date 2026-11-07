#!/usr/bin/env bash
# 将仓库自带便携 Node.js 加入 PATH（Git Bash 用）
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [ ! -f "$ROOT/tools/node/node.exe" ]; then
  echo "[use-node] 未找到 tools/node/node.exe，请先放置便携 Node（见 README）" >&2
  return 1 2>/dev/null || exit 1
fi
export PATH="$ROOT/tools/node:$PATH"
# shellcheck disable=SC2016
echo "[use-node] node -> $(node -v)"
