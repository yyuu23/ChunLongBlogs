# GitHub Actions 自动部署

本方案在 GitHub 免费托管的 ubuntu-latest runner（2核7GB）上完成 `npm ci` 和
`next build`，然后用 rsync 把构建产物增量上传到服务器。服务器只做三件事：
部署前备份数据、执行 `db:push` 同步表结构、`pm2 restart`。**服务器不再承担
任何构建压力**（npm install 和 next build 是过去部署期间卡顿的根源）。

```
GitHub runner（免费 2核7GB）              服务器（零构建压力）
  checkout → npm ci → next build
  （SITE_URL 注入构建）
        │ rsync 增量传输（--checksum 按内容判断）
        │ 首次约 300–450MB，之后每次通常 5–80MB
        ▼
  备份 data/ + public/uploads/  →  db:push  →  pm2 restart  →  冒烟测试
```

生产数据库、上传文件和 `.env` 始终留在服务器上，不会上传到 GitHub；
rsync 显式排除这三者（见后文"部署边界"）。

## 安全边界

可以公开或告诉协作者：

- 域名
- 服务器公网 IP
- SSH 端口
- GitHub 仓库地址

不要发送或提交：

- SSH 私钥
- 服务器密码
- `.env` 内容
- `AUTH_SECRET`
- 管理员密码
- LLM、Embedding 或 Cloudflare API Token

本部署不需要 Cloudflare API Token。DNS 在 Cloudflare 控制台配置一次即可。

当前生产站点约定：

- 域名：`chunlongblog.top`
- 服务器：`8.159.154.125`
- 系统：Ubuntu 24.04 LTS
- Next.js 监听端口：`3002`（可通过 `APP_PORT` 覆盖）
- Nginx 模板：`deploy/nginx/chunlongblog.top.conf`

## 1. 创建专用部署用户

通过服务器厂商控制台或现有 SSH 账号登录服务器，然后执行：

```bash
sudo adduser --disabled-password --gecos "" deploy
sudo mkdir -p /opt/chunlong-blog /opt/chunlong-backups
sudo chown -R deploy:deploy /opt/chunlong-blog /opt/chunlong-backups
```

Node.js、PM2、Nginx 和 **rsync** 需要提前安装（rsync 是新版部署的传输通道，
远端也必须有）。Ubuntu 24.04 执行：

```bash
sudo apt update
sudo apt install -y ca-certificates curl rsync nginx
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

注意：

- **服务器的 Node 大版本必须与 workflow 中 `setup-node` 的版本一致**（当前 22）。
  `better-sqlite3` 的原生二进制按 Node ABI 版本下发，不一致会在运行时报
  `NODE_MODULE_VERSION mismatch`。workflow 的 preflight 步骤会校验这一点并明确报错。
- Git 现在是**可选**的：新流程不再在服务器上 `git pull`，rsync 会把代码直接
  送过去。保留服务器上旧的 `.git` 目录可以作为回退手段（见后文）。

## 2. 生成 GitHub Actions 专用 SSH 密钥

在自己的电脑上执行，不要在网页或聊天中生成：

```bash
ssh-keygen -t ed25519 -C "github-actions-chunlong-blog" -f ~/.ssh/chunlong_blog_deploy
```

CI 无法交互输入密码，因此提示 passphrase 时直接回车留空。这把密钥只能用于部署，
不要复用个人 SSH 密钥。

生成两个文件：

- `~/.ssh/chunlong_blog_deploy`：私钥，只放 GitHub Secret
- `~/.ssh/chunlong_blog_deploy.pub`：公钥，放服务器

把公钥安装到服务器：

```bash
ssh-copy-id -i ~/.ssh/chunlong_blog_deploy.pub deploy@服务器IP
```

然后测试：

```bash
ssh -i ~/.ssh/chunlong_blog_deploy deploy@服务器IP
```

## 3. 初始化服务器项目

新版流程**不需要在服务器上 git clone、npm ci 或 build**——这些全部由
GitHub runner 完成后经 rsync 送来。初始化只需两步：

```bash
# 1. 创建 .env（内容参照仓库里的 .env.example）
nano /opt/chunlong-blog/.env

# 必填项：
# ADMIN_USERNAME / ADMIN_PASSWORD / AUTH_SECRET / SITE_URL / DATABASE_PATH=data/db.sqlite
```

```text
2. 到 GitHub 仓库 → Actions → Deploy production → Run workflow 手动跑一次。
   首次建议勾选 dry_run 先验证（见下节），真实运行后 rsync 会送来代码、
   node_modules 和构建产物，并自动执行 db:push 和 pm2 start。
```

首次部署成功后，如需演示数据（可选，仅首次）：

```bash
ssh deploy@服务器IP
cd /opt/chunlong-blog && npm run db:seed
```

## 4. 取得并验证服务器主机密钥

`SERVER_KNOWN_HOSTS` 用来防止 Actions 把代码部署到被冒充的服务器。

先通过服务器厂商的网页控制台，在服务器上查看 ED25519 主机密钥指纹：

```bash
sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

再在自己的电脑上获取主机公钥：

