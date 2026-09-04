/**
 * 一次性脚本：把已存储的站点配置切换到动漫背景。
 * 合并式更新 —— 只覆盖背景相关字段，保留后台改过的其他设置。
 * 运行：npx tsx scripts/apply-anime-bg.ts
 */
import { getSiteConfig, saveSiteConfig } from "../src/lib/site";

async function main() {
  const config = await getSiteConfig();
  await saveSiteConfig({
    ...config,
    bgMode: "image",
    bgImages: [
      "/assets/bg/anime-1.webp",
      "/assets/bg/anime-2.webp",
      "/assets/bg/anime-3.webp",
      "/assets/bg/anime-4.webp",
      "/assets/bg/anime-5.webp",
      "/assets/bg/anime-6.webp",
    ],
    bgMaskOpacity: 0.15,
    bgMaskBlur: 0,
    banners: [
      { image: "/assets/bg/anime-1.webp", title: "你好，我是 ChunLong", subtitle: "这里记录我的代码、思考与生活" },
      { image: "/assets/bg/anime-3.webp", title: "代码即诗", subtitle: "用 Next.js 与毛玻璃打造的一方天地" },
      { image: "/assets/bg/anime-5.webp", title: "慢下来，写点东西", subtitle: "技术 · 随笔 · 日常" },
    ],
  });
  console.log("✅ 站点配置已切换为动漫背景（6 张轮播 + 遮罩 15%）");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
