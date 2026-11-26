"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Compass,
  Focus,
  GitFork,
  HeartHandshake,
  Loader2,
  Maximize2,
  MousePointerClick,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";

import { PersonNode } from "@/components/graph/person-node";
import { UnionNode } from "@/components/graph/union-node";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ParentChildLink, Partnership, Person } from "@/db/schema";
import {
  buildLayoutedFamilyGraph,
  type EdgeSpotlightPayload,
  type FamilyGraphEdge,
  type FamilyGraphNode,
} from "@/lib/graph-layout/family-elk";
import { calculateKinship } from "@/lib/kinship/engine";

const nodeTypes = {
  person: PersonNode,
  union: UnionNode,
};

interface FamilyGraphCanvasProps {
  persons: Person[];
  partnerships: Partnership[];
  parentChildLinks: ParentChildLink[];
  claimedPersonId: string | null;
  selectedPersonId: string | null;
  focusPersonId: string | null;
  hourglassMode: boolean;
  highlightedPersonIds: string[];
  kinshipBadgesById: Map<string, string>;
  canEdit: boolean;
  onSelectPerson: (personId: string) => void;
  onToggleHourglass: (enabled: boolean, targetPersonId?: string | null) => void;
  onClearHighlight: () => void;
  onQuickAdd?: (
    personId: string,
    relation: "father" | "mother" | "spouse" | "child" | "sibling",
  ) => void;
}

