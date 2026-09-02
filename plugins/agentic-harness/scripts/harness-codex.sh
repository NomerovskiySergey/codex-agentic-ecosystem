#!/bin/sh
# Start Codex CLI with its write sandbox rooted at one Agentic Harness worktree.
set -eu

usage() {
  echo "usage: harness-codex.sh --worktree PATH [--] [codex prompt or options...]" >&2
  exit 64
}
worktree=
while [ "$#" -gt 0 ]; do
  case "$1" in
    --worktree) [ "$#" -ge 2 ] || usage; worktree=$2; shift 2 ;;
    --) shift; break ;;
    *) break ;;
  esac
done
[ -n "$worktree" ] || usage
worktree=$(cd "$worktree" && pwd -P)
git -C "$worktree" rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "DENY: worktree is not a Git checkout." >&2; exit 1; }
case "$worktree" in */.agent-harness/worktrees/*) ;; *) echo "DENY: worktree must live under <project>/.agent-harness/worktrees/." >&2; exit 1 ;; esac

exec codex -C "$worktree" --sandbox workspace-write --ask-for-approval on-request "$@"
