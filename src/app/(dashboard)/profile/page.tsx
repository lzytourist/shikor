import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Loader2 } from "lucide-react";

import { UserNav } from "@/components/auth/user-nav";
import { ShikorLogo } from "@/components/brand/shikor-logo";
import { MyProfileForm } from "@/components/profile/my-profile-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { getMyProfileData } from "@/server/dal/profile";

export const metadata: Metadata = {
  title: "My Profile",
};

async function ProfileHeaderActions() {
  const { profile } = await getMyProfileData();
  return <UserNav user={profile} />;
}

async function ProfileBody() {
  const { profile, linkedTreeProfiles } = await getMyProfileData();

  return (
    <main className="mx-auto flex-1 w-full max-w-5xl px-4 sm:px-6 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="outline" size="icon" className="h-9 w-9">
          <Link href="/trees" title="Back to My Family Trees">
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Profile</h1>
          <p className="text-sm text-muted-foreground">
            Update your details and pinpoint your location—staying automatically
            in sync with your family tree.
          </p>
        </div>
      </div>

      <MyProfileForm
        profile={profile}
        linkedTreeProfiles={linkedTreeProfiles}
      />
    </main>
  );
}

export default function MyProfilePage() {
  return (
    <div className="min-h-screen flex flex-col bg-muted/25 dark:bg-background">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <ShikorLogo href="/trees" />
          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <Suspense
              fallback={
                <div className="h-9 w-28 rounded-full bg-muted animate-pulse" />
              }
            >
              <ProfileHeaderActions />
            </Suspense>
          </div>
        </div>
      </header>

      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        }
      >
        <ProfileBody />
      </Suspense>
    </div>
  );
}
