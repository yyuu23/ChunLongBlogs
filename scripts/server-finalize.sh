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

# 管理员兜底：admin_users 为空时按 .env 创建，让首次部署完即可登录后台。
# 只在表空时插入——已有任何账号（包括用户改过密码后）绝不改动、绝不覆盖。
# 不用 db:seed 干这事：它会清空全部内容表再写演示数据，对生产库是灾难。
# 只提取这两个键而不 source 整个 .env：其余值可能含 shell 特殊字符，且避免
# 把 AUTH_SECRET 等导出进本 shell、再经 --update-env 泄进 pm2 的环境。
ADMIN_USERNAME="$(grep -E '^ADMIN_USERNAME=' .env | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'\$//")"
ADMIN_PASSWORD="$(grep -E '^ADMIN_PASSWORD=' .env | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'\$//")"
export ADMIN_USERNAME ADMIN_PASSWORD
node <<'NODE'
const b = require('bcryptjs');
const Database = require('better-sqlite3');
const db = new Database(process.env.DATABASE_PATH ?? 'data/db.sqlite');
const [{ n }] = db.prepare('SELECT count(*) AS n FROM admin_users').all();
if (n > 0) {
  console.log(`admin users present (${n}), skip bootstrap`);
} else if (!process.env.ADMIN_PASSWORD) {
  console.warn('!! admin_users is empty and .env has no ADMIN_PASSWORD — /admin will have no login. Set it in .env and redeploy.');
} else {
  const username = process.env.ADMIN_USERNAME || 'admin';
  db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)').run(
    username,
    b.hashSync(process.env.ADMIN_PASSWORD, 10),
  );
  console.log(`bootstrapped admin user: ${username}`);
}
NODE

if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  PORT="$APP_PORT" pm2 restart "$APP_NAME" --update-env
else
  PORT="$APP_PORT" pm2 start npm --name "$APP_NAME" -- start -- --hostname 127.0.0.1
fi

pm2 save

echo "--- pm2 recent logs ---"
pm2 logs "$APP_NAME" --lines 20 --nostream || true
echo "Deployment completed successfully."
