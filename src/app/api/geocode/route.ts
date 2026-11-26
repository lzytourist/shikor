import { NextResponse } from "next/server";

import { getCurrentSession } from "@/server/dal/auth";
import { geocodeCityCountry, reverseGeocodeCoords } from "@/server/dal/geocode";

export async function GET(request: Request) {
  const session = await getCurrentSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const latRaw = searchParams.get("lat");
  const lngRaw = searchParams.get("lng");

  if (latRaw !== null && lngRaw !== null) {
    const lat = Number.parseFloat(latRaw);
    const lng = Number.parseFloat(lngRaw);
    const place = await reverseGeocodeCoords(lat, lng);
    return NextResponse.json({
      city: place?.city ?? null,
      country: place?.country ?? null,
    });
  }

  const city = searchParams.get("city");
  const country = searchParams.get("country");
  const coords = await geocodeCityCountry(city, country);
  return NextResponse.json({
    latitude: coords?.latitude ?? null,
    longitude: coords?.longitude ?? null,
  });
}
