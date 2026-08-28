# 部署指南（ChunLong Blog）

适用：自己的服务器（Linux）+ 域名 + Nginx 反代。整个站点是**一个 Node 进程 + 一个 SQLite 文件**，无需数据库服务。

## 1. 服务器环境

- Node.js ≥ 20（推荐 20 LTS / 22）：`curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt install -y nodejs`
- pm2：`npm i -g pm2`
- Nginx

## 2. 拉取代码与安装

```bash
cd /opt
git clone https://github.com/yyuu23/ChunLongBlogs.git chunlong-blog
cd chunlong-blog
npm ci
```

## 3. 配置环境变量

```bash
cp .env.example .env
vim .env
```

必改项：

```ini
ADMIN_USERNAME=你的管理员账号
ADMIN_PASSWORD=一个强密码
AUTH_SECRET=<node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))">
SITE_URL=https://你的域名
```

## 4. 初始化数据库并启动

```bash
npm run db:push     # 建表
npm run db:seed     # 首次部署可选：写入演示数据（之后正式写作前可在后台删掉演示文章）
npm run build
pm2 start npm --name chunlong-blog -- start
pm2 save
```

> 升级：`git pull && npm ci && npm run db:push && npm run build && pm2 restart chunlong-blog`

## 5. Nginx 反代（80/443 + 证书）

```nginx
server {
    listen 80;
    server_name chunlong.me;   # 换成你的域名

    client_max_body_size 10m;  # 允许后台上传图片

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 可选：长期缓存上传图片
    location /uploads/ {
        proxy_pass http://127.0.0.1:3000;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

HTTPS 证书（Let's Encrypt）：

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d chunlong.me
```

## 6. 备份

数据全部在两个地方：

- `data/db.sqlite`（全部内容数据）
- `public/uploads/`（上传的图片）

```bash
# crontab 每天凌晨备份
0 3 * * * tar -czf /opt/backup/cl-$(date +\%F).tar.gz -C /opt/chunlong-blog data public/uploads
```

恢复：解压覆盖后 `pm2 restart chunlong-blog`。

## 7. 开启评论（giscus，可选）

1. GitHub 上为本仓库开启 Discussions
2. 安装 [giscus app](https://github.com/apps/giscus) 到仓库
3. 到 [giscus.app](https://giscus.app/zh-CN) 生成配置，把 `repo / repoId / category / categoryId` 四个值填进博客后台「站点设置」

## 8. 站内统计（可选，二期）

推荐自托管 [umami](https://umami.is/)（Docker 一行起），在后台「站点设置 → 页脚附加文字」之外的模板里注入脚本即可。

## 常见问题

- **忘记管理员密码**：改 `.env` 里的 `ADMIN_PASSWORD`，然后 `npm run db:seed`（会重置全部数据，慎用）；或直接改库：
  `node -e "const b=require('bcryptjs');console.log(b.hashSync('新密码',10))"` 后 SQL 更新 `admin_users.password_hash`
- **图片上传 401**：确认是从 `/admin` 登录后的会话操作
- **端口被占**：`pm2 delete chunlong-blog && PORT=3001 pm2 start npm --name chunlong-blog -- start` 并同步修改 Nginx
