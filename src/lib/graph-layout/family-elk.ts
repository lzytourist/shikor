import ELK, {
  type ElkExtendedEdge,
  type ElkNode,
} from "elkjs/lib/elk.bundled.js";
import type { Edge, Node } from "@xyflow/react";

import type { ParentChildLink, Partnership, Person } from "@/db/schema";
import { formatFuzzyDate } from "@/lib/genealogy/dag";

const elk = new ELK();

export const PERSON_NODE_WIDTH = 236;
export const PERSON_NODE_HEIGHT = 92;
export const UNION_NODE_WIDTH = 56;
export const UNION_NODE_HEIGHT = 28;

export interface EdgeSpotlightPayload {
  key: string;
  summary: string;
  personIds: string[];
  unionIds: string[];
  edgeIds: string[];
}

export interface FamilyEdgeData extends Record<string, unknown> {
  kind: "partner-union" | "union-child" | "parent-child";
  spotlight: EdgeSpotlightPayload;
  baseStroke: string;
  baseStrokeWidth: number;
  baseStrokeOpacity?: number;
  baseDasharray?: string;
}

export interface PersonNodeData extends Record<string, unknown> {
  person: Person;
  lifespanLabel: string;
  kinshipBadge?: string | null;
  isClaimedSelf: boolean;
  isFocused: boolean;
  isPairAnchor: boolean;
  isHighlighted: boolean;
  isDimmed: boolean;
  canEdit: boolean;
  onSelectPerson: (personId: string) => void;
  onCtrlSelectPerson?: (personId: string) => void;
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
  isDimmed: boolean;
  spotlight: EdgeSpotlightPayload;
  onToggleCollapse: (unionId: string) => void;
  onSelectUnion?: (spotlight: EdgeSpotlightPayload) => void;
}

export type FamilyGraphNode =
  | Node<PersonNodeData, "person">
  | Node<UnionNodeData, "union">;

