"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNotNull } from "drizzle-orm";

import { db } from "@/db";
import {
  type BloodGroup,
  familyTrees,
  persons,
  treeMembers,
  user,
} from "@/db/schema";
import { requireUser } from "@/server/dal/auth";
import { geocodeCityCountry } from "@/server/dal/geocode";

export interface UpdateMyProfilePayload {
  name: string;
  phone?: string | null;
  bloodGroup?: BloodGroup | null;
  currentCity?: string | null;
  currentCountry?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  syncToLinkedNodes: boolean;
}

function sanitizeCoord(
  val: number | null | undefined,
  min: number,
  max: number,
): number | null {
  if (typeof val !== "number" || !Number.isFinite(val)) return null;
  if (val < min || val > max) return null;
  return Number(val.toFixed(6));
}

export async function updateMyProfileAction(input: UpdateMyProfilePayload) {
  try {
    const { user: sessionUser } = await requireUser();

    const cleanName = input.name.trim();
    if (cleanName.length < 2) {
      return {
        ok: false as const,
        error: "Name must be at least 2 characters.",
      };
    }

    const cleanCity = input.currentCity?.trim() || null;
    const cleanCountry = input.currentCountry?.trim() || null;
    const cleanPhone = input.phone?.trim() || null;
    const cleanBlood = input.bloodGroup || null;

    let latitude = sanitizeCoord(input.latitude, -90, 90);
    let longitude = sanitizeCoord(input.longitude, -180, 180);

    // If only city/country were provided without pinpoint coordinates, geocode automatically
    if ((latitude === null || longitude === null) && (cleanCity || cleanCountry)) {
      const geocoded = await geocodeCityCountry(cleanCity, cleanCountry);
      if (geocoded) {
        latitude = Number(geocoded.latitude.toFixed(6));
        longitude = Number(geocoded.longitude.toFixed(6));
      }
    }

    await db
      .update(user)
      .set({
        name: cleanName,
        phone: cleanPhone,
        bloodGroup: cleanBlood,
        currentCity: cleanCity,
        currentCountry: cleanCountry,
        latitude,
        longitude,
      })
      .where(eq(user.id, sessionUser.id));

    let syncedCount = 0;

    if (input.syncToLinkedNodes) {
      const linked = await db
        .select({
          personId: treeMembers.claimedPersonId,
          treeSlug: familyTrees.slug,
        })
        .from(treeMembers)
        .innerJoin(familyTrees, eq(treeMembers.treeId, familyTrees.id))
        .where(
          and(
            eq(treeMembers.userId, sessionUser.id),
            isNotNull(treeMembers.claimedPersonId),
          ),
        );

      const personIds = linked
        .map((r) => r.personId)
        .filter((id): id is string => Boolean(id));

      if (personIds.length > 0) {
        const updateSet: Partial<typeof persons.$inferInsert> = {
          currentCity: cleanCity,
          currentCountry: cleanCountry,
          latitude,
          longitude,
        };
        if (cleanPhone !== null) {
          updateSet.contactPhone = cleanPhone;
        }
        if (cleanBlood !== null) {
          updateSet.bloodGroup = cleanBlood;
        }

        await db
          .update(persons)
          .set(updateSet)
          .where(inArray(persons.id, personIds));

        syncedCount = personIds.length;
        for (const row of linked) {
          revalidatePath(`/trees/${row.treeSlug}`);
        }
      }
    }

    revalidatePath("/profile");
    revalidatePath("/trees");
    return {
      ok: true as const,
      syncedCount,
      latitude,
      longitude,
    };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "Failed to update profile.",
    };
  }
}
