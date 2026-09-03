# 部署说明与经验记录

> **一句话**：把代码 push 到 `main` 分支，约 2~3 分钟后自动上线到服务器。
> 构建在 GitHub 免费云端完成，服务器零构建压力。

本文回答三类问题：**现在怎么部署**（§1–§2）、**域名与访问为什么是这样**（§3）、
**这次上线踩过什么坑、以后怎么排错**（§4）。日常操作看 §5 速查表。

从零搭建同一套部署的完整步骤见 [GITHUB_ACTIONS_DEPLOY.md](./GITHUB_ACTIONS_DEPLOY.md)。

---

## 0. 快速回答

| 问题 | 答案 |
| --- | --- |
| git 了就会自动部署吗？ | **push 到 `main` 分支才会**。本地 commit 不 push 没有任何效果；push 到其他分支也不触发 |
| 部署一次多久？ | 约 2~3 分钟。依赖安装 15s 左右（有缓存）、构建数秒到几分钟（视缓存）、传输 40s 到几分钟（视变更量） |
| 服务器有压力吗？ | 没有。`npm ci` 和 `next build` 全部在 GitHub 的免费云端机器上跑，服务器只接收文件、建表、重启进程 |
| 现在用什么地址访问？ | `http://8.159.154.125:8080`（ICP 备案办理期间，域名被阿里云拦截，见 §3） |
| 哪里看部署状态？ | 仓库 **Actions** 标签页 → 左侧 **Deploy production**（不要点 Management 下的 Runners，那是自建机器管理页，与本方案无关） |
| 部署失败会怎样？ | 失败即中止，**不会重启服务**，线上站点继续用上一个版本运行 |

---

## 1. 部署架构：谁在哪干活

```
GitHub Actions runner（免费 ubuntu-latest，2核7GB，用完即销毁）
  checkout 代码 → npm ci → next build（注入 SITE_URL）
        │
        │ rsync 增量传输（--checksum 按内容判断）
        │ 首次全量 ~870MB，日常增量通常仅几 MB
        ▼
阿里云服务器 8.159.154.125（Ubuntu 24.04，用户 deploy）
  备份 data/ + public/uploads/ → 接收文件 → db:push 建表 → pm2 restart
  应用：pm2 常驻 next start，监听 127.0.0.1:3002
  入口：nginx 监听 8080 反代到 3002
```

| 环节 | 在哪 | 说明 |
| --- | --- | --- |
| 代码构建 | GitHub 云端 | 每次 push 全新环境，构建完机器销毁，不占服务器任何资源 |
| 产物传输 | 云端 → 服务器 | rsync 压缩 + 按内容哈希增量，断线重跑自愈 |
| 运行时 | 服务器 | pm2 守护、开机自启（`pm2-deploy` systemd 服务已启用） |
| 数据 | 服务器 | SQLite 单文件 + 上传目录，部署永不触碰（见下表） |

**部署永不覆盖、永不删除的服务器文件**（rsync 显式排除）：

| 路径 | 内容 |
| --- | --- |
| `/opt/chunlong-blog/.env` | 生产密钥（管理员账号、AUTH_SECRET 等） |
| `/opt/chunlong-blog/data/` | SQLite 数据库（全部文章、说说、配置） |
| `/opt/chunlong-blog/public/uploads/` | 上传的图片等文件 |
| `/opt/chunlong-blog/.git/` | 保留仓库历史用于回退（当前服务器是全新初始化，暂无此目录） |

每次部署前会自动把 `data/` + `public/uploads/` 打包备份到
`/opt/chunlong-backups/`（只保留最近 10 份）。

---

## 2. 每次 push 后发生了什么（workflow 步骤）

推送到 `main` 后自动按序执行（也可在 Actions 页手动 Run workflow，可勾选
`dry_run` 只看将传输什么、不落盘不重启）：

