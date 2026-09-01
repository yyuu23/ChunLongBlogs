# 行星贴图来源与授权

本目录下的贴图用于实验室页面的太阳系渲染，共 **8 大行星**，与真实太阳系一一对应。

## 来源

- **NASA Visible Earth / Blue Marble** — 地球日面、夜面、云层、法线
- **threex.planets**（`github.com/jeromeetienne/threex.planets`）
  其素材来自 **Planet Pixel Emporium**（James Hastings-Trew）— 水星、金星、
  火星、木星、土星、天王星、海王星，以及土星环与天王星环
- three.js 官方示例纹理集（`threejs.org/examples/textures/planets/`）— 部分地球素材

## 授权提醒

- NASA 出品的素材属**美国政府作品，公共领域**，可自由使用。
- Planet Pixel Emporium 的素材**免费用于非商业/个人用途，需署名**。

本仓库为个人博客，符合非商业用途。若将来涉及商业使用，
建议把 Planet Pixel Emporium 的部分替换为下列**公共领域**资源：

- NASA Visible Earth：https://visibleearth.nasa.gov/
- NASA Image and Video Library：https://images.nasa.gov/
- USGS Astrogeology（月球/火星地质图）：https://astrogeology.usgs.gov/
- Solar System Scope（CC BY 4.0，2K/8K）：https://www.solarsystemscope.com/textures/

## 文件与用途

| 文件 | 用途 | 尺寸 |
| --- | --- | --- |
| `earth_day.jpg` | 地球表面 albedo | 1024×512 |
| `earth_night.jpg` | **夜面城市灯光**（仅在背光半球点亮） | 1024×512 |
| `earth_clouds.png` | 云层（带 alpha，独立自转） | 1024×512 |
| `earth_normal.jpg` | 法线贴图（山脉立体感） | 1024×512 |
| `mercury.jpg` | 水星（密集撞击坑） | 1024×512 |
| `venus.jpg` | 金星（硫酸云顶） | 1024×512 |
| `mars.jpg` | 火星 | 1024×512 |
| `jupiter.jpg` | 木星（条纹 + 大红斑） | 1024×512 |
| `saturn.jpg` | 土星 | 1024×512 |
| `saturn_ring.jpg` | 土星环颜色（**半径条带**：u = 半径归一） | 915×64 |
| `saturn_ring_alpha.png` | 土星环 alpha 剖面（含卡西尼缝） | 915×64 |
| `uranus.jpg` | 天王星（近乎无特征的青蓝盘面） | 1024×512 |
| `uranus_ring.jpg` | 天王星环颜色 | 512×32 |
| `uranus_ring_alpha.png` | 天王星环 alpha 剖面（环窄而稀疏） | 512×32 |
| `neptune.jpg` | 海王星 | 1024×512 |

总计约 **1.2 MB**。已按行星实际显示尺寸压缩，2K 以上分辨率在此尺寸下无视觉收益。
环贴图统一压到 512×32：屏幕上环只有二三十像素宽。

## 行星 → 贴图映射

轨道顺序与真实太阳系一致，小行星带（访客留声星）落在火星与木星之间。
轨道半径、行星大小、公转周期都经过压缩，否则外圈会被推出视野、木星会吞掉内圈 ——
具体压缩公式见 `src/components/lab/planetConfig.ts` 顶部注释。

| # | 轨道 | 行星 | 内容栏目 | 贴图 | 自转轴倾角 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 62 | 水星 | 说说 | `mercury.jpg` | 0.03° | 自转最慢 |
| 2 | 100 | 金星 | 相册 | `venus.jpg` | 2.64° | **逆行**自转，大气最厚 |
| 3 | 122 | 地球 | 文章 | 日面 + 夜灯 + 云 + 法线 | 23.44° | 唯一有城市灯光 |
| 4 | 148 | 火星 | 回忆 | `mars.jpg` | 25.19° | 点击弹回忆瓶 |
| — | *170–193* | *小行星带* | *访客留声星* | — | — | — |
| 5 | 224 | 木星 | 项目 | `jupiter.jpg` | 3.13° | 最大，自转最快 |
| 6 | 262 | 土星 | 关于 | `saturn.jpg` + 环 | 26.73° | 带环 = 视觉句号 |
| 7 | 320 | 天王星 | 音乐 | `uranus.jpg` + 环 | 97.77° | **侧躺自转**，所以环是竖着的 |
| 8 | 372 | 海王星 | 归档 | `neptune.jpg` | 28.32° | 最远最冷 |

未入轨的站点栏目：**首页、友链、实验室**（实验室就是这片星空本身）。
