#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${1:-$ROOT_DIR/dist}"
STAMP="$(date +%Y%m%d-%H%M%S)"
NAME="nms-project-$STAMP.zip"
OUT_PATH="$OUT_DIR/$NAME"

mkdir -p "$OUT_DIR"

cd "$ROOT_DIR"
zip -r "$OUT_PATH" . \
  -x ".git/*" \
  -x "node_modules/*" \
  -x "dist/*" \
  -x "messenger.json" \
  -x "*.log" \
  -x "tmp/*"

echo "ZIP ready: $OUT_PATH"
