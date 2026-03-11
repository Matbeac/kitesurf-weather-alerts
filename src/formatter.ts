import type { SpotForecast, DayForecast } from "./weather.js";
import type { SpotTides } from "./tides.js";
import { getTideTimesForDay } from "./tides.js";
import type { TideConfig } from "./spots.js";

/**
 * Génère le message WhatsApp hebdomadaire.
 *
 * Format optimisé pour WhatsApp :
 * - Emojis pour la lisibilité
 * - Gras avec *texte*
 * - Italique avec _texte_
 */

function windEmoji(knots: number): string {
  if (knots >= 25) return "🔥";
  if (knots >= 20) return "💨";
  if (knots >= 15) return "✅";
  if (knots >= 12) return "🟡";
  return "😴";
}

function directionArrow(dir: string): string {
  const arrows: Record<string, string> = {
    N: "⬇️",
    NE: "↙️",
    E: "⬅️",
    SE: "↖️",
    S: "⬆️",
    SW: "↗️",
    W: "➡️",
    NW: "↘️",
  };
  return arrows[dir] ?? "🔄";
}

function weatherEmoji(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 3) return "⛅";
  if (code <= 48) return "🌫️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "🌨️";
  if (code <= 82) return "🌧️";
  if (code <= 99) return "⛈️";
  return "🌤️";
}

function formatDaySummary(
  day: DayForecast,
  minWind: number,
  tides: SpotTides | null,
  tideConfig: TideConfig | undefined,
): string {
  const dayLabel = day.isWeekend ? `*${day.dayName}* 🎉` : day.dayName;
  const dateShort = day.date.slice(5); // MM-DD

  // Wind direction breakdown for the day (hourly)
  const dirBreakdown = formatHourlyDirections(day);

  // Tide info
  let tideStr = "";
  if (tides && tideConfig) {
    const tideTimes = getTideTimesForDay(tides, day.date, tideConfig.need);
    if (tideTimes.length > 0) {
      tideStr = ` 🌊 ${tideTimes.join(" / ")}`;
    }
  }

  if (day.bestHours.length === 0 && day.maxWind < minWind) {
    return `  ${dayLabel} (${dateShort}): 😴 ${day.avgWind}-${day.maxWind}kts ${dirBreakdown} — _flat_${tideStr}`;
  }

  const gustInfo =
    day.maxGusts > day.maxWind + 5 ? ` (raf ${day.maxGusts}kts)` : "";

  // Show best time window
  let timeWindow = "";
  if (day.bestHours.length > 0) {
    const firstH = day.bestHours[0].hour;
    const lastH = day.bestHours[day.bestHours.length - 1].hour;
    timeWindow = ` 🕐 ${firstH}h-${lastH + 1}h`;
  }

  const tempInfo = `${day.avgTemp}°C`;
  const weatherIcon = weatherEmoji(
    day.hours[Math.floor(day.hours.length / 2)]?.weatherCode ?? 0,
  );

  return `  ${dayLabel} (${dateShort}): ${windEmoji(day.maxWind)} ${day.avgWind}-${day.maxWind}kts${gustInfo} ${dirBreakdown}${timeWindow}${tideStr} ${weatherIcon} ${tempInfo}`;
}

/**
 * Affiche l'orientation du vent par tranche de la journée :
 * matin / midi / aprèm — avec flèches directionnelles
 */
function formatHourlyDirections(day: DayForecast): string {
  const morning = day.hours.filter((h) => h.hour >= 7 && h.hour < 12);
  const midday = day.hours.filter((h) => h.hour >= 12 && h.hour < 15);
  const afternoon = day.hours.filter((h) => h.hour >= 15 && h.hour <= 20);

  function slotDir(hours: typeof day.hours): string {
    if (hours.length === 0) return "—";
    const counts = new Map<string, number>();
    for (const h of hours) {
      counts.set(h.windDirection, (counts.get(h.windDirection) ?? 0) + 1);
    }
    let best = hours[0].windDirection;
    let max = 0;
    for (const [d, c] of counts) {
      if (c > max) {
        best = d;
        max = c;
      }
    }
    return `${directionArrow(best)}${best}`;
  }

  return `${slotDir(morning)}→${slotDir(midday)}→${slotDir(afternoon)}`;
}

