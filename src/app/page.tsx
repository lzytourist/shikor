import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, GitFork, Globe2, HeartHandshake, Lock } from "lucide-react";

import { UserNav } from "@/components/auth/user-nav";
import { ShikorLogo } from "@/components/brand/shikor-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentSession } from "@/server/dal/auth";

async function HeaderAuthActions() {
  const session = await getCurrentSession();

  if (session?.user) {
    return (
      <>
        <Button asChild variant="outline" size="sm">
          <Link href="/trees">My Family Trees</Link>
        </Button>
        <UserNav user={session.user} />
      </>
    );
  }

  return (
    <>
      <Button asChild variant="ghost" size="sm">
        <Link href="/sign-in">Sign in</Link>
      </Button>
      <Button asChild size="sm">
        <Link href="/sign-up">Get started</Link>
      </Button>
    </>
  );
}

async function HeroAuthCtas() {
  const session = await getCurrentSession();

  if (session?.user) {
    return (
      <Button asChild size="lg" className="gap-2 h-11 px-6">
        <Link href="/trees">
          Go to My Family Trees
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    );
  }

  return (
    <>
      <Button asChild size="lg" className="gap-2 h-11 px-6">
        <Link href="/sign-up">
          Start Your Family Tree
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
      <Button asChild variant="outline" size="lg" className="h-11 px-6">
        <Link href="/sign-in">Sign in</Link>
      </Button>
    </>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <ShikorLogo />
          <div className="flex items-center gap-3">
            <Suspense
              fallback={
                <div className="h-9 w-36 rounded-md bg-muted animate-pulse" />
              }
            >
              <HeaderAuthActions />
            </Suspense>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden py-20 sm:py-28">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-0 h-[520px] w-[720px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-primary/10 blur-3xl" />
          </div>

          <div className="relative mx-auto max-w-4xl px-4 sm:px-6 text-center space-y-6">
            <Badge variant="secondary" className="px-3 py-1 text-xs font-medium">
              Shikor · শিকড় — Keep Your Family Story Alive
            </Badge>

            <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-foreground leading-[1.12]">
              Know your roots.{" "}
              <span className="text-primary">Connect every generation.</span>
            </h1>

            <p className="mx-auto max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed">
              Create a living family tree across generations, preserve stories
              and life milestones, see how everyone is related in English &amp;
              বাংলা, and share privately with your family.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-3 min-h-11">
              <Suspense
                fallback={
                  <div className="h-11 w-56 rounded-lg bg-muted animate-pulse" />
                }
              >
                <HeroAuthCtas />
              </Suspense>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-24">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="rounded-2xl border bg-card p-6 space-y-2.5 shadow-2xs">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <GitFork className="h-5 w-5 rotate-180" />
              </div>
              <h3 className="font-semibold">Built for Real Families</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Supports multiple marriages, in-law branches, adoptions, and
                cousin marriages naturally—without messy duplicates.
              </p>
            </div>

            <div className="rounded-2xl border bg-card p-6 space-y-2.5 shadow-2xs">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <HeartHandshake className="h-5 w-5" />
              </div>
              <h3 className="font-semibold">How Are We Related?</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Pick any two relatives to see how they&apos;re connected in
                English and Bengali (Chacha · চাচা, Fupu · ফুপু, Mamato Bhai ·
                মামাতো ভাই).
              </p>
            </div>

            <div className="rounded-2xl border bg-card p-6 space-y-2.5 shadow-2xs">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Globe2 className="h-5 w-5" />
              </div>
              <h3 className="font-semibold">Directory &amp; World Map</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Find relatives by blood group or city in seconds, and see where
                your extended family lives around the world.
              </p>
            </div>

            <div className="rounded-2xl border bg-card p-6 space-y-2.5 shadow-2xs">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Lock className="h-5 w-5" />
              </div>
              <h3 className="font-semibold">Private Family Sharing</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Invite cousins to help update their branch, or send a
                passcode-protected link straight to your family group chat.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
