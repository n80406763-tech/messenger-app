#!/usr/bin/env bash
set -euo pipefail

CLIENT_ROOT="${1:-/var/www/netrender/client}"
SERVER_ROOT="${2:-/var/api/netrender/server}"
DATA_ROOT="${3:-/var/data/netrender}"

sudo mkdir -p "$CLIENT_ROOT"
sudo mkdir -p "$SERVER_ROOT"
sudo mkdir -p "$DATA_ROOT/db"
sudo mkdir -p "$DATA_ROOT/uploads"

sudo chown -R "${SUDO_USER:-$USER}:${SUDO_USER:-$USER}" "$(dirname "$CLIENT_ROOT")" "$(dirname "$SERVER_ROOT")" "$DATA_ROOT"

cat <<MSG
Created hierarchy:
- client: $CLIENT_ROOT
- server: $SERVER_ROOT
- data db: $DATA_ROOT/db
- data uploads: $DATA_ROOT/uploads
MSG
