#!/bin/sh
set -eu

if [ "$#" -ne 2 ]; then
  echo "usage: guard-git-action.sh <feature-file> <branch|commit>" >&2
  exit 64
fi

feature_file=$1
action=$2

case "$action" in
  branch) gate='| Branch | approved |' ;;
  commit) gate='| Commit | approved |' ;;
  *) echo "DENY: unsupported git action: $action" >&2; exit 64 ;;
esac

if ! grep -Fq "$gate" "$feature_file"; then
  echo "DENY: $action requires recorded human approval in $feature_file" >&2
  exit 1
fi

echo "ALLOW: recorded approval for $action"

