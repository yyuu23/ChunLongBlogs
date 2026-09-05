import type { Metadata } from "next";
import { PageTransition } from "@/components/effects/PageTransition";
import { ChatPageClient } from "@/components/chat/ChatPageClient";
import { getT } from "@/lib/i18n/server";
import { getSiteConfig } from "@/lib/site";
import { providerAvailable, resolveAiChatChoice, resolveProviderModel } from "@/lib/llm";
import { thinkingSpec } from "@/lib/llm-thinking";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("chatPage.title") };
}

/* 页面标题在 ChatPageClient 的顶栏里（与工具条合并成一行，把纵向空间让给消息卡）。
   模型预设从后台配置下发：过滤掉未配 Key 的供应商，带真实模型名与思考档位
   （品牌/模型名是公开信息；API key 与接入地址仍只在服务端）。 */
export default async function ChatPage() {
  const config = await getSiteConfig();
  const resolved = resolveAiChatChoice(config.aiChat);
  const aiChoices = {
    allow: config.aiChat.allowVisitorChoice,
    defaultChoice: resolved?.id ?? "",
    defaultEffort: config.aiChat.defaultEffort,
    choices: config.aiChat.choices
      .filter((c) => providerAvailable(c.provider))
      .map((c) => {
        const model = resolveProviderModel(c.provider, c.model);
        return { id: c.id, label: c.label, provider: c.provider, model, levels: thinkingSpec(c.provider, model).levels };
      }),
  };
  return (
    <PageTransition>
      <div className="pb-8">
        <ChatPageClient aiChoices={aiChoices} />
      </div>
    </PageTransition>
  );
}
