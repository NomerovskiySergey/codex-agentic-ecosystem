#!/bin/sh
# Guarded command gateway for Agentic Harness CLI worktrees.
set -eu

usage() {
  cat >&2 <<'EOF'
usage:
  harness-proxy.sh --project ROOT --feature FEAT command -- <read-or-test-command ...>
  harness-proxy.sh --project ROOT --feature FEAT write RELATIVE_PATH < CONTENT
  harness-proxy.sh --project ROOT --feature FEAT git-commit MESSAGE
EOF
  exit 64
}

project= feature=
while [ "$#" -gt 0 ]; do
  case "$1" in
    --project) [ "$#" -ge 2 ] || usage; project=$2; shift 2 ;;
    --feature) [ "$#" -ge 2 ] || usage; feature=$2; shift 2 ;;
    *) break ;;
  esac
done
[ -n "$project" ] && [ -n "$feature" ] && [ "$#" -ge 1 ] || usage

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
project=$(cd "$project" && pwd -P)
# A Git worktree does not necessarily contain the untracked project knowledge
# directory. Derive the control checkout while retaining the worktree as the
# only place where proxy writes and Git commands execute.
case "$project" in
  */.agent-harness/worktrees/*) control_root=${project%/.agent-harness/worktrees/*} ;;
  *) control_root=$project ;;
esac
feature_file=$(find "$control_root/.agent-harness/features" -maxdepth 1 -type f -name "$feature*.md" -print 2>/dev/null | head -n 1 || true)
[ -n "$feature_file" ] || { echo "DENY: feature record not found: $feature" >&2; exit 1; }
allowed=$(sed -n 's/^- Allowed paths: //p' "$feature_file" | head -n 1)
[ -n "$allowed" ] || { echo "DENY: feature has no approved write scope." >&2; exit 1; }

guard_path() {
  target_path=$1
  old_ifs=$IFS; IFS=','; set -- $allowed; IFS=$old_ifs
  "$script_dir/guard-path.sh" "$project" "$target_path" "$@"
}

action=$1; shift
case "$action" in
  command)
    [ "$#" -ge 2 ] && [ "$1" = "--" ] || usage
    shift
    "$script_dir/guard-command.sh" -- "$@"
    case "$1:${2:-}" in
      npm:test|npm:run|npm:exec|pnpm:test|pnpm:run|pnpm:exec|yarn:test|yarn:run|bun:test|bun:run) ;;
      node:--test|pytest:*|ctest:*|make:test|make:check|cmake:--build|cargo:test|cargo:check|go:test|gradle:test|mvn:test|pio:run|platformio:run) ;;
      python:-m|python3:-m)
        case "${3:-}" in pytest|unittest) ;; *) echo "DENY: Python is limited to pytest or unittest." >&2; exit 1 ;; esac ;;
      git:status|git:diff|git:show|git:log|git:branch|git:rev-parse) ;;
      *) echo "DENY: command is not in the hardened allowlist: $1 ${2:-}" >&2; exit 1 ;;
    esac
    (cd "$project" && exec "$@")
    ;;
  write)
    [ "$#" -eq 1 ] || usage
    relative_path=$1
    guard_path "$relative_path"
    target="$project/$relative_path"
    mkdir -p "$(dirname "$target")"
    mkdir -p "$project/.agent-harness/runs"
    temporary=$(mktemp "$project/.agent-harness/runs/harness-write.XXXXXX")
    trap 'rm -f "$temporary"' EXIT HUP INT TERM
    cat > "$temporary"
    mv "$temporary" "$target"
    trap - EXIT HUP INT TERM
    echo "ALLOW: wrote $relative_path through scoped proxy"
    ;;
  git-commit)
    [ "$#" -eq 1 ] || usage
    message=$1
    "$script_dir/guard-git-action.sh" "$feature_file" commit
    "$script_dir/guard-command.sh" -- git commit -m "$message"
    changed=$(cd "$project" && git status --porcelain | sed -E 's/^...//' | sed -n '/^./p')
    [ -n "$changed" ] || { echo "DENY: nothing to commit." >&2; exit 1; }
    printf '%s\n' "$changed" | while IFS= read -r changed_path; do guard_path "$changed_path"; done
    (cd "$project" && git add -- $changed && git commit -m "$message")
    ;;
  *) usage ;;
esac
