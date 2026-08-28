import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth";
import { getSiteConfig } from "@/lib/site";
import { AdminShell } from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "管理后台" };

export default async function AdminPanelLayout({ children }: { children: ReactNode }) {
  const session = await requireAdmin();
  const config = await getSiteConfig();

  return (
    <AdminShell username={session.username} siteName={config.siteName}>
      {children}
    </AdminShell>
  );
}
