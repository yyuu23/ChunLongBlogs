# -*- coding: utf-8 -*-
"""把 public/fonts/simhei.ttf 子集化为 simhei-subset.ttf（OG 分享图专用）。

字符集 = GB2312 全部（一二级汉字 + 符号区）+ ASCII + 常用标点，
同时导出实际覆盖的码位清单到 src/lib/og-subset-glyphs.json，
供 /api/og 路由检测"标题含子集外字符"时回退全量字体。

运行：python scripts/subset-simhei.py（依赖 pip install fonttools）
"""
import json
from pathlib import Path

from fontTools.subset import Subsetter, Options, load_font, save_font
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public/fonts/simhei.ttf"
OUT = ROOT / "public/fonts/simhei-subset.ttf"
GLYPH_JSON = ROOT / "src/lib/og-subset-glyphs.json"

chars = set()

# ASCII 可见区
for cp in range(0x20, 0x7F):
    chars.add(chr(cp))

# GB2312 汉字区（一二级，B0A1-F7FE）与符号区（A1A1-A9FE：标点、全角、罗马数字、制表符）
for b1 in list(range(0xA1, 0xAA)) + list(range(0xB0, 0xF8)):
    for b2 in range(0xA1, 0xFF):
        try:
            chars.add(bytes([b1, b2]).decode("gb2312"))
        except UnicodeDecodeError:
            pass

# 常用 Unicode 标点/符号兜底（标题里可能出现而 GB2312 区未覆盖的）
chars.update(
    "—–‘’“”…·×÷°′″€£¥¢©®™↑↓←→∞≈≠≤≥±√∵∴"
    "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑩"
    "😀-🿿"  # emoji 占位：satori 对 emoji 本就无字形，跳过即可（cmap 决定最终清单）
)

text = "".join(sorted(chars))
print(f"charset requested: {len(chars)} chars")

opts = Options()
opts.text = text
font = load_font(str(SRC), opts)
ss = Subsetter(options=opts)
ss.populate(text=text)
ss.subset(font)
save_font(font, str(OUT), opts)

# 以子集实际 cmap 为准导出码位清单（字体没有的字不会被写入，回退检测才准确）
cmap = TTFont(str(OUT)).getBestCmap()
glyphs = [chr(cp) for cp in sorted(cmap.keys())]
GLYPH_JSON.write_text(
    json.dumps(glyphs, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
)

src_mb = SRC.stat().st_size / 1048576
out_mb = OUT.stat().st_size / 1048576
print(f"simhei.ttf      {src_mb:.2f} MB")
print(f"simhei-subset   {out_mb:.2f} MB ({len(glyphs)} glyphs)")
