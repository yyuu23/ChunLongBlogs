# 已核验第三方素材清单

更新时间：2026-09-16。

本文件只记录已经取得可核验来源信息的素材。项目代码采用 MIT License；素材仍受各自许可证、署名要求和商标规则约束。文件未出现在本清单中，不代表它自动获得 MIT 授权，也不代表已经完成权利审计。

## Mixkit 环境音与烟花音效

- 提供方：Mixkit / Envato。
- 许可证：[Mixkit License](https://mixkit.co/license/)；Mixkit 的 Free Sound Effects 可用于个人和商业项目，无强制署名要求。
- 获取日期：2026-09-15。
- 修改：环境音统一截取到 45 秒并转为 mono 48 kbps MP3；烟花音效按前端使用场景压缩为 MP3。没有改变素材的主要内容。

| 本地文件 | 原始素材 / Mixkit ID | 来源页 | SHA-256 |
| --- | --- | --- | --- |
| `public/sounds/ambient/rain.mp3` | Light rain loop / 2472 | [Rain](https://mixkit.co/free-sound-effects/rain/) | `1603277d9cb6cfd486f3c0b941fdc2299dda83d1ea31949852c5972075f7990f` |
| `public/sounds/ambient/fire.mp3` | Campfire crackles / 1736 | [Fire](https://mixkit.co/free-sound-effects/fire/) | `e033be9f313085efe90ffc6909e81324cc0ba67663bb2051924982f34232cb0e` |
| `public/sounds/ambient/crickets.mp3` | Night crickets near the swamp / 368 | [Ambience](https://mixkit.co/free-sound-effects/ambience/) | `98a727ff4ce1ad5e3c494c747eba3eb9be41dce2d7c97416632ad92a6c46a8e7` |
| `public/sounds/ambient/stream.mp3` | Natural ambience with flowing water and birds / 1247 | [Ambience](https://mixkit.co/free-sound-effects/ambience/) | `66f1203c3710b3bf550e4624834bffb55504a964c1b741675615b49a6b32cbb0` |
| `public/sounds/ambient/forest.mp3` | Forest birds singing / 492 | [Ambience](https://mixkit.co/free-sound-effects/ambience/) | `9f3ea68b22cab37cb5563a56832f6ee66526949b7c25fe0349daa83b70574c9b` |
| `public/sounds/ambient/waves.mp3` | Sea waves loop / 1194 | [Waves](https://mixkit.co/free-sound-effects/waves/) | `0d03b734c66ae803ed1e4b245e2ac8657a75102d6559a37b7f0d11f8f58b796d` |
| `public/sounds/fireworks/launch.mp3` | Fast whistle firework / 3103 | [Fireworks](https://mixkit.co/free-sound-effects/fireworks/) | `3d98abb029d11b6ad428f21b0dd3b85fc9981be4e5308d6bf839a0108838b68d` |
| `public/sounds/fireworks/boom-0.mp3` | Multiple fireworks explosions / 1689 | [Fireworks](https://mixkit.co/free-sound-effects/fireworks/) | `1fe7779ec14057f891c0e1baed483fe09cb6f916ea78c9ad5e8936700b3df705` |
| `public/sounds/fireworks/boom-1.mp3` | Small firework explosion / 3104 | [Fireworks](https://mixkit.co/free-sound-effects/fireworks/) | `34060f7552563cc4aedba0fb4433fe851d7fe4566bbc2695c4411b0ae0c63748` |
| `public/sounds/fireworks/boom-2.mp3` | Fireworks bang in sky / 2989 | [Fireworks](https://mixkit.co/free-sound-effects/fireworks/) | `029538e68e756e7ba5cfa3a71ec0028b78e38fd61bc904e17433a716fb5a2679` |
| `public/sounds/fireworks/boom-3.mp3` | Firework rockets exploding in the sky / 2993 | [Fireworks](https://mixkit.co/free-sound-effects/fireworks/) | `94c5afb8700857ce7a74b082052e58b297df159eb57c3e970ef43dea102b62f3` |
| `public/sounds/fireworks/crackle.mp3` | Several whistle fireworks pop / 3105 | [Fireworks](https://mixkit.co/free-sound-effects/fireworks/) | `3e99a7e7600ca6e4dd49973ea57ed201a3758489076904d587b09a2c6c817fc0` |

## 行星贴图

获取与核验日期：2026-09-16。

来源组：

- NASA Visible Earth / Blue Marble：美国政府作品通常为公共领域；使用仍须遵守 [NASA Media Usage Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/)。
- [three.js 官方示例贴图](https://github.com/mrdoob/three.js/tree/dev/examples/textures/planets)：随 three.js 仓库发布，代码仓库采用 MIT；具体原始天文影像仍保留其来源属性。
- [threex.planets](https://github.com/jeromeetienne/threex.planets/tree/master/images) / [Planet Pixel Emporium](https://planetpixelemporium.com/planets.html)，作者 James Hastings-Trew：免费供个人、教育及非商业用途并要求署名；商业用途需要另行取得许可。

本项目按个人非商业博客使用 Planet Pixel Emporium 来源的贴图。若网站开始收费、广告商业化或将素材用于商业产品，必须先替换这些贴图或取得商业许可。

| 本地文件 | 记录来源 | 修改 | SHA-256 |
| --- | --- | --- | --- |
| `public/textures/planets/earth_day.jpg` | NASA / three.js 示例 | 缩放、JPEG 压缩 | `b0bba568903f5afe0916c9c9adf7c27a38a386a1f9726a8f5c189bdf4c2fcea5` |
| `public/textures/planets/earth_night.jpg` | NASA / three.js 示例 | 缩放、JPEG 压缩 | `b9fa64e178eb7486c2cda452c457941789dae456978fe0b6b5b8c956d65c7175` |
| `public/textures/planets/earth_clouds.png` | NASA / three.js 示例 | 缩放、保留 alpha | `7d3b82ef6b3feb506fc06f02a744aed3d864e23e7417075005f4082a7ff935a4` |
| `public/textures/planets/earth_normal.jpg` | three.js 示例衍生法线图 | 缩放、JPEG 压缩 | `eae176955f13c95765e2ce6ba0dd8a578806c18e93d0e787cbd8cd5e72543f8c` |
| `public/textures/planets/moon.jpg` | three.js 示例 | 缩放、JPEG 压缩 | `5819cc3076daf63e55a82760b3846717791c29dc72093869dadb6ab5c4c58a6b` |
| `public/textures/planets/mercury.jpg` | Planet Pixel Emporium，经 threex.planets | 缩放、JPEG 压缩 | `a64e5b01c6dffd1ae0cff0a9dfc2927871c86153d5db8e4c863c4e59d33035ed` |
| `public/textures/planets/venus.jpg` | Planet Pixel Emporium，经 threex.planets | 缩放、JPEG 压缩 | `b8d365abcdb6d5bda72ff0832f40b62a2a7626eb4c3278056e4265ac2616f4e1` |
| `public/textures/planets/mars.jpg` | Planet Pixel Emporium，经 threex.planets | 缩放、JPEG 压缩 | `df29d2926b7735abf14292da18b434fd7ad4eb3460f13c2ffafc046778e2b987` |
| `public/textures/planets/jupiter.jpg` | Planet Pixel Emporium，经 threex.planets | 缩放、JPEG 压缩 | `a70eed558c2c61a8d7074958357f8ddc5aa9459957170a8aab3c8780d8a16c0a` |
| `public/textures/planets/saturn.jpg` | Planet Pixel Emporium，经 threex.planets | 缩放、JPEG 压缩 | `e2309a4adebf248a3ffc1bf8362a12c0312395ea99c2ba93ec5cb6533effe7e2` |
| `public/textures/planets/saturn_ring.jpg` | Planet Pixel Emporium，经 threex.planets | 重排为环半径条带 | `801a5562b7c1356e3abeee0d08720fa82ea4f52bdcd47d7b7a4dd3e991a12076` |
| `public/textures/planets/saturn_ring_alpha.png` | 由 Saturn ring 贴图派生 | 提取 alpha、压缩 | `8734b5d32d3220b5a87718f81c70a302a82386a2667eb0048f36c7f6b01226a7` |
| `public/textures/planets/uranus.jpg` | Planet Pixel Emporium，经 threex.planets | 缩放、JPEG 压缩 | `492a6dc5e31bc9c4d67f54d62d377fd4f58781111c05c7ba6335491766cd18ae` |
| `public/textures/planets/uranus_ring.jpg` | Planet Pixel Emporium，经 threex.planets | 重排为环半径条带 | `5e193fed7ca9d1b2ad29006396ba1c9d837dc219d5e57f664e712f14bd58c804` |
| `public/textures/planets/uranus_ring_alpha.png` | 由 Uranus ring 贴图派生 | 提取 alpha、压缩 | `3f50a36d5140e0b25959ffb387637467935f4597813bd3c163f163c94c3b3d89` |
| `public/textures/planets/neptune.jpg` | Planet Pixel Emporium，经 threex.planets | 缩放、JPEG 压缩 | `a0deb3368c81087f094dcbe4b12698e1812d5bdf17575524dfee9d0a917b9a9a` |

现有仓库只保留了来源组记录，没有保存下载时的上游原文件哈希。因此这里不声称已经完成逐像素的上游同一性证明；当前 SHA-256 用于检测仓库内文件之后是否被替换。

## 模型供应商标识

获取与核验日期：2026-09-16。

以下 Logo 仅用于标识管理员配置和聊天模型提供方，不表示供应商对本站的赞助或认可。商标及品牌权利归各公司所有，未随本项目 MIT License 授权。

| 本地文件 | 官方来源 | 用途 | SHA-256 |
| --- | --- | --- | --- |
| `public/assets/logos/deepseek.png` | [DeepSeek](https://www.deepseek.com/) | DeepSeek 提供方标识 | `c60d3bea159f4f882cd7b257f71eed2c990c4c06c055d66d18107ebb2b378d09` |
| `public/assets/logos/glm.png` | [智谱开放平台](https://open.bigmodel.cn/) | GLM 提供方标识 | `f0ddc6c31cb0ded7925d81657d196e978f8ce12e7787930174feb046441f73d3` |
| `public/assets/logos/qwen.png` | [Qwen](https://qwenlm.github.io/) | Qwen 提供方标识 | `2d2d238126e6917884bab465afb818dbf3f96384209131ce1e3499312bca63da` |

## 字体

获取与核验日期：2026-09-16。字体文件由 `next/font` 在构建期下载并随构建结果自托管，不从站点运行时向 Google 请求。

- Geist Sans / Geist Mono：Vercel，SIL Open Font License 1.1；通过 `next/font/google` 在构建时自托管。[上游](https://github.com/vercel/geist-font)
- Noto Serif Simplified Chinese：Google，SIL Open Font License 1.1；通过 `next/font/google` 在构建时自托管。[上游](https://fonts.google.com/noto/specimen/Noto+Serif+SC)

## 项目自制演示素材

生成与核验日期：2026-09-16。

以下文件不是第三方素材。旋律和波形由 `scripts/gen-audio.mjs` 以正弦波叠加生成，再转码为 MP3；仓库中的 SVG 占位封面、头像和示例照片由 `scripts/gen-assets.mjs` 生成。

| 文件 | SHA-256 |
| --- | --- |
| `public/music/morning-light.mp3` | `a41266ee00cc9769031e9ee67e1d94866dda527ae3461948785e6ec2b755de6a` |
| `public/music/floating.mp3` | `908ca0a7b23869098cd24219de880a43f4b8f84f42f4d350ec9283ac607432ff` |
| `public/music/stardust.mp3` | `1b1f0473fc88886c4dae5c5929abc74fb3d954ca81f28b85d4e78fd0f763582d` |
