import { getSiteConfig } from "@/lib/site";
import { SettingsForm } from "@/components/admin/SettingsForm";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const config = await getSiteConfig();
  return <SettingsForm initial={config} />;
}
