import type { DatePrecision } from "@/db/schema";

export interface SimpleParentChildEdge {
  parentId: string;
  childId: string;
}

/**
 * Returns true if adding `proposedParentId -> proposedChildId` would create
 * an ancestor cycle (i.e. `proposedParentId === proposedChildId` or
 * `proposedParentId` is already a descendant of `proposedChildId`).
 */
export function wouldCreateAncestorCycle(
  existingEdges: SimpleParentChildEdge[],
  proposedParentId: string,
  proposedChildId: string,
): boolean {
  if (proposedParentId === proposedChildId) return true;

  const childrenByParent = new Map<string, string[]>();
  for (const edge of existingEdges) {
    const list = childrenByParent.get(edge.parentId) ?? [];
    list.push(edge.childId);
    childrenByParent.set(edge.parentId, list);
  }

  const visited = new Set<string>();
  const queue: string[] = [proposedChildId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === proposedParentId) {
      return true;
    }
    if (visited.has(current)) continue;
    visited.add(current);

    for (const nextChild of childrenByParent.get(current) ?? []) {
      if (!visited.has(nextChild)) {
        queue.push(nextChild);
      }
    }
  }

  return false;
}

export function formatFuzzyDate(params: {
  precision: DatePrecision;
  date?: string | null;
  year?: number | null;
  text?: string | null;
}): string | null {
  if (params.text?.trim()) return params.text.trim();
  if (params.precision === "exact" && params.date) return params.date;
  if (params.precision === "approx" && params.year) return `~${params.year}`;
  if (params.year) return String(params.year);
  return null;
}

export function slugifyTreeName(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base || "family-tree";
}
