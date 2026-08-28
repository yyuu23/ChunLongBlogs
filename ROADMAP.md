# ROADMAP · 功能差距清单

> 对比对象：**WitchCat**（[witchcat.cn](https://www.witchcat.cn/zh)，无源码，即调研文档 OTHER_FEATURES.md 的蓝本）、**Kirameku**（`C:\blog\Kirameku-main` 源码，实机 [boke.hiromu.top](https://boke.hiromu.top)）、**XinghuisamaBlogs**（`C:\blog\XinghuisamaBlogs-main` 源码，实机 [xinghuisama.top](https://www.xinghuisama.top)，另有 [anze.love](https://anze.love) 的 Live2D 看板娘参考）。
> 调研日期：2026-08-28（三个站点均已实地浏览核对）
> 用途：记录本项目暂缺的功能/动画，以后按需补齐。每项标注来源与工作量（S ≤ 半天 / M 1-2 天 / L 3 天+）。

## 我们已有的（不用重复做）

首页轮播 Banner+打字机/资料卡/节气公告/统计数字、文章双视图+筛选角标+分页、文章详情（Shiki 高亮/KaTeX/提示框/TOC/giscus 评论/阅读量/上下篇）、归档时间线、说说、相册（堆叠扇形展开+拍立得照片墙+灯箱）、友链、关于、RSS、站内搜索、404；粒子主题系统（日夜自动樱/萤+落叶+雪+关闭，交叉淡化）、点击爆破、开场屏、页面过渡、滚动渐入、3D 倾斜卡片、导航弹簧指示器+下滑隐藏、移动端底部 Tab+抽屉、特效设置面板；完整后台（写作/分类标签/说说/友链/相册/站点配置/上传）。

---

## A. 内容模块（页面级）

| # | 功能 | 来源 | 说明 | 工作量 |
|---|------|------|------|--------|
| A1 | **项目展示页 `/projects`** | WitchCat / Kirameku / XHBlogs | 项目卡片：状态、精选、语言占比（GitHub API）、Star/Fork、标签筛选 | M |
| A2 | **音乐馆 + 底部全局播放器** | WitchCat / Kirameku / XHBlogs 三家都有 | 歌单/流派/最近播放(localStorage)/歌词；**跨页面不断播**（React Context + 单例 audio）；黑胶唱片机待机→旋转动画。Kirameku 用 @meting 代理网易云 | L |
| A3 | **留言板 `/messages`** | WitchCat / Kirameku / anze.love | 独立页面版评论区（giscus 也能凑合，独立留言板更有站味） | S-M |
| A4 | **追番清单** | WitchCat | 状态筛选（追番中/已看完/想看/弃）、进度百分比、评分、跳 B 站、侧边统计 | M |
| A5 | **游戏库** | WitchCat | 在玩/想玩/通关/弃坑、时长统计、跳 Steam（可写脚本对接 Steam API） | M |
| A6 | **日记** | WitchCat | 天气/心情 frontmatter、相对时间、年份归档（介于说说和文章之间） | S-M |
| A7 | **杂谈/短文板块** | XHBlogs（xinghuisama.top 首页有杂谈卡） | 比"说说"长、比文章轻的短文类型，配封面 | S |
| A8 | **技能树** | WitchCat | 可交互"知识大脑"树状展开 + 熟练度/年限 + 统计面板 | M |
| A9 | **成长时间线** | WitchCat | 教育/工作/项目/成就分类 + 标签筛选（与"归档"不同：个人履历视角） | S |
| A10 | **赞助页** | WitchCat | 支付宝/微信二维码 + 三步指引 + 鸣谢列表 | S |
| A11 | **收藏夹/书签页** | Kirameku `/bookmark` | 分类书签管理（个人导航页） | S-M |
| A12 | **小说阅读器** | Kirameku `/novel` | 第三方源搜索+章节阅读（注意版权风险） | M |
| A13 | **实验室/花园页** | Kirameku `/garden`（19 个实验：烟花/流体/星空太阳系/代码雨/万花筒/重力沙/生命游戏/排序可视化/数学绘图/地图/二维码/JSON 工具…） | 炫技合集，可挑最有视觉冲击的几个做 | L |

## B. 布局与导航

| # | 功能 | 来源 | 说明 | 工作量 |
|---|------|------|------|--------|
| B1 | **常驻侧边栏布局** | WitchCat / XHBlogs 首页 | 站长卡+公告+分类+标签+最新动态+RSS 复制+音乐迷你条一列常驻（我们现在全部收在首页卡片里，大屏利用率可以更高） | M |
| B2 | **多级下拉菜单** | WitchCat | 顶部导航"链接⌄ / 我的⌄ / 关于⌄"分组，条目多了以后比平铺更整洁 | S |
| B3 | **首页"最新文章"大图轮播卡** | XHBlogs / Kirameku | 现在是三列小卡；大图横滑+左右切换的"Latest Insight"卡更有冲击力 | S |
| B4 | **首页照片墙海报卡** | XHBlogs / Kirameku | 最新相册封面海报，点击进相册 | S |
| B5 | **首页说说/杂谈轮播卡** | Kirameku | 最新几条说说横向轮播 | S |
| B6 | **系统运行时长 + 技术栈徽章** | XHBlogs / Kirameku | 页脚或首页卡：稳定运行 N 天 + Next.js/React/Tailwind 徽章 | S |
| B7 | **日历组件** | WitchCat | 右上角日历弹层/打卡 | S-M |
| B8 | **主题色选择器** | WitchCat | 全站 accent 色一键切换（CSS 变量，我们有暗色但没有色相主题） | M |

## C. 动效与特效（我们的强项区，可继续加）

| # | 功能 | 来源 | 说明 | 工作量 |
|---|------|------|------|--------|
| C1 | **看板娘（Live2D）** | anze.love（pio+Cubism4）/ Kirameku / WitchCat | 左下角小人：待机动作、点击对话、可隐藏、换装。开源方案：pixi-live2d-display + 免费模型 | M-L |
| C2 | **AI 聊天助手** | XHBlogs（CyberCat，Gemini） | 可撸的猫，气泡聊天，接任意 LLM API | M |
| C3 | **弹幕背景文字** | XHBlogs | 配置一句句短语从右往左飘（"今天背单词了吗？"），和粒子叠加很热闹 | S |
| C4 | **鼠标拖尾粒子** | Kirameku `MouseTrail.tsx` | 移动时蓝紫光点下坠消散 | S |
| C5 | **文字选中星光** | Kirameku `KiraSparkle.tsx` | 选中一段文字松开时在选区绽开四角星 | S |
| C6 | **季节自动粒子** | Kirameku `SeasonalEffect` | 我们有手动主题切换；可加"按月份自动选（春樱/夏萤/秋叶/冬雪）"档位 | S |
| C7 | **Logo 彩蛋：连击彩纸** | Kirameku | 点 Logo 7 次触发全屏彩纸庆祝 | S |
| C8 | **页面切换"传送门"遮罩** | Kirameku `PageTransition.tsx`（写好未启用） | 路由切换时 blur 遮罩+三环旋转+随机小贴士 | S |
| C9 | **友链"漂流瓶"散落** | Kirameku `/friends` | 友链卡随机散落旋转+可拖拽+点击弹详情 | M |
| C10 | **归档"时间河"** | Kirameku `/timeline` | SVG 正弦河流承载文章节点，可横向拖拽浏览 | M |
| C11 | **风中草粒子层** | XHBlogs `WindyGrass.tsx` | 底部 150 根摆动草叶（日绿夜白） | S |
| C12 | **WebGL/Three.js 创意页** | XHBlogs `/tree`（自定义 shader+徽章等级） | "灵境"式 3D 空间，工期大，放最后 | L |
| C13 | **图表统计仪表盘** | Kirameku（recharts 饼图/折线+AnimatedNumber） | 首页/后台数据可视化 | M |

## D. 交互小玩具

| # | 功能 | 来源 | 说明 | 工作量 |
|---|------|------|------|--------|
| D1 | **径向工具菜单** | Kirameku `RadialMenu`（长按 Tab 呼出） | 环形展开的小工具/小游戏入口 | M |
| D2 | **计算器等快捷小工具** | XHBlogs GlobalToolbox | 右下角工具箱：计算器/二维码/JSON 格式化（Kirameku garden 里也有独立页版） | S-M |
| D3 | **天气小组件** | XHBlogs（API 代理） | 侧栏/首页显示实时天气 | S |
| D4 | **舔狗日记/一言卡** | Kirameku 首页 | "换一条"按钮刷新的趣味句子卡（可接 hitokoto 一言 API） | S |
| D5 | **GitHub 访客 OAuth** | Kirameku `/auth/callback` | 游客用 GitHub 身份留言点赞（需要后端，二期） | M |

## E. 基建 / 后台 / SEO

| # | 功能 | 来源 | 说明 | 工作量 |
|---|------|------|------|--------|
| E1 | **多语言 i18n** | WitchCat（中/英/日/韩） | 工作量大，建议最后或永不做 | L |
| E2 | **站长数据仪表盘** | WitchCat `/dashboard` / Kirameku 后台 | 运行时长/内存/请求数/热门文章 Top5（我们是内容仪表盘，缺运行数据；可接 umami） | M |
| E3 | **说说评论** | Kirameku（chatter_comment 表） | 说说可被评论互动 | M |
| E4 | **相册浏览量** | WitchCat | 每张照片浏览统计 | S |
| E5 | **OSS/图床切换** | Kirameku（阿里云 oss2+压缩） | 我们已抽象上传接口，补 OSS 驱动即可 | M |
| E6 | **CC BY-NC-SA 协议声明** | WitchCat / XHBlogs 页脚 | 页脚显式知识共享协议（我们版权行有，协议没有） | S |
| E7 | **Sitemap / robots** | 通用 SEO | we have RSS；补 sitemap.xml 与 robots.txt | S |
| E8 | **代码高亮主题切换跟随站点主题色** | 可选优化 | 现在 Shiki 双主题跟随明暗，可再加跟随主题色 | S |

---

## 建议补齐顺序（个人推荐）

1. **快赢组（每项 ≤ 半天，观感提升大）**：B3 大图轮播卡 → C4 鼠标拖尾 → C5 选中星光 → C3 弹幕背景 → B6 运行时长徽章 → C7 Logo 彩蛋 → D4 一言卡 → E6/E7
2. **模块组（补内容版图）**：A1 项目页 → A7 杂谈 → A3 留言板 → A4 追番 + A5 游戏 + A6 日记（ WitchCat "生活四件套"）
3. **镇站之宝组（大件，一次做一个）**：A2 音乐馆+全局播放器 → C1 看板娘 → C2 AI 聊天 → C13 图表仪表盘 → B8 主题色
4. **炫技组（有余力再玩）**：C9 漂流瓶友链 → C10 时间河 → A13 实验室 → C12 Three.js 页 → E1 i18n

## 参考资料索引

- WitchCat 实机：https://www.witchcat.cn/zh （布局/功能蓝本，无源码）
- Kirameku 源码：`C:\blog\Kirameku-main`（前端 `Kirameku/`、FastAPI 后端 `Kirameku-backend/`；动效组件集中在 `Kirameku/components/ui|layout|posts`）
- XHBlogs 源码：`C:\blog\XinghuisamaBlogs-main`（前台 `XHBlogs/`、本地写作后台 `my-blog-manager/`；动效在 `XHBlogs/components/`）
- XHBlogs 实机：https://www.xinghuisama.top
- Live2D 看板娘参考：https://anze.love/留言板（pio 方案：pixi + Cubism4 SDK）