function InnerFamilyGraph({
  persons,
  partnerships,
  parentChildLinks,
  claimedPersonId,
  selectedPersonId,
  focusPersonId,
  hourglassMode,
  highlightedPersonIds,
  kinshipBadgesById,
  canEdit,
  onSelectPerson,
  onToggleHourglass,
  onClearHighlight,
  onQuickAdd,
}: FamilyGraphCanvasProps) {
  const { fitView, setCenter, getNode } = useReactFlow();
  const [baseNodes, setBaseNodes, onNodesChange] =
    useNodesState<FamilyGraphNode>([]);
  const [baseEdges, setBaseEdges, onEdgesChange] =
    useEdgesState<FamilyGraphEdge>([]);
  const [collapsedUnionIds, setCollapsedUnionIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [hasInitialLayout, setHasInitialLayout] = useState(false);
  const [edgeSpotlight, setEdgeSpotlight] =
    useState<EdgeSpotlightPayload | null>(null);
  const [ctrlPair, setCtrlPair] = useState<{
    firstId: string;
    secondId: string | null;
  } | null>(null);

  const personById = useMemo(
    () => new Map(persons.map((p) => [p.id, p])),
    [persons],
  );

  const handleToggleCollapse = useCallback((unionId: string) => {
    setCollapsedUnionIds((prev) => {
      const next = new Set(prev);
      if (next.has(unionId)) next.delete(unionId);
      else next.add(unionId);
      return next;
    });
  }, []);

  const handleCtrlSelectPerson = useCallback((personId: string) => {
    setEdgeSpotlight(null);
    setCtrlPair((prev) => {
      // No active selection OR a completed pair is already shown -> start fresh with this person as 1st
      if (!prev || prev.secondId !== null) {
        return { firstId: personId, secondId: null };
      }
      // Clicking the same 1st person again cancels selection
      if (prev.firstId === personId) {
        return null;
      }
      // 2nd Ctrl+Click -> complete the pair and reveal their connection!
      return { firstId: prev.firstId, secondId: personId };
    });
  }, []);

  const handleSelectUnion = useCallback((spotlight: EdgeSpotlightPayload) => {
    setCtrlPair(null);
    setEdgeSpotlight((prev) =>
      prev?.key === spotlight.key ? null : spotlight,
    );
  }, []);

  const handleEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: FamilyGraphEdge) => {
      const spotlight = edge.data?.spotlight;
      if (!spotlight) return;
      setCtrlPair(null);
      setEdgeSpotlight((prev) =>
        prev?.key === spotlight.key ? null : spotlight,
      );
    },
    [],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setEdgeSpotlight(null);
        setCtrlPair(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Compute kinship path when two people are Ctrl+Clicked
  const ctrlKinship = useMemo(() => {
    if (!ctrlPair?.firstId || !ctrlPair.secondId) return null;
    return calculateKinship({
      sourcePersonId: ctrlPair.firstId,
      targetPersonId: ctrlPair.secondId,
      persons,
      partnerships,
      parentChildLinks,
    });
  }, [ctrlPair, persons, partnerships, parentChildLinks]);

  // Structural ELK layout ONLY runs when graph structure or view mode changes
  useEffect(() => {
    let cancelled = false;

    buildLayoutedFamilyGraph({
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
      onCtrlSelectPerson: handleCtrlSelectPerson,
      onQuickAdd,
      onToggleCollapse: handleToggleCollapse,
      onSelectUnion: handleSelectUnion,
    })
      .then(({ nodes: nextNodes, edges: nextEdges }) => {
        if (cancelled) return;
        setBaseNodes(nextNodes);
        setBaseEdges(nextEdges);
        setHasInitialLayout(true);
        requestAnimationFrame(() => {
          fitView({ padding: 0.16, duration: 350, maxZoom: 1.1 });
        });
      })
      .catch((err) => {
        console.error("ELK layout error:", err);
        if (!cancelled) setHasInitialLayout(true);
      });

    return () => {
      cancelled = true;
    };
  }, [
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
    handleCtrlSelectPerson,
    onQuickAdd,
    handleToggleCollapse,
    handleSelectUnion,
    setBaseNodes,
    setBaseEdges,
    fitView,
  ]);

  // Helper that turns an ordered list of pathPersonIds into exact unionIds & edgeIds along that chain
  const buildPathGraphSets = useCallback(
    (orderedPersonIds: string[]) => {
      const pSet = new Set(orderedPersonIds);
      const consecutivePairs = new Set<string>();
      for (let i = 0; i < orderedPersonIds.length - 1; i++) {
        const a = orderedPersonIds[i];
        const b = orderedPersonIds[i + 1];
        consecutivePairs.add(`${a}:${b}`);
        consecutivePairs.add(`${b}:${a}`);
      }

      const uSet = new Set<string>();
      const eSet = new Set<string>();

      // Spouse steps between consecutive path members
      for (const u of partnerships) {
        if (consecutivePairs.has(`${u.partner1Id}:${u.partner2Id}`)) {
          uSet.add(u.id);
          eSet.add(`e-partner-${u.id}-0`);
          eSet.add(`e-partner-${u.id}-1`);
        }
      }

      // Parent <-> Child steps between consecutive path members
      for (const l of parentChildLinks) {
        if (consecutivePairs.has(`${l.parentId}:${l.childId}`)) {
          if (l.partnershipId) {
            const union = partnerships.find((u) => u.id === l.partnershipId);
            if (union) {
              uSet.add(union.id);
              const partnerIdx = union.partner1Id === l.parentId ? 0 : 1;
              eSet.add(`e-partner-${union.id}-${partnerIdx}`);
              eSet.add(`e-union-child-${union.id}-${l.childId}`);
            }
          }
          eSet.add(`e-parent-child-${l.id}`);
        }
      }

      return { personIds: pSet, unionIds: uSet, edgeIds: eSet };
    },
    [partnerships, parentChildLinks],
  );

  const activeHighlight = useMemo(() => {
    if (ctrlPair?.secondId) {
      if (ctrlKinship && ctrlKinship.pathPersonIds.length > 0) {
        return {
          active: true,
          ...buildPathGraphSets(ctrlKinship.pathPersonIds),
        };
      }
      // Disconnected pair: highlight just the two selected nodes so user sees both
      return {
        active: true,
        personIds: new Set([ctrlPair.firstId, ctrlPair.secondId]),
        unionIds: new Set<string>(),
        edgeIds: new Set<string>(),
      };
    }

    if (edgeSpotlight) {
      return {
        active: true,
        personIds: new Set(edgeSpotlight.personIds),
        unionIds: new Set(edgeSpotlight.unionIds),
        edgeIds: new Set(edgeSpotlight.edgeIds),
      };
    }

    if (highlightedPersonIds.length > 0) {
      return {
        active: true,
        ...buildPathGraphSets(highlightedPersonIds),
      };
    }

    return {
      active: false,
      personIds: new Set<string>(),
      unionIds: new Set<string>(),
      edgeIds: new Set<string>(),
    };
  }, [
    ctrlPair,
    ctrlKinship,
    edgeSpotlight,
    highlightedPersonIds,
    buildPathGraphSets,
  ]);

  const waitingAnchorId =
    ctrlPair && ctrlPair.secondId === null ? ctrlPair.firstId : null;

  const displayNodes = useMemo<FamilyGraphNode[]>(() => {
    if (!activeHighlight.active && !waitingAnchorId) return baseNodes;

    return baseNodes.map((node) => {
      if (node.type === "person") {
        const pid = node.data.person.id;
        const isPairAnchor = waitingAnchorId === pid;
        const hit = activeHighlight.active && activeHighlight.personIds.has(pid);
        return {
          ...node,
          zIndex: isPairAnchor || hit ? 15 : 1,
          data: {
            ...node.data,
            isPairAnchor,
            isHighlighted: hit,
            isDimmed: activeHighlight.active ? !hit : false,
          },
        };
      }

      const uid = node.data.partnership.id;
      const hit = activeHighlight.active && activeHighlight.unionIds.has(uid);
      return {
        ...node,
        zIndex: hit ? 15 : 1,
        data: {
          ...node.data,
          isHighlighted: hit,
          isDimmed: activeHighlight.active ? !hit : false,
        },
      };
    });
  }, [baseNodes, activeHighlight, waitingAnchorId]);

  const displayEdges = useMemo<FamilyGraphEdge[]>(() => {
    if (!activeHighlight.active) return baseEdges;

    return baseEdges.map((edge) => {
      const hit = activeHighlight.edgeIds.has(edge.id);
      const base = edge.data;
      if (hit) {
        return {
          ...edge,
          animated: true,
          zIndex: 20,
          style: {
            stroke: "var(--primary)",
            strokeWidth: 3,
            strokeOpacity: 1,
            strokeDasharray: base?.baseDasharray,
          },
        };
      }

      return {
        ...edge,
        animated: false,
        zIndex: 0,
        style: {
          stroke: base?.baseStroke ?? "var(--muted-foreground)",
          strokeWidth: 1.25,
          strokeOpacity: 0.15,
          strokeDasharray: base?.baseDasharray,
        },
      };
    });
  }, [baseEdges, activeHighlight]);

  const centerOnPerson = useCallback(
    (personId: string) => {
      const rfNode = getNode(`person:${personId}`);
      if (rfNode) {
        setCenter(rfNode.position.x + 118, rfNode.position.y + 46, {
          zoom: 1.0,
          duration: 450,
        });
      }
    },
    [getNode, setCenter],
  );

  useEffect(() => {
    if (selectedPersonId && hasInitialLayout) {
      centerOnPerson(selectedPersonId);
    }
  }, [selectedPersonId, hasInitialLayout, centerOnPerson]);

  const focusPerson = useMemo(
    () => persons.find((p) => p.id === focusPersonId) ?? null,
    [persons, focusPersonId],
  );

  const pairFirstPerson = ctrlPair ? personById.get(ctrlPair.firstId) : null;
  const pairSecondPerson =
    ctrlPair?.secondId ? personById.get(ctrlPair.secondId) : null;

  return (
    <div className="relative h-[calc(100vh-3.5rem)] w-full bg-muted/20 dark:bg-background">
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onEdgeClick={handleEdgeClick}
        onPaneClick={() => {
          if (ctrlPair) setCtrlPair(null);
          if (edgeSpotlight) setEdgeSpotlight(null);
          if (highlightedPersonIds.length > 0) onClearHighlight();
        }}
        multiSelectionKeyCode={null}
        selectionKeyCode={null}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        minZoom={0.08}
        maxZoom={1.8}
        fitView
      >
        <Background gap={22} size={1} />
        <Controls
          showInteractive={false}
          className="!bg-card !border-border !shadow-sm"
        />
        <MiniMap
          pannable
          zoomable
          className="!bg-card/90 !border !border-border !rounded-lg hidden md:block"
          nodeColor={(n) =>
            n.type === "union" ? "var(--muted-foreground)" : "var(--primary)"
          }
        />

        <Panel position="top-left" className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border bg-card/95 backdrop-blur-md p-1 shadow-sm">
            <Button
              size="sm"
              variant={!hourglassMode ? "default" : "ghost"}
              onClick={() => onToggleHourglass(false)}
              className="h-8 gap-1.5 text-xs cursor-pointer"
            >
              <GitFork className="h-3.5 w-3.5 rotate-180" />
              Full Tree ({persons.length})
            </Button>
            <Button
              size="sm"
              variant={hourglassMode ? "default" : "ghost"}
              onClick={() =>
                onToggleHourglass(
                  true,
                  selectedPersonId ?? claimedPersonId ?? persons[0]?.id ?? null,
                )
              }
              className="h-8 gap-1.5 text-xs cursor-pointer"
            >
              <Focus className="h-3.5 w-3.5" />
              Focus Family Line
            </Button>
          </div>

          {claimedPersonId && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                onSelectPerson(claimedPersonId);
                centerOnPerson(claimedPersonId);
              }}
              className="h-9 gap-1.5 text-xs bg-card/95 backdrop-blur-md shadow-sm cursor-pointer"
            >
              <Compass className="h-3.5 w-3.5 text-primary" />
              Center on Me
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => fitView({ padding: 0.16, duration: 350 })}
            className="h-9 gap-1.5 text-xs bg-card/95 backdrop-blur-md shadow-sm cursor-pointer"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            Fit All
          </Button>

          {collapsedUnionIds.size > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCollapsedUnionIds(new Set())}
              className="h-9 gap-1.5 text-xs bg-card/95 shadow-sm cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Expand All ({collapsedUnionIds.size})
            </Button>
          )}
        </Panel>

        {(hourglassMode && focusPerson) ||
        ctrlPair ||
        edgeSpotlight ||
        highlightedPersonIds.length > 0 ? (
          <Panel
            position="top-right"
            className="flex flex-col items-end gap-2 max-w-md"
          >
            {hourglassMode && focusPerson && (
              <Badge
                variant="secondary"
                className="gap-2 px-3 py-1.5 shadow-sm bg-card border"
              >
                <span>
                  Showing family line of{" "}
                  <strong>{focusPerson.displayName}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => onToggleHourglass(false)}
                  className="hover:text-destructive cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </Badge>
            )}

            {ctrlPair && !ctrlPair.secondId && pairFirstPerson && (
              <div className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-card/95 backdrop-blur-md px-3.5 py-2 text-xs shadow-md">
                <MousePointerClick className="h-4 w-4 text-amber-500 shrink-0" />
                <span>
                  Selected <strong>{pairFirstPerson.displayName}</strong> —{" "}
                  <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px] font-mono">
                    Ctrl+Click
                  </kbd>{" "}
                  another relative to see how they&apos;re related
                </span>
                <button
                  type="button"
                  onClick={() => setCtrlPair(null)}
                  className="text-muted-foreground hover:text-foreground cursor-pointer ml-1"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {ctrlPair?.secondId && pairFirstPerson && pairSecondPerson && (
              <div className="flex items-start gap-2.5 rounded-xl border border-primary/40 bg-card/95 backdrop-blur-md px-3.5 py-2.5 text-xs shadow-lg">
                <HeartHandshake className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold text-foreground">
                    {pairFirstPerson.displayName} → {pairSecondPerson.displayName}
                  </p>
                  {ctrlKinship ? (
                    <p className="text-muted-foreground">
                      <span className="font-semibold text-primary">
                        {ctrlKinship.badgeText}
                      </span>{" "}
                      · {ctrlKinship.englishTerm}
                    </p>
                  ) : (
                    <p className="text-destructive">
                      No family connection found between them yet
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  title="Clear highlight (Esc)"
                  onClick={() => setCtrlPair(null)}
                  className="text-muted-foreground hover:text-foreground cursor-pointer ml-1 mt-0.5"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {!ctrlPair && edgeSpotlight && (
              <Badge className="gap-2 px-3 py-1.5 shadow-md text-xs">
                <Sparkles className="h-3 w-3 shrink-0" />
                <span>{edgeSpotlight.summary}</span>
                <button
                  type="button"
                  title="Clear highlight (Esc)"
                  onClick={() => setEdgeSpotlight(null)}
                  className="hover:opacity-80 cursor-pointer ml-0.5"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </Badge>
            )}

            {!ctrlPair && !edgeSpotlight && highlightedPersonIds.length > 0 && (
              <Badge className="gap-2 px-3 py-1.5 shadow-md text-xs">
                <span>
                  Relationship highlighted ({highlightedPersonIds.length}{" "}
                  relatives)
                </span>
                <button
                  type="button"
                  onClick={onClearHighlight}
                  className="hover:opacity-80 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </Badge>
            )}
          </Panel>
        ) : null}
      </ReactFlow>

      {!hasInitialLayout && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-[1px] z-20">
          <div className="flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-xs font-medium shadow-md">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Arranging family tree...
          </div>
        </div>
      )}
    </div>
  );
}

export function FamilyGraphCanvas(props: FamilyGraphCanvasProps) {
  return (
    <ReactFlowProvider>
      <InnerFamilyGraph {...props} />
    </ReactFlowProvider>
  );
}
