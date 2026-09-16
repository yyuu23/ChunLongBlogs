"use client";

import { useState } from "react";
import type { AdminStatsPayload } from "@/lib/adminStats";

type Insight = { text: string; generatedAt: string };

export function useStatsDashboard(initial: AdminStatsPayload) {
  const [data, setData] = useState(initial);
  const [range, setRange] = useState(initial.range);
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState("");

  const load = async (nextRange: number) => {
    setRange(nextRange);
    setLoading(true);
    setInsight(null);
    setInsightError("");
    try {
      const response = await fetch(`/api/admin/stats?range=${nextRange}`);
      if (response.ok) setData((await response.json()) as AdminStatsPayload);
    } catch {
      // Keep the last successful snapshot visible when a refresh fails.
    } finally {
      setLoading(false);
    }
  };

  const runInsights = async () => {
    setInsightLoading(true);
    setInsightError("");
    try {
      const response = await fetch("/api/admin/stats/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ range }),
      });
      const result = (await response.json().catch(() => null)) as
        | { text?: string; generatedAt?: string; error?: string }
        | null;
      if (result?.text) {
        setInsight({ text: result.text, generatedAt: result.generatedAt ?? new Date().toISOString() });
      } else {
        setInsightError(result?.error ?? "生成失败，请重试");
      }
    } catch {
      setInsightError("请求失败");
    } finally {
      setInsightLoading(false);
    }
  };

  return {
    data,
    range,
    loading,
    insight,
    insightLoading,
    insightError,
    load,
    runInsights,
    dismissInsight: () => {
      setInsight(null);
      setInsightError("");
    },
  };
}
