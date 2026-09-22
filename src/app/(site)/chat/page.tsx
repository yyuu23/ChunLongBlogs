import type { Metadata } from "next";
import { PageTransition } from "@/components/effects/PageTransition";
import { ChatPageClient } from "@/components/chat/ChatPageClient";
import { getT } from "@/lib/i18n/server";
import { getSiteConfig } from "@/lib/site/repository";
import { buildAiChoicesPublic } from "@/lib/ai/choices";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("chatPage.title") };
}

/* 页面标题在 ChatPageClient 的顶栏里（与工具条合并成一行，把纵向空间让给消息卡）。
   模型预设经 buildAiChoicesPublic 下发（文章伴读面板共用同一构建）。 */
export default async function ChatPage() {
  const config = await getSiteConfig();
  const aiChoices = buildAiChoicesPublic(config.aiChat);
  return (
    <PageTransition>
      <div className="pb-8">
        <ChatPageClient
          aiChoices={aiChoices}
          siteMeta={{
            name: config.siteName,
            avatar: config.avatar || null,
            url: process.env.SITE_URL ?? "",
          }}
        />
      </div>
    </PageTransition>
  );
}
