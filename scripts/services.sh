#!/usr/bin/env bash
set -euo pipefail

ACTION="${1:-}"

if [[ -z "$ACTION" ]]; then
  echo "Usage: $0 <start-all|stop-all|status-all|restart-all|reset-data|update-all|local-update [update_file]>"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_FILE="$ROOT_DIR/messenger.json"

case "$ACTION" in
  start-all)
    sudo systemctl start messenger
    sudo systemctl start caddy
    ;;
  stop-all)
    sudo systemctl stop caddy
    sudo systemctl stop messenger
    ;;
  restart-all)
    sudo systemctl restart messenger
    sudo systemctl restart caddy
    ;;
  reset-data)
    sudo systemctl stop caddy
    sudo systemctl stop messenger
    rm -f "$DB_FILE" "$DB_FILE.tmp"
    echo "Deleted: $DB_FILE"
    ;;
  status-all)
    sudo systemctl status messenger --no-pager -l
    sudo systemctl status caddy --no-pager -l
    ;;
  local-update)
    UPDATE_PATH="${2:-$ROOT_DIR/update-bundle.json}"
    if [[ ! -f "$UPDATE_PATH" ]]; then
      echo "Update file not found: $UPDATE_PATH"
      exit 1
    fi

    TMP_DIR="$(mktemp -d)"
    python3 - "$UPDATE_PATH" "$TMP_DIR" "$ROOT_DIR" <<'PYUPDATE'
import base64
import json
import shutil
import sys
import zipfile
from pathlib import Path

update_path = Path(sys.argv[1])
tmp_dir = Path(sys.argv[2])
root = Path(sys.argv[3])
public_dir = root / 'public'

def apply_zip(zip_path: Path) -> None:
    with zipfile.ZipFile(zip_path, 'r') as zf:
        zf.extractall(tmp_dir)

    # support either archive containing /public/* or direct client files at root
    extracted_public = tmp_dir / 'public'
    if extracted_public.exists() and extracted_public.is_dir():
        for src in extracted_public.rglob('*'):
            if src.is_dir():
                continue
            rel = src.relative_to(extracted_public)
            dst = public_dir / rel
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
    else:
        allowed = {'.html', '.css', '.js', '.webmanifest', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.ico'}
        for src in tmp_dir.iterdir():
            if src.is_file() and src.suffix.lower() in allowed:
                dst = public_dir / src.name
                shutil.copy2(src, dst)

    # optional server update
    server_candidate = tmp_dir / 'server.js'
    if server_candidate.exists() and server_candidate.is_file():
        shutil.copy2(server_candidate, root / 'server.js')


def normalize_target(path_value: str) -> Path:
    rel = Path(path_value.replace('\\', '/'))
    if rel.is_absolute() or '..' in rel.parts:
        raise ValueError(f'Invalid path in update bundle: {path_value}')

    if rel == Path('server.js'):
        return root / 'server.js'
    if rel.parts and rel.parts[0] == 'public':
        return root / rel

    # for convenience allow client filenames without public/ prefix
    return public_dir / rel


def decode_payload(item: dict) -> bytes:
    encoding = str(item.get('encoding', 'utf-8')).lower()
    content = item.get('content', '')

    if encoding == 'base64':
        return base64.b64decode(content)
    if isinstance(content, str):
        return content.encode('utf-8')
    raise ValueError('Bundle file content must be a string for utf-8 encoding')


def apply_bundle(bundle_path: Path) -> None:
    data = json.loads(bundle_path.read_text(encoding='utf-8'))
    files = data.get('files')
    if not isinstance(files, list) or not files:
        raise ValueError('Bundle must contain non-empty "files" list')

    for item in files:
        if not isinstance(item, dict) or 'path' not in item:
            raise ValueError('Each bundle entry must be an object with "path"')
        dst = normalize_target(str(item['path']))
        payload = decode_payload(item)
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_bytes(payload)


if update_path.suffix.lower() == '.zip':
    apply_zip(update_path)
else:
    apply_bundle(update_path)

    # user asked for one-file update flow: delete bundle after successful apply
    if update_path.name == 'update-bundle.json' or update_path.name.endswith('.bundle.json'):
        update_path.unlink(missing_ok=True)
PYUPDATE

    rm -rf "$TMP_DIR"
    npm --prefix "$ROOT_DIR" run check
    sudo systemctl restart messenger
    sudo systemctl restart caddy
    ;;
  update-all)
    echo "Updating repository in: $ROOT_DIR"
    git -C "$ROOT_DIR" pull --ff-only
    if [[ -f "$ROOT_DIR/package-lock.json" ]]; then
      npm --prefix "$ROOT_DIR" ci --omit=dev
    else
      npm --prefix "$ROOT_DIR" install --omit=dev
    fi
    sudo systemctl restart messenger
    sudo systemctl restart caddy
    ;;
  *)
    echo "Unknown action: $ACTION"
    echo "Usage: $0 <start-all|stop-all|status-all|restart-all|reset-data|update-all|local-update [update_file]>"
    exit 1
    ;;
esac

echo "Done: $ACTION"
