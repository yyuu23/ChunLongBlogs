import type { Metadata } from "next";
import { FlaskConical } from "lucide-react";
import { PageTransition } from "@/components/effects/PageTransition";
import { LabClient } from "@/components/lab/LabClient";

export const metadata: Metadata = { title: "实验室" };

export default function LabPage() {
  return (
    <PageTransition>
      <div className="mx-auto w-[min(96%,72rem)] pb-8">
        <header className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-br-gradient text-white">
            <FlaskConical className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-serif text-3xl font-black">实验室</h1>
            <p className="text-sm text-muted">WebGL 星海 · three.js 实验场</p>
          </div>
        </header>
        <LabClient />
      </div>
    </PageTransition>
  );
}
