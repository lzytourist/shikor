"use client";

import { useState, useTransition } from "react";
import { Link2, Loader2, UserPlus } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PersonCombobox } from "@/components/workspace/person-combobox";
import type {
  Gender,
  LineageType,
  Partnership,
  PartnershipStatus,
  Person,
} from "@/db/schema";
import {
  linkExistingRelativeAction,
  quickAddRelativeAction,
  type QuickRelativeRelation,
} from "@/server/actions/genealogy";

interface QuickAddRelativeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  treeId: string;
  anchorPerson: Person | null;
  initialRelation: QuickRelativeRelation;
  allPersons: Person[];
  partnerships: Partnership[];
  onCreatedPerson?: (personId: string) => void;
}

export function QuickAddRelativeDialog({
  open,
  onOpenChange,
  treeId,
  anchorPerson,
  initialRelation,
  allPersons,
  partnerships,
  onCreatedPerson,
}: QuickAddRelativeDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [relation, setRelation] =
    useState<QuickRelativeRelation>(initialRelation);
  const [displayName, setDisplayName] = useState("");
  const [nickname, setNickname] = useState("");
  const [nativeName, setNativeName] = useState("");
  const [gender, setGender] = useState<Gender>(
    initialRelation === "father"
      ? "M"
      : initialRelation === "mother"
        ? "F"
        : "M",
  );
  const [isLiving, setIsLiving] = useState(true);
  const [lineageType, setLineageType] = useState<LineageType>("biological");
  const [partnershipStatus, setPartnershipStatus] =
    useState<PartnershipStatus>("married");
  const [selectedUnionId, setSelectedUnionId] = useState<string>("auto");

  // Link existing state (great for cousin marriages!)
  const [existingTargetId, setExistingTargetId] = useState<string>("");
  const [existingLinkKind, setExistingLinkKind] = useState<
    "spouse" | "parent" | "child"
  >("spouse");

  if (!anchorPerson) return null;

  const anchorUnions = partnerships.filter(
    (u) => u.partner1Id === anchorPerson.id || u.partner2Id === anchorPerson.id,
  );
  const personById = new Map(allPersons.map((p) => [p.id, p]));

  const handleRelationChange = (val: QuickRelativeRelation) => {
    setRelation(val);
    if (val === "father") setGender("M");
    else if (val === "mother") setGender("F");
    else if (val === "spouse") {
      setGender(anchorPerson.gender === "M" ? "F" : "M");
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      toast.error("Please enter a name.");
      return;
    }

    startTransition(async () => {
      const res = await quickAddRelativeAction({
        treeId,
        anchorPersonId: anchorPerson.id,
        relation,
        displayName,
        nickname,
        nativeName,
        gender,
        isLiving,
        lineageType,
        partnershipStatus,
        otherParentOrPartnershipId:
          selectedUnionId === "auto" ? null : selectedUnionId,
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      toast.success(`Added ${displayName} to the family tree!`);
      setDisplayName("");
      setNickname("");
      setNativeName("");
      onOpenChange(false);
      onCreatedPerson?.(res.personId);
    });
  };

  const handleLinkExistingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!existingTargetId) {
      toast.error("Please choose an existing relative.");
      return;
    }

    startTransition(async () => {
      const res = await linkExistingRelativeAction({
        treeId,
        sourcePersonId: anchorPerson.id,
        targetPersonId: existingTargetId,
        linkKind: existingLinkKind,
        lineageType,
        partnershipStatus,
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      toast.success("Relatives connected in the family graph!");
      setExistingTargetId("");
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a Relative to {anchorPerson.displayName}</DialogTitle>
          <DialogDescription>
            Add a new family member or connect someone who is already in the
            tree.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="new" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="new" className="gap-1.5 text-xs">
              <UserPlus className="h-3.5 w-3.5" />
              New Family Member
            </TabsTrigger>
            <TabsTrigger value="existing" className="gap-1.5 text-xs">
              <Link2 className="h-3.5 w-3.5" />
              Already in Tree
            </TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="pt-3">
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <FieldGroup className="gap-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <Field className="gap-1.5">
                    <FieldLabel>Relationship</FieldLabel>
                    <Select
                      value={relation}
                      onValueChange={(v) =>
                        handleRelationChange(v as QuickRelativeRelation)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="father">Father</SelectItem>
                        <SelectItem value="mother">Mother</SelectItem>
                        <SelectItem value="spouse">Spouse / Partner</SelectItem>
                        <SelectItem value="child">Child</SelectItem>
                        <SelectItem value="sibling">Sibling</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

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
                </div>

                <Field className="gap-1.5">
                  <FieldLabel htmlFor="rel-name">Display Name*</FieldLabel>
                  <Input
                    id="rel-name"
                    placeholder="e.g. Karim Ahmed"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field className="gap-1.5">
                    <FieldLabel htmlFor="rel-nick">
                      Nickname (Daknam)
                    </FieldLabel>
                    <Input
                      id="rel-nick"
                      placeholder="e.g. Babu"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                    />
                  </Field>

                  <Field className="gap-1.5">
                    <FieldLabel htmlFor="rel-bn">
                      Native Name (বাংলা)
                    </FieldLabel>
                    <Input
                      id="rel-bn"
                      placeholder="e.g. করিম আহমেদ"
                      value={nativeName}
                      onChange={(e) => setNativeName(e.target.value)}
                    />
                  </Field>
                </div>

                {relation === "spouse" ? (
                  <Field className="gap-1.5">
                    <FieldLabel>Marriage Status</FieldLabel>
                    <Select
                      value={partnershipStatus}
                      onValueChange={(v) =>
                        setPartnershipStatus(v as PartnershipStatus)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="married">Married</SelectItem>
                        <SelectItem value="engaged">Engaged</SelectItem>
                        <SelectItem value="divorced">Divorced</SelectItem>
                        <SelectItem value="widowed">Widowed</SelectItem>
                        <SelectItem value="separated">Separated</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <Field className="gap-1.5">
                      <FieldLabel>Parent Relationship</FieldLabel>
                      <Select
                        value={lineageType}
                        onValueChange={(v) => setLineageType(v as LineageType)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="biological">Biological</SelectItem>
                          <SelectItem value="adoptive">Adopted</SelectItem>
                          <SelectItem value="step">Step-parent</SelectItem>
                          <SelectItem value="foster">Foster</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>

                    {relation === "child" && anchorUnions.length > 1 && (
                      <Field className="gap-1.5">
                        <FieldLabel>Other Parent</FieldLabel>
                        <Select
                          value={selectedUnionId}
                          onValueChange={setSelectedUnionId}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto">
                              Single parent only
                            </SelectItem>
                            {anchorUnions.map((u) => {
                              const spId =
                                u.partner1Id === anchorPerson.id
                                  ? u.partner2Id
                                  : u.partner1Id;
                              const sp = personById.get(spId);
                              return (
                                <SelectItem key={u.id} value={u.id}>
                                  With {sp?.displayName ?? "Partner"}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </Field>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <span className="text-sm">Currently Living</span>
                  <Switch checked={isLiving} onCheckedChange={setIsLiving} />
                </div>
              </FieldGroup>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending && (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  )}
                  Add Relative
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="existing" className="pt-3">
            <form onSubmit={handleLinkExistingSubmit} className="space-y-4">
              <FieldGroup className="gap-3.5">
                <Field className="gap-1.5">
                  <FieldLabel>
                    How is the existing person related to{" "}
                    {anchorPerson.displayName}?
                  </FieldLabel>
                  <Select
                    value={existingLinkKind}
                    onValueChange={(v) =>
                      setExistingLinkKind(v as "spouse" | "parent" | "child")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="spouse">
                        Spouse / Partner (e.g. Cousin Marriage)
                      </SelectItem>
                      <SelectItem value="parent">
                        Parent of {anchorPerson.displayName}
                      </SelectItem>
                      <SelectItem value="child">
                        Child of {anchorPerson.displayName}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <Field className="gap-1.5">
                  <FieldLabel>Select Relative in Tree</FieldLabel>
                  <PersonCombobox
                    persons={allPersons.filter((p) => p.id !== anchorPerson.id)}
                    value={existingTargetId}
                    onValueChange={setExistingTargetId}
                    placeholder="Search and choose a person..."
                    modal={true}
                  />
                </Field>

                {existingLinkKind !== "spouse" && (
                  <Field className="gap-1.5">
                    <FieldLabel>Lineage Type</FieldLabel>
                    <Select
                      value={lineageType}
                      onValueChange={(v) => setLineageType(v as LineageType)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="biological">Biological</SelectItem>
                        <SelectItem value="adoptive">Adoptive</SelectItem>
                        <SelectItem value="step">Step</SelectItem>
                        <SelectItem value="foster">Foster</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </FieldGroup>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending && (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  )}
                  Connect Relatives
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
