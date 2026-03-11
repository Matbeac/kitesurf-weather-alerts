import type { Spot } from "./spots.js";

/**
 * Récupération des horaires de marées via Stormglass API.
 *
 * API gratuite : 10 requêtes/jour (largement suffisant pour 1x/semaine).
 * Inscription : https://stormglass.io (gratuit, clé API instantanée)
 *
 * On récupère les extremes (high/low) pour les 7 prochains jours.
 */

export interface TideExtreme {
  datetime: string;
  date: string;
  hour: number;
  type: "high" | "low";
  height: number;
}

export interface SpotTides {
  spotName: string;
  extremes: TideExtreme[];
}

export async function fetchTides(spot: Spot): Promise<SpotTides | null> {
  if (!spot.tide) return null;

  const apiKey = process.env.STORMGLASS_API_KEY;
  if (!apiKey) {
    console.warn(
      `⚠️  STORMGLASS_API_KEY manquante — pas de marées pour ${spot.name}`,
    );
    return null;
  }

  const now = new Date();
  const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const url = new URL("https://api.stormglass.io/v2/tide/extremes/point");
  url.searchParams.set("lat", spot.lat.toString());
  url.searchParams.set("lng", spot.lon.toString());
  url.searchParams.set("start", now.toISOString());
  url.searchParams.set("end", end.toISOString());

  const res = await fetch(url.toString(), {
    headers: { Authorization: apiKey },
  });

  if (!res.ok) {
    console.warn(
      `⚠️  Stormglass API error pour ${spot.name}: ${res.status} ${res.statusText}`,
    );
    return null;
  }

  interface StormglassExtreme {
    time: string;
    type: string;
    height: number;
  }

  const data: { data: StormglassExtreme[] } = await res.json();

  const extremes: TideExtreme[] = data.data.map((e) => {
    const dt = new Date(e.time);
    return {
      datetime: e.time,
      date: dt.toISOString().split("T")[0],
      hour: dt.getHours(),
      type: e.type === "high" ? "high" : "low",
      height: Math.round(e.height * 100) / 100,
    };
  });

  return { spotName: spot.name, extremes };
}

export async function fetchAllTides(
  spots: Spot[],
): Promise<Map<string, SpotTides>> {
  const tideMap = new Map<string, SpotTides>();

  for (const spot of spots) {
    if (!spot.tide) continue;
    const tides = await fetchTides(spot);
    if (tides) {
      tideMap.set(spot.name, tides);
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  return tideMap;
}

/**
 * Pour un jour et un spot donnés, retourne les horaires de marée pertinents.
 * - Cayeux / Le Touquet → marée basse (grandes plages découvertes)
 * - Le Crotoy → marée haute (la baie se remplit)
 */
export function getTideTimesForDay(
  tides: SpotTides,
  date: string,
  need: "high" | "low",
): string[] {
  return tides.extremes
    .filter((e) => e.date === date && e.type === need)
    .map((e) => {
      const dt = new Date(e.datetime);
      const h = dt.getHours().toString().padStart(2, "0");
      const m = dt.getMinutes().toString().padStart(2, "0");
      const heightStr = e.height > 0 ? `${e.height.toFixed(1)}m` : "";
      const label = need === "high" ? "PM" : "BM";
      return `${label} ${h}:${m}${heightStr ? ` (${heightStr})` : ""}`;
    });
}
