#!/usr/bin/env bash
set -euo pipefail

ACTION="${1:-}"

if [[ -z "$ACTION" ]]; then
  echo "Usage: $0 <start-all|stop-all|status-all|restart-all|reset-data>"
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
  *)
    echo "Unknown action: $ACTION"
    echo "Usage: $0 <start-all|stop-all|status-all|restart-all|reset-data>"
    exit 1
    ;;
esac

echo "Done: $ACTION"
