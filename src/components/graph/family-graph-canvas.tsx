"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  type Edge,
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
  Loader2,
  Maximize2,
  RotateCcw,
  X,
} from "lucide-react";

import { PersonNode } from "@/components/graph/person-node";
import { UnionNode } from "@/components/graph/union-node";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ParentChildLink, Partnership, Person } from "@/db/schema";
import {
  buildLayoutedFamilyGraph,
  type FamilyGraphNode,
} from "@/lib/graph-layout/family-elk";

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
  const [nodes, setNodes, onNodesChange] = useNodesState<FamilyGraphNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [collapsedUnionIds, setCollapsedUnionIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [hasInitialLayout, setHasInitialLayout] = useState(false);

  const highlightedSet = useMemo(
    () => new Set(highlightedPersonIds),
    [highlightedPersonIds],
  );

  const handleToggleCollapse = useCallback((unionId: string) => {
    setCollapsedUnionIds((prev) => {
      const next = new Set(prev);
      if (next.has(unionId)) next.delete(unionId);
      else next.add(unionId);
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    buildLayoutedFamilyGraph({
      persons,
      partnerships,
      parentChildLinks,
      focusPersonId,
      hourglassMode,
      collapsedUnionIds,
      highlightedPersonIds: highlightedSet,
      claimedPersonId,
      kinshipBadgesById,
      canEdit,
      onSelectPerson,
      onQuickAdd,
      onToggleCollapse: handleToggleCollapse,
    })
      .then(({ nodes: nextNodes, edges: nextEdges }) => {
        if (cancelled) return;
        setNodes(nextNodes);
        setEdges(nextEdges);
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
    highlightedSet,
    claimedPersonId,
    kinshipBadgesById,
    canEdit,
    onSelectPerson,
    onQuickAdd,
    handleToggleCollapse,
    setNodes,
    setEdges,
    fitView,
  ]);

  // Smooth pan when user searches/selects a person
  const centerOnPerson = useCallback(
    (personId: string) => {
      const rfNode = getNode(`person:${personId}`);
      if (rfNode) {
        setCenter(
          rfNode.position.x + 118,
          rfNode.position.y + 46,
          { zoom: 1.0, duration: 450 },
        );
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

  return (
    <div className="relative h-[calc(100vh-7.5rem)] w-full bg-muted/20 dark:bg-background">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        minZoom={0.08}
        maxZoom={1.8}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={22} size={1} />
        <Controls showInteractive={false} className="!bg-card !border-border !shadow-sm" />
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
              Full Graph ({persons.length})
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
              Hourglass Focus
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

        {(hourglassMode && focusPerson) || highlightedPersonIds.length > 0 ? (
          <Panel position="top-right" className="flex flex-col items-end gap-2">
            {hourglassMode && focusPerson && (
              <Badge
                variant="secondary"
                className="gap-2 px-3 py-1.5 shadow-sm bg-card border"
              >
                <span>
                  Hourglass centered on{" "}
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

            {highlightedPersonIds.length > 0 && (
              <Badge className="gap-2 px-3 py-1.5 shadow-sm">
                <span>
                  Kinship path highlighted ({highlightedPersonIds.length} nodes)
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
            Computing family DAG layout...
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
