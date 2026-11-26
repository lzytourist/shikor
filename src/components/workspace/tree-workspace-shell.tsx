"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  GitFork,
  Globe2,
  HeartHandshake,
  Search,
  TableProperties,
} from "lucide-react";

import { UserNav } from "@/components/auth/user-nav";
import { ShikorLogo } from "@/components/brand/shikor-logo";
import { FamilyGraphCanvas } from "@/components/graph/family-graph-canvas";
import {
  PersonEditorSheet,
  type PersonEditorTab,
} from "@/components/person-drawer/person-editor-sheet";
import { PersonInspectorSheet } from "@/components/person-drawer/person-inspector-sheet";
import { QuickAddRelativeDialog } from "@/components/person-drawer/quick-add-relative-dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { FamilyDirectoryView } from "@/components/workspace/family-directory-view";
import { FamilyMapView } from "@/components/workspace/family-map-view";
import { KinshipCalculatorView } from "@/components/workspace/kinship-calculator-view";
import { ShareCollaborateDialog } from "@/components/workspace/share-collaborate-dialog";
import { calculateKinship, type KinshipResult } from "@/lib/kinship/engine";
import type { QuickRelativeRelation } from "@/server/actions/genealogy";
import type { TreeWorkspaceData } from "@/server/dal/trees";

export type WorkspaceTab = "graph" | "directory" | "map" | "kinship";

interface TreeWorkspaceShellProps {
  workspace: TreeWorkspaceData;
  currentUser?: {
    name: string;
    email: string;
    image?: string | null;
  } | null;
}

