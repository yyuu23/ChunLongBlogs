import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { moments } from "@/lib/db/schema";
import { MomentsManager } from "@/components/admin/MomentsManager";

export const dynamic = "force-dynamic";

export default async function AdminMomentsPage() {
  const rows = await db.select().from(moments).orderBy(desc(moments.createdAt));

  return (
    <div>
      <h1 className="mx-auto mb-6 max-w-3xl text-xl font-bold">说说管理</h1>
      <MomentsManager
        moments={rows.map((m) => ({
          id: m.id,
          content: m.content,
          images: JSON.parse(m.images || "[]") as string[],
          mood: m.mood,
          location: m.location,
          createdAt: m.createdAt,
        }))}
      />
    </div>
  );
}
