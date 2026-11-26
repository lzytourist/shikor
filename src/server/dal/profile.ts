import "server-only";

import { and, eq, isNotNull } from "drizzle-orm";

import { db } from "@/db";
import { familyTrees, persons, treeMembers, user } from "@/db/schema";
import { requireUser } from "./auth";

export interface LinkedTreeProfile {
  memberId: string;
  treeId: string;
  treeName: string;
  treeSlug: string;
  role: string;
  personId: string;
  personName: string;
  personCity: string | null;
  personCountry: string | null;
  personLatitude: number | null;
  personLongitude: number | null;
}

export async function getMyProfileData() {
  const { user: sessionUser } = await requireUser();

  const [dbUser, linkedRows] = await Promise.all([
    db.query.user.findFirst({
      where: eq(user.id, sessionUser.id),
    }),
    db
      .select({
        memberId: treeMembers.id,
        treeId: familyTrees.id,
        treeName: familyTrees.name,
        treeSlug: familyTrees.slug,
        role: treeMembers.role,
        personId: persons.id,
        personName: persons.displayName,
        personCity: persons.currentCity,
        personCountry: persons.currentCountry,
        personLatitude: persons.latitude,
        personLongitude: persons.longitude,
      })
      .from(treeMembers)
      .innerJoin(familyTrees, eq(treeMembers.treeId, familyTrees.id))
      .innerJoin(persons, eq(treeMembers.claimedPersonId, persons.id))
      .where(
        and(
          eq(treeMembers.userId, sessionUser.id),
          isNotNull(treeMembers.claimedPersonId),
        ),
      ),
  ]);

  if (!dbUser) {
    throw new Error("User record not found.");
  }

  return {
    profile: dbUser,
    linkedTreeProfiles: linkedRows as LinkedTreeProfile[],
  };
}
