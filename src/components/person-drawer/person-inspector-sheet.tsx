"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  Calendar,
  Camera,
  Droplets,
  Focus,
  GraduationCap,
  Loader2,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Sparkles,
  Trash2,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type {
  BloodGroup,
  DatePrecision,
  Gender,
  LifeEvent,
  LifeEventType,
  ParentChildLink,
  Partnership,
  Person,
} from "@/db/schema";
import { formatFuzzyDate } from "@/lib/genealogy/dag";
import type { KinshipResult } from "@/lib/kinship/engine";
import {
  addLifeEventAction,
  claimPersonProfileAction,
  deleteLifeEventAction,
  deletePersonAction,
  type QuickRelativeRelation,
  updatePersonAction,
} from "@/server/actions/genealogy";

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
}

export function PersonInspectorSheet(props: PersonInspectorSheetProps) {
  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col">
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

function PersonInspectorContent({
  onOpenChange,
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
}: Omit<PersonInspectorSheetProps, "open" | "person"> & { person: Person }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [displayName, setDisplayName] = useState(person.displayName);
  const [fullName, setFullName] = useState(person.fullName ?? "");
  const [nickname, setNickname] = useState(person.nickname ?? "");
  const [nativeName, setNativeName] = useState(person.nativeName ?? "");
  const [gender, setGender] = useState<Gender>(person.gender);
  const [isLiving, setIsLiving] = useState(person.isLiving);
  const [birthPrecision, setBirthPrecision] = useState<DatePrecision>(
    person.birthDatePrecision,
  );
  const [birthDate, setBirthDate] = useState(person.birthDate ?? "");
  const [birthDateText, setBirthDateText] = useState(
    person.birthDateText ?? "",
  );
  const [deathPrecision, setDeathPrecision] = useState<DatePrecision>(
    person.deathDatePrecision,
  );
  const [deathDate, setDeathDate] = useState(person.deathDate ?? "");
  const [deathDateText, setDeathDateText] = useState(
    person.deathDateText ?? "",
  );
  const [bloodGroup, setBloodGroup] = useState<string>(
    person.bloodGroup ?? "none",
  );
  const [occupation, setOccupation] = useState(person.occupation ?? "");
  const [education, setEducation] = useState(person.education ?? "");
  const [birthPlace, setBirthPlace] = useState(person.birthPlace ?? "");
  const [currentCity, setCurrentCity] = useState(person.currentCity ?? "");
  const [currentCountry, setCurrentCountry] = useState(
    person.currentCountry ?? "",
  );
  const [contactPhone, setContactPhone] = useState(person.contactPhone ?? "");
  const [contactEmail, setContactEmail] = useState(person.contactEmail ?? "");
  const [siblingOrder, setSiblingOrder] = useState(person.siblingOrder ?? 0);
  const [bioMarkdown, setBioMarkdown] = useState(person.bioMarkdown ?? "");

  // Timeline add state
  const [eventType, setEventType] = useState<LifeEventType>("custom");
  const [eventTitle, setEventTitle] = useState("");
  const [eventDateText, setEventDateText] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [eventDesc, setEventDesc] = useState("");

  const familyConnections = useMemo(() => {
    if (!person) {
      return { parents: [], spouses: [], siblings: [], children: [] };
    }
    const byId = new Map(allPersons.map((p) => [p.id, p]));

    const parentLinks = parentChildLinks.filter((l) => l.childId === person.id);
    const parents = parentLinks
      .map((l) => ({
        person: byId.get(l.parentId),
        lineageType: l.lineageType,
        role: l.parentRole,
      }))
      .filter((x): x is { person: Person; lineageType: typeof x.lineageType; role: typeof x.role } =>
        Boolean(x.person),
      );

    const childLinks = parentChildLinks.filter((l) => l.parentId === person.id);
    const children = childLinks
      .map((l) => byId.get(l.childId))
      .filter((x): x is Person => Boolean(x));

    const myUnions = partnerships.filter(
      (u) => u.partner1Id === person.id || u.partner2Id === person.id,
    );
    const spouses = myUnions
      .map((u) => {
        const partnerId =
          u.partner1Id === person.id ? u.partner2Id : u.partner1Id;
        const p = byId.get(partnerId);
        return p ? { person: p, status: u.status } : null;
      })
      .filter((x): x is { person: Person; status: Partnership["status"] } =>
        Boolean(x),
      );

    const myParentIds = new Set(parentLinks.map((l) => l.parentId));
    const siblingIdSet = new Set<string>();
    for (const l of parentChildLinks) {
      if (myParentIds.has(l.parentId) && l.childId !== person.id) {
        siblingIdSet.add(l.childId);
      }
    }
    const siblings = [...siblingIdSet]
      .map((id) => byId.get(id))
      .filter((x): x is Person => Boolean(x));

    return { parents, spouses, siblings, children };
  }, [person, allPersons, partnerships, parentChildLinks]);

  const personEvents = useMemo(
    () => lifeEvents.filter((e) => e.personId === person.id),
    [person, lifeEvents],
  );

  const isClaimedSelf = claimedPersonId === person.id;

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await updatePersonAction({
        treeId,
        personId: person.id,
        displayName,
        fullName,
        nickname,
        nativeName,
        isNameUnknown: false,
        gender,
        isLiving,
        birthDatePrecision: birthPrecision,
        birthDate: birthPrecision === "exact" ? birthDate : null,
        birthDateText:
          birthPrecision === "exact" ? birthDate : birthDateText || null,
        deathDatePrecision: isLiving ? "unknown" : deathPrecision,
        deathDate:
          !isLiving && deathPrecision === "exact" ? deathDate : null,
        deathDateText:
          !isLiving
            ? deathPrecision === "exact"
              ? deathDate
              : deathDateText || null
            : null,
        bloodGroup:
          bloodGroup === "none" ? null : (bloodGroup as BloodGroup),
        occupation,
        education,
        bioMarkdown,
        birthPlace,
        currentCity,
        currentCountry,
        contactPhone,
        contactEmail,
        siblingOrder,
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Profile updated!");
      setIsEditing(false);
    });
  };

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

  const handleDeletePerson = () => {
    if (
      !window.confirm(
        `Remove ${person.displayName} from this family tree? This cannot be undone.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await deletePersonAction({
        treeId,
        personId: person.id,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Removed from tree.");
      onOpenChange(false);
    });
  };

  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim()) {
      toast.error("Please enter an event title.");
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
      toast.success("Timeline milestone added!");
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

  return (
    <>
      <SheetHeader className="px-6 pt-6 pb-4 border-b bg-muted/20 space-y-4 text-left">
          <div className="flex items-start gap-4 pr-6">
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

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <SheetTitle className="text-xl leading-tight">
                  {person.displayName}
                </SheetTitle>
                {person.bloodGroup && (
                  <Badge variant="outline" className="text-rose-600 border-rose-500/30">
                    <Droplets className="h-3 w-3 mr-1" />
                    {person.bloodGroup}
                  </Badge>
                )}
              </div>

              <SheetDescription className="text-xs">
                {person.nickname ? `Daknam: “${person.nickname}”` : ""}
                {person.nickname && person.nativeName ? " · " : ""}
                {person.nativeName ?? ""}
                {!person.nickname && !person.nativeName
                  ? person.isLiving
                    ? "Living family member"
                    : "Historical / Deceased ancestor"
                  : ""}
              </SheetDescription>

              {kinshipToClaimed && (
                <div className="pt-1 flex flex-wrap items-center gap-1.5">
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
              Focus Family Line
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
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onOpenQuickAdd(person.id, "child")}
                  className="h-8 gap-1 text-xs cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Relative
                </Button>
                <Button
                  size="sm"
                  variant={isEditing ? "default" : "ghost"}
                  onClick={() => setIsEditing((v) => !v)}
                  className="h-8 gap-1 text-xs cursor-pointer ml-auto"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {isEditing ? "Viewing" : "Edit"}
                </Button>
              </>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-6">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-5">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="story">Story &amp; Bio</TabsTrigger>
                <TabsTrigger value="timeline">
                  Timeline ({personEvents.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6 mt-0">
                {isEditing && canEdit ? (
                  <form onSubmit={handleSaveProfile} className="space-y-4">
                    <FieldGroup className="gap-3.5">
                      <div className="grid sm:grid-cols-2 gap-3">
                        <Field className="gap-1">
                          <FieldLabel>Display Name*</FieldLabel>
                          <Input
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            required
                          />
                        </Field>
                        <Field className="gap-1">
                          <FieldLabel>Nickname (Daknam)</FieldLabel>
                          <Input
                            value={nickname}
                            placeholder="e.g. Sunny"
                            onChange={(e) => setNickname(e.target.value)}
                          />
                        </Field>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-3">
                        <Field className="gap-1">
                          <FieldLabel>Native Name (বাংলা)</FieldLabel>
                          <Input
                            value={nativeName}
                            placeholder="e.g. করিম আহমেদ"
                            onChange={(e) => setNativeName(e.target.value)}
                          />
                        </Field>
                        <Field className="gap-1">
                          <FieldLabel>Full Legal Name</FieldLabel>
                          <Input
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                          />
                        </Field>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <Field className="gap-1">
                          <FieldLabel>Gender</FieldLabel>
                          <Select
                            value={gender}
                            onValueChange={(v) => setGender(v as Gender)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="M">Male</SelectItem>
                              <SelectItem value="F">Female</SelectItem>
                              <SelectItem value="O">Other</SelectItem>
                              <SelectItem value="U">Unknown</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>

                        <Field className="gap-1">
                          <FieldLabel>Blood Group</FieldLabel>
                          <Select
                            value={bloodGroup}
                            onValueChange={setBloodGroup}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Unknown</SelectItem>
                              {BLOOD_GROUPS.map((bg) => (
                                <SelectItem key={bg} value={bg}>
                                  {bg}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>

                        <Field className="gap-1">
                          <FieldLabel>Birth Order</FieldLabel>
                          <Input
                            type="number"
                            min={0}
                            value={siblingOrder}
                            onChange={(e) =>
                              setSiblingOrder(
                                Number.parseInt(e.target.value || "0", 10),
                              )
                            }
                          />
                        </Field>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <Field className="gap-1">
                          <FieldLabel>Birth Date</FieldLabel>
                          <Select
                            value={birthPrecision}
                            onValueChange={(v) =>
                              setBirthPrecision(v as DatePrecision)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unknown">Not sure</SelectItem>
                              <SelectItem value="exact">Exact Date</SelectItem>
                              <SelectItem value="year">Year Only</SelectItem>
                              <SelectItem value="approx">
                                Approximate (~Year)
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>

                        {birthPrecision === "exact" ? (
                          <Field className="gap-1">
                            <FieldLabel>Select Date</FieldLabel>
                            <Input
                              type="date"
                              value={birthDate}
                              onChange={(e) => setBirthDate(e.target.value)}
                            />
                          </Field>
                        ) : birthPrecision !== "unknown" ? (
                          <Field className="gap-1">
                            <FieldLabel>Birth Year</FieldLabel>
                            <Input
                              placeholder="e.g. ~1948 or 1965"
                              value={birthDateText}
                              onChange={(e) => setBirthDateText(e.target.value)}
                            />
                          </Field>
                        ) : null}
                      </div>

                      <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                        <span className="text-sm font-medium">
                          Currently Living
                        </span>
                        <Switch
                          checked={isLiving}
                          onCheckedChange={setIsLiving}
                        />
                      </div>

                      {!isLiving && (
                        <div className="grid grid-cols-2 gap-3">
                          <Field className="gap-1">
                            <FieldLabel>Date of Passing</FieldLabel>
                            <Select
                              value={deathPrecision}
                              onValueChange={(v) =>
                                setDeathPrecision(v as DatePrecision)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unknown">Not sure</SelectItem>
                                <SelectItem value="exact">
                                  Exact Date
                                </SelectItem>
                                <SelectItem value="year">Year Only</SelectItem>
                                <SelectItem value="approx">
                                  Approximate (~Year)
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </Field>

                          {deathPrecision === "exact" ? (
                            <Field className="gap-1">
                              <FieldLabel>Select Date</FieldLabel>
                              <Input
                                type="date"
                                value={deathDate}
                                onChange={(e) => setDeathDate(e.target.value)}
                              />
                            </Field>
                          ) : deathPrecision !== "unknown" ? (
                            <Field className="gap-1">
                              <FieldLabel>Year of Passing</FieldLabel>
                              <Input
                                placeholder="e.g. ~2004"
                                value={deathDateText}
                                onChange={(e) =>
                                  setDeathDateText(e.target.value)
                                }
                              />
                            </Field>
                          ) : null}
                        </div>
                      )}

                      <div className="grid sm:grid-cols-2 gap-3">
                        <Field className="gap-1">
                          <FieldLabel>Occupation</FieldLabel>
                          <Input
                            value={occupation}
                            placeholder="e.g. Software Engineer"
                            onChange={(e) => setOccupation(e.target.value)}
                          />
                        </Field>
                        <Field className="gap-1">
                          <FieldLabel>Education</FieldLabel>
                          <Input
                            value={education}
                            placeholder="e.g. BUET / Dhaka University"
                            onChange={(e) => setEducation(e.target.value)}
                          />
                        </Field>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-3">
                        <Field className="gap-1">
                          <FieldLabel>Current City</FieldLabel>
                          <Input
                            value={currentCity}
                            placeholder="e.g. Dhaka, London, Toronto"
                            onChange={(e) => setCurrentCity(e.target.value)}
                          />
                        </Field>
                        <Field className="gap-1">
                          <FieldLabel>Current Country</FieldLabel>
                          <Input
                            value={currentCountry}
                            placeholder="e.g. Bangladesh"
                            onChange={(e) => setCurrentCountry(e.target.value)}
                          />
                        </Field>
                      </div>

                      <div className="grid sm:grid-cols-3 gap-3">
                        <Field className="gap-1">
                          <FieldLabel>Birthplace / Ancestral Home</FieldLabel>
                          <Input
                            value={birthPlace}
                            placeholder="Village / District"
                            onChange={(e) => setBirthPlace(e.target.value)}
                          />
                        </Field>
                        <Field className="gap-1">
                          <FieldLabel>Phone / Contact</FieldLabel>
                          <Input
                            value={contactPhone}
                            placeholder="+880..."
                            onChange={(e) => setContactPhone(e.target.value)}
                          />
                        </Field>
                        <Field className="gap-1">
                          <FieldLabel>Email</FieldLabel>
                          <Input
                            type="email"
                            value={contactEmail}
                            placeholder="relative@email.com"
                            onChange={(e) => setContactEmail(e.target.value)}
                          />
                        </Field>
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={isPending}
                          onClick={handleDeletePerson}
                          className="gap-1.5"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete Person
                        </Button>

                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setIsEditing(false)}
                          >
                            Cancel
                          </Button>
                          <Button type="submit" size="sm" disabled={isPending}>
                            {isPending && (
                              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                            )}
                            Save Changes
                          </Button>
                        </div>
                      </div>
                    </FieldGroup>
                  </form>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border bg-muted/25 p-3 space-y-1">
                        <span className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Lifespan
                        </span>
                        <p className="text-sm font-medium">
                          {birthDisplay ? `Born ${birthDisplay}` : "Birth unknown"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {person.isLiving
                            ? "Living"
                            : deathDisplay
                              ? `Died ${deathDisplay}`
                              : "Deceased"}
                        </p>
                      </div>

                      <div className="rounded-xl border bg-muted/25 p-3 space-y-1">
                        <span className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          Location
                        </span>
                        <p className="text-sm font-medium truncate">
                          {[person.currentCity, person.currentCountry]
                            .filter(Boolean)
                            .join(", ") ||
                            person.nationality ||
                            "Not recorded"}
                        </p>
                        {person.birthPlace && (
                          <p className="text-xs text-muted-foreground truncate">
                            From {person.birthPlace}
                          </p>
                        )}
                      </div>

                      {(person.occupation || person.education) && (
                        <div className="col-span-2 rounded-xl border bg-muted/25 p-3 grid sm:grid-cols-2 gap-2">
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
                        <div className="col-span-2 rounded-xl border bg-muted/25 p-3 flex flex-wrap gap-4 text-xs">
                          {person.contactPhone && (
                            <span className="inline-flex items-center gap-1.5">
                              <Phone className="h-3.5 w-3.5 text-primary" />
                              {person.contactPhone}
                            </span>
                          )}
                          {person.contactEmail && (
                            <span className="text-muted-foreground">
                              {person.contactEmail}
                            </span>
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
                        {familyConnections.parents.length === 0 ? (
                          <p className="text-xs text-muted-foreground/70 italic">
                            No parents recorded
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {familyConnections.parents.map((item) => (
                              <button
                                key={`${item.person.id}-${item.lineageType}`}
                                type="button"
                                onClick={() => onSelectPerson(item.person.id)}
                                className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1.5 text-xs font-medium hover:border-primary cursor-pointer"
                              >
                                <span>{item.person.displayName}</span>
                                {item.lineageType !== "biological" && (
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px] px-1 py-0"
                                  >
                                    {item.lineageType}
                                  </Badge>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          Spouses ({familyConnections.spouses.length})
                        </p>
                        {familyConnections.spouses.length === 0 ? (
                          <p className="text-xs text-muted-foreground/70 italic">
                            No spouse recorded
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {familyConnections.spouses.map((sp) => (
                              <button
                                key={sp.person.id}
                                type="button"
                                onClick={() => onSelectPerson(sp.person.id)}
                                className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1.5 text-xs font-medium hover:border-primary cursor-pointer"
                              >
                                <span>{sp.person.displayName}</span>
                                <span className="text-[10px] text-muted-foreground capitalize">
                                  ({sp.status})
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          Children ({familyConnections.children.length})
                        </p>
                        {familyConnections.children.length === 0 ? (
                          <p className="text-xs text-muted-foreground/70 italic">
                            No children recorded
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {familyConnections.children.map((ch) => (
                              <button
                                key={ch.id}
                                type="button"
                                onClick={() => onSelectPerson(ch.id)}
                                className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1.5 text-xs font-medium hover:border-primary cursor-pointer"
                              >
                                {ch.displayName}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {familyConnections.siblings.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">
                            Siblings ({familyConnections.siblings.length})
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {familyConnections.siblings.map((sib) => (
                              <button
                                key={sib.id}
                                type="button"
                                onClick={() => onSelectPerson(sib.id)}
                                className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1.5 text-xs font-medium hover:border-primary cursor-pointer"
                              >
                                {sib.displayName}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="story" className="space-y-4 mt-0">
                {canEdit ? (
                  <form onSubmit={handleSaveProfile} className="space-y-3">
                    <Textarea
                      rows={8}
                      placeholder={`Write ${person.displayName}'s life story, anecdotes, ancestral home memories, or oral history...`}
                      value={bioMarkdown}
                      onChange={(e) => setBioMarkdown(e.target.value)}
                    />
                    <div className="flex justify-end">
                      <Button type="submit" size="sm" disabled={isPending}>
                        {isPending && (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        )}
                        Save Story
                      </Button>
                    </div>
                  </form>
                ) : null}

                {person.bioMarkdown ? (
                  <div className="rounded-xl border bg-muted/20 p-4 text-sm leading-relaxed whitespace-pre-wrap">
                    {person.bioMarkdown}
                  </div>
                ) : !canEdit ? (
                  <p className="text-sm text-muted-foreground italic text-center py-8">
                    No biographical story written yet.
                  </p>
                ) : null}
              </TabsContent>

              <TabsContent value="timeline" className="space-y-5 mt-0">
                {personEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic text-center py-4">
                    No life milestones recorded yet.
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
                            {[ev.dateText, ev.location]
                              .filter(Boolean)
                              .join(" · ")}
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
                          <SelectItem value="migration">Migration</SelectItem>
                          <SelectItem value="achievement">
                            Achievement
                          </SelectItem>
                          <SelectItem value="death">Death</SelectItem>
                          <SelectItem value="burial">
                            Burial / Grave Location
                          </SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
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
        </ScrollArea>
    </>
  );
}
