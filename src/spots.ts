/**
 * Configure tes spots de kitesurf ici !
 *
 * Pour trouver les coordonnées d'un spot :
 * 1. Va sur Google Maps
 * 2. Clic droit sur le spot → "Coordonnées"
 * 3. Copie latitude, longitude
 *
 * `idealDirections` : directions de vent idéales pour le spot (N, NE, E, SE, S, SW, W, NW)
 * `minWind` : vent minimum en noeuds pour que ça vaille le coup
 * `tide` : si le spot dépend de la marée (optionnel)
 *   - `need` : "high" (marée haute) ou "low" (marée basse)
 *   - `windowHours` : nombre d'heures autour du pic de marée où c'est praticable
 */

export interface TideConfig {
  need: "high" | "low";
  windowHours: number;
}

export interface Spot {
  name: string;
  lat: number;
  lon: number;
  idealDirections: string[];
  minWind: number;
  tide?: TideConfig;
}

export const spots: Spot[] = [
  {
    name: "🏖️ Cayeux-sur-Mer",
    lat: 50.1833,
    lon: 1.5,
    idealDirections: ["SW", "W", "S", "NW"],
    minWind: 14,
    tide: { need: "low", windowHours: 3 },
  },
  {
    name: "🦭 Le Crotoy — Baie de Somme",
    lat: 50.215,
    lon: 1.628,
    idealDirections: ["W", "SW", "NW", "N"],
    minWind: 14,
    tide: { need: "high", windowHours: 2 },
  },
  {
    name: "💨 L'Almanarre — Hyères",
    lat: 43.06,
    lon: 6.145,
    idealDirections: ["E", "SE", "W"],
    minWind: 15,
  },
  {
    name: "🌊 Le Touquet",
    lat: 50.524,
    lon: 1.585,
    idealDirections: ["SW", "W", "NW", "S"],
    minWind: 14,
    tide: { need: "low", windowHours: 3 },
  },
];
