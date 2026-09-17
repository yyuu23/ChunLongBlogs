# 公共写接口安全与运维

本文记录匿名点赞、浏览量、玩家进度、留声星、漂流瓶、评论和 AI 请求的安全边界。
它描述的是当前实现，不是对所有匿名请求“绝对可信”的承诺。代码入口位于
`src/lib/public-write/`，生产反代模板位于
`deploy/nginx/chunlongblog.cn.conf`。

## 1. 匿名访客身份

服务端通过 `cl_visitor` Cookie 识别匿名访客：

- JWT 使用 `AUTH_SECRET` 以 HS256 签名，issuer 为 `chunlong-blog`，audience 为
  `anonymous-visitor`，role 为 `anonymous`，有效期一年；
- Cookie 设置 `HttpOnly`、`SameSite=Lax`、`Path=/`，HTTPS 请求下同时设置
  `Secure`；
- 首次没有有效 Cookie 时，可以接收符合格式的旧 localStorage ID（包括 UUID 或
  `v-*`），签名后沿用原 ID，避免已有经验、积分、点赞和瓶子失联；
- 一旦存在有效 Cookie，服务端始终以 Cookie 内的 subject 为准，请求体或查询参数中
  的 `visitorId` 不能切换成其他访客；
- token 被篡改、过期或格式不合法时视为无有效会话，并重新签发身份。

`visitorId` 字段仍保留为兼容期可选字段。新客户端可以继续发送它以兼容旧服务端，
但不能把它当作服务端授权凭据。换浏览器、清除 Cookie 或轮换 `AUTH_SECRET` 都会形成
新身份；当前没有匿名身份跨设备恢复机制。

## 2. 请求校验

### 同源规则

公共写请求带 `Origin` 时，必须匹配请求自身 origin、可信反代还原的 origin 或
`SITE_URL`，否则返回 403。没有 `Origin` 的请求允许通过，以兼容部署冒烟测试、
服务端调用和非浏览器客户端；这类请求仍必须经过字段校验、身份校验和配额。

### JSON 与大小上限

使用公共解析器的接口必须声明 `Content-Type: application/json`。解析器同时检查
`Content-Length` 和实际读取字节数，不能通过省略或伪造长度绕过：

| 请求 | 最大请求体 |
| --- | ---: |
| 统计访问事件 | 2 KiB |
| 评论、看板娘主动搭话 | 8 KiB |
| 普通公共写接口 | 16 KiB |
| Chat Memory | 128 KiB |
| 长对话滚动摘要 | 256 KiB |
| Chat（含最多 3 张 data URL 图片） | 20 MiB |

`zod` schema 还会限制对象额外字段、事件枚举、字符串长度、数组数量、数值范围和图片
MIME。超过大小返回 413，非 JSON 返回 415，JSON 或字段非法返回 400。

## 3. 当前配额

“短时限制”使用进程内存，适合挡突发请求；“持久限制”写入 SQLite 的
`write_quota_counters`，PM2 重启不会清零。除特别说明外，日额度是固定 24 小时窗口。

| 接口 | 短时限制 | 持久限制或业务去重 |
| --- | --- | --- |
| `/api/player` | 访客 120/分钟；IP 300/分钟 | 访客 1000/日；IP 3000/日；单 IP 新访客 20/日 |
| `/api/stats` | IP 60/分钟 | IP 1000/日 |
| 文章 view | IP 30/分钟 | 同访客同文章 6 小时一次；IP 120/日 |
| 文章 like/unlike | IP 20/分钟 | 访客 50/日；IP 200/日；数据库保证同访客同文章一赞 |
| 留星 | IP 5/10 分钟 | 访客滚动 24 小时 3 条；IP 10/日 |
| 回光 | IP 30/分钟 | 访客 20/日；IP 100/日；数据库保证同访客同星一次 |
| 开瓶 | 访客 30/分钟；IP 30/分钟 | 签名访客必须是瓶子属主；重复开瓶幂等 |
| 评论 | IP 3/10 分钟 | GitHub 用户 10/日；IP 10/日；必须登录且只能删除自己的评论 |
| `/api/chat` | IP `CHAT_RATE_LIMIT`/分钟，默认 20 | 全站 `CHAT_DAILY_LIMIT`/日，默认 500；积分关闭时另启用访客 15/小时、60/日的兼容限制 |
| Chat Memory / 滚动摘要 | IP 各 5/分钟 | 与 Chat 共用全站日额度 |
| 看板娘主动搭话 | IP 3/小时 | 全站 200/日 |

