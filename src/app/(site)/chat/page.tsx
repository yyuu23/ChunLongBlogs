import type { Metadata } from "next";
import { PageTransition } from "@/components/effects/PageTransition";
import { ChatPageClient } from "@/components/chat/ChatPageClient";
import { getT } from "@/lib/i18n/server";
import { getSiteConfig } from "@/lib/site";
import { providerAvailable, resolveAiChatChoice } from "@/lib/llm";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("chatPage.title") };
}

/* 页面标题在 ChatPageClient 的顶栏里（与工具条合并成一行，把纵向空间让给消息卡）。
   模型预设从后台配置下发（过滤掉未配 Key 的供应商，只传 id/label，不泄露供应商与模型名） */
export default async function ChatPage() {
  const config = await getSiteConfig();
  const resolved = resolveAiChatChoice(config.aiChat);
  const aiChoices = {
    allow: config.aiChat.allowVisitorChoice,
    defaultChoice: resolved?.id ?? "",
    choices: config.aiChat.choices
      .filter((c) => providerAvailable(c.provider))
      .map((c) => ({ id: c.id, label: c.label })),
  };
  return (
    <PageTransition>
      <div className="pb-8">
        <ChatPageClient aiChoices={aiChoices} />
      </div>
    </PageTransition>
  );
}
