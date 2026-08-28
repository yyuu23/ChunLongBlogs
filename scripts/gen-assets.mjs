// 生成演示用 SVG 资源（背景/头像/封面/相册照片/友链头像）
// 运行：node scripts/gen-assets.mjs
import fs from "node:fs";
import path from "node:path";

const out = (p) => {
  const full = path.join("public/assets", p);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  return full;
};

function meshBg({ w = 1920, h = 1080, base, blobs }) {
  const blobEls = blobs
    .map(
      (b, i) => `
  <circle cx="${b.x}" cy="${b.y}" r="${b.r}" fill="url(#g${i})" filter="url(#blur)" opacity="${b.o ?? 0.85}"/>`,
    )
    .join("");
  const defs = blobs
    .map(
      (b, i) => `
    <radialGradient id="g${i}">
      <stop offset="0%" stop-color="${b.c}"/>
      <stop offset="100%" stop-color="${b.c}" stop-opacity="0"/>
    </radialGradient>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="base" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${base[0]}"/>
      <stop offset="100%" stop-color="${base[1]}"/>
    </linearGradient>
    <filter id="blur" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="160"/>
    </filter>${defs}
  </defs>
  <rect width="${w}" height="${h}" fill="url(#base)"/>${blobEls}
</svg>
`;
}

// —— 全屏背景（1920×1080）——
const bgs = [
  {
    base: ["#c2e9fb", "#fbc2eb"],
    blobs: [
      { x: 400, y: 300, r: 480, c: "#a18cd1" },
      { x: 1500, y: 800, r: 520, c: "#fbc2eb" },
      { x: 1100, y: 200, r: 420, c: "#a1c4fd", o: 0.7 },
    ],
  },
  {
    base: ["#e0c3fc", "#8ec5fc"],
    blobs: [
      { x: 1600, y: 300, r: 500, c: "#7f7fd5" },
      { x: 300, y: 900, r: 460, c: "#c1dfc4" },
      { x: 900, y: 500, r: 380, c: "#fbc2eb", o: 0.6 },
    ],
  },
  {
    base: ["#fbc2eb", "#a6c1ee"],
    blobs: [
      { x: 500, y: 800, r: 520, c: "#fdcbf1" },
      { x: 1400, y: 250, r: 440, c: "#a1c4fd" },
      { x: 1000, y: 600, r: 360, c: "#d4fc79", o: 0.5 },
    ],
  },
  {
    base: ["#a1c4fd", "#c2e9fb"],
    blobs: [
      { x: 200, y: 400, r: 460, c: "#84fab0" },
      { x: 1700, y: 700, r: 520, c: "#8fd3f4" },
      { x: 900, y: 1000, r: 400, c: "#e0c3fc", o: 0.6 },
    ],
  },
];
bgs.forEach((b, i) => fs.writeFileSync(out(`bg/bg-${i + 1}.svg`), meshBg(b)));

// —— 头像 ——
function avatar(initials, c1, c2) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="a" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <rect width="256" height="256" rx="128" fill="url(#a)"/>
  <text x="128" y="163" font-family="'Segoe UI', 'Noto Sans SC', sans-serif" font-size="104" font-weight="700" fill="rgba(255,255,255,.92)" text-anchor="middle">${initials}</text>
</svg>
`;
}
fs.writeFileSync(out("avatar.svg"), avatar("CL", "#6366f1", "#ec4899"));
["星", "萤", "月"].forEach((z, i) =>
  fs.writeFileSync(
    out(`friends/f${i + 1}.svg`),
    avatar(
      z,
      ["#0ea5e9", "#f59e0b", "#8b5cf6"][i],
      ["#6366f1", "#ef4444", "#ec4899"][i],
    ),
  ),
);

// —— 文章封面（1200×630）——
const covers = [
  {
    base: ["#667eea", "#764ba2"],
    blobs: [{ x: 300, y: 160, r: 300, c: "#fbc2eb" }, { x: 950, y: 480, r: 320, c: "#a1c4fd" }],
    label: "Next.js",
  },
  {
    base: ["#f093fb", "#f5576c"],
    blobs: [{ x: 900, y: 180, r: 300, c: "#fbc2eb" }, { x: 280, y: 460, r: 300, c: "#ffd6a5" }],
    label: "CSS",
  },
  {
    base: ["#4facfe", "#00f2fe"],
    blobs: [{ x: 600, y: 320, r: 340, c: "#c2e9fb" }, { x: 1100, y: 520, r: 260, c: "#a18cd1" }],
    label: "SQLite",
  },
];
covers.forEach((c, i) => {
  const svg = meshBg({ w: 1200, h: 630, base: c.base, blobs: c.blobs }).replace(
    "</svg>",
    `  <text x="60" y="560" font-family="'Segoe UI', 'Noto Sans SC', sans-serif" font-size="64" font-weight="800" fill="rgba(255,255,255,.85)">${c.label}</text>\n</svg>`,
  );
  fs.writeFileSync(out(`covers/cover-${i + 1}.svg`), svg);
});

// —— 相册照片（800×600）——
const palettes = [
  { base: ["#a18cd1", "#fbc2eb"], blobs: [{ x: 200, y: 150, r: 220, c: "#fff1b8" }] },
  { base: ["#84fab0", "#8fd3f4"], blobs: [{ x: 600, y: 420, r: 240, c: "#ffffff" }] },
  { base: ["#ffecd2", "#fcb69f"], blobs: [{ x: 400, y: 300, r: 260, c: "#ff9a9e" }] },
  { base: ["#a1c4fd", "#c2e9fb"], blobs: [{ x: 650, y: 180, r: 200, c: "#e0c3fc" }] },
  { base: ["#f6d365", "#fda085"], blobs: [{ x: 180, y: 450, r: 220, c: "#fff1b8" }] },
  { base: ["#5ee7df", "#b490ca"], blobs: [{ x: 550, y: 350, r: 230, c: "#ffffff" }] },
  { base: ["#d299c2", "#fef9d7"], blobs: [{ x: 300, y: 200, r: 210, c: "#a1c4fd" }] },
  { base: ["#accbee", "#e7f0fd"], blobs: [{ x: 500, y: 400, r: 240, c: "#fbc2eb" }] },
];
palettes.forEach((p, i) =>
  fs.writeFileSync(out(`photos/p${i + 1}.svg`), meshBg({ w: 800, h: 600, ...p })),
);

console.log("assets generated under public/assets/");
