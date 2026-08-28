"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  FileText,
  FolderOpen,
  MessageCircleHeart,
  Users,
  Images,
  Settings,
  LogOut,
  Menu,
  X,
  ExternalLink,
} from "lucide-react";
import { logoutAction } from "@/app/admin/actions";

const NAV = [
  { href: "/admin", label: "仪表盘", icon: LayoutDashboard },
  { href: "/admin/posts", label: "文章管理", icon: FileText },
  { href: "/admin/categories", label: "分类与标签", icon: FolderOpen },
  { href: "/admin/moments", label: "说说管理", icon: MessageCircleHeart },
  { href: "/admin/friends", label: "友链管理", icon: Users },
  { href: "/admin/albums", label: "相册管理", icon: Images },
  { href: "/admin/settings", label: "站点设置", icon: Settings },
];

export function AdminShell({
  username,
  siteName,
  children,
}: {
  username: string;
  siteName: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  const navList = (
    <nav className="flex flex-1 flex-col gap-1 p-3">
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition-colors ${
              active
                ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/25"
                : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
            }`}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-dvh bg-slate-100 text-slate-800">
      {/* 桌面侧边栏 */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col bg-slate-900 lg:flex">
        <div className="border-b border-white/10 px-5 py-5">
          <p className="font-serif text-lg font-bold text-white">{siteName}</p>
          <p className="mt-0.5 text-xs text-slate-500">管理后台 · @{username}</p>
        </div>
        {navList}
        <div className="border-t border-white/10 p-3">
          <Link
            href="/"
            target="_blank"
            className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200"
          >
            <ExternalLink className="h-4 w-4" />
            查看站点
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-slate-400 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
            >
              <LogOut className="h-4 w-4" />
              退出登录
            </button>
          </form>
        </div>
      </aside>

      {/* 移动端顶栏 + 抽屉 */}
      <div className="fixed inset-x-0 top-0 z-40 flex items-center justify-between bg-slate-900 px-4 py-3 lg:hidden">
        <p className="font-serif font-bold text-white">{siteName} · 后台</p>
        <button onClick={() => setOpen((v) => !v)} aria-label="菜单" className="text-slate-300">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 flex-col bg-slate-900 pt-14">
            {navList}
            <form action={logoutAction} className="border-t border-white/10 p-3">
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-slate-400 hover:text-rose-400"
              >
                <LogOut className="h-4 w-4" />
                退出登录
              </button>
            </form>
          </aside>
        </div>
      )}

      <main className="flex-1 px-4 pb-10 pt-16 lg:ml-60 lg:px-8 lg:pt-8">{children}</main>
    </div>
  );
}
