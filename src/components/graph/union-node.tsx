"use client";

import { memo } from "react";
import { Handle, type NodeProps, Position } from "@xyflow/react";
import { ChevronDown, ChevronRight, Heart, HeartOff } from "lucide-react";

import type {
  FamilyGraphNode,
  UnionNodeData,
} from "@/lib/graph-layout/family-elk";
import { cn } from "@/lib/utils";

function UnionNodeComponent({
  data,
}: NodeProps<Extract<FamilyGraphNode, { type: "union" }>>) {
  const {
    partnership,
    childCount,
    isCollapsed,
    isHighlighted,
    isDimmed,
    spotlight,
    onToggleCollapse,
    onSelectUnion,
  } = data as UnionNodeData;

  const isSeparated =
    partnership.status === "divorced" || partnership.status === "separated";

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onSelectUnion?.(spotlight);
      }}
      className={cn(
        "relative flex items-center justify-center gap-1 rounded-full border bg-card px-2 py-1 shadow-2xs transition-all duration-200 cursor-pointer",
        isHighlighted
          ? "border-primary bg-primary/15 text-primary ring-2 ring-primary/40 scale-110"
          : "border-border text-muted-foreground hover:border-primary/60",
        isDimmed && "opacity-25 hover:opacity-80",
      )}
      title="Click to highlight parents & children"
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-1.5 !h-1.5 !bg-transparent !border-0 opacity-0"
      />

      {isSeparated ? (
        <HeartOff className="h-3 w-3 text-destructive shrink-0" />
      ) : (
        <Heart className="h-3 w-3 text-rose-500 fill-rose-500/25 shrink-0" />
      )}

      {childCount > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse(partnership.id);
          }}
          title={
            isCollapsed
              ? `Expand ${childCount} child(ren)`
              : "Collapse descendants"
          }
          className="inline-flex items-center text-[10px] font-semibold text-foreground/80 hover:text-primary cursor-pointer"
        >
          {isCollapsed ? (
            <>
              <ChevronRight className="h-3 w-3" />
              <span>{childCount}</span>
            </>
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </button>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-1.5 !h-1.5 !bg-transparent !border-0 opacity-0"
      />
    </div>
  );
}

export const UnionNode = memo(UnionNodeComponent);
