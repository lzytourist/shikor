import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  GitFork,
  HeartHandshake,
  Sparkles,
  UserCheck,
  Users,
} from "lucide-react";

import { UserNav } from "@/components/auth/user-nav";
import { ShikorLogo } from "@/components/brand/shikor-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { CreateTreeActions } from "@/components/trees/create-tree-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/server/dal/auth";
import { listUserTrees } from "@/server/dal/trees";

export const metadata: Metadata = {
  title: "My Family Trees",
};

async function AuthenticatedUserNav() {
  const { user } = await requireUser();
  return <UserNav user={user} />;
}

async function TreesWorkspaceBody() {
  const [{ user }, trees] = await Promise.all([
    requireUser(),
    listUserTrees(),
  ]);

  return (
    <main className="mx-auto flex-1 w-full max-w-6xl px-4 sm:px-6 py-10 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            My Family Trees
          </h1>
          <p className="text-sm text-muted-foreground">
            Open a family tree, invite relatives to contribute, or start a new
            one.
          </p>
        </div>

        <CreateTreeActions defaultUserName={user.name} />
      </div>

      {trees.length === 0 ? (
        <Card className="border-dashed border-2 bg-card/60">
          <CardHeader className="text-center max-w-xl mx-auto pt-12 pb-4">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <GitFork className="h-6 w-6 rotate-180" />
            </div>
            <CardTitle className="text-xl">No family trees yet</CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              Create your first family tree to start mapping generations,
              preserving life stories, and inviting relatives to collaborate.
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-12 flex justify-center">
            <CreateTreeActions defaultUserName={user.name} />
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {trees.map((tree) => (
            <Card
              key={tree.id}
              className="group flex flex-col justify-between transition-all hover:border-primary/50 hover:shadow-md"
            >
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge
                    variant={tree.role === "owner" ? "default" : "secondary"}
                    className="capitalize"
                  >
                    {tree.role === "owner"
                      ? "Owner"
                      : tree.role === "editor"
                        ? "Can Edit"
                        : "View Only"}
                  </Badge>
                  {tree.claimedPersonName && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground truncate">
                      <UserCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                      You: {tree.claimedPersonName}
                    </span>
                  )}
                </div>

                <div>
                  <CardTitle className="text-xl group-hover:text-primary transition-colors">
                    <Link href={`/trees/${tree.slug}`}>{tree.name}</Link>
                  </CardTitle>
                  <CardDescription className="line-clamp-2 mt-1.5 min-h-[2.5rem]">
                    {tree.description ||
                      "Family tree, stories, and relative directory."}
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent>
                <div className="grid grid-cols-2 gap-3 rounded-xl bg-muted/50 p-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary shrink-0" />
                    <div>
                      <p className="text-sm font-semibold leading-none">
                        {tree.personsCount}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Members
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <HeartHandshake className="h-4 w-4 text-primary shrink-0" />
                    <div>
                      <p className="text-sm font-semibold leading-none">
                        {tree.partnershipsCount}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Marriages
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="pt-0">
                <Button asChild className="w-full gap-2">
                  <Link href={`/trees/${tree.slug}`}>
                    Open Family Tree
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <div className="rounded-2xl border bg-card/50 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary mt-0.5">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-medium">
              Tip: Mark yourself in the family tree
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Once you select &ldquo;This is me&rdquo; on your profile, Shikor
              automatically shows how every relative is connected to you in
              English and বাংলা (like Chacha · চাচা or Fupato Bhai · ফুপাতো
              ভাই).
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function TreesWorkspacePage() {
  return (
    <div className="min-h-screen flex flex-col bg-muted/25 dark:bg-background">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <ShikorLogo href="/trees" />
          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <Suspense
              fallback={
                <div className="h-9 w-28 rounded-full bg-muted animate-pulse" />
              }
            >
              <AuthenticatedUserNav />
            </Suspense>
          </div>
        </div>
      </header>

      <Suspense
        fallback={
          <div className="mx-auto flex-1 w-full max-w-6xl px-4 sm:px-6 py-10 space-y-6">
            <div className="h-14 w-64 rounded-lg bg-muted animate-pulse" />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <div className="h-64 rounded-xl bg-muted animate-pulse" />
            </div>
          </div>
        }
      >
        <TreesWorkspaceBody />
      </Suspense>
    </div>
  );
}
