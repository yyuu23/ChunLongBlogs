import Link from "next/link";
import { getT } from "@/lib/i18n/server";

export default async function NotFound() {
  const { t } = await getT();
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text font-serif text-7xl font-black text-transparent">
        404
      </p>
      <p className="text-muted">{t("notFound.title")}</p>
      <Link href="/" className="glass-button mt-2">
        {t("common.backHome")}
      </Link>
    </div>
  );
}
