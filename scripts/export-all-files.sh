#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_FILE_ARG="${1:-all-project-files.txt}"

if [[ "$OUT_FILE_ARG" = /* ]]; then
  OUT_FILE="$OUT_FILE_ARG"
else
  OUT_FILE="$ROOT_DIR/$OUT_FILE_ARG"
fi

cd "$ROOT_DIR"
{
  echo "# NMS full project export"
  echo "# generated: $(date -Iseconds)"
  echo
  while IFS= read -r f; do
    echo
    echo "===== FILE: $f ====="
    cat "$f"
  done < <(rg --files)
} > "$OUT_FILE"

echo "Export ready: $OUT_FILE"
