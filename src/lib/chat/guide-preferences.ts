import type { GuidePreferences } from "@/lib/content/types";

const STORAGE_KEY = "cl-guide-preferences";
const MAX_AGE = 30 * 24 * 60 * 60 * 1000;

function sanitize(value: unknown): GuidePreferences | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<GuidePreferences>;
  if (typeof raw.expiresAt !== "number" || raw.expiresAt <= Date.now()) return null;
  const level = ["beginner", "intermediate", "advanced"].includes(raw.level ?? "")
    ? raw.level
    : undefined;
  return {
    interests: Array.isArray(raw.interests)
      ? raw.interests.filter((item): item is string => typeof item === "string" && !!item.trim()).slice(0, 6)
      : [],
    level,
    goal: typeof raw.goal === "string" ? raw.goal.trim().slice(0, 120) : undefined,
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : Date.now(),
    expiresAt: raw.expiresAt,
  };
}

export function readGuidePreferences(): GuidePreferences | null {
  if (typeof window === "undefined") return null;
  try {
    const value = sanitize(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"));
    if (!value) localStorage.removeItem(STORAGE_KEY);
    return value;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function saveGuidePreferences(input: Pick<GuidePreferences, "interests" | "level" | "goal">) {
  const now = Date.now();
  const value = sanitize({ ...input, updatedAt: now, expiresAt: now + MAX_AGE });
  if (value && typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  return value;
}

export function clearGuidePreferences() {
  if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
}