export type FamilyGraphEdge = Edge<FamilyEdgeData>;

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

  const bShort = birth
    ? person.birthYear
      ? String(person.birthYear)
      : birth
    : null;
  const dShort = death
    ? person.deathYear
      ? String(person.deathYear)
      : death
    : null;

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
  highlightedPersonIds?: Set<string>;
  claimedPersonId: string | null;
  kinshipBadgesById: Map<string, string>;
  canEdit: boolean;
  onSelectPerson: (personId: string) => void;
  onCtrlSelectPerson?: (personId: string) => void;
  onQuickAdd?: (
    personId: string,
    relation: "father" | "mother" | "spouse" | "child" | "sibling",
  ) => void;
  onToggleCollapse: (unionId: string) => void;
  onSelectUnion?: (spotlight: EdgeSpotlightPayload) => void;
}): Promise<{ nodes: FamilyGraphNode[]; edges: FamilyGraphEdge[] }> {
  const {
    persons,
    partnerships,
    parentChildLinks,
    focusPersonId,
    hourglassMode,
    collapsedUnionIds,
    claimedPersonId,
    kinshipBadgesById,
    canEdit,
    onSelectPerson,
    onCtrlSelectPerson,
    onQuickAdd,
    onToggleCollapse,
    onSelectUnion,
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
  const personMap = new Map(visiblePersons.map((p) => [p.id, p]));

  const visiblePartnerships = partnerships.filter(
    (u) =>
      visiblePersonIds.has(u.partner1Id) && visiblePersonIds.has(u.partner2Id),
  );
  const visibleUnionIds = new Set(visiblePartnerships.map((u) => u.id));

  // Count total children per union (before collapse hiding) & visible children per union
  const totalChildrenByUnion = new Map<string, Set<string>>();
  const visibleChildrenByUnion = new Map<string, Set<string>>();
  for (const l of parentChildLinks) {
    if (l.partnershipId) {
      const totalSet = totalChildrenByUnion.get(l.partnershipId) ?? new Set();
      totalSet.add(l.childId);
      totalChildrenByUnion.set(l.partnershipId, totalSet);

      if (visiblePersonIds.has(l.childId)) {
        const visSet = visibleChildrenByUnion.get(l.partnershipId) ?? new Set();
        visSet.add(l.childId);
        visibleChildrenByUnion.set(l.partnershipId, visSet);
      }
    }
  }

  const rfNodes: FamilyGraphNode[] = [];
  const rfEdges: FamilyGraphEdge[] = [];
  const elkChildren: ElkNode[] = [];
  const elkEdges: ElkExtendedEdge[] = [];

  for (const person of visiblePersons) {
    const nodeId = `person:${person.id}`;

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
        isPairAnchor: false,
        isHighlighted: false,
        isDimmed: false,
        canEdit,
        onSelectPerson,
        onCtrlSelectPerson,
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
    const visChildren = [...(visibleChildrenByUnion.get(union.id) ?? [])];

    const p1 = personMap.get(union.partner1Id);
    const p2 = personMap.get(union.partner2Id);
    const p1Name = p1?.displayName ?? "Partner 1";
    const p2Name = p2?.displayName ?? "Partner 2";

    const partnerEdge0 = `e-partner-${union.id}-0`;
    const partnerEdge1 = `e-partner-${union.id}-1`;
    const childEdgeIds = visChildren.map(
      (cid) => `e-union-child-${union.id}-${cid}`,
    );

    const unionFamilySpotlight: EdgeSpotlightPayload = {
      key: `union-family:${union.id}`,
      summary:
        visChildren.length > 0
          ? `${p1Name} + ${p2Name} (${visChildren.length} ${visChildren.length === 1 ? "child" : "children"})`
          : `${p1Name} + ${p2Name} (${union.status})`,
      personIds: [union.partner1Id, union.partner2Id, ...visChildren],
      unionIds: [union.id],
      edgeIds: [partnerEdge0, partnerEdge1, ...childEdgeIds],
    };

    rfNodes.push({
      id: unionNodeId,
      type: "union",
      position: { x: 0, y: 0 },
      data: {
        partnership: union,
        childCount,
        isCollapsed: collapsedUnionIds.has(union.id),
        isHighlighted: false,
        isDimmed: false,
        spotlight: unionFamilySpotlight,
        onToggleCollapse,
        onSelectUnion,
      },
    });

    elkChildren.push({
      id: unionNodeId,
      width: UNION_NODE_WIDTH,
      height: UNION_NODE_HEIGHT,
    });

    const p1Node = `person:${union.partner1Id}`;
    const p2Node = `person:${union.partner2Id}`;

    const coupleSpotlight: EdgeSpotlightPayload = {
      key: `couple:${union.id}`,
      summary: `${p1Name} + ${p2Name} (${union.status})`,
      personIds: [union.partner1Id, union.partner2Id],
      unionIds: [union.id],
      edgeIds: [partnerEdge0, partnerEdge1],
    };

    const baseStroke =
      union.status === "divorced"
        ? "var(--destructive)"
        : "var(--muted-foreground)";
    const baseDasharray =
      union.status === "divorced" || union.status === "separated"
        ? "5 4"
        : undefined;

    for (const [idx, partnerNodeId] of [p1Node, p2Node].entries()) {
      const edgeId = `e-partner-${union.id}-${idx}`;
      rfEdges.push({
        id: edgeId,
        source: partnerNodeId,
        target: unionNodeId,
        type: "smoothstep",
        interactionWidth: 22,
        className: "cursor-pointer",
        data: {
          kind: "partner-union",
          spotlight: coupleSpotlight,
          baseStroke,
          baseStrokeWidth: 1.75,
          baseDasharray,
        },
        style: {
          stroke: baseStroke,
          strokeWidth: 1.75,
          strokeDasharray: baseDasharray,
        },
      });
      elkEdges.push({
        id: edgeId,
        sources: [partnerNodeId],
        targets: [unionNodeId],
      });
    }
  }

  const emittedUnionChildPairs = new Set<string>();
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
    const childName = personMap.get(link.childId)?.displayName ?? "Child";
    const isNonBio = link.lineageType !== "biological";
    const baseDasharray = isNonBio ? "4 4" : undefined;

    if (link.partnershipId && visibleUnionIds.has(link.partnershipId)) {
      const key = `${link.partnershipId}->${link.childId}`;
      if (emittedUnionChildPairs.has(key)) continue;
      emittedUnionChildPairs.add(key);

      const unionNodeId = `union:${link.partnershipId}`;
      const union = visiblePartnerships.find(
        (u) => u.id === link.partnershipId,
      )!;
      const p1Name = personMap.get(union.partner1Id)?.displayName ?? "Parent 1";
      const p2Name = personMap.get(union.partner2Id)?.displayName ?? "Parent 2";

      const edgeId = `e-union-child-${link.partnershipId}-${link.childId}`;
      const spotlight: EdgeSpotlightPayload = {
        key: edgeId,
        summary: `${p1Name} + ${p2Name} → ${childName}`,
        personIds: [union.partner1Id, union.partner2Id, link.childId],
        unionIds: [union.id],
        edgeIds: [
          `e-partner-${union.id}-0`,
          `e-partner-${union.id}-1`,
          edgeId,
        ],
      };

      rfEdges.push({
        id: edgeId,
        source: unionNodeId,
        target: childNodeId,
        type: "smoothstep",
        interactionWidth: 22,
        className: "cursor-pointer",
        label: isNonBio ? link.lineageType : undefined,
        data: {
          kind: "union-child",
          spotlight,
          baseStroke: "var(--muted-foreground)",
          baseStrokeWidth: 1.75,
          baseStrokeOpacity: 0.55,
          baseDasharray,
        },
        style: {
          stroke: "var(--muted-foreground)",
          strokeOpacity: 0.55,
          strokeWidth: 1.75,
          strokeDasharray: baseDasharray,
        },
      });
      elkEdges.push({
        id: edgeId,
        sources: [unionNodeId],
        targets: [childNodeId],
      });
    } else {
      const parentNodeId = `person:${link.parentId}`;
      const parentName = personMap.get(link.parentId)?.displayName ?? "Parent";
      const edgeId = `e-parent-child-${link.id}`;

      const spotlight: EdgeSpotlightPayload = {
        key: edgeId,
        summary: `${parentName} → ${childName}`,
        personIds: [link.parentId, link.childId],
        unionIds: [],
        edgeIds: [edgeId],
      };

      rfEdges.push({
        id: edgeId,
        source: parentNodeId,
        target: childNodeId,
        type: "smoothstep",
        interactionWidth: 22,
        className: "cursor-pointer",
        label: isNonBio ? link.lineageType : undefined,
        data: {
          kind: "parent-child",
          spotlight,
          baseStroke: "var(--muted-foreground)",
          baseStrokeWidth: 1.65,
          baseStrokeOpacity: 0.55,
          baseDasharray,
        },
        style: {
          stroke: "var(--muted-foreground)",
          strokeOpacity: 0.55,
          strokeWidth: 1.65,
          strokeDasharray: baseDasharray,
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
