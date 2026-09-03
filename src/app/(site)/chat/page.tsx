import type { Metadata } from "next";
import { Bot } from "lucide-react";
import { PageTransition } from "@/components/effects/PageTransition";
import { ChatPageClient } from "@/components/chat/ChatPageClient";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("chatPage.title") };
}

export default async function ChatPage() {
  const { t } = await getT();
  return (
    <PageTransition>
      <div className="pb-8">
        <header className="mx-auto mb-6 flex w-[min(96%,64rem)] items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-br-gradient text-white">
            <Bot className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-serif text-3xl font-black">{t("chatPage.title")}</h1>
            <p className="text-sm text-muted">{t("chatPage.subtitle")}</p>
          </div>
        </header>
        <ChatPageClient />
      </div>
    </PageTransition>
  );
}
