"use client";

import { useMemo, useState } from "react";
import { Droplets, GitFork, MapPin, Search } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { BloodGroup, Person } from "@/db/schema";
import { formatFuzzyDate } from "@/lib/genealogy/dag";

const BLOOD_GROUPS: BloodGroup[] = [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
];

interface FamilyDirectoryViewProps {
  persons: Person[];
  kinshipBadgesById: Map<string, string>;
  claimedPersonId: string | null;
  onSelectPerson: (personId: string) => void;
  onJumpToGraph: (personId: string) => void;
}

export function FamilyDirectoryView({
  persons,
  kinshipBadgesById,
  claimedPersonId,
  onSelectPerson,
  onJumpToGraph,
}: FamilyDirectoryViewProps) {
  const [query, setQuery] = useState("");
  const [bloodFilter, setBloodFilter] = useState<string>("all");
  const [livingFilter, setLivingFilter] = useState<string>("all");
  const [genderFilter, setGenderFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return persons.filter((p) => {
      if (bloodFilter !== "all" && p.bloodGroup !== bloodFilter) return false;
      if (livingFilter === "living" && !p.isLiving) return false;
      if (livingFilter === "deceased" && p.isLiving) return false;
      if (genderFilter !== "all" && p.gender !== genderFilter) return false;

      if (!q) return true;
      const haystack = [
        p.displayName,
        p.fullName,
        p.nickname,
        p.nativeName,
        p.occupation,
        p.currentCity,
        p.currentCountry,
        p.bloodGroup,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [persons, query, bloodFilter, livingFilter, genderFilter]);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-2xs">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, daknam, বাংলা, city, or occupation..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Select value={bloodFilter} onValueChange={setBloodFilter}>
            <SelectTrigger className="w-[138px]">
              <Droplets className="h-3.5 w-3.5 text-rose-500 mr-1.5" />
              <SelectValue placeholder="Blood Group" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Blood</SelectItem>
              {BLOOD_GROUPS.map((bg) => (
                <SelectItem key={bg} value={bg}>
                  {bg} Donors
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={livingFilter} onValueChange={setLivingFilter}>
            <SelectTrigger className="w-[136px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="living">Living Only</SelectItem>
              <SelectItem value="deceased">Deceased</SelectItem>
            </SelectContent>
          </Select>

          <Select value={genderFilter} onValueChange={setGenderFilter}>
            <SelectTrigger className="w-[124px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Genders</SelectItem>
              <SelectItem value="M">Male</SelectItem>
              <SelectItem value="F">Female</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>
          Showing <strong>{filtered.length}</strong> of {persons.length} family
          members
        </span>
        {(query ||
          bloodFilter !== "all" ||
          livingFilter !== "all" ||
          genderFilter !== "all") && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setBloodFilter("all");
              setLivingFilter("all");
              setGenderFilter("all");
            }}
            className="text-primary hover:underline cursor-pointer"
          >
            Reset filters
          </button>
        )}
      </div>

      <div className="rounded-2xl border bg-card overflow-hidden shadow-2xs">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Relative</TableHead>
              <TableHead>Kinship to You</TableHead>
              <TableHead>Status &amp; Birth</TableHead>
              <TableHead>Blood</TableHead>
              <TableHead>Location / Role</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-32 text-center text-muted-foreground"
                >
                  No family members match the selected filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => {
                const kinship = kinshipBadgesById.get(p.id);
                const birthStr = formatFuzzyDate({
                  precision: p.birthDatePrecision,
                  date: p.birthDate,
                  year: p.birthYear,
                  text: p.birthDateText,
                });
                const locationStr = [p.currentCity, p.currentCountry]
                  .filter(Boolean)
                  .join(", ");

                return (
                  <TableRow
                    key={p.id}
                    onClick={() => onSelectPerson(p.id)}
                    className="cursor-pointer hover:bg-muted/40"
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage
                            src={p.avatarUrl ?? undefined}
                            alt={p.displayName}
                          />
                          <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                            {p.isNameUnknown
                              ? "?"
                              : p.displayName.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm leading-tight">
                            {p.displayName}
                            {p.nickname ? (
                              <span className="text-muted-foreground font-normal">
                                {" "}
                                ({p.nickname})
                              </span>
                            ) : null}
                          </p>
                          {p.nativeName && (
                            <p className="text-xs text-muted-foreground">
                              {p.nativeName}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      {claimedPersonId === p.id ? (
                        <Badge>You · নিজে</Badge>
                      ) : kinship ? (
                        <Badge variant="secondary">{kinship}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            p.isLiving
                              ? "bg-emerald-500"
                              : "bg-muted-foreground/40"
                          }`}
                        />
                        <span>{p.isLiving ? "Living" : "Deceased"}</span>
                      </div>
                      {birthStr && (
                        <span className="text-[11px] text-muted-foreground">
                          b. {birthStr}
                        </span>
                      )}
                    </TableCell>

                    <TableCell>
                      {p.bloodGroup ? (
                        <Badge
                          variant="outline"
                          className="text-rose-600 border-rose-500/30"
                        >
                          {p.bloodGroup}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    <TableCell className="text-xs">
                      {locationStr ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {locationStr}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          {p.occupation || p.nationality || "—"}
                        </span>
                      )}
                    </TableCell>

                    <TableCell
                      className="text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onJumpToGraph(p.id)}
                        className="h-8 gap-1.5 text-xs cursor-pointer"
                      >
                        <GitFork className="h-3.5 w-3.5 rotate-180" />
                        Graph
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
