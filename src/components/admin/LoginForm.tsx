"use client";

import { useActionState } from "react";
import { Lock, UserRound, Loader2 } from "lucide-react";
import { loginAction } from "@/app/admin/actions";

export function LoginForm() {
  const [error, formAction, pending] = useActionState(loginAction, null);

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      <h1 className="text-center text-xl font-bold text-slate-800">ChunLong Blog · 后台</h1>

      <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100">
        <UserRound className="h-4 w-4 text-slate-400" />
        <input
          name="username"
          placeholder="管理员账号"
          autoComplete="username"
          className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
        />
      </label>

      <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100">
        <Lock className="h-4 w-4 text-slate-400" />
        <input
          name="password"
          type="password"
          placeholder="密码"
          autoComplete="current-password"
          className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
        />
      </label>

      {error && <p className="text-center text-xs text-rose-500">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {pending ? "登录中…" : "登 录"}
      </button>
    </form>
  );
}
