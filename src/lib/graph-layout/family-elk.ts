import ELK, { type ElkExtendedEdge, type ElkNode } from "elkjs/lib/elk.bundled.js";
import type { Edge, Node } from "@xyflow/react";

import type { ParentChildLink, Partnership, Person } from "@/db/schema";
import { formatFuzzyDate } from "@/lib/genealogy/dag";

const elk = new ELK();

export const PERSON_NODE_WIDTH = 236;
export const PERSON_NODE_HEIGHT = 92;
export const UNION_NODE_WIDTH = 52;
export const UNION_NODE_HEIGHT = 28;

export interface PersonNodeData extends Record<string, unknown> {
  person: Person;
  lifespanLabel: string;
  kinshipBadge?: string | null;
  isClaimedSelf: boolean;
  isFocused: boolean;
  isHighlighted: boolean;
  canEdit: boolean;
  onSelectPerson: (personId: string) => void;
  onQuickAdd?: (
    personId: string,
    relation: "father" | "mother" | "spouse" | "child" | "sibling",
  ) => void;
}

export interface UnionNodeData extends Record<string, unknown> {
  partnership: Partnership;
  childCount: number;
  isCollapsed: boolean;
  isHighlighted: boolean;
  onToggleCollapse: (unionId: string) => void;
}

export type FamilyGraphNode =
  | Node<PersonNodeData, "person">
  | Node<UnionNodeData, "union">;

export function computeHourglassPersonIds(params: {
  focusPersonId: string;
  persons: Person[];
  partnerships: Partnership[];
  parentChildLinks: ParentChildLink[];
}): Set<string> {
  const { focusPersonId, partnerships, parentChildLinks } = params;
  const visible = new Set<string>([focusPersonId]);

  const parentsOf = new Map<string, string[]>();
  const childrenOf = new Map<string, string[]>();
  for (const link of parentChildLinks) {
    const pList = parentsOf.get(link.childId) ?? [];
    pList.push(link.parentId);
    parentsOf.set(link.childId, pList);

    const cList = childrenOf.get(link.parentId) ?? [];
    cList.push(link.childId);
    childrenOf.set(link.parentId, cList);
  }

  const spousesOf = new Map<string, string[]>();
  for (const u of partnerships) {
    const l1 = spousesOf.get(u.partner1Id) ?? [];
    l1.push(u.partner2Id);
    spousesOf.set(u.partner1Id, l1);

    const l2 = spousesOf.get(u.partner2Id) ?? [];
    l2.push(u.partner1Id);
    spousesOf.set(u.partner2Id, l2);
  }

  // Upward ancestors
  const upQueue = [focusPersonId];
  while (upQueue.length > 0) {
    const curr = upQueue.shift()!;
    for (const parentId of parentsOf.get(curr) ?? []) {
      if (!visible.has(parentId)) {
        visible.add(parentId);
        upQueue.push(parentId);
      }
    }
  }

  // Immediate siblings of focus person
  for (const pId of parentsOf.get(focusPersonId) ?? []) {
    for (const sibId of childrenOf.get(pId) ?? []) {
      visible.add(sibId);
    }
  }

  // Downward descendants + spouses of focus & descendants
  const downQueue = [focusPersonId];
  const visitedDown = new Set<string>([focusPersonId]);
  while (downQueue.length > 0) {
    const curr = downQueue.shift()!;
    for (const spId of spousesOf.get(curr) ?? []) {
      visible.add(spId);
    }
    for (const childId of childrenOf.get(curr) ?? []) {
      visible.add(childId);
      if (!visitedDown.has(childId)) {
        visitedDown.add(childId);
        downQueue.push(childId);
      }
    }
  }

  return visible;
}

function getLifespanLabel(person: Person): string {
  const birth = formatFuzzyDate({
    precision: person.birthDatePrecision,
    date: person.birthDate,
    year: person.birthYear,
    text: person.birthDateText,
  });
  const death = formatFuzzyDate({
    precision: person.deathDatePrecision,
    date: person.deathDate,
    year: person.deathYear,
    text: person.deathDateText,
  });

  const bShort = birth ? (person.birthYear ? String(person.birthYear) : birth) : null;
  const dShort = death ? (person.deathYear ? String(person.deathYear) : death) : null;

  if (bShort && dShort) return `${bShort} – ${dShort}`;
  if (bShort && person.isLiving) return `b. ${bShort} · Living`;
  if (bShort && !person.isLiving) return `b. ${bShort} · Deceased`;
  if (dShort) return `d. ${dShort}`;
  return person.isLiving ? "Living" : "Deceased";
}

