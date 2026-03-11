import type { Spot } from "./spots.js";

/**
 * Open-Meteo API — 100% gratuit, pas de clé API
 * https://open-meteo.com/en/docs
 *
 * Modèle utilisé : "best_match" (défaut Open-Meteo)
 * → Pour la France, ça sélectionne automatiquement :
 *   - ICON-EU (DWD, 7km) pour J+0 à J+2 — le plus précis pour le vent en Europe
 *   - ICON Global (DWD, 13km) pour J+3 à J+7
 *   - Parfois ECMWF IFS (9km) si meilleur score
 *
 * Alternatives possibles (changer le paramètre `models`) :
 *   - "ecmwf_ifs025"  → ECMWF IFS 0.25° (le modèle européen de référence)
 *   - "gfs_seamless"  → GFS (NOAA, américain, 13km)
 *   - "meteofrance_seamless" → ARPEGE/AROME (Météo-France, excellent pour la France)
 *
 * Données horaires récupérées :
 * - wind_speed_10m (km/h → convertis en noeuds)
 * - wind_gusts_10m (km/h → convertis en noeuds)
 * - wind_direction_10m (degrés → direction cardinale)
 * - temperature_2m (°C)
 * - weather_code (WMO code pour l'icône météo)
 */

const KMH_TO_KNOTS = 0.539957;

/** Change this to use a specific model instead of auto-selection */
const WEATHER_MODEL: string | null = null; // e.g. "meteofrance_seamless"

interface HourlyData {
  time: string[];
  wind_speed_10m: number[];
  wind_gusts_10m: number[];
  wind_direction_10m: number[];
  temperature_2m: number[];
  weather_code: number[];
}

interface OpenMeteoResponse {
  hourly: HourlyData;
}

export interface HourForecast {
  datetime: string;
  date: string;
  hour: number;
  windKnots: number;
  gustsKnots: number;
  windDirection: string;
  windDegrees: number;
  temperature: number;
  weatherCode: number;
}

export interface DayForecast {
  date: string;
  dayName: string;
  isWeekend: boolean;
  hours: HourForecast[];
  maxWind: number;
  maxGusts: number;
  avgWind: number;
  dominantDirection: string;
  avgTemp: number;
  bestHours: HourForecast[];
}

export interface SpotForecast {
  spot: Spot;
  days: DayForecast[];
  bestDay: DayForecast | null;
  kitableHours: number;
}

function degreesToDirection(deg: number): string {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round(deg / 45) % 8;
  return directions[index];
}

function getDayName(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const days = [
    "Dimanche",
    "Lundi",
    "Mardi",
    "Mercredi",
    "Jeudi",
    "Vendredi",
    "Samedi",
  ];
  return days[date.getDay()];
}

function isWeekend(dateStr: string): boolean {
  const date = new Date(dateStr + "T00:00:00");
  const day = date.getDay();
  return day === 0 || day === 6;
}

function dominantDirection(directions: string[]): string {
  const counts = new Map<string, number>();
  for (const dir of directions) {
    counts.set(dir, (counts.get(dir) ?? 0) + 1);
  }
  let maxDir = directions[0];
  let maxCount = 0;
  for (const [dir, count] of counts) {
    if (count > maxCount) {
      maxDir = dir;
      maxCount = count;
    }
  }
  return maxDir;
}

export async function fetchSpotForecast(spot: Spot): Promise<SpotForecast> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", spot.lat.toString());
  url.searchParams.set("longitude", spot.lon.toString());
  url.searchParams.set(
    "hourly",
    "wind_speed_10m,wind_gusts_10m,wind_direction_10m,temperature_2m,weather_code",
  );
  url.searchParams.set("wind_speed_unit", "kmh");
  url.searchParams.set("timezone", "Europe/Paris");
  url.searchParams.set("forecast_days", "7");

  if (WEATHER_MODEL) {
    url.searchParams.set("models", WEATHER_MODEL);
  }

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(
      `Open-Meteo API error for ${spot.name}: ${res.status} ${res.statusText}`,
    );
  }

  const data: OpenMeteoResponse = await res.json();
  const { hourly } = data;

  // Parse hourly data
  const allHours: HourForecast[] = hourly.time.map((t, i) => {
    const dt = new Date(t);
    return {
      datetime: t,
      date: t.split("T")[0],
      hour: dt.getHours(),
      windKnots: Math.round(hourly.wind_speed_10m[i] * KMH_TO_KNOTS),
      gustsKnots: Math.round(hourly.wind_gusts_10m[i] * KMH_TO_KNOTS),
      windDirection: degreesToDirection(hourly.wind_direction_10m[i]),
      windDegrees: hourly.wind_direction_10m[i],
      temperature: Math.round(hourly.temperature_2m[i]),
      weatherCode: hourly.weather_code[i],
    };
  });

  // Filter to useful hours (7h - 20h)
  const usableHours = allHours.filter((h) => h.hour >= 7 && h.hour <= 20);

  // Group by day
  const dayMap = new Map<string, HourForecast[]>();
  for (const h of usableHours) {
    const existing = dayMap.get(h.date) ?? [];
    existing.push(h);
    dayMap.set(h.date, existing);
  }

  const days: DayForecast[] = [...dayMap.entries()].map(([date, hours]) => {
    const winds = hours.map((h) => h.windKnots);
    const kitableHours = hours.filter(
      (h) =>
        h.windKnots >= spot.minWind &&
        spot.idealDirections.includes(h.windDirection),
    );

    return {
      date,
      dayName: getDayName(date),
      isWeekend: isWeekend(date),
      hours,
      maxWind: Math.max(...winds),
      maxGusts: Math.max(...hours.map((h) => h.gustsKnots)),
      avgWind: Math.round(winds.reduce((a, b) => a + b, 0) / winds.length),
      dominantDirection: dominantDirection(hours.map((h) => h.windDirection)),
      avgTemp: Math.round(
        hours.map((h) => h.temperature).reduce((a, b) => a + b, 0) /
          hours.length,
      ),
      bestHours: kitableHours,
    };
  });

  const totalKitableHours = days.reduce(
    (sum, d) => sum + d.bestHours.length,
    0,
  );
  const bestDay =
    days.reduce(
      (best, d) =>
        d.bestHours.length > (best?.bestHours.length ?? 0) ? d : best,
      null as DayForecast | null,
    ) ?? null;

  return {
    spot,
    days,
    bestDay,
    kitableHours: totalKitableHours,
  };
}

export async function fetchAllForecasts(
  spots: Spot[],
): Promise<SpotForecast[]> {
  // Sequential to be nice with the free API
  const results: SpotForecast[] = [];
  for (const spot of spots) {
    results.push(await fetchSpotForecast(spot));
    // Small delay between requests
    await new Promise((r) => setTimeout(r, 300));
  }
  return results;
}
