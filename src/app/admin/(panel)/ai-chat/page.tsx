import { getSiteConfig, DEFAULT_SITE_CONFIG, type AiProvider } from "@/lib/site";
import { providerAvailable, envProvider, resolveProviderModel } from "@/lib/llm";
import { AiChatManager } from "@/components/admin/AiChatManager";

export const dynamic = "force-dynamic";

/**
 * AI 对话管理：模型预设（供应商/模型名）、默认模型与思考强度、访客选择开关、每访客限额。
 * 供应商的 Key 只认 .env（DEEPSEEK_API_KEY / GLM_API_KEY / QWEN_API_KEY），这里只决定路由与暴露。
 */
export default async function AiChatAdminPage() {
  const config = await getSiteConfig();
  const providers: Record<AiProvider, boolean> = {
    deepseek: providerAvailable("deepseek"),
    glm: providerAvailable("glm"),
    qwen: providerAvailable("qwen"),
  };
  // 各供应商解析后的真实默认模型名（预设未填模型覆盖时，档位徽章按它计算）
  const resolvedModels = Object.fromEntries(
    (Object.keys(providers) as AiProvider[]).map((p) => [p, resolveProviderModel(p)]),
  ) as Record<AiProvider, string>;
  return (
    <div className="mx-auto mb-6 max-w-3xl">
      <h1 className="mb-6 text-xl font-bold">AI 对话管理</h1>
      <AiChatManager
        initial={config.aiChat}
        providers={providers}
        envDefault={envProvider()}
        resolvedModels={resolvedModels}
        defaults={{
          choices: DEFAULT_SITE_CONFIG.aiChat.choices,
          defaultChoice: DEFAULT_SITE_CONFIG.aiChat.defaultChoice,
          defaultEffort: DEFAULT_SITE_CONFIG.aiChat.defaultEffort,
        }}
      />
    </div>
  );
}
