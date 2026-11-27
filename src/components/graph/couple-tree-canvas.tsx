"use client";

/**
 * Experimental "Couple blocks" tree view.
 *
 * Each person and their spouse(s) are drawn as one joined block; all children
 * of that block hang from a single drop line beneath it, so full siblings
 * always sit together. Layout is a simple dependency-free tidy tree. It is
 * deliberately independent from the ELK based view so it can be removed
 * without touching it.
 */

import { memo, useMemo } from "react";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  type Edge,
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Sparkles } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { ParentChildLink, Partnership, Person } from "@/db/schema";
import { cn } from "@/lib/utils";

const CARD_W = 210;
const CARD_H = 84;
const SPOUSE_GAP = 24;
const BLOCK_GAP = 40;
const LEVEL_GAP = 110;

interface Block {
  members: string[];
  children: Block[];
  sub: number;
  depth: number;
  centerX: number;
}

interface CardData extends Record<string, unknown> {
  person: Person;
  isClaimedSelf: boolean;
  isSelected: boolean;
  kinshipBadge?: string | null;
  onSelect: (id: string) => void;
}

function initials(name: string) {
  return name
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

function lifespan(p: Person) {
  const b = p.birthYear ? `b. ${p.birthYear}` : "";
  const d = p.deathYear ? `d. ${p.deathYear}` : "";
  if (p.isLiving) return b ? `${b} · Living` : "Living";
  return [b, d].filter(Boolean).join(" – ") || "Deceased";
}

const CardNode = memo(function CardNode({ data }: NodeProps<Node<CardData>>) {
  const { person, isClaimedSelf, isSelected, kinshipBadge, onSelect } = data;
  const accent =
    person.gender === "M"
      ? "bg-sky-500/75"
      : person.gender === "F"
        ? "bg-rose-500/75"
        : "bg-muted-foreground/35";
  return (
    <div
      onClick={() => onSelect(person.id)}
      style={{ width: CARD_W, height: CARD_H }}
      className={cn(
        "relative flex cursor-pointer items-center gap-2.5 rounded-xl border bg-card px-3 shadow-xs transition hover:border-primary/60 hover:shadow-md",
        person.isNameUnknown && "border-dashed",
        isSelected && "border-primary ring-2 ring-primary",
      )}
    >
      <span
        className={cn(
          "absolute inset-x-3 top-0 h-[3px] rounded-b-full",
          accent,
        )}
      />
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <Handle
        type="source"
        id="l"
        position={Position.Left}
        className="!opacity-0"
      />
      <Handle
        type="source"
        id="r"
        position={Position.Right}
        className="!opacity-0"
      />
      <Handle
        type="target"
        id="lt"
        position={Position.Left}
        className="!opacity-0"
      />
      <Avatar className="h-10 w-10 shrink-0">
        <AvatarImage src={person.avatarUrl ?? undefined} alt="" />
        <AvatarFallback className="text-xs font-semibold">
          {person.isNameUnknown ? "?" : initials(person.displayName) || "P"}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-sm font-semibold leading-tight"
          title={person.displayName}
        >
          {person.displayName}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {lifespan(person)}
        </p>
        {isClaimedSelf ? (
          <span className="mt-1 inline-flex items-center gap-0.5 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
            <Sparkles className="h-2.5 w-2.5" /> You
          </span>
        ) : kinshipBadge ? (
          <span className="mt-1 inline-block max-w-full truncate rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
            {kinshipBadge}
          </span>
        ) : null}
      </div>
    </div>
  );
});

const AnchorNode = memo(function AnchorNode() {
  return (
    <div className="h-2 w-2 rounded-full bg-muted-foreground/60">
      <Handle
        type="source"
        position={Position.Bottom}
        className="!opacity-0"
      />
    </div>
  );
});

const nodeTypes = { card: CardNode, anchor: AnchorNode };

function buildLayout(
  persons: Person[],
  partnerships: Partnership[],
  links: ParentChildLink[],
) {
  const byId = new Map(persons.map((p) => [p.id, p]));
  const parentsOf = new Map<string, Set<string>>();
  const childrenOf = new Map<string, Set<string>>();
  for (const l of links) {
    if (!byId.has(l.parentId) || !byId.has(l.childId)) continue;
    (parentsOf.get(l.childId) ?? parentsOf.set(l.childId, new Set()).get(l.childId)!).add(l.parentId);
    (childrenOf.get(l.parentId) ?? childrenOf.set(l.parentId, new Set()).get(l.parentId)!).add(l.childId);
  }
  const partnersOf = new Map<string, { id: string; order: number }[]>();
  for (const u of partnerships) {
    if (!byId.has(u.partner1Id) || !byId.has(u.partner2Id)) continue;
    const add = (a: string, b: string) => {
      const arr = partnersOf.get(a) ?? [];
      arr.push({ id: b, order: u.marriageOrder ?? 1 });
      partnersOf.set(a, arr);
    };
    add(u.partner1Id, u.partner2Id);
    add(u.partner2Id, u.partner1Id);
  }

  const sortKey = (id: string) => {
    const p = byId.get(id)!;
    return [p.siblingOrder ?? 0, p.birthYear ?? 9999] as const;
  };
  const byAge = (a: string, b: string) => {
    const [ao, ay] = sortKey(a);
    const [bo, by] = sortKey(b);
    return ao - bo || ay - by;
  };

  const placed = new Set<string>();
  const build = (id: string, depth: number): Block => {
    const members = [id];
    placed.add(id);
    for (const sp of [...(partnersOf.get(id) ?? [])].sort(
      (a, b) => a.order - b.order,
    )) {
      if (!placed.has(sp.id)) {
        placed.add(sp.id);
        members.push(sp.id);
      }
    }
    const kidIds = new Set<string>();
    for (const m of members) for (const c of childrenOf.get(m) ?? []) kidIds.add(c);
    const children: Block[] = [];
    for (const c of [...kidIds].sort(byAge)) {
      if (!placed.has(c)) children.push(build(c, depth + 1));
    }
    const blockW =
      members.length * CARD_W + (members.length - 1) * SPOUSE_GAP;
    const kidsW = children.length
      ? children.reduce((s, c) => s + c.sub, 0) +
        BLOCK_GAP * (children.length - 1)
      : 0;
    return {
      members,
      children,
      depth,
      sub: Math.max(blockW, kidsW),
      centerX: 0,
    };
  };

  const roots: Block[] = [];
  const order = [...persons].sort(
    (a, b) => +new Date(a.createdAt) - +new Date(b.createdAt),
  );
  for (const p of order) {
    if (!placed.has(p.id) && !(parentsOf.get(p.id)?.size ?? 0)) {
      roots.push(build(p.id, 0));
    }
  }
  for (const p of order) {
    if (!placed.has(p.id)) roots.push(build(p.id, 0));
  }

  const position = (b: Block, x0: number) => {
    b.centerX = x0 + b.sub / 2;
    const kidsW = b.children.length
      ? b.children.reduce((s, c) => s + c.sub, 0) +
        BLOCK_GAP * (b.children.length - 1)
      : 0;
    let cx = x0 + (b.sub - kidsW) / 2;
    for (const c of b.children) {
      position(c, cx);
      cx += c.sub + BLOCK_GAP;
    }
  };
  let x = 0;
  for (const r of roots) {
    position(r, x);
    x += r.sub + BLOCK_GAP * 2;
  }

  const placements: {
    id: string;
    x: number;
    y: number;
    memberIds: string[];
    index: number;
    block: Block;
  }[] = [];
  const walk = (b: Block) => {
    const blockW =
      b.members.length * CARD_W + (b.members.length - 1) * SPOUSE_GAP;
    const left = b.centerX - blockW / 2;
    b.members.forEach((id, i) =>
      placements.push({
        id,
        x: left + i * (CARD_W + SPOUSE_GAP),
        y: b.depth * (CARD_H + LEVEL_GAP),
        memberIds: b.members,
        index: i,
        block: b,
      }),
    );
    b.children.forEach(walk);
  };
  roots.forEach(walk);
  return { placements, roots };
}

interface InnerProps {
  persons: Person[];
  partnerships: Partnership[];
  parentChildLinks: ParentChildLink[];
  claimedPersonId: string | null;
  selectedPersonId: string | null;
  kinshipBadgesById: Map<string, string>;
  onSelectPerson: (personId: string) => void;
}

function Inner({
  persons,
  partnerships,
  parentChildLinks,
  claimedPersonId,
  selectedPersonId,
  kinshipBadgesById,
  onSelectPerson,
}: InnerProps) {
  const { nodes, edges } = useMemo(() => {
    const byId = new Map(persons.map((p) => [p.id, p]));
    const { placements, roots } = buildLayout(
      persons,
      partnerships,
      parentChildLinks,
    );
    const nodes: Node[] = placements.map((pl) => ({
      id: `p:${pl.id}`,
      type: "card",
      position: { x: pl.x, y: pl.y },
      draggable: false,
      data: {
        person: byId.get(pl.id)!,
        isClaimedSelf: claimedPersonId === pl.id,
        isSelected: selectedPersonId === pl.id,
        kinshipBadge: kinshipBadgesById.get(pl.id) ?? null,
        onSelect: onSelectPerson,
      } satisfies CardData,
    }));
    const edges: Edge[] = [];
    const line = {
      stroke: "var(--muted-foreground)",
      strokeOpacity: 0.6,
      strokeWidth: 1.75,
    };
    const visit = (b: Block) => {
      for (let i = 0; i < b.members.length - 1; i++) {
        edges.push({
          id: `m:${b.members[i]}-${b.members[i + 1]}`,
          source: `p:${b.members[i]}`,
          sourceHandle: "r",
          target: `p:${b.members[i + 1]}`,
          targetHandle: "lt",
          type: "straight",
          style: { ...line, stroke: "var(--primary)", strokeOpacity: 0.7 },
        });
      }
      if (b.children.length) {
        const anchorId = `a:${b.members[0]}`;
        nodes.push({
          id: anchorId,
          type: "anchor",
          draggable: false,
          selectable: false,
          position: {
            x: b.centerX - 4,
            y: b.depth * (CARD_H + LEVEL_GAP) + CARD_H - 4,
          },
          data: {},
        });
        for (const c of b.children) {
          edges.push({
            id: `c:${anchorId}-${c.members[0]}`,
            source: anchorId,
            target: `p:${c.members[0]}`,
            type: "smoothstep",
            style: line,
          });
        }
      }
      b.children.forEach(visit);
    };
    roots.forEach(visit);
    return { nodes, edges };
  }, [
    persons,
    partnerships,
    parentChildLinks,
    claimedPersonId,
    selectedPersonId,
    kinshipBadgesById,
    onSelectPerson,
  ]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      nodesDraggable={false}
      nodesConnectable={false}
      fitView
      minZoom={0.1}
      maxZoom={1.5}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={20} />
      <Controls showInteractive={false} />
      <MiniMap pannable zoomable className="!bg-card" />
    </ReactFlow>
  );
}

export function CoupleTreeCanvas(props: InnerProps) {
  return (
    <div className="h-[calc(100vh-3.5rem)] w-full">
      <ReactFlowProvider>
        <Inner {...props} />
      </ReactFlowProvider>
    </div>
  );
}
