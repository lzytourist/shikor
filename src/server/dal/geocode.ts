import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { geocache } from "@/db/schema";

export async function geocodeCityCountry(
  city?: string | null,
  country?: string | null,
): Promise<{ latitude: number; longitude: number } | null> {
  const parts = [city?.trim(), country?.trim()].filter(Boolean);
  if (parts.length === 0) return null;

  const query = parts.join(", ");
  const queryKey = query.toLowerCase();

  const cached = await db.query.geocache.findFirst({
    where: eq(geocache.queryKey, queryKey),
  });
  if (cached) {
    return { latitude: cached.latitude, longitude: cached.longitude };
  }

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", query);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");

    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "ShikorFamilyTreeApp/1.0 (local-dev)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>;
    if (!data[0]) return null;

    const latitude = Number.parseFloat(data[0].lat);
    const longitude = Number.parseFloat(data[0].lon);
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) return null;

    await db
      .insert(geocache)
      .values({
        queryKey,
        latitude,
        longitude,
        displayLabel: data[0].display_name,
      })
      .onConflictDoUpdate({
        target: geocache.queryKey,
        set: { latitude, longitude, updatedAt: new Date() },
      });

    return { latitude, longitude };
  } catch {
    return null;
  }
}