| # | 步骤 | 干什么 | 实测耗时 |
| --- | --- | --- | --- |
| 1 | Validate deployment secrets | 校验 GitHub 上的 5 个 secrets + SITE_URL 是否齐全 | 0s |
| 2 | Checkout | 取出本次代码 | 2s |
| 3 | Setup Node | Node 22（必须与服务器大版本一致，better-sqlite3 二进制按 ABI 匹配） | 10s |
| 4 | Install dependencies | `npm ci`（绝不能设 NODE_ENV=production，会跳过 devDeps 导致构建失败） | 15s（有缓存） |
| 5 | Cache Next.js build | 保存/恢复 `.next/cache` 构建缓存 | 3s |
| 6 | Build | `next build`，注入 SITE_URL（写入 robots.txt 和静态 metadata） | 5s~几分钟 |
| 7 | Configure SSH | 组装部署密钥（支持 PEM 原文/base64 单行，自动剥 CRLF）并自检私钥有效性 | 0s |
| 8 | Verify SSH connectivity | 单独测一次 SSH 连通，把"连不上"和"服务器检查不过"区分开 | 3s |
| 9 | Server preflight | 服务器侧体检：x86_64 架构 / rsync 已装 / .env 存在 / **Node ABI 一致** / 磁盘 ≥2GB | 4s |
| 10 | Backup server runtime data | tar 备份数据库 + 上传目录，清理只留 10 份 | 3s |
| 11 | Rsync build artifacts | 增量传输全部产物（`--delete-after`：删旧文件在传输完成后） | 37s（增量） |
| 12 | Finalize | 校验产物完整 → `db:push` 同步表结构 → `pm2 restart`（首次自动 `pm2 start`） | 9s |
| 13 | Smoke test (app) | 在服务器本地 curl `127.0.0.1:3002`，并验证 robots.txt 里烘入了正式域名 | 4s |
| 14 | Smoke test (public URL) | curl 公网地址；**带 continue-on-error**，备案期间失败不阻断（注意：日志里显示 OK 是假象，见 §4.6） | — |

安全设计：pm2 restart 严格排在 rsync 成功之后——传输中断或任何一步失败都会
立即中止，线上继续跑旧版本，重跑 workflow 即自愈。

---

## 3. 域名与访问：现状及注意点

### 3.1 现状（截至 2026-09）

- 域名 `chunlongblog.top` 已购买，DNS 托管在 Cloudflare，A 记录已指向服务器并**开启了橙色云代理**
- 服务器在**阿里云中国大陆地域**，ICP 备案**办理中、尚未通过**
- 因此：**域名访问被阿里云拦截**，返回 403，页面标题 `Non-compliance ICP Filing`，响应头 `Server: Beaver`
- 当前唯一访问方式：`http://8.159.154.125:8080`

### 3.2 关键认知：拦截按 Host 头，与端口无关

实测（同一 IP、同一端口 8080，仅 Host 头不同）：

| 请求 | 结果 |
| --- | --- |
| `curl http://8.159.154.125:8080/` | **200**，正常返回博客页面 |
| `curl -H "Host: chunlongblog.top" http://8.159.154.125:8080/` | **403 拦截** |

由此得出两个重要结论（当时走过弯路）：

1. **换非标端口（8080 等）不能绕过拦截**——当初以为阿里云只查 80/443，实测错误
2. **Cloudflare Origin Rules 改回源端口也无效**——Cloudflare 回源时照样携带
   `chunlongblog.top` 这个 Host 头，一样被拦

所以不要在"绕"上花时间。唯一合规解法：**完成 ICP 备案**（或把服务器换到
不需要备案的境外地域，届时只需改 GitHub 里的 `SERVER_HOST`/`SERVER_KNOWN_HOSTS`
两个 secrets + 新服务器按 [GITHUB_ACTIONS_DEPLOY.md](./GITHUB_ACTIONS_DEPLOY.md) 准备一次）。

### 3.3 备案期间要注意的

- Cloudflare 的 DNS/SSL 设置可以先不动（域名反正不通）
- workflow 的 `Smoke test (public URL)` 会一直失败但**不阻断部署**，应用健康以
  `Smoke test (app)` 为准
- 后台、写作、评论等一切功能用 IP:8080 都正常

### 3.4 备案通过后要做的事（清单）

完整步骤写在 [deploy/nginx/chunlongblog.top.conf](../deploy/nginx/chunlongblog.top.conf) 顶部注释，概要：

1. nginx `listen 8080` 改回 `listen 80`
2. `certbot --nginx -d chunlongblog.top -d www.chunlongblog.top` 签 HTTPS 证书
3. Cloudflare SSL/TLS 模式从 Flexible 升为 **Full (strict)**
4. `nginx -t && systemctl reload nginx`

**SITE_URL 是双路径的，改域名时两处同步**：
GitHub Environment 的 `SITE_URL` 变量（构建期，烘入 robots.txt / metadata）
+ 服务器 `/opt/chunlong-blog/.env` 的 `SITE_URL`（运行期，供 sitemap.xml / feed 读取）。

---

## 4. 经验记录：为什么改造 + 踩坑实录

### 4.1 背景：为什么要改成云端构建

旧流程（git 历史里 `scripts/deploy-production.sh`，已删除）是 GitHub Actions
通过 SSH 登录服务器，在**服务器上**执行 `npm ci` + `next build`。小服务器
（2核左右）扛不住构建的 CPU/内存峰值，部署期间站点严重卡顿甚至构建失败
（服务器上曾手动构建失败过一次）。

