"use client";

import { useMemo, useState } from "react";
import { Droplets, GitFork, Globe2, HeartPulse, MapPin, Search, Users } from "lucide-react";

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
import { cn } from "@/lib/utils";

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

  const stats = useMemo(() => {
    let living = 0;
    let bloodRecorded = 0;
    const bloodCounts = new Map<BloodGroup, number>();
    const cities = new Set<string>();

    for (const p of persons) {
      if (p.isLiving) living++;
      if (p.bloodGroup) {
        bloodRecorded++;
        bloodCounts.set(p.bloodGroup, (bloodCounts.get(p.bloodGroup) ?? 0) + 1);
      }
      if (p.currentCity?.trim()) {
        cities.add(p.currentCity.trim().toLowerCase());
      }
    }

    return {
      total: persons.length,
      living,
      deceased: persons.length - living,
      bloodRecorded,
      bloodCounts,
      citiesCount: cities.size,
    };
  }, [persons]);

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

  const currentYear = new Date().getFullYear();

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 space-y-5">
      {/* Family Summary Insights */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl border bg-card p-4 shadow-2xs flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xl font-bold leading-none">{stats.total}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Members</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            setLivingFilter((prev) => (prev === "living" ? "all" : "living"))
          }
          className={cn(
            "rounded-2xl border bg-card p-4 shadow-2xs flex items-center gap-3 text-left transition-colors cursor-pointer hover:border-primary/50",
            livingFilter === "living" && "border-primary ring-1 ring-primary",
          )}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 shrink-0">
            <HeartPulse className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xl font-bold leading-none">{stats.living}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Living · {stats.deceased} Passed
            </p>
          </div>
        </button>

        <div className="rounded-2xl border bg-card p-4 shadow-2xs flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/12 text-rose-600 dark:text-rose-400 shrink-0">
            <Droplets className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xl font-bold leading-none">
              {stats.bloodRecorded}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Blood Groups Added
            </p>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-2xs flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/12 text-sky-600 dark:text-sky-400 shrink-0">
            <Globe2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xl font-bold leading-none">
              {stats.citiesCount}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Cities Recorded
            </p>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="space-y-3 rounded-2xl border bg-card p-4 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, nickname, বাংলা, city, or profession..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Select value={bloodFilter} onValueChange={setBloodFilter}>
              <SelectTrigger className="w-[144px]">
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
                <SelectItem value="deceased">Passed Away</SelectItem>
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

        {/* Quick Blood Donor Chips when any are recorded */}
        {stats.bloodRecorded > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] font-medium text-muted-foreground mr-1">
              Quick Donor Filter:
            </span>
            {BLOOD_GROUPS.filter((bg) => (stats.bloodCounts.get(bg) ?? 0) > 0).map(
              (bg) => (
                <button
                  key={bg}
                  type="button"
                  onClick={() =>
                    setBloodFilter((prev) => (prev === bg ? "all" : bg))
                  }
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors cursor-pointer",
                    bloodFilter === bg
                      ? "bg-rose-600 text-white border-rose-600"
                      : "bg-muted/40 hover:border-rose-500/50 text-foreground",
                  )}
                >
                  {bg} ({stats.bloodCounts.get(bg)})
                </button>
              ),
            )}
          </div>
        )}
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
              <TableHead>Family Member</TableHead>
              <TableHead>Relation to You</TableHead>
              <TableHead>Status &amp; Birth</TableHead>
              <TableHead>Blood Group</TableHead>
              <TableHead>City / Profession</TableHead>
              <TableHead className="text-right">View</TableHead>
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
                const age =
                  p.isLiving && p.birthYear
                    ? currentYear - p.birthYear
                    : null;
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
                        <span>
                          {p.isLiving ? "Living" : "Passed"}
                          {age !== null && age >= 0 && age <= 125
                            ? ` · ${age}y`
                            : ""}
                        </span>
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
                        Show in Tree
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
