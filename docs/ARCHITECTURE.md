# 架构与目录说明

本文说明 ChunLong Blog 当前目录的职责边界。整理目标是让可复用业务逻辑和副作用边界
更清楚，而不是按文件行数拆分代码。职责单一的长文件可以保留；不会启用
`max-lines`，也不会为了缩短文件制造只转发一次的模块。

## 1. App Router 与路由组

`src/app` 继续负责 Next.js 路由入口、布局和请求编排。带括号的目录是
[Route Groups](https://nextjs.org/docs/app/api-reference/file-conventions/route-groups)：
括号中的名称只参与代码组织，不会出现在公开 URL 中。

- `src/app/(site)/posts/page.tsx` 对应 `/posts`，不是 `/(site)/posts`；
- `src/app/(site)/layout.tsx` 只包装公开站点，共享导航、背景、音乐播放器、
  Live2D 看板娘和悬浮聊天窗；
- `src/app/admin/(panel)/page.tsx` 对应 `/admin`，`(panel)` 为已登录后台页面共享外壳；
- `src/app/api`、`src/app/admin/actions` 和页面文件保持就近编排，不迁入业务库。

因此移动路由组内部文件时要按 Next.js 的文件约定判断 URL，不能把括号目录当作地址段。

## 2. 依赖方向

主依赖方向为：

```text
app / components  →  lib/domain  →  db / shared
```

- 页面和组件可以调用领域模块；
- 领域模块可以使用数据库与通用基础设施；
- `src/lib` 不反向导入页面入口或具体 UI 组件；
- `src/lib/shared` 不依赖任何具体业务领域；
- 调用方直接导入具体模块，不建立聚合全部能力的大型 barrel，也不保留旧路径转发文件；
- ESLint 持续检查跨层反向依赖与循环依赖。

## 3. 目录职责

```text
src/lib/
├─ admin/               # 后台纯函数和 Server Action 辅助
├─ ai/                  # 模型配置、补全、流式输出、写作、图像与统计解读
├─ analytics/           # 访问统计、后台统计与导出
├─ auth/                # 管理员会话、GitHub 用户与 OAuth
├─ bottles/             # 漂流瓶仓储、外观、排序与音效
├─ chat/                # 会话、记忆、导出、策略、SSE 与工具调用
│  └─ tools/            # 工具定义、标签、领域处理器与统一执行器
├─ content/             # 文章、系列、项目、推荐、Markdown 与定时发布
│  └─ rag/              # 纯切块、向量索引、混合检索与相关文章
├─ db/                  # Drizzle 连接与 schema
├─ engagement/          # 成就、经验、积分与好感度
├─ i18n/                # 四语言字典与服务端语言解析
├─ lab/                 # 实验清单、算法及烟花/环境音频引擎
├─ music/               # 播放偏好、收藏、歌词、网易云与共享类型
├─ public-write/        # 公共写接口的身份、解析、校验与配额
├─ seasonal/            # 节日、节气、时间段、天气与粒子主题
├─ site/                # 站点配置类型、默认值和服务端仓储
└─ shared/              # 日志、通用限流、剪贴板与无业务归属工具
```

`src/components` 仍按使用场景组织。悬浮 AI 聊天窗属于 `components/chat`，Live2D
点击、拖动和主动气泡属于 `components/mascot`；两者不会因为视觉位置接近而混成同一职责。
访问埋点位于 `components/analytics`。

## 4. 服务端与客户端边界

- 数据库、Cookie、密钥和外部模型调用只允许出现在服务端模块；仅供 Next.js 运行的
  模块使用 `server-only` 标记；
- `site/repository.ts` 也属于服务端仓储，但需要被 `scripts/seed.ts` 与配置脚本复用，
  因此依靠调用路径和代码审查约束，不添加会阻断 CLI 的 Next.js 专用标记；
- 浏览器存储、Web Audio 与交互状态留在客户端模块；
- 客户端需要站点配置时只导入 `site/types.ts` 等无副作用类型或纯数据模块；
- RAG 的 `chunking.ts` 是纯函数，可脱离数据库独立测试；索引和检索模块负责服务端副作用。

## 5. 测试结构

- `tests/unit/`：切块、配置清洗、瓶子排序、音乐偏好、工具循环等纯逻辑测试；
- `tests/integration/`：API Route、SQLite、持久配额、定时发布与 Markdown 导入测试。

Vitest 在 Windows 使用隔离 fork 串行运行测试文件，避免模块级 SQLite 单例互相污染；
Linux CI 继续并行。每个数据库集成测试使用独立临时 SQLite，不共享生产数据。

## 6. Markdown 与数据库内容

`content/posts/` 保持原位，front-matter 字段和导入方式不变。它用于演示种子和按需导入，
线上页面运行时以 SQLite 中的文章为准。修改仓库里的 Markdown 不会自动覆盖后台已经编辑
过的正文；部署后如需同步，应只通过现有单篇导入流程更新目标文章，不能无确认地批量重导。

源码目录重命名时应同步检查 README、`docs/`、`public/**/CREDITS.md` 和文章正文中的
路径引用。第三方音频、贴图、字体、Logo 与 Live2D 文件未参与本次目录移动，
`THIRD_PARTY_NOTICES.md` 中的资源映射继续有效。
