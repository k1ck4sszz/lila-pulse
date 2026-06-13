import type { HeatData, Manifest, MatchData } from "./types";

// Loads the bundled JSON produced by pipeline/process.py. Uses Vite's BASE_URL
// so it works at the site root or under a sub-path on static hosts.
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const dataUrl = (p: string) => `${BASE}/data/${p}`;

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(dataUrl(path));
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

export const loadManifest = () => getJson<Manifest>("manifest.json");

export const loadMatch = (id: string) =>
  getJson<MatchData>(`match/${id}.json`);

const heatCache = new Map<string, Promise<HeatData>>();
export function loadHeat(map: string): Promise<HeatData> {
  let p = heatCache.get(map);
  if (!p) {
    p = getJson<HeatData>(`heatmap/${map}.json`);
    heatCache.set(map, p);
  }
  return p;
}

export function minimapUrl(image: string): string {
  return `${BASE}/minimaps/${image}`;
}
