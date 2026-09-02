# GitHub Actions 自动部署

本方案使用 GitHub Actions 通过 SSH 登录服务器，然后执行
`scripts/deploy-production.sh`。生产数据库、上传文件和 `.env` 始终留在服务器，
不会上传到 GitHub。

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

Node.js、Git、PM2 和 Nginx 应提前安装。Ubuntu 24.04 执行：

```bash
sudo apt update
sudo apt install -y ca-certificates curl git nginx
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```


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

以 `deploy` 用户执行：

```bash
cd /opt
git clone https://github.com/yyuu23/ChunLongBlogs.git chunlong-blog
cd /opt/chunlong-blog
npm ci
cp .env.example .env
nano .env
npm run db:push
npm run db:seed
npm run build
PORT=3002 pm2 start npm --name chunlong-blog -- start -- --hostname 127.0.0.1
pm2 save
```

`npm run db:seed` 只在首次初始化时执行，以后自动部署不会执行它。

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

可选：为 `production` 开启 Required reviewers。这样每次发布前需要在 GitHub 手动批准。
同时建议给 `main` 开启分支保护，避免未经检查的提交直接取得生产服务器上的部署权限。

## 6. 触发和停止部署

推送到 `main` 会自动部署：

```bash
git push origin main
```

也可以进入 `Actions -> Deploy production -> Run workflow` 手动部署。

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

## 7. 密钥泄露时的处理

立即在服务器编辑 `/home/deploy/.ssh/authorized_keys`，删除对应公钥，然后删除 GitHub 中的
`SERVER_SSH_KEY`。重新生成一对全新的部署密钥并更新服务器和 GitHub Secret。不要继续使用旧密钥。
