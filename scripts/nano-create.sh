#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: bash scripts/nano-create.sh <relative-or-absolute-file-path>"
  exit 1
fi

TARGET="$1"
DIR="$(dirname "$TARGET")"

mkdir -p "$DIR"
if [[ ! -f "$TARGET" ]]; then
  : > "$TARGET"
fi

nano "$TARGET"
