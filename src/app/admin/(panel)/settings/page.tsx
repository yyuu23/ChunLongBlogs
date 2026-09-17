import { getSiteConfig } from "@/lib/site";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { getEmbeddingIndexStatus } from "@/lib/rag";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const [config, embeddingStatus] = await Promise.all([getSiteConfig(), getEmbeddingIndexStatus()]);
  return <SettingsForm initial={config} embeddingStatus={embeddingStatus} />;
}
