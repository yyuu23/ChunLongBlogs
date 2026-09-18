export function mergeBottleOrder<T extends { id: number }>(
  items: T[],
  storedOrder: number[] | null,
) {
  const byId = new Map(items.map((item) => [item.id, item]));
  const timeline = [...items].reverse();
  if (!storedOrder) return timeline;
  const stored = storedOrder.map((id) => byId.get(id)).filter((item): item is T => !!item);
  const storedIds = new Set(stored.map((item) => item.id));
  return [...stored, ...timeline.filter((item) => !storedIds.has(item.id))];
}

export function reorderBottleIds(
  ids: number[],
  id: number,
  targetId: number,
  mode: "before" | "after",
) {
  if (id === targetId) return ids;
  const next = [...ids];
  const from = next.indexOf(id);
  const target = next.indexOf(targetId);
  if (from < 0 || target < 0) return ids;
  next.splice(from, 1);
  const insertAt = next.indexOf(targetId) + (mode === "after" ? 1 : 0);
  next.splice(insertAt, 0, id);
  return next;
}
