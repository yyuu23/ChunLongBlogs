#!/usr/bin/env bash
# 服务器端脚本，由 GitHub Actions 在 rsync 成功之后通过 ssh 'bash -s' 管道执行：
# 校验产物完整性，同步数据库结构（drizzle-kit push），然后重启应用。
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/chunlong-blog}"
APP_NAME="${APP_NAME:-chunlong-blog}"
APP_PORT="${APP_PORT:-3002}"

cd "$APP_DIR"

if [[ ! -f .env ]]; then
  echo "Missing $APP_DIR/.env; configure production secrets on the server first." >&2
  exit 1
fi

# rsync 完整性检查：构建产物与关键二进制必须已就位
if [[ ! -d .next ]]; then
  echo "rsync incomplete: $APP_DIR/.next is missing" >&2
  exit 1
fi
if [[ ! -e node_modules/.bin/next ]]; then
  echo "rsync incomplete: node_modules/.bin/next is missing" >&2
  exit 1
fi
if [[ ! -e node_modules/.bin/drizzle-kit ]]; then
  echo "rsync incomplete: node_modules/.bin/drizzle-kit is missing" >&2
  exit 1
fi

npm run db:push

if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  PORT="$APP_PORT" pm2 restart "$APP_NAME" --update-env
else
  PORT="$APP_PORT" pm2 start npm --name "$APP_NAME" -- start -- --hostname 127.0.0.1
fi

pm2 save

echo "--- pm2 recent logs ---"
pm2 logs "$APP_NAME" --lines 20 --nostream || true
echo "Deployment completed successfully."
