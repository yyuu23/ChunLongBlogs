import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // gzip 压缩由 nginx 接管（见 deploy/nginx/chunlongblog.top.conf），
  // Node 不再对每个 HTML/RSC 响应逐次压缩，省下 2 核小机器的 CPU
  // （官方文档：服务器已配置压缩时推荐关闭）
  compress: false,
  images: {
    // 允许后台粘贴任意图床/远程图片地址作为封面与相册照片
    remotePatterns: [{ protocol: "https", hostname: "**" }],
    // 优化结果缓存 31 天（nginx 侧还有 /_next/image 的磁盘缓存兜底）
    minimumCacheTTL: 2678400,
    // 优先 AVIF：同质量比 webp 再省 20-30% 传输，浏览器不支持时自动回退
    formats: ["image/avif", "image/webp"],
  },
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    // 站内导航 30s 内复用客户端路由缓存（本版默认 dynamic=0，
    // 即每次导航都重新请求 RSC）；刚发布的内容最长 30s 后可见
    staleTimes: { dynamic: 30, static: 180 },
  },
};

export default nextConfig;
