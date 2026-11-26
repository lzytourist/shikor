"use client";

import { useState, useTransition } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PersonCombobox } from "@/components/workspace/person-combobox";
import type {
  BloodGroup,
  DatePrecision,
  Gender,
  LineageType,
  PartnershipStatus,
  Person,
} from "@/db/schema";
import {
  addPersonAction,
  type QuickRelativeRelation,
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

interface AddPersonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  treeId: string;
  allPersons: Person[];
  claimedPersonId: string | null;
  defaultAnchorPersonId?: string | null;
  onCreatedPerson?: (personId: string) => void;
}

export function AddPersonDialog({
  open,
  onOpenChange,
  treeId,
  allPersons,
  claimedPersonId,
  defaultAnchorPersonId,
  onCreatedPerson,
}: AddPersonDialogProps) {
  const anchorKey = defaultAnchorPersonId ?? claimedPersonId ?? "new";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <AddPersonDialogContent
          key={`${anchorKey}-${allPersons.length}`}
          onOpenChange={onOpenChange}
          treeId={treeId}
          allPersons={allPersons}
          claimedPersonId={claimedPersonId}
          defaultAnchorPersonId={defaultAnchorPersonId}
          onCreatedPerson={onCreatedPerson}
        />
      ) : null}
    </Dialog>
  );
}

type AddPersonDialogContentProps = Omit<AddPersonDialogProps, "open">;

