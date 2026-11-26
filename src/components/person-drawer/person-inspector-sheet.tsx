"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Briefcase,
  Calendar,
  Camera,
  Droplets,
  ExternalLink,
  Focus,
  GraduationCap,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Sparkles,
  Trash2,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";

import type { PersonEditorTab } from "@/components/person-drawer/person-editor-sheet";
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
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type {
  LifeEvent,
  LifeEventType,
  ParentChildLink,
  Partnership,
  Person,
} from "@/db/schema";
import { formatFuzzyDate } from "@/lib/genealogy/dag";
import {
  getAgeSummary,
  getPersonConnections,
} from "@/lib/genealogy/person-connections";
import type { KinshipResult } from "@/lib/kinship/engine";
import { cn } from "@/lib/utils";
import {
  addLifeEventAction,
  claimPersonProfileAction,
  deleteLifeEventAction,
  type QuickRelativeRelation,
} from "@/server/actions/genealogy";

interface PersonInspectorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  treeId: string;
  person: Person | null;
  allPersons: Person[];
  partnerships: Partnership[];
  parentChildLinks: ParentChildLink[];
  lifeEvents: LifeEvent[];
  claimedPersonId: string | null;
  kinshipToClaimed: KinshipResult | null;
  canEdit: boolean;
  isGuest: boolean;
  onSelectPerson: (personId: string) => void;
  onFocusHourglass: (personId: string) => void;
  onOpenQuickAdd: (personId: string, relation: QuickRelativeRelation) => void;
  onOpenEditor: (tab?: PersonEditorTab) => void;
}