其实 GitHub Actions 的 `runs-on: ubuntu-latest` 本身就是**免费云端机器**
（公开仓库不限时长；私有仓库免费额度每月 2000 分钟，每次部署 2~3 分钟足够用），
不需要任何申请。改造只是让它把构建的活也干了。

### 4.2 方案里的关键设计决策（为什么这么做）

| 决策 | 理由 |
| --- | --- |
| rsync 用 `--checksum`（按内容哈希） | CI 每次全新构建，所有文件 mtime 都是"现在"，默认按时间戳判断会**每次全量传 ~870MB**；按内容判断后日常增量仅几 MB |
| 排除 `/data/` 是第一红线 | 构建时 runner 上会生成一个**空 SQLite 文件**，不排除会覆盖生产数据库 |
| `--delete-after`，绝不用 `--delete-excluded` | 删除推迟到传输完成后；被排除的服务器文件（.env/data/uploads）默认不参与删除 |
| node_modules 全量随产物传输 | `db:push` 用的 drizzle-kit 在 devDependencies 里，且数据库在服务器上，schema 推送必须在服务器执行 |
| Node 大版本钉死 22 并在 preflight 校验 ABI | better-sqlite3 原生二进制按 Node ABI 下发，两端不一致运行时报 `NODE_MODULE_VERSION mismatch`。升级 Node 需 workflow 和服务器同步改 |
| 服务器脚本用 `ssh 'bash -s' < 脚本` 管道执行 | 服务器上的落地副本是上一次部署的旧版；管道保证永远执行**本次代码版本**的脚本 |
| `.gitattributes` 强制 `*.sh`/`*.yml` LF | Windows 开发（autocrlf=true），CRLF 会让 Linux 上 bash/yaml 直接报错 |
| 冒烟测试拆两段（服务器本地 / 公网） | 公网验证依赖 DNS/HTTPS，未就绪时失败属预期，用 continue-on-error 与真正的应用故障区分开 |

### 4.3 踩坑实录（按时间线，每条：现象 → 根因 → 解法 → 识别特征）

**坑 1：4 次部署 7~9 秒全红**
- 现象：Actions 里所有运行秒败
- 根因：`Missing SERVER_HOST`——GitHub 的 Environment secrets **从未配置过**。
  workflow 第一步校验就退出，连构建都没开始
- 解法：Settings → Environments → `production` 下配 5 个 secrets + 1 个 variable
- 识别特征：**失败得越快，问题越靠前**。7 秒失败不用查构建，先看第一步日志

**坑 2：私钥在 Windows 上复制粘贴被破坏**
- 现象：`Configure SSH`/连接失败，但本地用同一把密钥能登录
- 根因：PowerShell 复制的私钥内容带 CRLF 或被截断，OpenSSH 无法解析
- 解法：私钥转 **base64 单行**存入 secret（`[Convert]::ToBase64String([IO.File]::ReadAllBytes(...))`），
  workflow 里自动识别并解码；另加了私钥自检（`ssh-keygen -y`）和独立的
  "Verify SSH connectivity" 诊断步骤，失败时直接打印原因
- 识别特征：本地 `ssh -i 私钥` 能通、CI 不通 → 先怀疑 secret 内容而非服务器

**坑 3：首次部署卡死在备份步骤**
- 现象：`Backup server runtime data` 失败
- 根因：备份目录为空时 `ls chunlong-*.tar.gz` 退出码为 2，在
  `set -Eeuo pipefail` 下直接中止脚本（首次部署必然踩到）
- 解法：先用 `nullglob` 数组统计数量，确实超量才执行清理
- 识别特征：只在"第一次"失败的步骤，优先怀疑"空目录/首次无数据"这类边界

**坑 4：SSH 报 REMOTE HOST IDENTIFICATION HAS CHANGED**
- 现象：连接服务器时弹出中间人攻击警告
- 根因：服务器**重装过系统**，主机密钥变了，本地 `known_hosts` 还是旧记录
- 解法：先通过阿里云控制台 VNC 核对新指纹确认是重装所致，再
  `ssh-keygen -R <IP>` 清旧记录 + 重新 `ssh-keyscan`；GitHub 里的
  `SERVER_KNOWN_HOSTS` 同步换成新值
- 识别特征：换过服务器/重装系统后必现；**先核实再清记录**，不要无脑 `-R`

