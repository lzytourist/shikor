"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Loader2,
  MapPin,
  Save,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";

import {
  type LocationValue,
  PinpointLocationPicker,
} from "@/components/location/pinpoint-location-picker";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import type { BloodGroup } from "@/db/schema";
import { updateMyProfileAction } from "@/server/actions/profile";
import type { LinkedTreeProfile } from "@/server/dal/profile";

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

interface MyProfileFormProps {
  profile: {
    id: string;
    name: string;
    email: string;
    image: string | null;
    phone: string | null;
    bloodGroup: string | null;
    currentCity: string | null;
    currentCountry: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  linkedTreeProfiles: LinkedTreeProfile[];
}

export function MyProfileForm({
  profile,
  linkedTreeProfiles,
}: MyProfileFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.image);
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [bloodGroup, setBloodGroup] = useState(profile.bloodGroup ?? "none");
  const [syncToLinkedNodes, setSyncToLinkedNodes] = useState(true);

  const [location, setLocation] = useState<LocationValue>({
    city: profile.currentCity ?? "",
    country: profile.currentCountry ?? "",
    latitude: profile.latitude,
    longitude: profile.longitude,
  });

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("target", "user");
      formData.append("syncToLinked", String(syncToLinkedNodes));

      const res = await fetch("/api/uploads/avatar", {
        method: "POST",
        body: formData,
      });
      const json = (await res.json()) as { avatarUrl?: string; error?: string };
      if (!res.ok || !json.avatarUrl) {
        toast.error(json.error || "Photo upload failed.");
        return;
      }
      setAvatarUrl(json.avatarUrl);
      toast.success(
        syncToLinkedNodes && linkedTreeProfiles.length > 0
          ? "Profile photo updated and synced to your linked family tree profile!"
          : "Profile photo updated!",
      );
      router.refresh();
    } catch {
      toast.error("Could not upload photo.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateMyProfileAction({
        name,
        phone,
        bloodGroup: bloodGroup === "none" ? null : (bloodGroup as BloodGroup),
        currentCity: location.city,
        currentCountry: location.country,
        latitude: location.latitude,
        longitude: location.longitude,
        syncToLinkedNodes,
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      if (res.latitude !== null && res.longitude !== null) {
        setLocation((prev) => ({
          ...prev,
          latitude: res.latitude,
          longitude: res.longitude,
        }));
      }

      toast.success(
        res.syncedCount > 0
          ? `Profile saved and synced to ${res.syncedCount} linked family tree ${res.syncedCount === 1 ? "profile" : "profiles"}!`
          : "Profile saved!",
      );
      router.refresh();
    });
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6 items-start">
      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-center gap-4">
          <div className="relative shrink-0">
            <Avatar className="h-16 w-16 ring-2 ring-border">
              <AvatarImage src={avatarUrl ?? undefined} alt={name} />
              <AvatarFallback className="text-lg font-semibold bg-primary/10 text-primary">
                {name.slice(0, 2).toUpperCase()}
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
              title="Change profile photo"
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border bg-background shadow-sm hover:bg-accent cursor-pointer"
            >
              {isUploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Camera className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
          </div>

          <div>
            <CardTitle className="text-xl">Personal Information</CardTitle>
            <CardDescription>{profile.email}</CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <FieldGroup className="gap-4">
              <Field className="gap-1.5">
                <FieldLabel htmlFor="profile-name">Full Name</FieldLabel>
                <Input
                  id="profile-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </Field>

              <div className="grid sm:grid-cols-2 gap-4">
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="profile-phone">Phone Number</FieldLabel>
                  <Input
                    id="profile-phone"
                    placeholder="+880..."
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </Field>

                <Field className="gap-1.5">
                  <FieldLabel>Blood Group</FieldLabel>
                  <Select value={bloodGroup} onValueChange={setBloodGroup}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not set</SelectItem>
                      {BLOOD_GROUPS.map((bg) => (
                        <SelectItem key={bg} value={bg}>
                          {bg}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <PinpointLocationPicker
                value={location}
                onChange={setLocation}
                showGpsButton={true}
                defaultExpandedMap={true}
              />

              {linkedTreeProfiles.length > 0 && (
                <div className="flex items-center justify-between gap-4 rounded-xl border bg-primary/[0.04] border-primary/25 p-3.5">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">
                      Sync to my linked family tree profiles
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Automatically updates your city, pinpoint coordinates,
                      phone, and blood group on the tree(s) where you&apos;re
                      marked &ldquo;This is me&rdquo;.
                    </p>
                  </div>
                  <Switch
                    checked={syncToLinkedNodes}
                    onCheckedChange={setSyncToLinkedNodes}
                  />
                </div>
              )}
            </FieldGroup>

            <div className="flex justify-end">
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
                Save My Profile
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Linked Tree Profiles Sidebar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-primary" />
            Linked Tree Profiles
          </CardTitle>
          <CardDescription className="text-xs">
            Family trees where you have marked a person as &ldquo;This is
            me&rdquo;.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {linkedTreeProfiles.length === 0 ? (
            <div className="rounded-xl border border-dashed p-4 text-center space-y-2">
              <p className="text-xs text-muted-foreground">
                You haven&apos;t linked yourself to a person in any family tree
                yet.
              </p>
              <Button asChild size="sm" variant="outline">
                <Link href="/trees">Go to My Family Trees</Link>
              </Button>
            </div>
          ) : (
            linkedTreeProfiles.map((item) => (
              <div
                key={item.memberId}
                className="rounded-xl border bg-muted/20 p-3.5 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold truncate">
                    {item.treeName}
                  </p>
                  <Badge variant="secondary" className="text-[10px] capitalize">
                    {item.role}
                  </Badge>
                </div>

                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="flex items-center gap-1.5 text-foreground font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    Linked as {item.personName}
                  </p>
                  <p className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                    {[item.personCity, item.personCountry]
                      .filter(Boolean)
                      .join(", ") || "No city set yet"}
                  </p>
                  {item.personLatitude !== null &&
                    item.personLongitude !== null && (
                      <p className="font-mono text-[10px] pl-5">
                        {item.personLatitude.toFixed(5)},{" "}
                        {item.personLongitude.toFixed(5)}
                      </p>
                    )}
                </div>

                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="w-full h-8 text-xs gap-1.5"
                >
                  <Link href={`/trees/${item.treeSlug}`}>
                    Open Tree
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
