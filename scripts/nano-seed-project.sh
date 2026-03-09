#!/usr/bin/env bash
set -euo pipefail

SERVER_ROOT="${1:-/var/api/netrender/server}"
CLIENT_ROOT="${2:-/var/www/netrender/client}"
NO_OPEN="${3:-}"

SERVER_FILES=(
  "index.js"
  "server.js"
  "routes.js"
  "routes-api.js"
  "package.json"
  "README.md"
  "scripts/build-zip.sh"
  "scripts/export-all-files.sh"
  "scripts/init-hierarchy.sh"
  "scripts/nano-create.sh"
  "scripts/nano-seed-project.sh"
  "scripts/prepare-layout.sh"
  "scripts/reinstall-server.sh"
  "scripts/serv.sh"
  "scripts/services.sh"
)

CLIENT_FILES=(
  "index.html"
  "app.js"
  "styles.css"
  "sw.js"
  "manifest.webmanifest"
  "icon-192.svg"
  "icon-512.svg"
)

create_file() {
  local base="$1"
  local rel="$2"
  local abs="$base/$rel"
  mkdir -p "$(dirname "$abs")"
  [[ -f "$abs" ]] || : > "$abs"
  printf '%s\n' "$abs"
}

ALL_CREATED=()

for f in "${SERVER_FILES[@]}"; do
  ALL_CREATED+=("$(create_file "$SERVER_ROOT" "$f")")
done

for f in "${CLIENT_FILES[@]}"; do
  ALL_CREATED+=("$(create_file "$CLIENT_ROOT" "$f")")
done

echo "Created project skeleton:"
echo "- server root: $SERVER_ROOT"
echo "- client root: $CLIENT_ROOT"

echo "Files:"
printf '  %s\n' "${ALL_CREATED[@]}"

if [[ "$NO_OPEN" == "--no-open" ]]; then
  echo "Skip nano opening (--no-open)"
  exit 0
fi

echo
echo "Opening nano sequentially. Save and exit each file to move to the next."
for file in "${ALL_CREATED[@]}"; do
  nano "$file"
done
