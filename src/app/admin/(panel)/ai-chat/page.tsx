import { getSiteConfig, type AiProvider } from "@/lib/site";
import { providerAvailable, envProvider } from "@/lib/llm";
import { AiChatManager } from "@/components/admin/AiChatManager";

export const dynamic = "force-dynamic";

/**
 * AI 对话管理：模型预设（供应商/模型名/思考开关）、默认模型、访客选择开关、每访客限额。
 * 供应商的 Key 只认 .env（DEEPSEEK_API_KEY / GLM_API_KEY / QWEN_API_KEY），这里只决定路由与暴露。
 */
export default async function AiChatAdminPage() {
  const config = await getSiteConfig();
  const providers: Record<AiProvider, boolean> = {
    deepseek: providerAvailable("deepseek"),
    glm: providerAvailable("glm"),
    qwen: providerAvailable("qwen"),
  };
  return (
    <div className="mx-auto mb-6 max-w-3xl">
      <h1 className="mb-6 text-xl font-bold">AI 对话管理</h1>
      <AiChatManager initial={config.aiChat} providers={providers} envDefault={envProvider()} />
    </div>
  );
}
