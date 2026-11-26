import { Suspense } from "react";
import Link from "next/link";
import {
  ArrowRight,
  GitFork,
  Globe2,
  Heart,
  HeartHandshake,
  Lock,
  Sparkles,
} from "lucide-react";

import { UserNav } from "@/components/auth/user-nav";
import { ShikorLogo } from "@/components/brand/shikor-logo";
import { ThemeToggle } from "@/components/theme-toggle";
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
          <div className="flex items-center gap-2.5">
            <ThemeToggle />
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
        <section className="relative overflow-hidden py-14 sm:py-22">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-0 h-[520px] w-[720px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-primary/10 blur-3xl" />
          </div>

          <div className="relative mx-auto max-w-6xl px-4 sm:px-6 grid lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-7 text-center lg:text-left space-y-6">
              <Badge
                variant="secondary"
                className="px-3 py-1 text-xs font-medium"
              >
                Shikor · শিকড় — Keep Your Family Story Alive
              </Badge>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-[1.1]">
                Know your roots.{" "}
                <span className="text-primary">Connect every generation.</span>
              </h1>

              <p className="mx-auto lg:mx-0 max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed">
                Create a living family tree across generations, preserve stories
                and life milestones, see how everyone is related in English
                &amp; বাংলা, and share privately with your family.
              </p>

              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 pt-2 min-h-11">
                <Suspense
                  fallback={
                    <div className="h-11 w-56 rounded-lg bg-muted animate-pulse" />
                  }
                >
                  <HeroAuthCtas />
                </Suspense>
              </div>
            </div>

            {/* Visual Preview Card */}
            <div className="lg:col-span-5">
              <div className="relative rounded-3xl border bg-card/85 backdrop-blur-sm p-6 shadow-xl space-y-5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    Live Family View
                  </span>
                  <Badge variant="secondary" className="text-[10px]">
                    3 Generations
                  </Badge>
                </div>

                {/* Generation 1 */}
                <div className="flex justify-center">
                  <div className="w-56 rounded-xl border bg-background p-3 shadow-xs relative">
                    <span className="absolute inset-x-3 top-0 h-[3px] rounded-b-full bg-sky-500/75" />
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">Abdul Karim</p>
                        <p className="text-[11px] text-muted-foreground">
                          আব্দুল করিম
                        </p>
                      </div>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        Dada · দাদা
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-center -my-3">
                  <div className="h-6 w-px bg-border" />
                </div>

                {/* Generation 2 */}
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <div className="rounded-xl border bg-background p-2.5 shadow-xs relative">
                    <span className="absolute inset-x-2.5 top-0 h-[3px] rounded-b-full bg-sky-500/75" />
                    <p className="text-xs font-semibold truncate">
                      Rafiq Ahmed
                    </p>
                    <span className="inline-block mt-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      Baba · বাবা
                    </span>
                  </div>

                  <div className="flex h-7 w-7 items-center justify-center rounded-full border bg-card shadow-2xs">
                    <Heart className="h-3.5 w-3.5 text-rose-500 fill-rose-500/25" />
                  </div>

                  <div className="rounded-xl border bg-background p-2.5 shadow-xs relative">
                    <span className="absolute inset-x-2.5 top-0 h-[3px] rounded-b-full bg-rose-500/75" />
                    <p className="text-xs font-semibold truncate">
                      Salma Begum
                    </p>
                    <span className="inline-block mt-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      Ma · মা
                    </span>
                  </div>
                </div>

                <div className="flex justify-center -my-3">
                  <div className="h-6 w-px bg-primary/60" />
                </div>

                {/* Generation 3 */}
                <div className="flex justify-center">
                  <div className="w-60 rounded-xl border-2 border-primary bg-primary/[0.04] p-3 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">
                          Nabil Ahmed
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          b. 1998 · Living · Dhaka
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                        <Sparkles className="h-2.5 w-2.5" />
                        You
                      </span>
                    </div>
                  </div>
                </div>
              </div>
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
