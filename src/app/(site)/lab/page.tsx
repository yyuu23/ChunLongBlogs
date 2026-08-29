import type { Metadata } from "next";
import { desc, eq, sql } from "drizzle-orm";
import { FlaskConical } from "lucide-react";
import { PageTransition } from "@/components/effects/PageTransition";
import { LabClient } from "@/components/lab/LabClient";
import type { MomentItem, StarItem } from "@/components/lab/LabScene";
import { db } from "@/lib/db";
import { moments, posts, songs, stars } from "@/lib/db/schema";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "实验室" };

export default async function LabPage() {
  const [momentRows, starRows, notesCount, postsCount, soundCount] = await Promise.all([
    db.select().from(moments).orderBy(desc(moments.createdAt)).limit(20),
    db.select().from(stars).orderBy(desc(stars.id)).limit(80),
    db.select({ n: sql<number>`count(*)` }).from(moments),
    db
      .select({ n: sql<number>`count(*)` })
      .from(posts)
      .where(eq(posts.status, "published")),
    db.select({ n: sql<number>`count(*)` }).from(songs),
  ]);

  const momentItems: MomentItem[] = momentRows.map((m) => ({
    id: m.id,
    content: m.content,
    mood: m.mood,
    date: formatDate(m.createdAt),
  }));

  const starItems: StarItem[] = starRows.map((s) => ({
    id: s.id,
    content: s.content,
    date: formatDate(s.createdAt),
  }));

  return (
    <PageTransition>
      <div className="mx-auto w-[min(96%,72rem)] pb-8">
        <header className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-br-gradient text-white">
            <FlaskConical className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-serif text-3xl font-black">实验室</h1>
            <p className="text-sm text-muted">
              行星体系 · 每颗行星是一类内容 · 放首歌让恒星起舞 🎵
            </p>
          </div>
        </header>
        <LabClient
          moments={momentItems}
          initialStars={starItems}
          counts={{
            notes: Number(notesCount[0]?.n ?? 0),
            posts: Number(postsCount[0]?.n ?? 0),
            sound: Number(soundCount[0]?.n ?? 0),
          }}
        />
      </div>
    </PageTransition>
  );
}
