import { Suspense } from "react";
import type { Metadata } from "next";
import LoginForm from "@/components/shadcn-space/radix/blocks/login-01/login";
import { isGoogleAuthEnabled } from "@/lib/auth";
import { redirectIfAuthenticated } from "@/server/dal/auth";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your Shikor family tree workspace.",
};

interface SignInPageProps {
  searchParams: Promise<{ callbackUrl?: string }>;
}

async function SignInBoundary({ searchParams }: SignInPageProps) {
  const { callbackUrl } = await searchParams;
  const safeCallback =
    callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")
      ? callbackUrl
      : "/trees";

  await redirectIfAuthenticated(safeCallback);

  return (
    <LoginForm
      callbackUrl={safeCallback}
      isGoogleEnabled={isGoogleAuthEnabled}
    />
  );
}

export default function SignInPage(props: SignInPageProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-muted/40 dark:bg-background">
          <div className="h-[520px] w-full max-w-lg rounded-xl border bg-card animate-pulse mx-4" />
        </div>
      }
    >
      <SignInBoundary {...props} />
    </Suspense>
  );
}
