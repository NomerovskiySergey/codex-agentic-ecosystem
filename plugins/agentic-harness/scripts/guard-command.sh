#!/bin/sh
set -eu

if [ "$#" -lt 2 ] || [ "$1" != "--" ]; then
  echo "usage: guard-command.sh -- <command ...>" >&2
  exit 64
fi
shift

command_line="$*"
for forbidden in 'rm ' 'rmdir ' 'git reset --hard' 'git clean ' 'git push --force' 'git branch -D' 'git rebase ' 'git filter-repo'; do
  case "$command_line" in
    *"$forbidden"*)
      echo "DENY: destructive command requires a separate break-glass approval: $command_line" >&2
      exit 1
      ;;
  esac
done

for external in 'git push ' 'gh pr ' 'curl ' 'wget ' 'npm publish ' 'pip install '; do
  case "$command_line" in
    *"$external"*)
      echo "DENY: external action requires explicit approval: $command_line" >&2
      exit 1
      ;;
  esac
done

echo "ALLOW: $command_line"
