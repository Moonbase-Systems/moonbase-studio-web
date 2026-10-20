#!/usr/bin/env bash
set -euo pipefail

# Unblock Cursor agent Shell if it spawns bare "zsh" while zsh is missing:
if [[ -f "$HOME/.local/bin/zsh" ]]; then
  chmod +x "$HOME/.local/bin/zsh" || true
fi

cd /home/dominik/moonbase/moonbase-studio-web

{
  echo "=== pnpm add -D vitest@^3.2.4 ==="
  pnpm add -D 'vitest@^3.2.4'

  echo ""
  echo "=== pnpm test ==="
  pnpm test

  echo ""
  echo "=== pnpm typecheck ==="
  pnpm typecheck

  echo ""
  echo "ALL_CHECKS_DONE"
} 2>&1 | tee /tmp/vitest-all.log

echo DONE > /tmp/vitest-done.flag
