import type { Metadata } from "next";
import { PageTransition } from "@/components/effects/PageTransition";
import { ChatPageClient } from "@/components/chat/ChatPageClient";
import { getT } from "@/lib/i18n/server";
import { getSiteConfig } from "@/lib/site";
import { providerAvailable, resolveAiChatChoice, resolveProviderModel } from "@/lib/llm";
import { thinkingSpec } from "@/lib/llm-thinking";
import { CHOICE_COST_DEFAULTS, creditsCfg, effortCostOf, peakMultiplierOf } from "@/lib/credits";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("chatPage.title") };
}

/* 页面标题在 ChatPageClient 的顶栏里（与工具条合并成一行，把纵向空间让给消息卡）。
   模型预设从后台配置下发：过滤掉未配 Key 的供应商，带真实模型名、思考档位与积分价
   （品牌/模型名/积分价是公开信息；API key 与接入地址仍只在服务端）。 */
export default async function ChatPage() {
  const config = await getSiteConfig();
  const resolved = resolveAiChatChoice(config.aiChat);
  const creditCfg = creditsCfg(config.aiChat);
  const aiChoices = {
    allow: config.aiChat.allowVisitorChoice,
    defaultChoice: resolved?.id ?? "",
    defaultEffort: config.aiChat.defaultEffort,
    // 积分价随选择器下发：模型行显示基准价（含促销划线原价），档位滑条旁显示当前档实际价
    choices: config.aiChat.choices
      .filter((c) => providerAvailable(c.provider))
      .map((c) => {
        const model = resolveProviderModel(c.provider, c.model);
        const base = c.cost ?? CHOICE_COST_DEFAULTS[c.provider] ?? 10;
        const levels = thinkingSpec(c.provider, model).levels;
        return {
          id: c.id,
          label: c.label,
          provider: c.provider,
          model,
          levels,
          cost: base,
          promo: c.promo,
          // 该模型各档位的实际积分价（与扣费同口径：向下取整，钳制到其支持的档位）
          levelCosts: Object.fromEntries(
            levels.map((lv) => [lv, Math.max(0, Math.floor(base * effortCostOf(config.aiChat, lv)))]),
          ) as Record<string, number>,
        };
      }),
    credits: {
      enabled: creditCfg.enabled,
      dailyGrant: creditCfg.dailyGrant,
      peakMultiplier: peakMultiplierOf(config.aiChat),
    },
  };
  return (
    <PageTransition>
      <div className="pb-8">
        <ChatPageClient aiChoices={aiChoices} />
      </div>
    </PageTransition>
  );
}
