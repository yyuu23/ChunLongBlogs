"use client";

/**
 * 根布局级兜底：layout.tsx 自身抛错时 error.tsx 不再生效，走这里。
 * Next 约定必须自带 <html>/<body>；此时 globals.css 不保证加载，
 * 全部用内联样式。P0-4 的 AUTH_SECRET 生产缺失等启动期错误也会落到这页。
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh">
      <body style={{ margin: 0, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, fontFamily: "system-ui, sans-serif", color: "#64748b", textAlign: "center", padding: "0 24px" }}>
        <p style={{ margin: 0, fontSize: 72, fontWeight: 900, backgroundImage: "linear-gradient(to right, #6366f1, #a855f7, #ec4899)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
          500
        </p>
        <p style={{ margin: 0 }}>网站出了点问题，请稍后重试</p>
        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          <button onClick={() => reset()} style={{ padding: "8px 20px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}>
            重试
          </button>
          <a href="/" style={{ padding: "8px 20px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", color: "inherit", textDecoration: "none" }}>
            回首页
          </a>
        </div>
        {error.digest ? <p style={{ margin: 0, fontSize: 12, opacity: 0.6 }}>digest: {error.digest}</p> : null}
      </body>
    </html>
  );
}
