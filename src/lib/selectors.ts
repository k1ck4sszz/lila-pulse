import type { HeatPoint, MatchData } from "./types";
import type { MarkerInput } from "../components/MapCanvas";
import { categoryOf, CODE_TO_EVENT } from "./types";

export type HeatMetric = "traffic" | "kills" | "deaths" | "loot" | "storm";

const METRIC_CODES: Record<HeatMetric, number[]> = {
  traffic: [0, 1],
  kills: [2, 4],
  deaths: [3, 5],
  loot: [7],
  storm: [6],
};

export interface HeatFilter {
  metric: HeatMetric;
  dateIdxAllowed: Set<number> | null; // null = all dates
  showHumans: boolean;
  showBots: boolean;
}

// Filter bundled heat points -> world [x,z] for the heatmap renderer.
export function filterHeatPoints(
  points: HeatPoint[],
  f: HeatFilter,
): Array<[number, number]> {
  const codes = new Set(METRIC_CODES[f.metric]);
  const out: Array<[number, number]> = [];
  for (const [x, z, type, dateIdx, isBot] of points) {
    if (!codes.has(type)) continue;
    if (f.dateIdxAllowed && !f.dateIdxAllowed.has(dateIdx)) continue;
    if (isBot === 1 && !f.showBots) continue;
    if (isBot === 0 && !f.showHumans) continue;
    out.push([x, z]);
  }
  return out;
}

// Build heat points (same row layout) from in-memory matches — used for the
// uploaded/plug-and-play path where there is no precomputed heat file.
export function heatPointsFromMatches(
  matches: MatchData[],
  dateIdxOf: (date: string) => number,
): HeatPoint[] {
  const rows: HeatPoint[] = [];
  for (const m of matches) {
    const di = dateIdxOf(m.date);
    for (const p of m.players) {
      const bot = p.isBot ? 1 : 0;
      const posCode = p.isBot ? 1 : 0;
      for (const [x, z] of p.path) rows.push([x, z, posCode, di, bot]);
      for (const e of p.events) rows.push([e.x, e.z, e.type, di, bot]);
    }
  }
  return rows;
}

// Build event markers from a single match for replay mode.
export function markersFromMatch(
  match: MatchData,
  cats: Record<"kill" | "death" | "loot" | "storm", boolean>,
  upToMs: number | null,
): MarkerInput[] {
  const out: MarkerInput[] = [];
  for (const p of match.players) {
    for (const e of p.events) {
      const cat = categoryOf(e.type);
      if (cat === "position") continue;
      if (!cats[cat]) continue;
      if (upToMs != null && e.t > upToMs) continue;
      out.push({
        x: e.x,
        z: e.z,
        cat,
        isBot: p.isBot,
        label: `${CODE_TO_EVENT[e.type]} · ${p.isBot ? "bot" : "player"} ${shortId(
          p.id,
        )} · ${e.t}ms`,
      });
    }
  }
  return out;
}

// Sparse markers (kills/deaths/storm) from bundled heat points for analytics.
export function markersFromHeat(
  points: HeatPoint[],
  cats: Record<"kill" | "death" | "loot" | "storm", boolean>,
  f: Omit<HeatFilter, "metric">,
  cap = 4000,
): MarkerInput[] {
  const out: MarkerInput[] = [];
  for (const [x, z, type, dateIdx, isBot] of points) {
    const cat = categoryOf(type);
    if (cat === "position" || cat === "loot") continue; // loot too dense -> heatmap only
    if (!cats[cat]) continue;
    if (f.dateIdxAllowed && !f.dateIdxAllowed.has(dateIdx)) continue;
    if (isBot === 1 && !f.showBots) continue;
    if (isBot === 0 && !f.showHumans) continue;
    out.push({
      x,
      z,
      cat,
      isBot: isBot === 1,
      label: `${CODE_TO_EVENT[type]} (${isBot === 1 ? "bot" : "player"})`,
    });
    if (out.length >= cap) break;
  }
  return out;
}

function shortId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id;
}
