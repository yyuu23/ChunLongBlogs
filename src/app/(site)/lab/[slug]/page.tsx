import type { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";
import { PageTransition } from "@/components/effects/PageTransition";
import { DemoShell } from "@/components/lab/demos/registry";
import { labDemoBySlug } from "@/lib/lab/catalog";
import { pick } from "@/lib/i18n/config";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps, parent: ResolvingMetadata): Promise<Metadata> {
  const [{ slug }, { locale }, { alternates }] = await Promise.all([params, getT(), parent]);
  const demo = labDemoBySlug(slug);
  // 页面级 alternates 会整体替换根布局（浅合并），RSS 自动发现的 types 需显式带回
  return {
    title: demo ? pick(locale, demo.name) : "404",
    alternates: { canonical: `/lab/${slug}`, types: alternates?.types ?? undefined },
  };
}

/** 实验台 demo 页：/lab/<slug>（注册表见 lib/lab-demos.ts，无效 slug 404） */
export default async function LabDemoPage({ params }: PageProps) {
  const [{ slug }, { locale }] = await Promise.all([params, getT()]);
  const demo = labDemoBySlug(slug);
  if (!demo) notFound();
  return (
    <PageTransition>
      <div className="mx-auto w-[min(96%,72rem)] pb-8">
        <DemoShell slug={demo.slug} emoji={demo.emoji} title={pick(locale, demo.name)} desc={pick(locale, demo.desc)} />
      </div>
    </PageTransition>
  );
}