**坑 5：误判"换 8080 端口可绕过备案拦截"**
- 现象/过程：让 nginx 听 8080 并配 Cloudflare Origin Rules，结果域名仍 403
- 根因：见 §3.2，阿里云按 **Host 头**拦截，与端口无关
- 教训：**做对照实验**（带/不带 Host 头各测一次）再下结论；技术绕过监管拦截
  本身也不可取，正确出路是备案

**坑 6：冒烟测试"假绿"**
- 现象：`Smoke test (public URL)` 显示绿色勾，实际 curl 是失败的
- 根因：该步骤带 `continue-on-error: true`，GitHub 会把失败也标成 success
- 教训：看带 continue-on-error 的步骤要**点开看日志**，不能只看颜色

### 4.4 值得记住的排错方法论

1. **先看失败在第几步**（Actions → 点开运行 → 左侧步骤列表）：失败越早，
   问题越靠近配置（secrets/SSH）；失败越晚，越靠近应用本身
2. **同一命令本地复现**：CI 里失败的命令，拿本地等价环境跑一遍，区分
   "环境问题"和"逻辑问题"
3. **对照实验定位变量**：一次只改一个条件（如 Host 头、端口），看结果差异
4. **让 CI 自己会说话**：这次给 workflow 加的密钥自检、连通性诊断、preflight
   体检，都是为了让下次失败时日志直接给出原因，而不是靠猜

---

## 5. 日常操作速查

| 想做什么 | 怎么做 |
| --- | --- |
| 发布新版本 | `git push origin main`（merge/直接提交到 main 均触发） |
| 手动重新部署 | Actions → Deploy production → Run workflow（分支 main，不勾 dry_run） |
| 预检传输内容 | 同上，但勾选 `dry_run`（只列 rsync 清单，不动服务器） |
| 看部署日志 | Actions → 点具体某次运行 → 点 Build & deploy → 展开各步骤 |
| 看应用日志 | 服务器上 `pm2 logs chunlong-blog --lines 50` |
| 重启网站（不发版） | 服务器上 `pm2 restart chunlong-blog` |
| 停止/恢复网站 | `pm2 stop chunlong-blog` / `pm2 restart chunlong-blog` |
| 回滚到上一版 | `git revert <坏提交> && git push origin main`，走同一条流水线重新部署（服务器无 .git，不能用 git 方式回退） |
| 恢复数据 | `/opt/chunlong-backups/` 里取最近的 tar.gz 解压覆盖后 `pm2 restart` |
| 暂停自动部署 | Actions → Deploy production → `...` → Disable workflow |

应急（Actions 整体不可用时的手工路径）见 [DEPLOY.md](../DEPLOY.md)。

---

## 6. 关键信息都存在哪（改配置时查这张表）

| 信息 | 位置 |
| --- | --- |
| 部署目标 IP / 端口 / 用户 / 私钥 / 主机公钥 | GitHub 仓库 Settings → Environments → **production** 的 5 个 secrets（私钥为 base64 单行格式） |
| 构建期 SITE_URL | 同上页的 Environment variables → `SITE_URL` |
| 运行期密钥（管理员账号、AUTH_SECRET、SITE_URL 等） | 服务器 `/opt/chunlong-blog/.env`（600 权限，仅 deploy 用户） |
| 部署密钥对（本机留档） | `~/.ssh/chunlong_blog_deploy`（私钥）/ `.pub`（公钥，已装在服务器 deploy 用户的 authorized_keys） |
| nginx 配置 | 服务器 `/etc/nginx/sites-available/chunlongblog.top.conf`；仓库模板 `deploy/nginx/chunlongblog.top.conf`（两者保持同步） |
| 数据库 | 服务器 `/opt/chunlong-blog/data/db.sqlite`（单文件） |
| 上传文件 | 服务器 `/opt/chunlong-blog/public/uploads/` |
| 自动备份 | 服务器 `/opt/chunlong-backups/`（保留 10 份）+ crontab 每日备份见 DEPLOY.md §5 |
| workflow 本体 | `.github/workflows/deploy.yml` |
| 服务器端脚本 | `scripts/server-backup.sh`、`scripts/server-finalize.sh`（经 ssh 管道执行，永远运行本次版本） |

---

## 7. 相关文档

- [GITHUB_ACTIONS_DEPLOY.md](./GITHUB_ACTIONS_DEPLOY.md) —— 从零搭建这套部署的完整参考（服务器初始化、密钥生成、GitHub 配置、安全边界）
- [DEPLOY.md](../DEPLOY.md) —— 纯手工部署路径（仅应急）
- [deploy/nginx/chunlongblog.top.conf](../deploy/nginx/chunlongblog.top.conf) —— nginx 模板，顶部注释含备案通过后的切换步骤
