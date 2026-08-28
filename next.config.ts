import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // 允许后台粘贴任意图床/远程图片地址作为封面与相册照片
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
