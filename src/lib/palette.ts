import type { EventCategory } from "./types";

// Tactical command-center palette. Humans read cool/cyan, bots warm/amber so
// the two populations separate instantly even on a busy map.
export const COLORS = {
  human: "#22d3ee", // cyan-400
  humanDim: "rgba(34,211,238,0.35)",
  bot: "#f59e0b", // amber-500
  botDim: "rgba(245,158,11,0.30)",

  kill: "#ef4444", // red — you killed something
  death: "#a855f7", // purple — you died
  loot: "#34d399", // emerald — pickup
  storm: "#3b82f6", // blue — storm death

  start: "#ffffff",
  extract: "#facc15",
} as const;

export const CATEGORY_COLOR: Record<EventCategory, string> = {
  kill: COLORS.kill,
  death: COLORS.death,
  loot: COLORS.loot,
  storm: COLORS.storm,
  position: COLORS.human,
};

export const CATEGORY_LABEL: Record<EventCategory, string> = {
  kill: "Kills",
  death: "Deaths",
  loot: "Loot",
  storm: "Storm deaths",
  position: "Movement",
};

// Thermal gradient stops for heatmaps (low -> high density).
export const HEAT_GRADIENT: [number, string][] = [
  [0.0, "rgba(0,0,80,0)"],
  [0.25, "rgba(0,90,200,0.55)"],
  [0.45, "rgba(0,200,180,0.7)"],
  [0.65, "rgba(180,230,40,0.8)"],
  [0.85, "rgba(255,150,0,0.9)"],
  [1.0, "rgba(255,40,20,0.95)"],
];
