"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Briefcase,
  Camera,
  Loader2,
  MapPin,
  Plus,
  Save,
  Trash2,
  Unlink,
  User,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { PinpointLocationPicker } from "@/components/location/pinpoint-location-picker";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  ParentChildLink,
  Partnership,
  PartnershipStatus,
  Person,
} from "@/db/schema";
import { getPersonConnections } from "@/lib/genealogy/person-connections";
import {
  deletePersonAction,
  type QuickRelativeRelation,
  removeParentChildLinkAction,
  removePartnershipAction,
  updatePartnershipStatusAction,
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

export type PersonEditorTab = "identity" | "location" | "story";

interface PersonEditorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: PersonEditorTab;
  treeId: string;
  person: Person | null;
  allPersons: Person[];
  partnerships: Partnership[];
  parentChildLinks: ParentChildLink[];
  onOpenQuickAdd: (personId: string, relation: QuickRelativeRelation) => void;
  onDeleted?: () => void;
}

export function PersonEditorSheet(props: PersonEditorSheetProps) {
  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent
        size="xl"
        className="p-0 gap-0 flex flex-col overflow-hidden"
      >
        {props.person ? (
          <PersonEditorForm
            key={`${props.person.id}-${props.person.updatedAt?.toString() ?? ""}-${props.initialTab ?? "identity"}`}
            {...props}
            person={props.person}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function PersonEditorForm({
  onOpenChange,
  initialTab = "identity",
  treeId,
  person,
  allPersons,
  partnerships,
  parentChildLinks,
  onOpenQuickAdd,
  onDeleted,
}: Omit<PersonEditorSheetProps, "open" | "person"> & { person: Person }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<PersonEditorTab>(initialTab);

  // Identity & Basics
  const [displayName, setDisplayName] = useState(person.displayName);
  const [fullName, setFullName] = useState(person.fullName ?? "");
  const [nickname, setNickname] = useState(person.nickname ?? "");
  const [nativeName, setNativeName] = useState(person.nativeName ?? "");
  const [isNameUnknown, setIsNameUnknown] = useState(person.isNameUnknown);
  const [placeholderLabel, setPlaceholderLabel] = useState(
    person.placeholderLabel ?? "",
  );
  const [gender, setGender] = useState<Gender>(person.gender);
  const [bloodGroup, setBloodGroup] = useState<string>(
    person.bloodGroup ?? "none",
  );
  const [siblingOrder, setSiblingOrder] = useState(person.siblingOrder ?? 0);
  const [isTwin, setIsTwin] = useState(person.isTwin);

  // Dates & Status
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

  // Work, Contact & Location
  const [occupation, setOccupation] = useState(person.occupation ?? "");
  const [education, setEducation] = useState(person.education ?? "");
  const [nationality, setNationality] = useState(person.nationality ?? "");
  const [birthPlace, setBirthPlace] = useState(person.birthPlace ?? "");
  const [currentCity, setCurrentCity] = useState(person.currentCity ?? "");
  const [currentCountry, setCurrentCountry] = useState(
    person.currentCountry ?? "",
  );
  const [latitude, setLatitude] = useState<number | null>(person.latitude);
  const [longitude, setLongitude] = useState<number | null>(person.longitude);
  const [contactPhone, setContactPhone] = useState(person.contactPhone ?? "");
  const [contactEmail, setContactEmail] = useState(person.contactEmail ?? "");

  // Story
  const [bioMarkdown, setBioMarkdown] = useState(person.bioMarkdown ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(person.avatarUrl);

  const familyConnections = useMemo(
    () =>
      getPersonConnections(person.id, allPersons, partnerships, parentChildLinks),
    [person.id, allPersons, partnerships, parentChildLinks],
  );

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
      setAvatarUrl(json.avatarUrl);
      toast.success("Photo updated!");
      router.refresh();
    } catch {
      toast.error("Could not upload image.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const resolvedDisplay = isNameUnknown
        ? placeholderLabel.trim() || displayName.trim() || "Unnamed Relative"
        : displayName.trim() || "Unnamed Relative";

      const res = await updatePersonAction({
        treeId,
        personId: person.id,
        displayName: resolvedDisplay,
        fullName: isNameUnknown ? null : fullName,
        nickname,
        nativeName,
        isNameUnknown,
        placeholderLabel: isNameUnknown ? placeholderLabel : null,
        gender,
        isLiving,
        birthDatePrecision: birthPrecision,
        birthDate: birthPrecision === "exact" ? birthDate : null,
        birthDateText:
          birthPrecision === "exact" ? birthDate : birthDateText || null,
        deathDatePrecision: isLiving ? "unknown" : deathPrecision,
        deathDate: !isLiving && deathPrecision === "exact" ? deathDate : null,
        deathDateText: !isLiving
          ? deathPrecision === "exact"
            ? deathDate
            : deathDateText || null
          : null,
        bloodGroup: bloodGroup === "none" ? null : (bloodGroup as BloodGroup),
        occupation,
        education,
        bioMarkdown,
        nationality,
        birthPlace,
        currentCity,
        currentCountry,
        latitude,
        longitude,
        contactPhone,
        contactEmail,
        siblingOrder,
        isTwin,
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Changes saved!");
      onOpenChange(false);
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
      toast.success("Removed from family tree.");
      onOpenChange(false);
      onDeleted?.();
    });
  };

  return (
    <form onSubmit={handleSave} className="flex flex-col h-full min-h-0">
      {/* Spacious Sticky Header */}
      <SheetHeader className="px-6 sm:px-8 pt-6 pb-4 border-b bg-muted/25 shrink-0 text-left">
        <div className="flex items-center gap-4 pr-10">
          <div className="relative shrink-0">
            <Avatar className="h-14 w-14 ring-2 ring-border">
              <AvatarImage src={avatarUrl ?? undefined} alt={displayName} />
              <AvatarFallback className="text-base font-semibold bg-primary/10 text-primary">
                {displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
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
              title="Change photo"
              className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border bg-background shadow-sm hover:bg-accent cursor-pointer"
            >
              {isUploading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Camera className="h-3 w-3 text-muted-foreground" />
              )}
            </button>
          </div>

          <div className="min-w-0 flex-1">
            <SheetTitle className="text-xl font-semibold truncate">
              Edit {person.displayName}
            </SheetTitle>
            <SheetDescription className="text-xs mt-0.5">
              Update names, birth &amp; passing dates, pinpoint location, story,
              or family connections.
            </SheetDescription>
          </div>
        </div>
      </SheetHeader>

      {/* Clean Tab Bar + Native Scroll Body */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as PersonEditorTab)}
        className="flex-1 min-h-0 flex flex-col"
      >
        <div className="px-6 sm:px-8 py-3 border-b bg-background shrink-0">
          <TabsList className="grid w-full grid-cols-3 h-10">
            <TabsTrigger value="identity" className="gap-2 text-xs sm:text-sm">
              <User className="h-4 w-4 shrink-0" />
              <span>Basics &amp; Dates</span>
            </TabsTrigger>
            <TabsTrigger value="location" className="gap-2 text-xs sm:text-sm">
              <MapPin className="h-4 w-4 shrink-0" />
              <span>Work &amp; Location</span>
            </TabsTrigger>
            <TabsTrigger value="story" className="gap-2 text-xs sm:text-sm">
              <BookOpen className="h-4 w-4 shrink-0" />
              <span>Story &amp; Links</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="px-6 sm:px-8 py-6 space-y-6 max-w-full">
            {/* TAB 1: Basics & Dates */}
            <TabsContent value="identity" className="mt-0 space-y-6">
              <section className="rounded-2xl border bg-card p-5 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">Names &amp; Identity</h3>
                  <label className="inline-flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <Checkbox
                      checked={isNameUnknown}
                      onCheckedChange={(c) => setIsNameUnknown(Boolean(c))}
                    />
                    Name not known (ancestor placeholder)
                  </label>
                </div>

                {isNameUnknown ? (
                  <Field className="gap-1.5">
                    <FieldLabel>Placeholder Label</FieldLabel>
                    <Input
                      value={placeholderLabel}
                      placeholder="e.g. 2nd Son or 1st Daughter"
                      onChange={(e) => setPlaceholderLabel(e.target.value)}
                    />
                  </Field>
                ) : (
                  <FieldGroup className="gap-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field className="gap-1.5">
                        <FieldLabel>Display Name*</FieldLabel>
                        <Input
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          required
                        />
                      </Field>
                      <Field className="gap-1.5">
                        <FieldLabel>Full Legal Name</FieldLabel>
                        <Input
                          value={fullName}
                          placeholder="Full name if different"
                          onChange={(e) => setFullName(e.target.value)}
                        />
                      </Field>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field className="gap-1.5">
                        <FieldLabel>Nickname (Daknam)</FieldLabel>
                        <Input
                          value={nickname}
                          placeholder="e.g. Sunny, Babu"
                          onChange={(e) => setNickname(e.target.value)}
                        />
                      </Field>
                      <Field className="gap-1.5">
                        <FieldLabel>Native Name (বাংলা)</FieldLabel>
                        <Input
                          value={nativeName}
                          placeholder="e.g. করিম আহমেদ"
                          onChange={(e) => setNativeName(e.target.value)}
                        />
                      </Field>
                    </div>
                  </FieldGroup>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <Field className="gap-1.5">
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

                  <Field className="gap-1.5">
                    <FieldLabel>Blood Group</FieldLabel>
                    <Select value={bloodGroup} onValueChange={setBloodGroup}>
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

                  <Field className="gap-1.5">
                    <FieldLabel>Birth Order (among siblings)</FieldLabel>
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

                  <div className="flex items-end pb-2">
                    <label className="inline-flex items-center gap-2.5 text-sm font-medium cursor-pointer">
                      <Checkbox
                        checked={isTwin}
                        onCheckedChange={(c) => setIsTwin(Boolean(c))}
                      />
                      Twin sibling
                    </label>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border bg-card p-5 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">
                      Living Status &amp; Vital Dates
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Exact dates aren&apos;t required—you can use just a year
                      or an estimate like ~1940.
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5 rounded-full border bg-muted/30 px-3 py-1.5">
                    <span className="text-xs font-medium">
                      {isLiving ? "Currently Living" : "Passed Away"}
                    </span>
                    <Switch checked={isLiving} onCheckedChange={setIsLiving} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                    <Field className="gap-1.5">
                      <FieldLabel className="text-xs">Birth Date</FieldLabel>
                      <Select
                        value={birthPrecision}
                        onValueChange={(v) =>
                          setBirthPrecision(v as DatePrecision)
                        }
                      >
                        <SelectTrigger className="bg-background">
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
                      <Field className="gap-1.5">
                        <FieldLabel className="text-xs">Select Date</FieldLabel>
                        <Input
                          type="date"
                          value={birthDate}
                          onChange={(e) => setBirthDate(e.target.value)}
                          className="bg-background"
                        />
                      </Field>
                    ) : birthPrecision !== "unknown" ? (
                      <Field className="gap-1.5">
                        <FieldLabel className="text-xs">Birth Year</FieldLabel>
                        <Input
                          placeholder="e.g. ~1948 or 1965"
                          value={birthDateText}
                          onChange={(e) => setBirthDateText(e.target.value)}
                          className="bg-background"
                        />
                      </Field>
                    ) : null}
                  </div>

                  {!isLiving && (
                    <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                      <Field className="gap-1.5">
                        <FieldLabel className="text-xs">
                          Date of Passing
                        </FieldLabel>
                        <Select
                          value={deathPrecision}
                          onValueChange={(v) =>
                            setDeathPrecision(v as DatePrecision)
                          }
                        >
                          <SelectTrigger className="bg-background">
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

                      {deathPrecision === "exact" ? (
                        <Field className="gap-1.5">
                          <FieldLabel className="text-xs">Select Date</FieldLabel>
                          <Input
                            type="date"
                            value={deathDate}
                            onChange={(e) => setDeathDate(e.target.value)}
                            className="bg-background"
                          />
                        </Field>
                      ) : deathPrecision !== "unknown" ? (
                        <Field className="gap-1.5">
                          <FieldLabel className="text-xs">
                            Year of Passing
                          </FieldLabel>
                          <Input
                            placeholder="e.g. ~2004"
                            value={deathDateText}
                            onChange={(e) => setDeathDateText(e.target.value)}
                            className="bg-background"
                          />
                        </Field>
                      ) : null}
                    </div>
                  )}
                </div>
              </section>
            </TabsContent>

            {/* TAB 2: Work, Contact & Pinpoint Location */}
            <TabsContent value="location" className="mt-0 space-y-6">
              <section className="rounded-2xl border bg-card p-5 space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-primary" />
                  Profession, Education &amp; Contact
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field className="gap-1.5">
                    <FieldLabel>Profession / Role</FieldLabel>
                    <Input
                      value={occupation}
                      placeholder="e.g. Doctor, Teacher, Engineer"
                      onChange={(e) => setOccupation(e.target.value)}
                    />
                  </Field>
                  <Field className="gap-1.5">
                    <FieldLabel>Education</FieldLabel>
                    <Input
                      value={education}
                      placeholder="e.g. Dhaka University"
                      onChange={(e) => setEducation(e.target.value)}
                    />
                  </Field>
                  <Field className="gap-1.5">
                    <FieldLabel>Phone</FieldLabel>
                    <Input
                      value={contactPhone}
                      placeholder="+880..."
                      onChange={(e) => setContactPhone(e.target.value)}
                    />
                  </Field>
                  <Field className="gap-1.5">
                    <FieldLabel>Email</FieldLabel>
                    <Input
                      type="email"
                      value={contactEmail}
                      placeholder="relative@email.com"
                      onChange={(e) => setContactEmail(e.target.value)}
                    />
                  </Field>
                  <Field className="gap-1.5">
                    <FieldLabel>Ancestral Home / Birthplace</FieldLabel>
                    <Input
                      value={birthPlace}
                      placeholder="Village, Upazila, or District"
                      onChange={(e) => setBirthPlace(e.target.value)}
                    />
                  </Field>
                  <Field className="gap-1.5">
                    <FieldLabel>Nationality</FieldLabel>
                    <Input
                      value={nationality}
                      placeholder="e.g. Bangladeshi"
                      onChange={(e) => setNationality(e.target.value)}
                    />
                  </Field>
                </div>
              </section>

              <PinpointLocationPicker
                value={{
                  city: currentCity,
                  country: currentCountry,
                  latitude,
                  longitude,
                }}
                onChange={(next) => {
                  setCurrentCity(next.city);
                  setCurrentCountry(next.country);
                  setLatitude(next.latitude);
                  setLongitude(next.longitude);
                }}
                showGpsButton={false}
                defaultExpandedMap={false}
              />
            </TabsContent>

            {/* TAB 3: Story & Family Connections */}
            <TabsContent value="story" className="mt-0 space-y-6">
              <section className="rounded-2xl border bg-card p-5 space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  Life Story &amp; Family Memories
                </h3>
                <Textarea
                  rows={8}
                  placeholder={`Write ${person.displayName}'s story, childhood memories, achievements, or family anecdotes...`}
                  value={bioMarkdown}
                  onChange={(e) => setBioMarkdown(e.target.value)}
                />
              </section>

              <section className="rounded-2xl border bg-card p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    Manage Family Links
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        onOpenChange(false);
                        onOpenQuickAdd(person.id, "spouse");
                      }}
                      className="h-7 px-2.5 text-xs gap-1 cursor-pointer"
                    >
                      <Plus className="h-3 w-3" />
                      Spouse
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        onOpenChange(false);
                        onOpenQuickAdd(person.id, "child");
                      }}
                      className="h-7 px-2.5 text-xs gap-1 cursor-pointer"
                    >
                      <Plus className="h-3 w-3" />
                      Child
                    </Button>
                  </div>
                </div>

                {familyConnections.spouses.length === 0 &&
                familyConnections.parents.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    No parent or spouse links to edit yet.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {familyConnections.spouses.map((sp) => (
                      <div
                        key={sp.partnershipId}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-muted/20 px-3.5 py-2.5 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">Spouse</Badge>
                          <span className="font-medium text-sm">
                            {sp.person.displayName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Select
                            value={sp.status}
                            onValueChange={(v) =>
                              startTransition(async () => {
                                const res = await updatePartnershipStatusAction(
                                  {
                                    treeId,
                                    partnershipId: sp.partnershipId,
                                    status: v as PartnershipStatus,
                                  },
                                );
                                if (!res.ok) toast.error(res.error);
                                else toast.success("Marriage status updated.");
                              })
                            }
                          >
                            <SelectTrigger className="h-8 w-32 text-xs bg-background">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="married">Married</SelectItem>
                              <SelectItem value="engaged">Engaged</SelectItem>
                              <SelectItem value="divorced">Divorced</SelectItem>
                              <SelectItem value="widowed">Widowed</SelectItem>
                              <SelectItem value="separated">
                                Separated
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive gap-1 cursor-pointer"
                            onClick={() =>
                              startTransition(async () => {
                                const res = await removePartnershipAction({
                                  treeId,
                                  partnershipId: sp.partnershipId,
                                });
                                if (!res.ok) toast.error(res.error);
                                else toast.success("Marriage link removed.");
                              })
                            }
                          >
                            <Unlink className="h-3.5 w-3.5" />
                            Unlink
                          </Button>
                        </div>
                      </div>
                    ))}

                    {familyConnections.parents.map((item) => (
                      <div
                        key={item.linkId}
                        className="flex items-center justify-between gap-2 rounded-xl border bg-muted/20 px-3.5 py-2.5 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="capitalize">
                            {item.role} · {item.lineageType}
                          </Badge>
                          <span className="font-medium text-sm">
                            {item.person.displayName}
                          </span>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive gap-1 cursor-pointer"
                          onClick={() =>
                            startTransition(async () => {
                              const res = await removeParentChildLinkAction({
                                treeId,
                                linkId: item.linkId,
                              });
                              if (!res.ok) toast.error(res.error);
                              else toast.success("Parent link removed.");
                            })
                          }
                        >
                          <Unlink className="h-3.5 w-3.5" />
                          Unlink
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </TabsContent>
          </div>
        </div>
      </Tabs>

      {/* Sticky Footer */}
      <div className="border-t bg-muted/25 px-6 sm:px-8 py-4 flex items-center justify-between gap-3 shrink-0">
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={isPending}
          onClick={handleDeletePerson}
          className="gap-1.5 cursor-pointer"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Remove Person
        </Button>

        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isPending}
            className="gap-2 cursor-pointer"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Changes
          </Button>
        </div>
      </div>
    </form>
  );
}
