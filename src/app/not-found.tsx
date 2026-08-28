import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text font-serif text-7xl font-black text-transparent">
        404
      </p>
      <p className="text-muted">这个页面飘落到别的次元去了 🌸</p>
      <Link href="/" className="glass-button mt-2">
        回到首页
      </Link>
    </div>
  );
}
