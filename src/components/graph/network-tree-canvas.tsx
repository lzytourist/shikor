"use client";

/**
 * Experimental force-directed "Network" view. People are circles, parent→child
 * links are solid lines, partnerships are dashed pink lines. A gentle
 * generation bias keeps ancestors above descendants so it still reads like a
 * tree. Dependency-free: tiny physics simulation + SVG, pan/zoom/drag built in.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ParentChildLink, Partnership, Person } from "@/db/schema";
import { cn } from "@/lib/utils";

interface Props {
  persons: Person[];
  partnerships: Partnership[];
  parentChildLinks: ParentChildLink[];
  claimedPersonId: string | null;
  selectedPersonId: string | null;
  onSelectPerson: (personId: string) => void;
}

interface Sim {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  depth: number;
  fixed: boolean;
}

const LEVEL_H = 130;

function initials(name: string) {
  return (
    name
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?"
  );
}

function computeDepths(
  persons: Person[],
  partnerships: Partnership[],
  links: ParentChildLink[],
) {
  const depth = new Map(persons.map((p) => [p.id, 0]));
  for (let iter = 0; iter < persons.length + 2; iter++) {
    let changed = false;
    for (const l of links) {
      const d = (depth.get(l.parentId) ?? 0) + 1;
      if (depth.has(l.childId) && d > (depth.get(l.childId) ?? 0) && d < 60) {
        depth.set(l.childId, d);
        changed = true;
      }
    }
    for (const u of partnerships) {
      const a = depth.get(u.partner1Id);
      const b = depth.get(u.partner2Id);
      if (a === undefined || b === undefined || a === b) continue;
      const m = Math.max(a, b);
      depth.set(u.partner1Id, m);
      depth.set(u.partner2Id, m);
      changed = true;
    }
    if (!changed) break;
  }
  return depth;
}

export function NetworkTreeCanvas({
  persons,
  partnerships,
  parentChildLinks,
  claimedPersonId,
  selectedPersonId,
  onSelectPerson,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<Map<string, Sim>>(new Map());
  const alphaRef = useRef(1);
  const rafRef = useRef<number | null>(null);
  const [snap, setSnap] = useState<Map<string, { x: number; y: number }>>(
    () => new Map(),
  );
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const byId = useMemo(() => new Map(persons.map((p) => [p.id, p])), [persons]);

  const links = useMemo(
    () =>
      parentChildLinks.filter(
        (l) => byId.has(l.parentId) && byId.has(l.childId),
      ),
    [parentChildLinks, byId],
  );
  const unions = useMemo(
    () =>
      partnerships.filter((u) => byId.has(u.partner1Id) && byId.has(u.partner2Id)),
    [partnerships, byId],
  );

  const neighbors = useMemo(() => {
    const m = new Map<string, Set<string>>();
    const add = (a: string, b: string) => {
      (m.get(a) ?? m.set(a, new Set()).get(a)!).add(b);
      (m.get(b) ?? m.set(b, new Set()).get(b)!).add(a);
    };
    links.forEach((l) => add(l.parentId, l.childId));
    unions.forEach((u) => add(u.partner1Id, u.partner2Id));
    return m;
  }, [links, unions]);

  const kick = useCallback((alpha = 0.6) => {
    alphaRef.current = Math.max(alphaRef.current, alpha);
    if (rafRef.current !== null) return;
    const step = () => {
      const nodes = [...simRef.current.values()];
      const a = alphaRef.current;
      const centerX = 0;
      // repulsion
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const n1 = nodes[i];
          const n2 = nodes[j];
          let dx = n2.x - n1.x;
          let dy = n2.y - n1.y;
          let d2 = dx * dx + dy * dy;
          if (d2 > 90000) continue;
          if (d2 < 1) {
            dx = Math.random() - 0.5;
            dy = Math.random() - 0.5;
            d2 = 1;
          }
          const d = Math.sqrt(d2);
          const f = (3200 / d2) * a;
          const fx = (dx / d) * f;
          const fy = (dy / d) * f;
          n1.vx -= fx;
          n1.vy -= fy;
          n2.vx += fx;
          n2.vy += fy;
        }
      }
      const spring = (aId: string, bId: string, len: number, k: number) => {
        const s = simRef.current.get(aId);
        const t = simRef.current.get(bId);
        if (!s || !t) return;
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const f = (d - len) * k * a;
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        s.vx += fx;
        s.vy += fy;
        t.vx -= fx;
        t.vy -= fy;
      };
      links.forEach((l) => spring(l.parentId, l.childId, 110, 0.06));
      unions.forEach((u) => spring(u.partner1Id, u.partner2Id, 80, 0.12));
      for (const n of nodes) {
        if (n.fixed) {
          n.vx = 0;
          n.vy = 0;
          continue;
        }
        // generation bias keeps ancestors on top; weak pull to centre
        n.vy += (n.depth * LEVEL_H - n.y) * 0.08 * a;
        n.vx += (centerX - n.x) * 0.002 * a;
        n.vx *= 0.82;
        n.vy *= 0.82;
        n.x += n.vx;
        n.y += n.vy;
      }
      alphaRef.current *= 0.985;
      setSnap(
        new Map(nodes.map((n) => [n.id, { x: n.x, y: n.y }] as const)),
      );
      if (alphaRef.current > 0.02) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(step);
  }, [links, unions]);

  // (Re)seed simulation when data changes, keeping known positions.
  useEffect(() => {
    const depth = computeDepths(persons, partnerships, parentChildLinks);
    const old = simRef.current;
    const next = new Map<string, Sim>();
    const perDepth = new Map<number, number>();
    for (const p of persons) {
      const d = depth.get(p.id) ?? 0;
      const idx = perDepth.get(d) ?? 0;
      perDepth.set(d, idx + 1);
      const prev = old.get(p.id);
      next.set(p.id, {
        id: p.id,
        x: prev?.x ?? idx * 90 - 200 + Math.random() * 20,
        y: prev?.y ?? d * LEVEL_H + Math.random() * 20,
        vx: 0,
        vy: 0,
        depth: d,
        fixed: false,
      });
    }
    simRef.current = next;
    kick(1);
    const el = wrapRef.current;
    if (el && old.size === 0) {
      setView({ x: el.clientWidth / 2, y: 80, k: 0.9 });
    }
  }, [persons, partnerships, parentChildLinks, kick]);

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    },
    [],
  );

  // Pan & zoom
  const panRef = useRef<{ sx: number; sy: number; vx: number; vy: number } | null>(
    null,
  );
  const dragRef = useRef<{ id: string; moved: boolean } | null>(null);

  const toWorld = (clientX: number, clientY: number) => {
    const rect = wrapRef.current!.getBoundingClientRect();
    const v = viewRef.current;
    return {
      x: (clientX - rect.left - v.x) / v.k,
      y: (clientY - rect.top - v.y) / v.k,
    };
  };

  const onWheel = (e: React.WheelEvent) => {
    const rect = wrapRef.current!.getBoundingClientRect();
    const v = viewRef.current;
    const k = Math.min(2.5, Math.max(0.15, v.k * (e.deltaY < 0 ? 1.1 : 0.9)));
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setView({
      k,
      x: mx - ((mx - v.x) / v.k) * k,
      y: my - ((my - v.y) / v.k) * k,
    });
  };

  const onPointerDown = (e: React.PointerEvent, nodeId?: string) => {
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    if (nodeId) {
      e.stopPropagation();
      dragRef.current = { id: nodeId, moved: false };
      const n = simRef.current.get(nodeId);
      if (n) n.fixed = true;
    } else {
      panRef.current = {
        sx: e.clientX,
        sy: e.clientY,
        vx: viewRef.current.x,
        vy: viewRef.current.y,
      };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (dragRef.current) {
      const n = simRef.current.get(dragRef.current.id);
      if (n) {
        const w = toWorld(e.clientX, e.clientY);
        n.x = w.x;
        n.y = w.y;
        dragRef.current.moved = true;
        kick(0.4);
      }
    } else if (panRef.current) {
      const p = panRef.current;
      setView((v) => ({
        ...v,
        x: p.vx + e.clientX - p.sx,
        y: p.vy + e.clientY - p.sy,
      }));
    }
  };

  const onPointerUp = () => {
    if (dragRef.current) {
      const { id, moved } = dragRef.current;
      const n = simRef.current.get(id);
      if (n) n.fixed = false;
      if (!moved) onSelectPerson(id);
      dragRef.current = null;
    }
    panRef.current = null;
  };

  const focusId = hoverId ?? selectedPersonId;
  const focusSet = focusId
    ? new Set([focusId, ...(neighbors.get(focusId) ?? [])])
    : null;

  const pos = (id: string) => snap.get(id);

  return (
    <div
      ref={wrapRef}
      className="relative h-[calc(100vh-3.5rem)] w-full touch-none overflow-hidden bg-muted/20 dark:bg-background"
      onWheel={onWheel}
    >
      <svg
        className="h-full w-full cursor-grab active:cursor-grabbing"
        onPointerDown={(e) => onPointerDown(e)}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {links.map((l) => {
            const a = pos(l.parentId);
            const b = pos(l.childId);
            if (!a || !b) return null;
            const dim =
              focusSet && !(focusSet.has(l.parentId) && focusSet.has(l.childId));
            return (
              <line
                key={l.id}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="var(--muted-foreground)"
                strokeWidth={1.8}
                strokeDasharray={l.lineageType === "biological" ? undefined : "4 4"}
                opacity={dim ? 0.12 : 0.6}
              />
            );
          })}
          {unions.map((u) => {
            const a = pos(u.partner1Id);
            const b = pos(u.partner2Id);
            if (!a || !b) return null;
            const dim =
              focusSet &&
              !(focusSet.has(u.partner1Id) && focusSet.has(u.partner2Id));
            return (
              <line
                key={u.id}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="#e11d48"
                strokeWidth={2.2}
                strokeDasharray="6 4"
                opacity={dim ? 0.1 : 0.7}
              />
            );
          })}
          {persons.map((p) => {
            const n = pos(p.id);
            if (!n) return null;
            const dim = focusSet && !focusSet.has(p.id);
            const isSel = selectedPersonId === p.id;
            const isMe = claimedPersonId === p.id;
            const fill =
              p.gender === "M" ? "#38bdf8" : p.gender === "F" ? "#fb7185" : "#a1a1aa";
            return (
              <g
                key={p.id}
                transform={`translate(${n.x} ${n.y})`}
                opacity={dim ? 0.25 : 1}
                className="cursor-pointer"
                onPointerDown={(e) => onPointerDown(e, p.id)}
                onPointerEnter={() => setHoverId(p.id)}
                onPointerLeave={() => setHoverId(null)}
              >
                <circle
                  r={isMe ? 22 : 18}
                  fill={fill}
                  fillOpacity={p.isLiving ? 0.95 : 0.55}
                  stroke={isSel ? "var(--primary)" : isMe ? "#16a34a" : "white"}
                  strokeWidth={isSel || isMe ? 3.5 : 2}
                />
                <text
                  textAnchor="middle"
                  dy="0.35em"
                  fontSize={11}
                  fontWeight={700}
                  fill="white"
                  pointerEvents="none"
                >
                  {p.isNameUnknown ? "?" : initials(p.displayName)}
                </text>
                <text
                  y={(isMe ? 22 : 18) + 14}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={isSel ? 700 : 500}
                  fill="var(--foreground)"
                  pointerEvents="none"
                  className={cn("select-none")}
                >
                  {p.displayName.length > 22
                    ? `${p.displayName.slice(0, 21)}…`
                    : p.displayName}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg border bg-card/90 px-3 py-2 text-[11px] text-muted-foreground shadow-sm">
        Drag people to rearrange · scroll to zoom · drag background to pan
        <div className="mt-1 flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <span className="h-0.5 w-4 bg-muted-foreground" /> parent → child
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-0.5 w-4 border-t-2 border-dashed border-rose-600" />{" "}
            partners
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => kick(1)}
        className="absolute bottom-3 right-3 rounded-lg border bg-card px-3 py-1.5 text-xs shadow-sm hover:bg-accent"
      >
        Re-arrange
      </button>
    </div>
  );
}
