"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  setWorkerUrl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Crosshair, Loader2, MapPin, Search, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

if (typeof window !== "undefined") {
  setWorkerUrl(
    new URL(
      "maplibre-gl/dist/maplibre-gl-worker.mjs",
      import.meta.url,
    ).toString(),
  );
}

export interface LocationValue {
  city: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
}

interface PinpointLocationPickerProps {
  value: LocationValue;
  onChange: (next: LocationValue) => void;
  showGpsButton?: boolean;
  defaultExpandedMap?: boolean;
}

export function PinpointLocationPicker({
  value,
  onChange,
  showGpsButton = true,
  defaultExpandedMap = false,
}: PinpointLocationPickerProps) {
  const [showMap, setShowMap] = useState(defaultExpandedMap);
  const [isLocating, setIsLocating] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);

  // Draft strings only exist while user is actively typing partial decimals
  const [latDraft, setLatDraft] = useState<string | null>(null);
  const [lngDraft, setLngDraft] = useState<string | null>(null);

  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    valueRef.current = value;
    onChangeRef.current = onChange;
  }, [value, onChange]);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);

  const applyCoordsAndReverseGeocode = useCallback(
    async (lat: number, lng: number) => {
      const roundedLat = Number(lat.toFixed(6));
      const roundedLng = Number(lng.toFixed(6));
      const current = valueRef.current;

      setLatDraft(null);
      setLngDraft(null);
      onChangeRef.current({
        ...current,
        latitude: roundedLat,
        longitude: roundedLng,
      });

      try {
        const res = await fetch(
          `/api/geocode?lat=${encodeURIComponent(roundedLat)}&lng=${encodeURIComponent(roundedLng)}`,
        );
        if (res.ok) {
          const data = (await res.json()) as {
            city: string | null;
            country: string | null;
          };
          if (data.city || data.country) {
            onChangeRef.current({
              city: data.city ?? current.city,
              country: data.country ?? current.country,
              latitude: roundedLat,
              longitude: roundedLng,
            });
          }
        }
      } catch {
        // Coordinates still saved even if reverse geocode fails
      }
    },
    [],
  );

  useEffect(() => {
    if (!showMap || !mapContainerRef.current) return;

    const hasCoords =
      valueRef.current.latitude !== null &&
      valueRef.current.longitude !== null;
    const startLng = valueRef.current.longitude ?? 90.4125;
    const startLat = valueRef.current.latitude ?? 23.8103;

    const map = new MapLibreMap({
      container: mapContainerRef.current,
      style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
      center: [startLng, startLat],
      zoom: hasCoords ? 13 : 5,
    });
    map.addControl(new NavigationControl(), "top-right");
    mapRef.current = map;

    const placeMarker = (lng: number, lat: number) => {
      if (markerRef.current) {
        markerRef.current.setLngLat([lng, lat]);
      } else {
        const marker = new Marker({ color: "#059669", draggable: true })
          .setLngLat([lng, lat])
          .addTo(map);
        marker.on("dragend", () => {
          const pos = marker.getLngLat();
          void applyCoordsAndReverseGeocode(pos.lat, pos.lng);
        });
        markerRef.current = marker;
      }
    };

    if (hasCoords) {
      placeMarker(startLng, startLat);
    }

    map.on("click", (e) => {
      placeMarker(e.lngLat.lng, e.lngLat.lat);
      void applyCoordsAndReverseGeocode(e.lngLat.lat, e.lngLat.lng);
    });

    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [showMap, applyCoordsAndReverseGeocode]);

  // Sync pin position when coordinates update via text input / GPS / City lookup
  useEffect(() => {
    if (!showMap || !mapRef.current) return;
    if (value.latitude === null || value.longitude === null) return;

    const map = mapRef.current;
    if (markerRef.current) {
      markerRef.current.setLngLat([value.longitude, value.latitude]);
    } else {
      const marker = new Marker({ color: "#059669", draggable: true })
        .setLngLat([value.longitude, value.latitude])
        .addTo(map);
      marker.on("dragend", () => {
        const pos = marker.getLngLat();
        void applyCoordsAndReverseGeocode(pos.lat, pos.lng);
      });
      markerRef.current = marker;
    }
    map.flyTo({
      center: [value.longitude, value.latitude],
      zoom: Math.max(map.getZoom(), 12),
    });
  }, [value.latitude, value.longitude, showMap, applyCoordsAndReverseGeocode]);

  const handleUseGps = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("Location access is not supported by this browser.");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setShowMap(true);
        await applyCoordsAndReverseGeocode(
          pos.coords.latitude,
          pos.coords.longitude,
        );
        setIsLocating(false);
        toast.success("Pinned your exact current location!");
      },
      (err) => {
        setIsLocating(false);
        toast.error(
          err.message || "Could not read your GPS location. Check permissions.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleLookupCity = async () => {
    if (!value.city.trim() && !value.country.trim()) {
      toast.error("Enter a city or country first.");
      return;
    }
    setIsLookingUp(true);
    try {
      const res = await fetch(
        `/api/geocode?city=${encodeURIComponent(value.city)}&country=${encodeURIComponent(value.country)}`,
      );
      const data = (await res.json()) as {
        latitude: number | null;
        longitude: number | null;
      };
      if (data.latitude !== null && data.longitude !== null) {
        setLatDraft(null);
        setLngDraft(null);
        onChange({
          ...value,
          latitude: Number(data.latitude.toFixed(6)),
          longitude: Number(data.longitude.toFixed(6)),
        });
        setShowMap(true);
        toast.success("Found city! Drag the pin for exact address.");
      } else {
        toast.error("Could not find that city. Try picking directly on the map.");
      }
    } catch {
      toast.error("Location lookup failed.");
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleLatTextChange = (raw: string) => {
    // Support pasting "23.8103, 90.4125" directly from Google Maps
    const pairMatch = raw.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
    if (pairMatch) {
      const lat = Number.parseFloat(pairMatch[1]);
      const lng = Number.parseFloat(pairMatch[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        setLatDraft(null);
        setLngDraft(null);
        onChange({
          ...value,
          latitude: Number(lat.toFixed(6)),
          longitude: Number(lng.toFixed(6)),
        });
        toast.success("Parsed coordinates!");
        return;
      }
    }

    setLatDraft(raw);
    if (!raw.trim()) {
      onChange({ ...value, latitude: null });
      return;
    }
    const parsed = Number.parseFloat(raw);
    if (Number.isFinite(parsed) && parsed >= -90 && parsed <= 90) {
      onChange({ ...value, latitude: Number(parsed.toFixed(6)) });
    }
  };

  const handleLngTextChange = (raw: string) => {
    setLngDraft(raw);
    if (!raw.trim()) {
      onChange({ ...value, longitude: null });
      return;
    }
    const parsed = Number.parseFloat(raw);
    if (Number.isFinite(parsed) && parsed >= -180 && parsed <= 180) {
      onChange({ ...value, longitude: Number(parsed.toFixed(6)) });
    }
  };

  const displayedLat =
    latDraft !== null
      ? latDraft
      : value.latitude !== null
        ? String(value.latitude)
        : "";
  const displayedLng =
    lngDraft !== null
      ? lngDraft
      : value.longitude !== null
        ? String(value.longitude)
        : "";

  return (
    <div className="rounded-xl border bg-muted/20 p-3.5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          Location &amp; Pinpoint Coordinates
        </span>

        <div className="flex flex-wrap items-center gap-1.5">
          {showGpsButton && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isLocating}
              onClick={handleUseGps}
              className="h-7 px-2.5 text-[11px] gap-1 cursor-pointer bg-background"
            >
              {isLocating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Crosshair className="h-3 w-3 text-primary" />
              )}
              Use My GPS
            </Button>
          )}

          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isLookingUp}
            onClick={handleLookupCity}
            className="h-7 px-2.5 text-[11px] gap-1 cursor-pointer bg-background"
          >
            {isLookingUp ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Search className="h-3 w-3 text-primary" />
            )}
            Find City
          </Button>

          <Button
            type="button"
            size="sm"
            variant={showMap ? "secondary" : "outline"}
            onClick={() => setShowMap((v) => !v)}
            className="h-7 px-2.5 text-[11px] gap-1 cursor-pointer"
          >
            <MapPin className="h-3 w-3" />
            {showMap ? "Hide Map" : "Pin on Map"}
          </Button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-2.5">
        <Field className="gap-1">
          <FieldLabel className="text-xs">Current City</FieldLabel>
          <Input
            value={value.city}
            placeholder="e.g. Dhaka, London, Toronto"
            onChange={(e) => onChange({ ...value, city: e.target.value })}
            className="bg-background"
          />
        </Field>
        <Field className="gap-1">
          <FieldLabel className="text-xs">Current Country</FieldLabel>
          <Input
            value={value.country}
            placeholder="e.g. Bangladesh"
            onChange={(e) => onChange({ ...value, country: e.target.value })}
            className="bg-background"
          />
        </Field>
      </div>

      <div className="grid sm:grid-cols-[1fr_1fr_auto] items-end gap-2.5">
        <Field className="gap-1">
          <FieldLabel className="text-xs">
            Latitude{" "}
            <span className="font-normal text-muted-foreground">
              (or paste lat, lng)
            </span>
          </FieldLabel>
          <Input
            value={displayedLat}
            placeholder="e.g. 23.810332"
            onChange={(e) => handleLatTextChange(e.target.value)}
            onBlur={() => setLatDraft(null)}
            className="bg-background font-mono text-xs"
          />
        </Field>

        <Field className="gap-1">
          <FieldLabel className="text-xs">Longitude</FieldLabel>
          <Input
            value={displayedLng}
            placeholder="e.g. 90.412518"
            onChange={(e) => handleLngTextChange(e.target.value)}
            onBlur={() => setLngDraft(null)}
            className="bg-background font-mono text-xs"
          />
        </Field>

        {(value.latitude !== null || value.longitude !== null) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            title="Clear coordinates"
            onClick={() => {
              setLatDraft(null);
              setLngDraft(null);
              onChange({ ...value, latitude: null, longitude: null });
            }}
            className="h-9 px-2.5 text-xs text-muted-foreground hover:text-destructive cursor-pointer"
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Clear Pin
          </Button>
        )}
      </div>

      {showMap && (
        <div className="space-y-1.5">
          <div
            ref={mapContainerRef}
            className="h-52 w-full rounded-lg border overflow-hidden"
          />
          <p className="text-[11px] text-muted-foreground">
            Click anywhere on the map or drag the green pin to set an exact
            neighborhood or home coordinate.
          </p>
        </div>
      )}
    </div>
  );
}
