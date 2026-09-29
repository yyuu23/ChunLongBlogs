import type { Metadata, ResolvingMetadata } from "next";
import { PageTransition } from "@/components/effects/PageTransition";
import { ChatPageClient } from "@/components/chat/ChatPageClient";
import { getT } from "@/lib/i18n/server";
import { getSiteConfig } from "@/lib/site/repository";
import { buildAiChoicesPublic } from "@/lib/ai/choices";

export const dynamic = "force-dynamic";

export async function generateMetadata(_props: unknown, parent: ResolvingMetadata): Promise<Metadata> {
  const [{ t }, { alternates }] = await Promise.all([getT(), parent]);
  const description = t("chatPage.subtitle");
  return {
    title: t("chatPage.title"),
    description,
    // 页面级 alternates 会整体替换根布局（浅合并），RSS 自动发现的 types 需显式带回
    alternates: { canonical: "/chat", types: alternates?.types ?? undefined },
    openGraph: { title: t("chatPage.title"), description },
  };
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
