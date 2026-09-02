#!/bin/sh
set -eu

if [ "$#" -lt 2 ]; then
  echo "usage: guard-path.sh <project-root> <path> [allowed-path ...]" >&2
  exit 64
fi

project_root=$(cd "$1" && pwd -P)
target=$2
shift 2

case "$target" in
  /*) normalized=$target ;;
  *) normalized=$project_root/$target ;;
esac

case "$normalized" in
  "$project_root"/*) ;;
  *) echo "DENY: path is outside project root: $target" >&2; exit 1 ;;
esac

case "$normalized" in
  "$project_root"/.git/*|*/.env|*/.env.*|*/secrets/*|*/credentials/*)
    echo "DENY: protected path: $target" >&2
    exit 1
    ;;
esac

if [ "$#" -eq 0 ]; then
  echo "ALLOW: $target"
  exit 0
fi

for allowed in "$@"; do
  case "$normalized" in
    "$project_root/$allowed"|"$project_root/$allowed"/*)
      echo "ALLOW: $target"
      exit 0
      ;;
  esac
done

echo "DENY: path is not in approved feature scope: $target" >&2
exit 1

