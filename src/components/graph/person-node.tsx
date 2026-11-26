"use client";

import { memo } from "react";
import { Handle, type NodeProps, Position } from "@xyflow/react";
import { Plus, Sparkles } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
  FamilyGraphNode,
  PersonNodeData,
} from "@/lib/graph-layout/family-elk";
import { cn } from "@/lib/utils";

function getInitials(name: string) {
  return name
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

function PersonNodeComponent({
  data,
  selected,
}: NodeProps<Extract<FamilyGraphNode, { type: "person" }>>) {
  const {
    person,
    lifespanLabel,
    kinshipBadge,
    isClaimedSelf,
    isFocused,
    isPairAnchor,
    isHighlighted,
    isDimmed,
    canEdit,
    onSelectPerson,
    onCtrlSelectPerson,
    onQuickAdd,
  } = data as PersonNodeData;

  const genderAccent =
    person.gender === "M"
      ? "bg-sky-500/12 text-sky-700 dark:text-sky-300 ring-sky-500/30"
      : person.gender === "F"
        ? "bg-rose-500/12 text-rose-700 dark:text-rose-300 ring-rose-500/30"
        : "bg-muted text-muted-foreground ring-border";

  const stripeColor =
    person.gender === "M"
      ? "bg-sky-500/75"
      : person.gender === "F"
        ? "bg-rose-500/75"
        : "bg-muted-foreground/35";

  const isActive = Boolean(selected || isFocused);

  return (
    <div
      onClick={(e) => {
        if ((e.ctrlKey || e.metaKey) && onCtrlSelectPerson) {
          e.preventDefault();
          e.stopPropagation();
          onCtrlSelectPerson(person.id);
          return;
        }
        onSelectPerson(person.id);
      }}
      title="Click to view profile · Ctrl+Click two relatives to see how they're related"
      className={cn(
        "group relative w-[236px] min-h-[92px] rounded-xl border bg-card px-3 pt-3 pb-2.5 shadow-xs transition-all duration-200 cursor-pointer select-none overflow-visible",
        "hover:border-primary/60 hover:shadow-md",
        person.isNameUnknown && "border-dashed bg-card/85",
        isActive && "ring-2 ring-primary border-primary shadow-md",
        isPairAnchor &&
          "ring-2 ring-amber-500 border-amber-500 bg-amber-500/[0.06] shadow-lg scale-[1.02]",
        isHighlighted &&
          "ring-2 ring-primary bg-primary/[0.06] dark:bg-primary/[0.12] border-primary shadow-lg scale-[1.02]",
        isDimmed && "opacity-25 saturate-50 hover:opacity-85",
      )}
    >
      {/* Subtle gender top accent bar */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-x-3 top-0 h-[3px] rounded-b-full",
          stripeColor,
        )}
      />

      {isPairAnchor && (
        <span className="absolute -top-2.5 left-3 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow-xs z-20">
          1st Selected · Pick another
        </span>
      )}

      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-border !border-0 opacity-0"
      />

      <div className="flex items-start gap-2.5">
        <Avatar
          className={cn("h-10 w-10 ring-2 shrink-0 mt-0.5", genderAccent)}
        >
          <AvatarImage
            src={person.avatarUrl ?? undefined}
            alt={person.displayName}
          />
          <AvatarFallback
            className={cn("text-xs font-semibold", genderAccent)}
          >
            {person.isNameUnknown
              ? "?"
              : getInitials(person.displayName) || "P"}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-start justify-between gap-1">
            <div className="min-w-0">
              <p
                className={cn(
                  "text-sm font-semibold leading-tight truncate text-card-foreground",
                  person.isNameUnknown && "italic text-muted-foreground",
                )}
                title={person.displayName}
              >
                {person.displayName}
              </p>
              {(person.nickname || person.nativeName) && (
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {person.nickname ? `“${person.nickname}”` : ""}
                  {person.nickname && person.nativeName ? " · " : ""}
                  {person.nativeName ?? ""}
                </p>
              )}
            </div>

            {person.bloodGroup && (
              <span className="shrink-0 rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                {person.bloodGroup}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between gap-1.5 pt-0.5">
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground truncate">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full shrink-0",
                  person.isLiving
                    ? "bg-emerald-500"
                    : "bg-muted-foreground/45",
                )}
              />
              {lifespanLabel}
            </span>

            {isClaimedSelf ? (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground shrink-0">
                <Sparkles className="h-2.5 w-2.5" />
                You
              </span>
            ) : kinshipBadge ? (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary truncate max-w-[105px]">
                {kinshipBadge}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {canEdit && onQuickAdd && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "absolute -right-2 -top-2 transition-opacity z-20",
            isActive
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100 focus-within:opacity-100",
          )}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                title="Add relative"
                className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md hover:scale-105 transition-transform cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel className="text-xs truncate">
                Add to {person.displayName}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onQuickAdd(person.id, "father")}
                className="cursor-pointer text-xs"
              >
                + Add Father
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onQuickAdd(person.id, "mother")}
                className="cursor-pointer text-xs"
              >
                + Add Mother
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onQuickAdd(person.id, "spouse")}
                className="cursor-pointer text-xs"
              >
                + Add Spouse
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onQuickAdd(person.id, "sibling")}
                className="cursor-pointer text-xs"
              >
                + Add Sibling
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onQuickAdd(person.id, "child")}
                className="cursor-pointer text-xs"
              >
                + Add Child
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-border !border-0 opacity-0"
      />
    </div>
  );
}

export const PersonNode = memo(PersonNodeComponent);
