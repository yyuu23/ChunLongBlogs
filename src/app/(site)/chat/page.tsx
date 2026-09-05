import type { Metadata } from "next";
import { PageTransition } from "@/components/effects/PageTransition";
import { ChatPageClient } from "@/components/chat/ChatPageClient";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("chatPage.title") };
}

/* 页面标题在 ChatPageClient 的顶栏里（与工具条合并成一行，把纵向空间让给消息卡） */
export default async function ChatPage() {
  return (
    <PageTransition>
      <div className="pb-8">
        <ChatPageClient />
      </div>
    </PageTransition>
  );
}
