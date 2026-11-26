import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export const getCurrentSession = cache(async () => {
  return auth.api.getSession({
    headers: await headers(),
  });
});

export async function requireUser() {
  const session = await getCurrentSession();
  if (!session?.user) {
    redirect("/sign-in");
  }
  return session;
}

export async function redirectIfAuthenticated(destination = "/trees") {
  const session = await getCurrentSession();
  if (session?.user) {
    redirect(destination);
  }
}