export function TreeWorkspaceShell({
  workspace,
  currentUser,
}: TreeWorkspaceShellProps) {
  const {
    tree,
    accessRole,
    canEdit,
    canManage,
    claimedPersonId,
    persons,
    partnerships,
    parentChildLinks,
    lifeEvents,
    collaborators,
    shareLinks,
  } = workspace;

  const [activeTab, setActiveTab] = useState<WorkspaceTab>("graph");
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorInitialTab, setEditorInitialTab] =
    useState<PersonEditorTab>("identity");

  const [hourglassMode, setHourglassMode] = useState(false);
  const [focusPersonId, setFocusPersonId] = useState<string | null>(
    claimedPersonId ?? tree.rootPersonId ?? persons[0]?.id ?? null,
  );
  const [highlightedPersonIds, setHighlightedPersonIds] = useState<string[]>(
    [],
  );

  const [searchOpen, setSearchOpen] = useState(false);
  const [quickAddState, setQuickAddState] = useState<{
    open: boolean;
    anchorPersonId: string | null;
    relation: QuickRelativeRelation;
  }>({
    open: false,
    anchorPersonId: null,
    relation: "child",
  });

  // Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Precompute kinship badges for every person relative to claimedPersonId
  const { kinshipBadgesById, kinshipResultsById } = useMemo(() => {
    const badges = new Map<string, string>();
    const full = new Map<string, KinshipResult>();
    if (!claimedPersonId) {
      return { kinshipBadgesById: badges, kinshipResultsById: full };
    }

    for (const p of persons) {
      const res = calculateKinship({
        sourcePersonId: claimedPersonId,
        targetPersonId: p.id,
        persons,
        partnerships,
        parentChildLinks,
      });
      if (res) {
        badges.set(p.id, res.badgeText);
        full.set(p.id, res);
      }
    }
    return { kinshipBadgesById: badges, kinshipResultsById: full };
  }, [claimedPersonId, persons, partnerships, parentChildLinks]);

  const selectedPerson = useMemo(
    () => persons.find((p) => p.id === selectedPersonId) ?? null,
    [persons, selectedPersonId],
  );

  const quickAddAnchor = useMemo(
    () => persons.find((p) => p.id === quickAddState.anchorPersonId) ?? null,
    [persons, quickAddState.anchorPersonId],
  );

  const handleSelectPerson = useCallback((personId: string) => {
    setSelectedPersonId(personId);
    setInspectorOpen(true);
  }, []);

  const handleJumpToGraph = useCallback((personId: string) => {
    setActiveTab("graph");
    setSelectedPersonId(personId);
    setInspectorOpen(false);
  }, []);

  const handleToggleHourglass = useCallback(
    (enabled: boolean, targetPersonId?: string | null) => {
      setHourglassMode(enabled);
      if (targetPersonId) {
        setFocusPersonId(targetPersonId);
      }
    },
    [],
  );

  const handleOpenQuickAdd = useCallback(
    (personId: string, relation: QuickRelativeRelation) => {
      setQuickAddState({
        open: true,
        anchorPersonId: personId,
        relation,
      });
    },
    [],
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Workspace Top Bar */}
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-3 px-3 sm:px-5">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {accessRole !== "guest" ? (
              <Button asChild variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <Link href="/trees" title="Back to all trees">
                  <ChevronLeft className="h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <ShikorLogo size="sm" href="/" />
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-semibold text-sm sm:text-base truncate">
                  {tree.name}
                </h1>
                <Badge
                  variant="secondary"
                  className="text-[10px] hidden sm:inline-flex"
                >
                  {accessRole === "guest"
                    ? "Shared View"
                    : accessRole === "owner"
                      ? "Owner"
                      : accessRole === "editor"
                        ? "Can Edit"
                        : "View Only"}
                </Badge>
              </div>
            </div>
          </div>

          {/* Center View Switcher */}
          <nav className="flex items-center gap-1 rounded-xl border bg-muted/40 p-1">
            <Button
              size="sm"
              variant={activeTab === "graph" ? "default" : "ghost"}
              onClick={() => setActiveTab("graph")}
              className="h-8 gap-1.5 text-xs px-2.5 sm:px-3 cursor-pointer"
            >
              <GitFork className="h-3.5 w-3.5 rotate-180" />
              <span className="hidden md:inline">Family Tree</span>
            </Button>

            <Button
              size="sm"
              variant={activeTab === "directory" ? "default" : "ghost"}
              onClick={() => setActiveTab("directory")}
              className="h-8 gap-1.5 text-xs px-2.5 sm:px-3 cursor-pointer"
            >
              <TableProperties className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Directory</span>
            </Button>

            <Button
              size="sm"
              variant={activeTab === "map" ? "default" : "ghost"}
              onClick={() => setActiveTab("map")}
              className="h-8 gap-1.5 text-xs px-2.5 sm:px-3 cursor-pointer"
            >
              <Globe2 className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Map</span>
            </Button>

            <Button
              size="sm"
              variant={activeTab === "kinship" ? "default" : "ghost"}
              onClick={() => setActiveTab("kinship")}
              className="h-8 gap-1.5 text-xs px-2.5 sm:px-3 cursor-pointer"
            >
              <HeartHandshake className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Relationships</span>
            </Button>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchOpen(true)}
              className="h-8 gap-2 text-xs text-muted-foreground cursor-pointer"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Find relative...</span>
              <kbd className="hidden lg:inline-flex rounded border bg-muted px-1.5 text-[10px] font-mono">
                ⌘K
              </kbd>
            </Button>

            {accessRole !== "guest" && (
              <ShareCollaborateDialog
                treeId={tree.id}
                canManage={canManage}
                collaborators={collaborators}
                shareLinks={shareLinks}
              />
            )}

            <ThemeToggle />

            {currentUser && <UserNav user={currentUser} />}
          </div>
        </div>
      </header>

      {/* Active Workspace View */}
      <main className="flex-1">
        {activeTab === "graph" && (
          <FamilyGraphCanvas
            persons={persons}
            partnerships={partnerships}
            parentChildLinks={parentChildLinks}
            claimedPersonId={claimedPersonId}
            selectedPersonId={selectedPersonId}
            focusPersonId={focusPersonId}
            hourglassMode={hourglassMode}
            highlightedPersonIds={highlightedPersonIds}
            kinshipBadgesById={kinshipBadgesById}
            canEdit={canEdit}
            onSelectPerson={handleSelectPerson}
            onToggleHourglass={handleToggleHourglass}
            onClearHighlight={() => setHighlightedPersonIds([])}
            onQuickAdd={canEdit ? handleOpenQuickAdd : undefined}
          />
        )}

        {activeTab === "directory" && (
          <FamilyDirectoryView
            persons={persons}
            kinshipBadgesById={kinshipBadgesById}
            claimedPersonId={claimedPersonId}
            onSelectPerson={handleSelectPerson}
            onJumpToGraph={handleJumpToGraph}
          />
        )}

        {activeTab === "map" && (
          <FamilyMapView
            persons={persons}
            onSelectPerson={handleSelectPerson}
          />
        )}

        {activeTab === "kinship" && (
          <KinshipCalculatorView
            persons={persons}
            partnerships={partnerships}
            parentChildLinks={parentChildLinks}
            claimedPersonId={claimedPersonId}
            onSelectPerson={handleSelectPerson}
            onHighlightOnGraph={(pathIds) => {
              setHighlightedPersonIds(pathIds);
              setHourglassMode(false);
              setActiveTab("graph");
            }}
          />
        )}
      </main>

      {/* Slide-Over Person Details Sidebar */}
      <PersonInspectorSheet
        open={inspectorOpen}
        onOpenChange={setInspectorOpen}
        treeId={tree.id}
        person={selectedPerson}
        allPersons={persons}
        partnerships={partnerships}
        parentChildLinks={parentChildLinks}
        lifeEvents={lifeEvents}
        claimedPersonId={claimedPersonId}
        kinshipToClaimed={
          selectedPerson
            ? (kinshipResultsById.get(selectedPerson.id) ?? null)
            : null
        }
        canEdit={canEdit}
        isGuest={accessRole === "guest"}
        onSelectPerson={(id) => {
          setSelectedPersonId(id);
          setInspectorOpen(true);
        }}
        onFocusHourglass={(id) => {
          setFocusPersonId(id);
          setHourglassMode(true);
          setActiveTab("graph");
          setInspectorOpen(false);
        }}
        onOpenQuickAdd={(id, rel) => {
          setInspectorOpen(false);
          handleOpenQuickAdd(id, rel);
        }}
        onOpenEditor={(tab = "identity") => {
          setInspectorOpen(false);
          setEditorInitialTab(tab);
          setEditorOpen(true);
        }}
      />

      {/* Bigger Dedicated Person Editor Sheet */}
      {canEdit && (
        <PersonEditorSheet
          open={editorOpen}
          onOpenChange={setEditorOpen}
          initialTab={editorInitialTab}
          treeId={tree.id}
          person={selectedPerson}
          allPersons={persons}
          partnerships={partnerships}
          parentChildLinks={parentChildLinks}
          onOpenQuickAdd={handleOpenQuickAdd}
          onDeleted={() => setSelectedPersonId(null)}
        />
      )}

      {/* Quick Add / Link Existing Modal */}
      {canEdit && (
        <QuickAddRelativeDialog
          open={quickAddState.open}
          onOpenChange={(open) =>
            setQuickAddState((prev) => ({ ...prev, open }))
          }
          treeId={tree.id}
          anchorPerson={quickAddAnchor}
          initialRelation={quickAddState.relation}
          allPersons={persons}
          partnerships={partnerships}
          onCreatedPerson={(newId) => {
            setSelectedPersonId(newId);
          }}
        />
      )}

      {/* Command Palette (Ctrl+K / Cmd+K) */}
      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandInput placeholder="Search family members by name, nickname, বাংলা, or blood group..." />
        <CommandList>
          <CommandEmpty>No family member found.</CommandEmpty>
          <CommandGroup heading={`Family Members (${persons.length})`}>
            {persons.map((p) => {
              const badge = kinshipBadgesById.get(p.id);
              return (
                <CommandItem
                  key={p.id}
                  value={`${p.displayName} ${p.nickname ?? ""} ${p.nativeName ?? ""} ${p.bloodGroup ?? ""}`}
                  onSelect={() => {
                    setSearchOpen(false);
                    setSelectedPersonId(p.id);
                    setInspectorOpen(true);
                  }}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <div>
                    <span className="font-medium">{p.displayName}</span>
                    {p.nickname && (
                      <span className="text-muted-foreground ml-1.5 text-xs">
                        ({p.nickname})
                      </span>
                    )}
                    {p.nativeName && (
                      <span className="text-muted-foreground ml-1.5 text-xs">
                        · {p.nativeName}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {p.bloodGroup && (
                      <Badge variant="outline" className="text-[10px]">
                        {p.bloodGroup}
                      </Badge>
                    )}
                    {badge && (
                      <Badge variant="secondary" className="text-[10px]">
                        {badge}
                      </Badge>
                    )}
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}
