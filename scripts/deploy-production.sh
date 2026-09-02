#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/chunlong-blog}"
APP_NAME="${APP_NAME:-chunlong-blog}"
APP_PORT="${APP_PORT:-3002}"
BRANCH="${DEPLOY_BRANCH:-main}"
BACKUP_DIR="${BACKUP_DIR:-/opt/chunlong-backups}"

cd "$APP_DIR"

if [[ ! -f package.json || ! -d .git ]]; then
  echo "Invalid application directory: $APP_DIR" >&2
  exit 1
fi

if [[ ! -f .env ]]; then
  echo "Missing $APP_DIR/.env; configure production secrets on the server first." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

backup_path="$BACKUP_DIR/chunlong-$(date -u +%Y%m%dT%H%M%SZ).tar.gz"
backup_items=()
[[ -d data ]] && backup_items+=(data)
[[ -d public/uploads ]] && backup_items+=(public/uploads)

if (( ${#backup_items[@]} > 0 )); then
  tar -czf "$backup_path" "${backup_items[@]}"
  chmod 600 "$backup_path"
  echo "Runtime data backed up to $backup_path"
fi

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git merge --ff-only "origin/$BRANCH"

# Anolis/RHEL 8 ships glibc 2.28. Build native modules locally instead of
# using better-sqlite3's prebuilt binary, which currently requires glibc 2.29.
npm_config_build_from_source=true npm ci
npm run db:push
npm run build

if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  PORT="$APP_PORT" pm2 restart "$APP_NAME" --update-env
else
  PORT="$APP_PORT" pm2 start npm --name "$APP_NAME" -- start
fi

pm2 save
echo "Deployment completed successfully."
