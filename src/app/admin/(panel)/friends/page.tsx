import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { friendLinks } from "@/lib/db/schema";
import { FriendsManager } from "@/components/admin/FriendsManager";

export const dynamic = "force-dynamic";

export default async function AdminFriendsPage() {
  const rows = await db.select().from(friendLinks).orderBy(asc(friendLinks.sort), asc(friendLinks.id));

  return (
    <div>
      <h1 className="mx-auto mb-6 max-w-3xl text-xl font-bold">友链管理</h1>
      <FriendsManager friends={rows} />
    </div>
  );
}
