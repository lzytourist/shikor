"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  Popup,
  setWorkerUrl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Globe2, MapPin, PlusCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Person } from "@/db/schema";

if (typeof window !== "undefined") {
  setWorkerUrl(
    new URL(
      "maplibre-gl/dist/maplibre-gl-worker.mjs",
      import.meta.url,
    ).toString(),
  );
}

interface FamilyMapViewProps {
  persons: Person[];
  onSelectPerson: (personId: string) => void;
}

interface CityCluster {
  key: string;
  label: string;
  latitude: number;
  longitude: number;
  members: Person[];
}

export function FamilyMapView({ persons, onSelectPerson }: FamilyMapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  const { clusters, unpinnedLiving } = useMemo(() => {
    const map = new Map<string, CityCluster>();
    const unpinned: Person[] = [];

    for (const p of persons) {
      if (p.latitude != null && p.longitude != null) {
        const label =
          [p.currentCity, p.currentCountry].filter(Boolean).join(", ") ||
          `Pinned (${p.latitude.toFixed(3)}, ${p.longitude.toFixed(3)})`;
        const key = `${p.latitude.toFixed(4)}:${p.longitude.toFixed(4)}`;
        const existing = map.get(key);
        if (existing) {
          existing.members.push(p);
        } else {
          map.set(key, {
            key,
            label,
            latitude: p.latitude,
            longitude: p.longitude,
            members: [p],
          });
        }
      } else if (p.isLiving && !p.isNameUnknown) {
        unpinned.push(p);
      }
    }

    return {
      clusters: [...map.values()].sort(
        (a, b) => b.members.length - a.members.length,
      ),
      unpinnedLiving: unpinned,
    };
  }, [persons]);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new MapLibreMap({
      container: mapContainerRef.current,
      style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
      center: [90.4125, 23.8103],
      zoom: clusters.length > 0 ? 3.5 : 5.5,
    });

    map.addControl(new NavigationControl(), "top-right");
    mapRef.current = map;

    const markers: Marker[] = [];
    for (const cluster of clusters) {
      const el = document.createElement("button");
      el.type = "button";
      el.className =
        "flex items-center gap-1 rounded-full bg-emerald-600 text-white px-2.5 py-1 text-xs font-semibold shadow-lg ring-2 ring-white cursor-pointer hover:scale-105 transition-transform";
      el.textContent = `${cluster.label.split(",")[0]} (${cluster.members.length})`;

      const popupNode = document.createElement("div");
      popupNode.className = "space-y-1.5 min-w-[160px] text-xs";
      const heading = document.createElement("p");
      heading.className = "font-semibold text-sm";
      heading.textContent = cluster.label;
      popupNode.appendChild(heading);

      const list = document.createElement("div");
      list.className = "flex flex-wrap gap-1";
      for (const m of cluster.members.slice(0, 8)) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className =
          "rounded border px-1.5 py-0.5 text-[11px] hover:border-emerald-600 cursor-pointer";
        chip.textContent = m.displayName;
        chip.onclick = () => onSelectPerson(m.id);
        list.appendChild(chip);
      }
      if (cluster.members.length > 8) {
        const more = document.createElement("span");
        more.className = "text-[11px] text-muted-foreground";
        more.textContent = `+${cluster.members.length - 8} more`;
        list.appendChild(more);
      }
      popupNode.appendChild(list);

      const popup = new Popup({ offset: 18, closeButton: false }).setDOMContent(
        popupNode,
      );

      el.onclick = () => {
        map.flyTo({
          center: [cluster.longitude, cluster.latitude],
          zoom: 9,
        });
      };

      const marker = new Marker({ element: el })
        .setLngLat([cluster.longitude, cluster.latitude])
        .setPopup(popup)
        .addTo(map);
      markers.push(marker);
    }

    if (clusters.length === 1) {
      map.setCenter([clusters[0].longitude, clusters[0].latitude]);
      map.setZoom(8);
    } else if (clusters.length > 1) {
      const bounds = new LngLatBounds();
      for (const c of clusters) {
        bounds.extend([c.longitude, c.latitude]);
      }
      map.fitBounds(bounds, { padding: 70, maxZoom: 9 });
    }

    return () => {
      for (const m of markers) m.remove();
      map.remove();
      mapRef.current = null;
    };
  }, [clusters, onSelectPerson]);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6">
      <div className="grid lg:grid-cols-3 gap-5 h-[calc(100vh-10rem)] min-h-[520px]">
        <div className="lg:col-span-2 relative rounded-2xl border overflow-hidden shadow-xs bg-card">
          <div ref={mapContainerRef} className="h-full w-full" />
        </div>

        <div className="rounded-2xl border bg-card flex flex-col overflow-hidden shadow-2xs">
          <div className="p-4 border-b space-y-1 shrink-0">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Globe2 className="h-4 w-4 text-primary" />
                Where Our Family Lives
              </h3>
              <Badge variant="secondary">{clusters.length} cities</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Add a relative&apos;s city and country on their profile to see
              them on the family map.
            </p>
          </div>

          <ScrollArea className="flex-1 min-h-0 p-4">
            <div className="space-y-5">
              {clusters.length === 0 ? (
                <div className="text-center py-6 space-y-2 rounded-xl border border-dashed p-4">
                  <MapPin className="h-7 w-7 text-muted-foreground/50 mx-auto" />
                  <p className="text-sm font-medium">No cities added yet</p>
                  <p className="text-xs text-muted-foreground">
                    Tap a living relative below to open their profile and add
                    their city (e.g. Dhaka, London, New York).
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {clusters.map((cluster) => (
                    <div
                      key={cluster.key}
                      className="rounded-xl border bg-muted/20 p-3 space-y-2"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          mapRef.current?.flyTo({
                            center: [cluster.longitude, cluster.latitude],
                            zoom: 9,
                          })
                        }
                        className="flex w-full items-center justify-between text-left font-medium text-sm hover:text-primary cursor-pointer"
                      >
                        <span className="inline-flex items-center gap-1.5 truncate">
                          <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                          {cluster.label}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {cluster.members.length}
                        </Badge>
                      </button>

                      <div className="flex flex-wrap gap-1.5">
                        {cluster.members.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => onSelectPerson(m.id)}
                            className="rounded-md border bg-background px-2 py-1 text-xs hover:border-primary cursor-pointer"
                          >
                            {m.displayName}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {unpinnedLiving.length > 0 && (
                <div className="space-y-2 pt-2 border-t">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <PlusCircle className="h-3.5 w-3.5 text-primary" />
                    Living relatives without a city ({unpinnedLiving.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {unpinnedLiving.slice(0, 18).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => onSelectPerson(p.id)}
                        className="rounded-md border border-dashed bg-muted/20 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-primary cursor-pointer"
                      >
                        + {p.displayName}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
