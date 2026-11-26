import { Suspense } from "react";
import type { Metadata } from "next";
import RegisterForm from "@/components/shadcn-space/radix/blocks/register-01/register";
import { isGoogleAuthEnabled } from "@/lib/auth";
import { redirectIfAuthenticated } from "@/server/dal/auth";

export const metadata: Metadata = {
  title: "Create Account",
  description: "Create a Shikor account to start building your family tree.",
};

interface SignUpPageProps {
  searchParams: Promise<{ callbackUrl?: string }>;
}

async function SignUpBoundary({ searchParams }: SignUpPageProps) {
  const { callbackUrl } = await searchParams;
  const safeCallback =
    callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")
      ? callbackUrl
      : "/trees";

  await redirectIfAuthenticated(safeCallback);

  return (
    <RegisterForm
      callbackUrl={safeCallback}
      isGoogleEnabled={isGoogleAuthEnabled}
    />
  );
}

export default function SignUpPage(props: SignUpPageProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-muted/40 dark:bg-background">
          <div className="h-[580px] w-full max-w-lg rounded-xl border bg-card animate-pulse mx-4" />
        </div>
      }
    >
      <SignUpBoundary {...props} />
    </Suspense>
  );
}
