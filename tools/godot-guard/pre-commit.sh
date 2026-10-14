#!/usr/bin/env sh
# godot-guard pre-commit hook — 提交前跑无头冒烟，发现脚本错误就阻止提交。
#
# 安装（仓库内版本，可提交、全队共享）：
#   git config core.hooksPath tools/godot-guard/hooks
#   或直接把本文件复制到 .git/hooks/pre-commit 并 chmod +x
#
# 环境变量：GODOT_PATH 可覆盖 godot 可执行文件路径（默认 /usr/bin/godot）

set -u

GODOT_BIN="${GODOT_PATH:-/usr/bin/godot}"
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0

if ! command -v "$GODOT_BIN" >/dev/null 2>&1 && [ ! -x "$GODOT_BIN" ]; then
  echo "[godot-guard] godot not found at '$GODOT_BIN' — skipping check."
  exit 0
fi

echo "[godot-guard] running headless smoke check..."
out=$("$GODOT_BIN" --headless --path "$REPO_ROOT" --quit 2>&1)

# 'no main scene defined' 在 M1 之前属正常，先放行。
fatal=$(printf '%s\n' "$out" \
  | grep -E 'SCRIPT ERROR|Parse Error|Failed to load|Failed to parse' \
  | grep -v 'no main scene defined')

if [ -n "$fatal" ]; then
  echo "[godot-guard] BLOCKED — script errors found:"
  printf '%s\n' "$fatal"
  echo "[godot-guard] fix them, or commit with --no-verify to bypass."
  exit 1
fi

if printf '%s' "$out" | grep -q 'no main scene defined'; then
  echo "[godot-guard] OK (no main scene yet — expected before M1)"
else
  echo "[godot-guard] OK"
fi
exit 0
