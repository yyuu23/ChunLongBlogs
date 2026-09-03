// PM2 进程配置：直接运行 next 二进制。
// 之前的形式是 `pm2 start npm -- start`——多一层 npm 常驻进程（约 50-80MB RSS），
// 且无内存护栏。2GB 小机器上改为直连二进制 + max_memory_restart 防 OOM。
// 变量由 scripts/server-finalize.sh 注入（APP_DIR/APP_NAME/APP_PORT）。
const APP_NAME = process.env.APP_NAME || "chunlong-blog";
const APP_DIR = process.env.APP_DIR || "/opt/chunlong-blog";
const PORT = process.env.APP_PORT || "3002";

module.exports = {
  apps: [
    {
      name: APP_NAME,
      cwd: APP_DIR,
      script: "node_modules/next/dist/bin/next",
      args: "start --hostname 127.0.0.1",
      env: {
        NODE_ENV: "production",
        PORT,
      },
      // 2GB 机器的护栏：RSS 超 600M 自动重启；Node 堆上限 768M（护栏先触发）
      max_memory_restart: "600M",
      node_args: "--max-old-space-size=768",
      autorestart: true,
    },
  ],
};
