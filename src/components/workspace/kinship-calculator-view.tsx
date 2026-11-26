"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight, ArrowRight, GitFork, HeartHandshake, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ParentChildLink, Partnership, Person } from "@/db/schema";
import { calculateKinship } from "@/lib/kinship/engine";

interface KinshipCalculatorViewProps {
  persons: Person[];
  partnerships: Partnership[];
  parentChildLinks: ParentChildLink[];
  claimedPersonId: string | null;
  onHighlightOnGraph: (pathPersonIds: string[]) => void;
  onSelectPerson: (personId: string) => void;
}

export function KinshipCalculatorView({
  persons,
  partnerships,
  parentChildLinks,
  claimedPersonId,
  onHighlightOnGraph,
  onSelectPerson,
}: KinshipCalculatorViewProps) {
  const [personAId, setPersonAId] = useState<string>(
    claimedPersonId ?? persons[0]?.id ?? "",
  );
  const [personBId, setPersonBId] = useState<string>(
    persons.find((p) => p.id !== (claimedPersonId ?? persons[0]?.id))?.id ?? "",
  );

  const personById = useMemo(
    () => new Map(persons.map((p) => [p.id, p])),
    [persons],
  );

  const result = useMemo(() => {
    if (!personAId || !personBId) return null;
    return calculateKinship({
      sourcePersonId: personAId,
      targetPersonId: personBId,
      persons,
      partnerships,
      parentChildLinks,
    });
  }, [personAId, personBId, persons, partnerships, parentChildLinks]);

  const personA = personById.get(personAId);
  const personB = personById.get(personBId);

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-primary text-xs font-semibold uppercase tracking-wider">
            <HeartHandshake className="h-4 w-4" />
            Cultural Kinship Pathfinder
          </div>
          <CardTitle className="text-2xl">How are we related?</CardTitle>
          <CardDescription>
            Select any two family members to trace their shortest lineage or
            marriage connection in English and Bengali (বাংলা).
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid sm:grid-cols-[1fr_auto_1fr] items-end gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                From Person (Perspective)
              </label>
              <Select value={personAId} onValueChange={setPersonAId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose Person A" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {persons.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.displayName}
                      {p.nickname ? ` (${p.nickname})` : ""}
                      {claimedPersonId === p.id ? " — [You]" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="button"
              variant="outline"
              size="icon"
              title="Swap direction"
              onClick={() => {
                setPersonAId(personBId);
                setPersonBId(personAId);
              }}
              className="cursor-pointer mx-auto"
            >
              <ArrowLeftRight className="h-4 w-4" />
            </Button>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                To Relative
              </label>
              <Select value={personBId} onValueChange={setPersonBId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose Person B" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {persons.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.displayName}
                      {p.nickname ? ` (${p.nickname})` : ""}
                      {claimedPersonId === p.id ? " — [You]" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {result && personA && personB ? (
            <div className="rounded-2xl border bg-primary/[0.04] dark:bg-primary/[0.08] border-primary/25 p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">
                    To <strong>{personA.displayName}</strong>,{" "}
                    <strong>{personB.displayName}</strong> is:
                  </p>
                  <div className="flex flex-wrap items-baseline gap-3">
                    <h3 className="text-2xl sm:text-3xl font-bold text-foreground">
                      {result.bengaliTranslit ?? result.englishTerm}
                    </h3>
                    {result.bengaliScript && (
                      <span className="text-xl sm:text-2xl font-semibold text-primary">
                        {result.bengaliScript}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {result.englishTerm}
                  </p>
                  {result.lineageNote && (
                    <Badge variant="outline" className="mt-1">
                      {result.lineageNote}
                    </Badge>
                  )}
                </div>

                <Button
                  onClick={() => onHighlightOnGraph(result.pathPersonIds)}
                  className="gap-2 cursor-pointer shrink-0"
                >
                  <GitFork className="h-4 w-4 rotate-180" />
                  Highlight Path on Graph
                </Button>
              </div>

              <div className="space-y-2 pt-2 border-t border-border/60">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Connection Chain ({result.pathPersonIds.length} nodes)
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {result.pathPersonIds.map((pid, idx) => {
                    const node = personById.get(pid);
                    if (!node) return null;
                    return (
                      <div key={pid} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onSelectPerson(pid)}
                          className="rounded-lg border bg-card px-3 py-1.5 text-xs font-medium shadow-2xs hover:border-primary cursor-pointer"
                        >
                          {node.displayName}
                        </button>
                        {idx < result.pathPersonIds.length - 1 && (
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              No connected path found between these two members yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
