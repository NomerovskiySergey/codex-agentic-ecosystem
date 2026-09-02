#!/bin/sh
# Create an isolated feature worktree after the feature's Branch gate is approved.
set -eu

usage() {
  echo "usage: harness-worktree.sh create --project ROOT --feature FEAT --branch BRANCH --base BASE" >&2
  exit 64
}
[ "${1:-}" = create ] || usage
shift
project= feature= branch= base=
while [ "$#" -gt 0 ]; do
  case "$1" in
    --project) [ "$#" -ge 2 ] || usage; project=$2; shift 2 ;;
    --feature) [ "$#" -ge 2 ] || usage; feature=$2; shift 2 ;;
    --branch) [ "$#" -ge 2 ] || usage; branch=$2; shift 2 ;;
    --base) [ "$#" -ge 2 ] || usage; base=$2; shift 2 ;;
    *) usage ;;
  esac
done
[ -n "$project" ] && [ -n "$feature" ] && [ -n "$branch" ] && [ -n "$base" ] || usage
for value in "$feature" "$branch" "$base"; do
  case "$value" in *[!A-Za-z0-9._/-]*|*..*) echo "DENY: unsafe feature or branch name." >&2; exit 1 ;; esac
done

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
project=$(cd "$project" && pwd -P)
git -C "$project" rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "DENY: project is not a Git worktree." >&2; exit 1; }
feature_file=$(find "$project/.agent-harness/features" -maxdepth 1 -type f -name "$feature*.md" -print 2>/dev/null | head -n 1 || true)
[ -n "$feature_file" ] || { echo "DENY: feature record not found: $feature" >&2; exit 1; }
"$script_dir/guard-git-action.sh" "$feature_file" branch >&2
"$script_dir/guard-command.sh" -- git worktree add -b "$branch" "$feature" "$base" >&2

worktree_root="$project/.agent-harness/worktrees"
worktree="$worktree_root/$feature"
[ ! -e "$worktree" ] || { echo "DENY: worktree target already exists: $worktree" >&2; exit 1; }
mkdir -p "$worktree_root"
git -C "$project" show-ref --verify --quiet "refs/heads/$base" || { echo "DENY: base branch does not exist: $base" >&2; exit 1; }
git -C "$project" show-ref --verify --quiet "refs/heads/$branch" && { echo "DENY: branch already exists: $branch" >&2; exit 1; }
git -C "$project" worktree add -b "$branch" "$worktree" "$base" >&2
printf '%s\n' "$worktree"