AI 积分启用时，每条 Chat 请求还会在调用上游前原子扣分；余额不足直接返回 429，
上游首个请求失败且没有产生内容时退款。积分限制不会替代 IP 分钟限流或全站日熔断。

持久配额表只保存“策略 + 身份 HMAC 摘要 + 时间桶”、次数和过期时间，不保存原始 IP
或原始 visitorId；HMAC 密钥同样来自 `AUTH_SECRET`。过期记录至多每小时低频清理一次。
评论领域表当前为审核目的单独保存 IP；它不属于配额表，也不改变配额键不落原始 IP
的约定。

## 4. 响应约定

| 状态码 | 含义 |
| --- | --- |
| 400 | JSON 无法解析、字段或业务参数非法 |
| 401 | 需要 GitHub 登录的操作没有有效用户会话 |
| 403 | 浏览器跨源写请求被拒绝 |
| 404 | 目标文章、星、瓶子或评论关系不存在，或不属于当前身份 |
| 413 | 请求体超过该接口上限 |
| 415 | Content-Type 不是 JSON |
| 429 | 短时限流、日额度、积分或业务配额耗尽 |

所有公共配额产生的 429 都带秒数形式的 `Retry-After`。前端应展示友好提示，不能在
没有退避的情况下自动重试。

## 5. 生产反向代理要求

生产经 Nginx 反代时，服务器 `.env` 明确设置：

```dotenv
TRUST_PROXY=1
```

并保留仓库模板中的覆盖式请求头：

```nginx
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $remote_addr;
proxy_set_header X-Forwarded-Proto $scheme;
```

完成 HTTPS 后可以按模板说明把 `X-Forwarded-Proto` 固定为 `https`。不要把
`X-Forwarded-For` 改成 `$proxy_add_x_forwarded_for`，否则客户端自报的地址会混入
可信身份。应用端口直接暴露公网时必须设置 `TRUST_PROXY=0`，不能信任浏览器自己传入
的代理头。

`AUTH_SECRET` 必须是生产随机长串。轮换它会让管理员、GitHub 用户和匿名访客 JWT
同时失效，并改变新配额键的 HMAC；应把它当作需要计划维护窗口的密钥轮换。

部署流水线的 `db:push` 会创建 `write_quota_counters` 和过期索引，无需回填。
应用也会在首次使用持久配额时做幂等建表兜底。

## 6. 验证清单

本地回归先运行：

```bash
npm run check
npm run build
```

接口级验证至少覆盖：

1. 新浏览器首次请求收到 `cl_visitor`，属性包含 HttpOnly、SameSite=Lax，HTTPS 下包含 Secure；
2. 无 Cookie 时旧 ID 被接管，有有效 Cookie 时伪造请求体 `visitorId` 不改变属主；
3. 篡改或过期 token 不会取得原身份；
4. 跨源浏览器请求返回 403，无 Origin 的部署检查仍可执行；
5. 非 JSON、超限请求体和非法字段分别得到 415、413、400；
6. 触发短时和持久配额时得到 429 与 `Retry-After`；
7. 产生一条持久配额后重启 PM2，计数仍然生效；
8. 当前访客不能打开他人的瓶子，也不能借请求体 ID 操作他人的点赞状态；
9. Nginx 外网请求的日志与配额使用真实来源 IP，而不是客户端伪造的转发头。

相关自动化测试位于 `src/lib/__tests__/public-write-*.test.ts` 及各 API 集成测试。
生产文章页健康检查由 `scripts/smoke-article.mjs` 和部署 workflow 负责，详见
[DEPLOYMENT.md](./DEPLOYMENT.md)。

## 7. 已知边界

- 分钟级内存限流以单 Node 进程为边界；当前生产架构是单进程，若以后扩为多实例，
  需要把短时计数迁移到共享存储；
- 匿名 Cookie 提供防冒充与配额身份，不等同于实名账号或强认证；清除 Cookie 后仍会
  获得新匿名身份，IP 与全站配额负责限制批量重建；
- `TRUST_PROXY=0` 时应用不会采信任何代理头，无法取得来源 IP，公共写接口的 IP 维度
  会按设计放行健康检查；因此生产站不应绕过 Nginx 直接暴露 Node 端口；
- 无 Origin 请求是为服务端任务和健康检查保留的兼容边界，不应把“同源检查”当作
  唯一鉴权；属主校验、GitHub 用户会话和配额必须继续保留。