export function PersonInspectorSheet(props: PersonInspectorSheetProps) {
  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent
        size="lg"
        className="p-0 gap-0 flex flex-col overflow-hidden"
      >
        {props.person ? (
          <PersonInspectorContent
            key={`${props.person.id}-${props.person.updatedAt?.toString() ?? ""}`}
            {...props}
            person={props.person}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function RelativeChip({
  person,
  subtitle,
  onClick,
}: {
  person: Person;
  subtitle?: string | null;
  onClick: () => void;
}) {
  const dot =
    person.gender === "M"
      ? "bg-sky-500"
      : person.gender === "F"
        ? "bg-rose-500"
        : "bg-muted-foreground/50";

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-xl border bg-card px-3 py-1.5 text-xs font-medium hover:border-primary hover:bg-accent/50 transition-colors cursor-pointer"
    >
      <span className={cn("h-2 w-2 rounded-full shrink-0", dot)} />
      <span>{person.displayName}</span>
      {subtitle && (
        <span className="text-[10px] text-muted-foreground capitalize">
          ({subtitle})
        </span>
      )}
    </button>
  );
}

function PersonInspectorContent({
  treeId,
  person,
  allPersons,
  partnerships,
  parentChildLinks,
  lifeEvents,
  claimedPersonId,
  kinshipToClaimed,
  canEdit,
  isGuest,
  onSelectPerson,
  onFocusHourglass,
  onOpenQuickAdd,
  onOpenEditor,
}: Omit<PersonInspectorSheetProps, "open" | "person"> & { person: Person }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);

  // Timeline add state
  const [eventType, setEventType] = useState<LifeEventType>("custom");
  const [eventTitle, setEventTitle] = useState("");
  const [eventDateText, setEventDateText] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [eventDesc, setEventDesc] = useState("");

  const familyConnections = useMemo(
    () =>
      getPersonConnections(person.id, allPersons, partnerships, parentChildLinks),
    [person.id, allPersons, partnerships, parentChildLinks],
  );

  const personEvents = useMemo(
    () => lifeEvents.filter((e) => e.personId === person.id),
    [person, lifeEvents],
  );

  const isClaimedSelf = claimedPersonId === person.id;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("treeId", treeId);
      formData.append("personId", person.id);

      const res = await fetch("/api/uploads/avatar", {
        method: "POST",
        body: formData,
      });
      const json = (await res.json()) as { avatarUrl?: string; error?: string };
      if (!res.ok || !json.avatarUrl) {
        toast.error(json.error || "Upload failed.");
        return;
      }
      toast.success("Profile photo updated!");
      router.refresh();
    } catch {
      toast.error("Could not upload image.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleClaimToggle = () => {
    startTransition(async () => {
      const res = await claimPersonProfileAction({
        treeId,
        personId: isClaimedSelf ? null : person.id,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        isClaimedSelf
          ? "Removed 'This is me' mark."
          : `Marked ${person.displayName} as "This is me"!`,
      );
    });
  };

  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim()) {
      toast.error("Please enter a milestone title.");
      return;
    }
    startTransition(async () => {
      const res = await addLifeEventAction({
        treeId,
        personId: person.id,
        eventType,
        title: eventTitle,
        dateText: eventDateText,
        location: eventLocation,
        description: eventDesc,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Milestone added!");
      setEventTitle("");
      setEventDateText("");
      setEventLocation("");
      setEventDesc("");
    });
  };

  const birthDisplay = formatFuzzyDate({
    precision: person.birthDatePrecision,
    date: person.birthDate,
    year: person.birthYear,
    text: person.birthDateText,
  });
  const deathDisplay = formatFuzzyDate({
    precision: person.deathDatePrecision,
    date: person.deathDate,
    year: person.deathYear,
    text: person.deathDateText,
  });
  const ageSummary = getAgeSummary(person);

  const genderLabel =
    person.gender === "M"
      ? "Male"
      : person.gender === "F"
        ? "Female"
        : person.gender === "O"
          ? "Other"
          : null;

  return (
    <>
      <SheetHeader className="px-6 pt-6 pb-4 border-b bg-muted/20 space-y-4 text-left shrink-0">
        <div className="flex items-start gap-4 pr-8">
          <div className="relative group shrink-0">
            <Avatar className="h-16 w-16 ring-2 ring-border">
              <AvatarImage
                src={person.avatarUrl ?? undefined}
                alt={person.displayName}
              />
              <AvatarFallback className="text-lg font-semibold bg-primary/10 text-primary">
                {person.displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {canEdit && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload profile photo"
                  className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border bg-background shadow-sm hover:bg-accent cursor-pointer"
                >
                  {isUploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Camera className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </button>
              </>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <SheetTitle className="text-xl leading-tight">
                {person.displayName}
              </SheetTitle>
              {person.bloodGroup && (
                <Badge
                  variant="outline"
                  className="text-rose-600 border-rose-500/30"
                >
                  <Droplets className="h-3 w-3 mr-1" />
                  {person.bloodGroup}
                </Badge>
              )}
            </div>

            <SheetDescription className="text-xs flex flex-wrap items-center gap-1.5">
              {person.nickname && <span>“{person.nickname}”</span>}
              {person.nickname && person.nativeName && <span>·</span>}
              {person.nativeName && <span>{person.nativeName}</span>}
              {(person.nickname || person.nativeName) && genderLabel && (
                <span>·</span>
              )}
              {genderLabel && <span>{genderLabel}</span>}
              <span>·</span>
              <span
                className={
                  person.isLiving
                    ? "text-emerald-600 dark:text-emerald-400 font-medium"
                    : ""
                }
              >
                {person.isLiving ? "Living" : "Passed Away"}
              </span>
            </SheetDescription>

            {kinshipToClaimed && (
              <div className="pt-0.5 flex flex-wrap items-center gap-1.5">
                <Badge className="gap-1 text-xs">
                  <Sparkles className="h-3 w-3" />
                  {kinshipToClaimed.bengaliTranslit
                    ? `${kinshipToClaimed.bengaliTranslit} · ${kinshipToClaimed.bengaliScript ?? ""}`
                    : kinshipToClaimed.englishTerm}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  ({kinshipToClaimed.englishTerm})
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onFocusHourglass(person.id)}
            className="h-8 gap-1.5 text-xs cursor-pointer"
          >
            <Focus className="h-3.5 w-3.5 text-primary" />
            Focus Line
          </Button>

          {!isGuest && (
            <Button
              size="sm"
              variant={isClaimedSelf ? "secondary" : "outline"}
              disabled={isPending}
              onClick={handleClaimToggle}
              className="h-8 gap-1.5 text-xs cursor-pointer"
            >
              <UserCheck className="h-3.5 w-3.5 text-primary" />
              {isClaimedSelf ? "Marked as You" : "This is me"}
            </Button>
          )}

          {canEdit && (
            <Button
              size="sm"
              onClick={() => onOpenEditor("identity")}
              className="h-8 gap-1.5 text-xs cursor-pointer ml-auto"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit Details
            </Button>
          )}
        </div>
      </SheetHeader>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-6">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="story">Story &amp; Bio</TabsTrigger>
              <TabsTrigger value="timeline">
                Milestones ({personEvents.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6 mt-0">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border bg-muted/20 p-3.5 space-y-1">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Life &amp; Dates
                  </span>
                  <p className="text-sm font-medium">
                    {birthDisplay
                      ? `Born ${birthDisplay}`
                      : "Birth date not added"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {person.isLiving
                      ? ageSummary
                        ? `Living · ${ageSummary}`
                        : "Living"
                      : deathDisplay
                        ? `Passed ${deathDisplay}${ageSummary ? ` · ${ageSummary}` : ""}`
                        : "Passed away"}
                  </p>
                </div>

                <div className="rounded-xl border bg-muted/20 p-3.5 space-y-1">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    Location
                  </span>
                  <p className="text-sm font-medium truncate">
                    {[person.currentCity, person.currentCountry]
                      .filter(Boolean)
                      .join(", ") ||
                      person.nationality ||
                      "Not added yet"}
                  </p>
                  {person.birthPlace && (
                    <p className="text-xs text-muted-foreground truncate">
                      From {person.birthPlace}
                    </p>
                  )}
                  {person.latitude !== null && person.longitude !== null && (
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${person.latitude}&mlon=${person.longitude}#map=15/${person.latitude}/${person.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-mono text-primary hover:underline pt-0.5"
                    >
                      {person.latitude.toFixed(4)}, {person.longitude.toFixed(4)}
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  )}
                </div>

                {(person.occupation || person.education) && (
                  <div className="col-span-2 rounded-xl border bg-muted/20 p-3.5 grid sm:grid-cols-2 gap-2.5">
                    {person.occupation && (
                      <div className="flex items-center gap-2 text-xs">
                        <Briefcase className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>{person.occupation}</span>
                      </div>
                    )}
                    {person.education && (
                      <div className="flex items-center gap-2 text-xs">
                        <GraduationCap className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>{person.education}</span>
                      </div>
                    )}
                  </div>
                )}

                {(person.contactPhone || person.contactEmail) && (
                  <div className="col-span-2 rounded-xl border bg-muted/20 p-3.5 flex flex-wrap gap-4 text-xs">
                    {person.contactPhone && (
                      <a
                        href={`tel:${person.contactPhone}`}
                        className="inline-flex items-center gap-1.5 hover:text-primary"
                      >
                        <Phone className="h-3.5 w-3.5 text-primary" />
                        {person.contactPhone}
                      </a>
                    )}
                    {person.contactEmail && (
                      <a
                        href={`mailto:${person.contactEmail}`}
                        className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-primary"
                      >
                        <Mail className="h-3.5 w-3.5 text-primary" />
                        {person.contactEmail}
                      </a>
                    )}
                  </div>
                )}
              </div>

              <Separator />

              {/* Immediate Family Connections */}
              <div className="space-y-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Immediate Family
                </h4>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Parents ({familyConnections.parents.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {familyConnections.parents.map((item) => (
                      <RelativeChip
                        key={item.linkId}
                        person={item.person}
                        subtitle={
                          item.lineageType !== "biological"
                            ? item.lineageType
                            : null
                        }
                        onClick={() => onSelectPerson(item.person.id)}
                      />
                    ))}
                    {canEdit &&
                      !familyConnections.parents.some(
                        (p) => p.role === "father",
                      ) && (
                        <button
                          type="button"
                          onClick={() => onOpenQuickAdd(person.id, "father")}
                          className="inline-flex items-center gap-1 rounded-xl border border-dashed border-primary/40 bg-primary/[0.04] px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 cursor-pointer"
                        >
                          <Plus className="h-3 w-3" />
                          Add Father
                        </button>
                      )}
                    {canEdit &&
                      !familyConnections.parents.some(
                        (p) => p.role === "mother",
                      ) && (
                        <button
                          type="button"
                          onClick={() => onOpenQuickAdd(person.id, "mother")}
                          className="inline-flex items-center gap-1 rounded-xl border border-dashed border-primary/40 bg-primary/[0.04] px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 cursor-pointer"
                        >
                          <Plus className="h-3 w-3" />
                          Add Mother
                        </button>
                      )}
                    {!canEdit && familyConnections.parents.length === 0 && (
                      <p className="text-xs text-muted-foreground/70 italic">
                        No parents recorded
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Spouses ({familyConnections.spouses.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {familyConnections.spouses.map((sp) => (
                      <RelativeChip
                        key={sp.partnershipId}
                        person={sp.person}
                        subtitle={sp.status}
                        onClick={() => onSelectPerson(sp.person.id)}
                      />
                    ))}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => onOpenQuickAdd(person.id, "spouse")}
                        className="inline-flex items-center gap-1 rounded-xl border border-dashed border-primary/40 bg-primary/[0.04] px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 cursor-pointer"
                      >
                        <Plus className="h-3 w-3" />
                        Add Spouse
                      </button>
                    )}
                    {!canEdit && familyConnections.spouses.length === 0 && (
                      <p className="text-xs text-muted-foreground/70 italic">
                        No spouse recorded
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Children ({familyConnections.children.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {familyConnections.children.map((ch) => (
                      <RelativeChip
                        key={ch.linkId}
                        person={ch.person}
                        subtitle={
                          ch.lineageType !== "biological"
                            ? ch.lineageType
                            : null
                        }
                        onClick={() => onSelectPerson(ch.person.id)}
                      />
                    ))}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => onOpenQuickAdd(person.id, "child")}
                        className="inline-flex items-center gap-1 rounded-xl border border-dashed border-primary/40 bg-primary/[0.04] px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 cursor-pointer"
                      >
                        <Plus className="h-3 w-3" />
                        Add Child
                      </button>
                    )}
                    {!canEdit && familyConnections.children.length === 0 && (
                      <p className="text-xs text-muted-foreground/70 italic">
                        No children recorded
                      </p>
                    )}
                  </div>
                </div>

                {(familyConnections.siblings.length > 0 || canEdit) && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Siblings ({familyConnections.siblings.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {familyConnections.siblings.map((sib) => (
                        <RelativeChip
                          key={sib.id}
                          person={sib}
                          onClick={() => onSelectPerson(sib.id)}
                        />
                      ))}
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => onOpenQuickAdd(person.id, "sibling")}
                          className="inline-flex items-center gap-1 rounded-xl border border-dashed border-primary/40 bg-primary/[0.04] px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 cursor-pointer"
                        >
                          <Plus className="h-3 w-3" />
                          Add Sibling
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="story" className="space-y-4 mt-0">
              {person.bioMarkdown ? (
                <div className="space-y-3">
                  <div className="rounded-2xl border bg-muted/20 p-5 text-sm leading-relaxed whitespace-pre-wrap">
                    {person.bioMarkdown}
                  </div>
                  {canEdit && (
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onOpenEditor("story")}
                        className="gap-1.5 text-xs cursor-pointer"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit Story
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed p-8 text-center space-y-3">
                  <BookOpen className="h-8 w-8 text-muted-foreground/50 mx-auto" />
                  <p className="text-sm text-muted-foreground">
                    No life story written for {person.displayName} yet.
                  </p>
                  {canEdit && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onOpenEditor("story")}
                      className="gap-1.5 text-xs cursor-pointer"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Write Life Story
                    </Button>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="timeline" className="space-y-5 mt-0">
              {personEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground italic text-center py-4">
                  No life milestones added yet.
                </p>
              ) : (
                <div className="relative pl-5 space-y-4 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-px before:bg-border">
                  {personEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="relative rounded-xl border bg-card p-3.5 space-y-1"
                    >
                      <span className="absolute -left-[21px] top-4 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className="capitalize text-[10px]"
                          >
                            {ev.eventType}
                          </Badge>
                          <span className="text-sm font-semibold">
                            {ev.title}
                          </span>
                        </div>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() =>
                              startTransition(async () => {
                                await deleteLifeEventAction({
                                  treeId,
                                  eventId: ev.id,
                                });
                              })
                            }
                            className="text-muted-foreground hover:text-destructive cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      {(ev.dateText || ev.location) && (
                        <p className="text-xs text-muted-foreground">
                          {[ev.dateText, ev.location].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      {ev.description && (
                        <p className="text-xs leading-relaxed pt-1">
                          {ev.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {canEdit && (
                <form
                  onSubmit={handleAddEvent}
                  className="rounded-xl border bg-muted/20 p-4 space-y-3"
                >
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Add Life Milestone
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    <Select
                      value={eventType}
                      onValueChange={(v) => setEventType(v as LifeEventType)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="birth">Birth</SelectItem>
                        <SelectItem value="marriage">Marriage</SelectItem>
                        <SelectItem value="education">Education</SelectItem>
                        <SelectItem value="career">Career</SelectItem>
                        <SelectItem value="migration">Moved / Migration</SelectItem>
                        <SelectItem value="achievement">Achievement</SelectItem>
                        <SelectItem value="death">Passing</SelectItem>
                        <SelectItem value="burial">Burial Place</SelectItem>
                        <SelectItem value="custom">Other</SelectItem>
                      </SelectContent>
                    </Select>

                    <Input
                      placeholder="Year / Date (e.g. ~1971)"
                      value={eventDateText}
                      onChange={(e) => setEventDateText(e.target.value)}
                    />
                  </div>
                  <Input
                    placeholder="Milestone title (e.g. Moved to Dhaka)"
                    value={eventTitle}
                    onChange={(e) => setEventTitle(e.target.value)}
                  />
                  <Input
                    placeholder="Location (optional)"
                    value={eventLocation}
                    onChange={(e) => setEventLocation(e.target.value)}
                  />
                  <Textarea
                    rows={2}
                    placeholder="Details or memories..."
                    value={eventDesc}
                    onChange={(e) => setEventDesc(e.target.value)}
                  />
                  <Button type="submit" size="sm" disabled={isPending}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Milestone
                  </Button>
                </form>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
}