function AddPersonDialogContent({
  onOpenChange,
  treeId,
  allPersons,
  claimedPersonId,
  defaultAnchorPersonId,
  onCreatedPerson,
}: AddPersonDialogContentProps) {
  const [isPending, startTransition] = useTransition();

  const [displayName, setDisplayName] = useState("");
  const [nickname, setNickname] = useState("");
  const [nativeName, setNativeName] = useState("");
  const [gender, setGender] = useState<Gender>("M");
  const [isLiving, setIsLiving] = useState(true);
  const [bloodGroup, setBloodGroup] = useState<string>("none");
  const [birthPrecision, setBirthPrecision] =
    useState<DatePrecision>("unknown");
  const [birthDate, setBirthDate] = useState("");
  const [birthDateText, setBirthDateText] = useState("");
  const [occupation, setOccupation] = useState("");
  const [currentCity, setCurrentCity] = useState("");
  const [currentCountry, setCurrentCountry] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  // Optional connection
  const [shouldConnect, setShouldConnect] = useState(allPersons.length > 0);
  const [anchorPersonId, setAnchorPersonId] = useState<string>(
    defaultAnchorPersonId ?? claimedPersonId ?? allPersons[0]?.id ?? "",
  );
  const [relation, setRelation] = useState<QuickRelativeRelation>("child");
  const [lineageType, setLineageType] = useState<LineageType>("biological");
  const [partnershipStatus, setPartnershipStatus] =
    useState<PartnershipStatus>("married");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      toast.error("Please enter a name.");
      return;
    }

    if (shouldConnect && !anchorPersonId) {
      toast.error(
        "Choose who this person is connected to, or turn off 'Connect to a relative'.",
      );
      return;
    }

    startTransition(async () => {
      const res = await addPersonAction({
        treeId,
        displayName,
        nickname,
        nativeName,
        gender,
        isLiving,
        bloodGroup: bloodGroup === "none" ? null : (bloodGroup as BloodGroup),
        occupation,
        birthDatePrecision: birthPrecision,
        birthDate: birthPrecision === "exact" ? birthDate : null,
        birthDateText:
          birthPrecision === "exact" ? birthDate : birthDateText || null,
        currentCity,
        currentCountry,
        contactPhone,
        connection:
          shouldConnect && anchorPersonId
            ? {
                anchorPersonId,
                relation,
                lineageType,
                partnershipStatus,
              }
            : null,
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      toast.success(`Added ${displayName.trim()} to the family tree!`);
      onOpenChange(false);
      onCreatedPerson?.(res.personId);
    });
  };

  return (
    <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b bg-muted/25 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <UserPlus className="h-5 w-5 text-primary" />
            Add a Family Member
          </DialogTitle>
          <DialogDescription>
            Add someone new to your tree, optionally connect them to an existing
            relative, and include basic details.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 min-h-0"
        >
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">
            <FieldGroup className="gap-4">
              {/* Names */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <Field className="gap-1.5 sm:col-span-2">
                  <FieldLabel htmlFor="add-person-name">
                    Full / Display Name*
                  </FieldLabel>
                  <Input
                    id="add-person-name"
                    placeholder="e.g. Karim Ahmed"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    autoFocus
                    required
                  />
                </Field>

                <Field className="gap-1.5">
                  <FieldLabel htmlFor="add-person-nick">
                    Nickname (Daknam)
                  </FieldLabel>
                  <Input
                    id="add-person-nick"
                    placeholder="e.g. Babu"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                  />
                </Field>

                <Field className="gap-1.5">
                  <FieldLabel htmlFor="add-person-bn">
                    Native Name (বাংলা)
                  </FieldLabel>
                  <Input
                    id="add-person-bn"
                    placeholder="e.g. করিম আহমেদ"
                    value={nativeName}
                    onChange={(e) => setNativeName(e.target.value)}
                  />
                </Field>
              </div>

              {/* Gender, Blood, Living */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 items-end">
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

                <div className="flex items-center justify-between rounded-lg border px-3 h-10">
                  <span className="text-sm font-medium">Living</span>
                  <Switch checked={isLiving} onCheckedChange={setIsLiving} />
                </div>
              </div>

              {/* Connection Card */}
              {allPersons.length > 0 && (
                <div className="rounded-xl border bg-muted/20 p-4 space-y-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">
                        Connect to a Relative
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Link this new person directly to someone already in your
                        tree.
                      </p>
                    </div>
                    <Switch
                      checked={shouldConnect}
                      onCheckedChange={setShouldConnect}
                    />
                  </div>

                  {shouldConnect && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <Field className="gap-1.5">
                        <FieldLabel className="text-xs">
                          New person is the...
                        </FieldLabel>
                        <Select
                          value={relation}
                          onValueChange={(v) => {
                            const next = v as QuickRelativeRelation;
                            setRelation(next);
                            if (next === "father") setGender("M");
                            if (next === "mother") setGender("F");
                          }}
                        >
                          <SelectTrigger className="bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="child">Child of</SelectItem>
                            <SelectItem value="father">Father of</SelectItem>
                            <SelectItem value="mother">Mother of</SelectItem>
                            <SelectItem value="spouse">Spouse of</SelectItem>
                            <SelectItem value="sibling">Sibling of</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>

                      <Field className="gap-1.5">
                        <FieldLabel className="text-xs">
                          Existing Relative
                        </FieldLabel>
                        <PersonCombobox
                          persons={allPersons}
                          value={anchorPersonId}
                          onValueChange={setAnchorPersonId}
                          claimedPersonId={claimedPersonId}
                          placeholder="Search relative..."
                          modal={true}
                        />
                      </Field>

                      {relation === "spouse" ? (
                        <Field className="gap-1.5 sm:col-span-2">
                          <FieldLabel className="text-xs">
                            Marriage Status
                          </FieldLabel>
                          <Select
                            value={partnershipStatus}
                            onValueChange={(v) =>
                              setPartnershipStatus(v as PartnershipStatus)
                            }
                          >
                            <SelectTrigger className="bg-background">
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
                        </Field>
                      ) : (
                        <Field className="gap-1.5 sm:col-span-2">
                          <FieldLabel className="text-xs">
                            Parent Relationship
                          </FieldLabel>
                          <Select
                            value={lineageType}
                            onValueChange={(v) =>
                              setLineageType(v as LineageType)
                            }
                          >
                            <SelectTrigger className="bg-background">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="biological">
                                Biological
                              </SelectItem>
                              <SelectItem value="adoptive">Adopted</SelectItem>
                              <SelectItem value="step">Step-parent</SelectItem>
                              <SelectItem value="foster">Foster</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Optional Vital & Location Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <Field className="gap-1.5">
                  <FieldLabel>Birth Date</FieldLabel>
                  <Select
                    value={birthPrecision}
                    onValueChange={(v) => setBirthPrecision(v as DatePrecision)}
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
                  <Field className="gap-1.5">
                    <FieldLabel>Select Birth Date</FieldLabel>
                    <Input
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                    />
                  </Field>
                ) : birthPrecision !== "unknown" ? (
                  <Field className="gap-1.5">
                    <FieldLabel>Birth Year</FieldLabel>
                    <Input
                      placeholder="e.g. ~1985"
                      value={birthDateText}
                      onChange={(e) => setBirthDateText(e.target.value)}
                    />
                  </Field>
                ) : (
                  <Field className="gap-1.5">
                    <FieldLabel>Profession (optional)</FieldLabel>
                    <Input
                      placeholder="e.g. Teacher, Doctor"
                      value={occupation}
                      onChange={(e) => setOccupation(e.target.value)}
                    />
                  </Field>
                )}

                <Field className="gap-1.5">
                  <FieldLabel>Current City (optional)</FieldLabel>
                  <Input
                    placeholder="e.g. Dhaka"
                    value={currentCity}
                    onChange={(e) => setCurrentCity(e.target.value)}
                  />
                </Field>

                <Field className="gap-1.5">
                  <FieldLabel>Current Country (optional)</FieldLabel>
                  <Input
                    placeholder="e.g. Bangladesh"
                    value={currentCountry}
                    onChange={(e) => setCurrentCountry(e.target.value)}
                  />
                </Field>

                <Field className="gap-1.5 sm:col-span-2">
                  <FieldLabel>Phone (optional)</FieldLabel>
                  <Input
                    placeholder="+880..."
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                  />
                </Field>
              </div>
            </FieldGroup>
          </div>

          <DialogFooter className="px-6 py-4 border-t bg-muted/25 shrink-0">
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
                <UserPlus className="h-4 w-4" />
              )}
              Add to Family Tree
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
  );
}
