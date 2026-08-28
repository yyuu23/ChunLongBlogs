import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "@/components/admin/LoginForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "登录" };

export default async function AdminLoginPage() {
  if (await getSession()) redirect("/admin");

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 px-4">
      <div className="w-full max-w-sm rounded-3xl border border-white/60 bg-white/70 p-8 shadow-xl backdrop-blur-xl">
        <LoginForm />
      </div>
    </div>
  );
}
