"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { FolderDown, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createTreeSchema,
  type CreateTreeValues,
} from "@/lib/validations/trees";
import {
  createFamilyTreeAction,
  importLegacyTreeAction,
} from "@/server/actions/trees";

interface CreateTreeActionsProps {
  defaultUserName: string;
  showLegacyImportButton?: boolean;
}

export function CreateTreeActions({
  defaultUserName,
  showLegacyImportButton = true,
}: CreateTreeActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isImporting, startImportTransition] = useTransition();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateTreeValues>({
    resolver: zodResolver(createTreeSchema),
    defaultValues: {
      name: "",
      description: "",
      firstPersonName: defaultUserName,
      firstPersonGender: "M",
      claimAsSelf: true,
    },
  });

  const onSubmit = async (values: CreateTreeValues) => {
    const res = await createFamilyTreeAction(values);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Family tree created!");
    setOpen(false);
    reset();
    router.push(`/trees/${res.slug}`);
  };

  const handleImportLegacy = () => {
    startImportTransition(async () => {
      const res = await importLegacyTreeAction();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `Loaded ${res.personsCount} family members and ${res.partnershipsCount} marriages!`,
      );
      router.push(`/trees/${res.slug}`);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {showLegacyImportButton && (
        <Button
          type="button"
          variant="outline"
          disabled={isImporting}
          onClick={handleImportLegacy}
          className="gap-2 cursor-pointer"
        >
          {isImporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FolderDown className="h-4 w-4 text-primary" />
          )}
          Import Legacy Family Tree
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="gap-2 cursor-pointer">
            <Plus className="h-4 w-4" />
            New Family Tree
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create a Family Tree</DialogTitle>
            <DialogDescription>
              Give your family tree a name and add the first person. You can add
              parents, spouses, siblings, and children right inside the tree.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FieldGroup className="gap-4">
              <Field className="gap-1.5" data-invalid={!!errors.name}>
                <FieldLabel htmlFor="tree-name">Family Tree Name</FieldLabel>
                <Input
                  id="tree-name"
                  placeholder="e.g. Maternal Family Tree (Nana Bari)"
                  {...register("name")}
                />
                {errors.name && <FieldError>{errors.name.message}</FieldError>}
              </Field>

              <Field className="gap-1.5" data-invalid={!!errors.description}>
                <FieldLabel htmlFor="tree-desc">
                  Short Note (optional)
                </FieldLabel>
                <Textarea
                  id="tree-desc"
                  rows={2}
                  placeholder="Ancestral village, family history, or a short welcome note..."
                  {...register("description")}
                />
                {errors.description && (
                  <FieldError>{errors.description.message}</FieldError>
                )}
              </Field>

              <div className="grid sm:grid-cols-3 gap-3">
                <Field
                  className="sm:col-span-2 gap-1.5"
                  data-invalid={!!errors.firstPersonName}
                >
                  <FieldLabel htmlFor="first-person">
                    First Person&apos;s Name
                  </FieldLabel>
                  <Input
                    id="first-person"
                    placeholder="Your name or an elder ancestor"
                    {...register("firstPersonName")}
                  />
                  {errors.firstPersonName && (
                    <FieldError>{errors.firstPersonName.message}</FieldError>
                  )}
                </Field>

                <Field className="gap-1.5">
                  <FieldLabel>Gender</FieldLabel>
                  <Controller
                    control={control}
                    name="firstPersonGender"
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="M">Male</SelectItem>
                          <SelectItem value="F">Female</SelectItem>
                          <SelectItem value="O">Other</SelectItem>
                          <SelectItem value="U">Prefer not to say</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
              </div>

              <div className="flex items-center gap-2.5 pt-1">
                <Controller
                  control={control}
                  name="claimAsSelf"
                  render={({ field }) => (
                    <Checkbox
                      id="claimAsSelf"
                      checked={field.value}
                      onCheckedChange={(c) => field.onChange(Boolean(c))}
                    />
                  )}
                />
                <FieldLabel
                  htmlFor="claimAsSelf"
                  className="text-sm font-normal text-muted-foreground cursor-pointer"
                >
                  This is me (automatically show how everyone is related to me)
                </FieldLabel>
              </div>
            </FieldGroup>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                )}
                Create Family Tree
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
