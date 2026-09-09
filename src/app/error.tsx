"use client";

/**
 * 路由段错误边界：server/client 组件抛错时展示此页（否则是裸 500）。
 * 文案用固定中文（站点默认语言）——client 组件拿不到服务端 getT()，
 * 错误页不值得为四语言再做一套客户端字典。digest 可对照服务端日志定位。
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text font-serif text-7xl font-black text-transparent">
        500
      </p>
      <p className="text-muted">页面出了点问题，请稍后重试</p>
      <div className="mt-2 flex items-center gap-3">
        <button onClick={() => reset()} className="glass-button">
          重试
        </button>
        <a href="/" className="glass-button">
          回首页
        </a>
      </div>
      {error.digest ? <p className="mt-2 text-xs opacity-50">digest: {error.digest}</p> : null}
    </div>
  );
}
