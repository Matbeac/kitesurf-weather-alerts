#!/usr/bin/env tsx

import { spots } from "./spots.js";
import { fetchAllForecasts } from "./weather.js";
import { fetchAllTides } from "./tides.js";
import { formatWhatsAppMessage } from "./formatter.js";
import { sendWhatsApp } from "./sender.js";

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  console.log("🪁 Kitesurf Weather Alerts");
  console.log(`📍 ${spots.length} spots configurés`);
  console.log(
    `📅 ${new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`,
  );
  console.log("");

  // Fetch forecasts
  console.log("🌤️  Récupération des prévisions météo...");
  const forecasts = await fetchAllForecasts(spots);

  // Fetch tides for spots that need them
  const spotsWithTides = spots.filter((s) => s.tide);
  let tideMap = new Map();
  if (spotsWithTides.length > 0) {
    console.log(
      `🌊 Récupération des marées (${spotsWithTides.length} spots)...`,
    );
    tideMap = await fetchAllTides(spots);
  }

  // Format message
  const message = formatWhatsAppMessage(forecasts, tideMap);

  // Send
  await sendWhatsApp({ message, dryRun });

  if (!dryRun) {
    console.log("\n🎉 Forecast envoyé avec succès !");
  }
}

main().catch((err) => {
  console.error("❌ Erreur:", err);
  process.exit(1);
});