```bash
ssh-keyscan -t ed25519 服务器IP
```

检查本地扫描结果的指纹：

```bash
ssh-keyscan -t ed25519 服务器IP 2>/dev/null | ssh-keygen -lf -
```

它必须和服务器控制台显示的指纹完全一致。确认后，将 `ssh-keyscan` 输出的完整一行保存为
`SERVER_KNOWN_HOSTS`。如果 SSH 不是 22 端口，使用：

```bash
ssh-keyscan -p SSH端口 -t ed25519 服务器IP
```

## 5. 配置 GitHub Environment

打开仓库：

`Settings -> Environments -> New environment -> production`

在 `production` 的 Environment secrets 中添加：

| 名称 | 内容 |
| --- | --- |
| `SERVER_HOST` | 服务器公网 IP 或 SSH 主机名 |
| `SERVER_PORT` | SSH 端口，通常为 `22` |
| `SERVER_USER` | `deploy` |
| `SERVER_SSH_KEY` | `chunlong_blog_deploy` 私钥的完整内容 |
| `SERVER_KNOWN_HOSTS` | 已验证的 `ssh-keyscan` 完整输出 |

在 Environment variables 中添加：

| 名称 | 内容 |
| --- | --- |
| `SITE_URL` | `https://你的域名` |

**`SITE_URL` 有两条生效路径**，修改域名时两处都要改并重新部署：

1. **构建期**（GitHub 的 `SITE_URL` 变量）：runner 构建时注入，写入
   `robots.txt` 和静态 metadata。部署后的冒烟测试会校验这一点。
2. **运行期**（服务器 `/opt/chunlong-blog/.env` 的 `SITE_URL`）：
   `sitemap.xml` 和 `/feed` 是动态路由，运行时读取。

可选：为 `production` 开启 Required reviewers。这样每次发布前需要在 GitHub 手动批准。
同时建议给 `main` 开启分支保护，避免未经检查的提交直接取得生产服务器上的部署权限。

## 6. 触发和停止部署

推送到 `main` 会自动部署：

```bash
git push origin main
```

也可以进入 `Actions -> Deploy production -> Run workflow` 手动部署。

**Dry-run 验证**：手动 Run workflow 时勾选 `dry_run`，只会执行
`rsync --dry-run --itemize-changes` 列出将要传输/删除的文件，不写入服务器、
不重启服务。用于验证排除规则（确认列表中没有 `data/`、`public/uploads/`、
`.env`）或排查"为什么每次传这么多"。

暂停自动部署：

`Actions -> Deploy production -> ... -> Disable workflow`

停止网站本身需要登录服务器：

```bash
pm2 stop chunlong-blog
```

恢复网站：

```bash
pm2 restart chunlong-blog
```

GitHub Actions 只负责发布，不负责让网站持续运行。

## 7. 部署边界：rsync 传什么、不传什么

**传入服务器**（`/opt/chunlong-blog/`）：源码、`node_modules`（含 devDependencies，
`db:push` 需要 drizzle-kit）、`.next` 构建产物、`public` 静态资源、配置文件。

**永远不传、不覆盖、不删除**（rsync 排除 + `--delete-after` 下排除项默认不参与删除）：

| 路径 | 说明 |
| --- | --- |
| `.env` | 生产密钥，只在服务器上配置 |
| `data/` | SQLite 数据库。注意：runner 构建时会在工作区生成一个**空库**，排除规则防止它覆盖生产库 |
| `public/uploads/` | 用户上传的文件 |
| `.git/` | 服务器上保留的仓库历史（回退用） |
| `node_modules/.cache/`、`.next/cache/` | 纯构建缓存，服务器不需要 |

带宽与时长预期：首次 rsync 压缩后约 300–450MB（`-z` 对 JS 文本压缩 3–5 倍）；
日常增量部署通常只有 5–80MB（主要是变化的 `.next` chunk）。workflow 使用
`--checksum` 按内容判断增量——因为 CI 每次全新构建，所有文件 mtime 都是"现在"，
默认按时间戳判断会退化为每次全量传输。

## 8. 回退到旧的部署方式

如果需要回到"服务器上构建"的旧流程：

```bash
git revert <本次部署改造的 commit>   # 恢复 deploy.yml 和 scripts/deploy-production.sh
git push origin main
```

服务器上的 `.git` 目录一直保留（rsync 不碰它），旧的
`git fetch && git merge --ff-only` 流程可以继续工作。

注意：`scripts/server-backup.sh` 和 `scripts/server-finalize.sh` 通过
`ssh 'bash -s' < 脚本` 管道执行，**始终运行本次 revision 的版本**——
服务器上的落地副本可能还是上一次部署的旧版，不能直接 `bash scripts/server-*.sh` 调用。

## 9. 密钥泄露时的处理

立即在服务器编辑 `/home/deploy/.ssh/authorized_keys`，删除对应公钥，然后删除 GitHub 中的
`SERVER_SSH_KEY`。重新生成一对全新的部署密钥并更新服务器和 GitHub Secret。不要继续使用旧密钥。