function formatSpot(forecast: SpotForecast, tides: SpotTides | null): string {
  const { spot, days, kitableHours } = forecast;
  const lines: string[] = [];

  // Spot header
  const tideLabel =
    spot.tide?.need === "high"
      ? " (marée haute)"
      : spot.tide?.need === "low"
        ? " (marée basse)"
        : "";

  if (kitableHours > 0) {
    lines.push(`${spot.name}${tideLabel} — *${kitableHours}h kitables* 🪁`);
  } else {
    lines.push(`${spot.name}${tideLabel} — _pas de session cette semaine_ 😢`);
  }

  // Day by day
  for (const day of days) {
    lines.push(formatDaySummary(day, spot.minWind, tides, spot.tide));
  }

  return lines.join("\n");
}

function getWeekendVerdict(forecasts: SpotForecast[]): string {
  const weekendSpots: { name: string; hours: number; maxWind: number }[] = [];

  for (const f of forecasts) {
    const weekendDays = f.days.filter((d) => d.isWeekend);
    const weekendHours = weekendDays.reduce(
      (sum, d) => sum + d.bestHours.length,
      0,
    );
    const maxWind = Math.max(...weekendDays.map((d) => d.maxWind), 0);
    if (weekendHours > 0) {
      weekendSpots.push({
        name: f.spot.name,
        hours: weekendHours,
        maxWind,
      });
    }
  }

  if (weekendSpots.length === 0) {
    return "🛋️ *Verdict week-end :* Canapé & Netflix. Pas de vent prévu.";
  }

  weekendSpots.sort((a, b) => b.hours - a.hours);
  const best = weekendSpots[0];
  return `🏆 *Verdict week-end :* Fonce à ${best.name} ! ${best.hours}h de vent annoncées, pointes à ${best.maxWind}kts`;
}

function getWeekVerdict(forecasts: SpotForecast[]): string {
  let bestSpot = "";
  let bestHours = 0;
  let bestMaxWind = 0;

  for (const f of forecasts) {
    if (f.kitableHours > bestHours) {
      bestSpot = f.spot.name;
      bestHours = f.kitableHours;
      bestMaxWind = f.bestDay?.maxWind ?? 0;
    }
  }

  if (bestHours === 0) {
    return "📅 *Verdict semaine :* Semaine calme. Reste au bureau !";
  }

  return `📅 *Verdict semaine :* Meilleur spot → ${bestSpot} avec ${bestHours}h de ride, max ${bestMaxWind}kts`;
}

export function formatWhatsAppMessage(
  forecasts: SpotForecast[],
  tideMap: Map<string, SpotTides>,
): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const sections: string[] = [];

  // Header
  sections.push(`🪁 *KITE FORECAST — Semaine du ${dateStr}*`);
  sections.push("━━━━━━━━━━━━━━━━━━━━━━━━");

  // Weekend verdict first (the most important info)
  sections.push(getWeekendVerdict(forecasts));
  sections.push(getWeekVerdict(forecasts));
  sections.push("");

  // Legend
  sections.push("🔥 >25kts | 💨 20-25 | ✅ 15-20 | 🟡 12-15 | 😴 <12");
  sections.push("Vent : matin→midi→aprèm | 🌊 marées");
  sections.push("━━━━━━━━━━━━━━━━━━━━━━━━");

  // Each spot
  for (const forecast of forecasts) {
    sections.push("");
    const spotTides = tideMap.get(forecast.spot.name) ?? null;
    sections.push(formatSpot(forecast, spotTides));
  }

  // Footer
  sections.push("");
  sections.push("━━━━━━━━━━━━━━━━━━━━━━━━");
  sections.push("_Modèle : ICON-EU (DWD) via Open-Meteo.com_");
  sections.push(
    "_Marées : Stormglass.io | ⚠️ Vérifie toujours avant de partir !_",
  );

  return sections.join("\n");
}
