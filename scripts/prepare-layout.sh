#!/usr/bin/env bash
set -euo pipefail

CLIENT_ROOT="${1:-/var/www/netrender/client}"
SERVER_ROOT="${2:-/var/api/netrender/server}"
DATA_ROOT="${3:-/var/data/netrender}"

sudo mkdir -p "$CLIENT_ROOT" "$SERVER_ROOT" "$DATA_ROOT/db" "$DATA_ROOT/uploads"

# Remove file leftovers in target folders but keep folders themselves.
sudo find "$CLIENT_ROOT" -mindepth 1 -delete || true
sudo find "$SERVER_ROOT" -mindepth 1 -delete || true
sudo find "$DATA_ROOT/db" -mindepth 1 -delete || true
sudo find "$DATA_ROOT/uploads" -mindepth 1 -delete || true

cat <<MSG
Layout prepared and cleaned:
- client: $CLIENT_ROOT
- server: $SERVER_ROOT
- db: $DATA_ROOT/db
- uploads: $DATA_ROOT/uploads
MSG