export async function buildLayoutedFamilyGraph(params: {
  persons: Person[];
  partnerships: Partnership[];
  parentChildLinks: ParentChildLink[];
  focusPersonId?: string | null;
  hourglassMode: boolean;
  collapsedUnionIds: Set<string>;
  highlightedPersonIds: Set<string>;
  claimedPersonId: string | null;
  kinshipBadgesById: Map<string, string>;
  canEdit: boolean;
  onSelectPerson: (personId: string) => void;
  onQuickAdd?: (
    personId: string,
    relation: "father" | "mother" | "spouse" | "child" | "sibling",
  ) => void;
  onToggleCollapse: (unionId: string) => void;
}): Promise<{ nodes: FamilyGraphNode[]; edges: Edge[] }> {
  const {
    persons,
    partnerships,
    parentChildLinks,
    focusPersonId,
    hourglassMode,
    collapsedUnionIds,
    highlightedPersonIds,
    claimedPersonId,
    kinshipBadgesById,
    canEdit,
    onSelectPerson,
    onQuickAdd,
    onToggleCollapse,
  } = params;

  let allowedIds = new Set(persons.map((p) => p.id));
  if (hourglassMode && focusPersonId && allowedIds.has(focusPersonId)) {
    allowedIds = computeHourglassPersonIds({
      focusPersonId,
      persons,
      partnerships,
      parentChildLinks,
    });
  }

  // Filter out descendants strictly beneath collapsed unions
  if (collapsedUnionIds.size > 0) {
    const hiddenChildrenQueue: string[] = [];
    const childrenByParent = new Map<string, string[]>();
    for (const l of parentChildLinks) {
      const arr = childrenByParent.get(l.parentId) ?? [];
      arr.push(l.childId);
      childrenByParent.set(l.parentId, arr);
      if (l.partnershipId && collapsedUnionIds.has(l.partnershipId)) {
        hiddenChildrenQueue.push(l.childId);
      }
    }

    const hiddenSet = new Set<string>();
    while (hiddenChildrenQueue.length > 0) {
      const cid = hiddenChildrenQueue.shift()!;
      if (hiddenSet.has(cid)) continue;
      hiddenSet.add(cid);
      for (const grandChild of childrenByParent.get(cid) ?? []) {
        hiddenChildrenQueue.push(grandChild);
      }
    }
    for (const hid of hiddenSet) {
      allowedIds.delete(hid);
    }
  }

  const visiblePersons = persons.filter((p) => allowedIds.has(p.id));
  const visiblePersonIds = new Set(visiblePersons.map((p) => p.id));

  const visiblePartnerships = partnerships.filter(
    (u) =>
      visiblePersonIds.has(u.partner1Id) && visiblePersonIds.has(u.partner2Id),
  );
  const visibleUnionIds = new Set(visiblePartnerships.map((u) => u.id));

  // Count total children per union (before collapse hiding) so collapsed badge shows count
  const totalChildrenByUnion = new Map<string, Set<string>>();
  for (const l of parentChildLinks) {
    if (l.partnershipId) {
      const set = totalChildrenByUnion.get(l.partnershipId) ?? new Set();
      set.add(l.childId);
      totalChildrenByUnion.set(l.partnershipId, set);
    }
  }

  const rfNodes: FamilyGraphNode[] = [];
  const rfEdges: Edge[] = [];
  const elkChildren: ElkNode[] = [];
  const elkEdges: ElkExtendedEdge[] = [];

  for (const person of visiblePersons) {
    const nodeId = `person:${person.id}`;
    const isHighlighted = highlightedPersonIds.has(person.id);

    rfNodes.push({
      id: nodeId,
      type: "person",
      position: { x: 0, y: 0 },
      data: {
        person,
        lifespanLabel: getLifespanLabel(person),
        kinshipBadge: kinshipBadgesById.get(person.id) ?? null,
        isClaimedSelf: claimedPersonId === person.id,
        isFocused: focusPersonId === person.id,
        isHighlighted,
        canEdit,
        onSelectPerson,
        onQuickAdd,
      },
    });

    elkChildren.push({
      id: nodeId,
      width: PERSON_NODE_WIDTH,
      height: PERSON_NODE_HEIGHT,
    });
  }

  for (const union of visiblePartnerships) {
    const unionNodeId = `union:${union.id}`;
    const childCount = totalChildrenByUnion.get(union.id)?.size ?? 0;
    const isHighlighted =
      highlightedPersonIds.has(union.partner1Id) &&
      highlightedPersonIds.has(union.partner2Id);

    rfNodes.push({
      id: unionNodeId,
      type: "union",
      position: { x: 0, y: 0 },
      data: {
        partnership: union,
        childCount,
        isCollapsed: collapsedUnionIds.has(union.id),
        isHighlighted,
        onToggleCollapse,
      },
    });

    elkChildren.push({
      id: unionNodeId,
      width: UNION_NODE_WIDTH,
      height: UNION_NODE_HEIGHT,
    });

    const p1Node = `person:${union.partner1Id}`;
    const p2Node = `person:${union.partner2Id}`;

    for (const [idx, partnerNodeId] of [p1Node, p2Node].entries()) {
      const edgeId = `e-partner-${union.id}-${idx}`;
      rfEdges.push({
        id: edgeId,
        source: partnerNodeId,
        target: unionNodeId,
        type: "smoothstep",
        animated: false,
        style: {
          stroke: isHighlighted
            ? "var(--primary)"
            : union.status === "divorced"
              ? "var(--destructive)"
              : "var(--muted-foreground)",
          strokeWidth: isHighlighted ? 2.5 : 1.75,
          strokeDasharray:
            union.status === "divorced" || union.status === "separated"
              ? "5 4"
              : undefined,
        },
      });
      elkEdges.push({
        id: edgeId,
        sources: [partnerNodeId],
        targets: [unionNodeId],
      });
    }
  }

  // Deduplicate union -> child edges so a child with 2 parents in the same visible union gets ONE clean line from the union!
  const emittedUnionChildPairs = new Set<string>();

  // Sort links by child's siblingOrder so ELK respects birth order left-to-right
  const personMap = new Map(visiblePersons.map((p) => [p.id, p]));
  const sortedLinks = [...parentChildLinks]
    .filter(
      (l) =>
        visiblePersonIds.has(l.parentId) && visiblePersonIds.has(l.childId),
    )
    .sort((a, b) => {
      const ca = personMap.get(a.childId);
      const cb = personMap.get(b.childId);
      return (ca?.siblingOrder ?? 0) - (cb?.siblingOrder ?? 0);
    });

  for (const link of sortedLinks) {
    const childNodeId = `person:${link.childId}`;
    const isNonBio = link.lineageType !== "biological";

    if (link.partnershipId && visibleUnionIds.has(link.partnershipId)) {
      const key = `${link.partnershipId}->${link.childId}`;
      if (emittedUnionChildPairs.has(key)) continue;
      emittedUnionChildPairs.add(key);

      const unionNodeId = `union:${link.partnershipId}`;
      const union = visiblePartnerships.find((u) => u.id === link.partnershipId);
      const isHighlighted =
        highlightedPersonIds.has(link.childId) &&
        Boolean(
          union &&
            (highlightedPersonIds.has(union.partner1Id) ||
              highlightedPersonIds.has(union.partner2Id)),
        );

      const edgeId = `e-union-child-${link.partnershipId}-${link.childId}`;
      rfEdges.push({
        id: edgeId,
        source: unionNodeId,
        target: childNodeId,
        type: "smoothstep",
        animated: isHighlighted,
        label: isNonBio ? link.lineageType : undefined,
        style: {
          stroke: isHighlighted ? "var(--primary)" : "var(--border)",
          strokeWidth: isHighlighted ? 2.75 : 1.75,
          strokeDasharray: isNonBio ? "4 4" : undefined,
        },
      });
      elkEdges.push({
        id: edgeId,
        sources: [unionNodeId],
        targets: [childNodeId],
      });
    } else {
      // Single known parent or other parent hidden -> connect directly Parent -> Child
      const parentNodeId = `person:${link.parentId}`;
      const isHighlighted =
        highlightedPersonIds.has(link.parentId) &&
        highlightedPersonIds.has(link.childId);
      const edgeId = `e-parent-child-${link.id}`;

      rfEdges.push({
        id: edgeId,
        source: parentNodeId,
        target: childNodeId,
        type: "smoothstep",
        animated: isHighlighted,
        label: isNonBio ? link.lineageType : undefined,
        style: {
          stroke: isHighlighted ? "var(--primary)" : "var(--muted-foreground)",
          strokeOpacity: isHighlighted ? 1 : 0.55,
          strokeWidth: isHighlighted ? 2.75 : 1.6,
          strokeDasharray: isNonBio ? "4 4" : undefined,
        },
      });
      elkEdges.push({
        id: edgeId,
        sources: [parentNodeId],
        targets: [childNodeId],
      });
    }
  }

  if (elkChildren.length === 0) {
    return { nodes: [], edges: [] };
  }

  const layouted = await elk.layout({
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "DOWN",
      "elk.layered.spacing.nodeNodeBetweenLayers": "68",
      "elk.spacing.nodeNode": "34",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
      "elk.separateConnectedComponents": "true",
      "elk.spacing.componentComponent": "90",
    },
    children: elkChildren,
    edges: elkEdges,
  });

  const posById = new Map<string, { x: number; y: number }>();
  for (const child of layouted.children ?? []) {
    posById.set(child.id, { x: child.x ?? 0, y: child.y ?? 0 });
  }

  const positionedNodes = rfNodes.map((node) => ({
    ...node,
    position: posById.get(node.id) ?? { x: 0, y: 0 },
  }));

  return { nodes: positionedNodes, edges: rfEdges };
}
