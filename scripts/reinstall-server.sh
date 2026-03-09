#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage:
  bash scripts/reinstall-server.sh --zip /path/to/nms-project.zip [options]

Required:
  --zip PATH             Path to ZIP archive with full project

Options:
  --app-dir PATH         Destination directory (default: /opt/nms)
  --port PORT            App port (default: 3001)
  --domain DOMAIN        Domain for nginx config (default: _)
  --pm2-name NAME        PM2 process name (default: messenger)
  --user USER            Linux user to own files (default: current user)
  --with-nginx           Also install/configure nginx reverse proxy
  --help                 Show this help

Example:
  bash scripts/reinstall-server.sh \
    --zip /root/nms-project-20260301-153455.zip \
    --app-dir /opt/nms \
    --port 3001 \
    --domain netrender.ru \
    --with-nginx
USAGE
}

ZIP_PATH=""
APP_DIR="/opt/nms"
PORT="3001"
DOMAIN="_"
PM2_NAME="messenger"
OWNER_USER="$(id -un)"
WITH_NGINX=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --zip)
      ZIP_PATH="${2:-}"
      shift 2
      ;;
    --app-dir)
      APP_DIR="${2:-}"
      shift 2
      ;;
    --port)
      PORT="${2:-}"
      shift 2
      ;;
    --domain)
      DOMAIN="${2:-}"
      shift 2
      ;;
    --pm2-name)
      PM2_NAME="${2:-}"
      shift 2
      ;;
    --user)
      OWNER_USER="${2:-}"
      shift 2
      ;;
    --with-nginx)
      WITH_NGINX=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$ZIP_PATH" ]]; then
  echo "Error: --zip is required" >&2
  usage
  exit 1
fi

if [[ ! -f "$ZIP_PATH" ]]; then
  echo "Error: ZIP not found: $ZIP_PATH" >&2
  exit 1
fi

if ! command -v unzip >/dev/null 2>&1; then
  echo "Installing unzip..."
  sudo apt update
  sudo apt install -y unzip
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "Installing pm2..."
  sudo npm i -g pm2
fi

echo "Preparing app directory: $APP_DIR"
sudo mkdir -p "$APP_DIR"
sudo chown -R "$OWNER_USER":"$OWNER_USER" "$APP_DIR"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

unzip -q "$ZIP_PATH" -d "$TMP_DIR"

if [[ ! -f "$TMP_DIR/package.json" ]]; then
  echo "Error: ZIP root must contain package.json" >&2
  exit 1
fi

if [[ -d "$APP_DIR/current" ]]; then
  BACKUP_DIR="$APP_DIR/backup-$(date +%Y%m%d-%H%M%S)"
  echo "Backing up current to: $BACKUP_DIR"
  mv "$APP_DIR/current" "$BACKUP_DIR"
fi

mkdir -p "$APP_DIR/current"
cp -a "$TMP_DIR"/. "$APP_DIR/current"/

cd "$APP_DIR/current"

echo "Installing dependencies..."
if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi

echo "Running syntax checks..."
npm run check

echo "Starting PM2 process: $PM2_NAME on port $PORT"
pm2 delete "$PM2_NAME" >/dev/null 2>&1 || true
PORT="$PORT" pm2 start index.js --name "$PM2_NAME"
pm2 save

PM2_STARTUP_CMD="$(pm2 startup systemd -u "$OWNER_USER" --hp "/home/$OWNER_USER" 2>/dev/null | tail -n 1 || true)"
if [[ -n "$PM2_STARTUP_CMD" && "$PM2_STARTUP_CMD" == sudo* ]]; then
  echo "Enabling PM2 startup..."
  eval "$PM2_STARTUP_CMD" || true
  pm2 save
fi

if [[ "$WITH_NGINX" -eq 1 ]]; then
  echo "Configuring nginx for domain: $DOMAIN"
  sudo apt install -y nginx
  sudo tee /etc/nginx/sites-available/messenger >/dev/null <<NGINX
server {
    listen 80;
    server_name ${DOMAIN};


    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600;
    }
}
NGINX

  sudo rm -f /etc/nginx/sites-enabled/default
  sudo ln -sf /etc/nginx/sites-available/messenger /etc/nginx/sites-enabled/messenger
  sudo nginx -t
  sudo systemctl restart nginx
  sudo systemctl enable nginx
fi

echo "Done. App installed at: $APP_DIR/current"
echo "PM2 status:"
pm2 status
if [[ "$WITH_NGINX" -eq 1 ]]; then
  echo "Nginx status:"
  sudo systemctl status nginx --no-pager -l || true
fi
