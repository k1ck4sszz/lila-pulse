// Shared data model. Both ingestion paths (bundled JSON from the Python
// pipeline, and in-browser parquet drop via hyparquet) normalize to these.

export type EventName =
  | "Position"
  | "BotPosition"
  | "Kill"
  | "Killed"
  | "BotKill"
  | "BotKilled"
  | "KilledByStorm"
  | "Loot";

export const EVENT_CODES: Record<EventName, number> = {
  Position: 0,
  BotPosition: 1,
  Kill: 2,
  Killed: 3,
  BotKill: 4,
  BotKilled: 5,
  KilledByStorm: 6,
  Loot: 7,
};

export const CODE_TO_EVENT: EventName[] = [
  "Position",
  "BotPosition",
  "Kill",
  "Killed",
  "BotKill",
  "BotKilled",
  "KilledByStorm",
  "Loot",
];

// Event categories used for filtering, markers and heatmaps.
export type EventCategory = "kill" | "death" | "loot" | "storm" | "position";

export function categoryOf(code: number): EventCategory {
  switch (CODE_TO_EVENT[code]) {
    case "Kill":
    case "BotKill":
      return "kill";
    case "Killed":
    case "BotKilled":
      return "death";
    case "KilledByStorm":
      return "storm";
    case "Loot":
      return "loot";
    default:
      return "position";
  }
}

export interface MapConfig {
  scale: number;
  originX: number;
  originZ: number;
  image: string;
  imageSize: number;
}

export interface MatchMeta {
  id: string;
  map: string;
  date: string;
  players: number;
  humans: number;
  bots: number;
  durationMs: number;
  positions: number;
  kills: number;
  killed: number;
  botKills: number;
  botKilled: number;
  storm: number;
  loot: number;
}

export interface Manifest {
  generatedAt: string;
  game: string;
  maps: Record<string, MapConfig>;
  eventCodes: Record<string, number>;
  dates: string[];
  matches: MatchMeta[];
  totals: Record<string, number>;
}

// path point: [worldX, worldZ, relativeTimeMs]
export type PathPoint = [number, number, number];

export interface PlayerEvent {
  type: number; // event code
  x: number;
  z: number;
  t: number; // relative ms
}

export interface Player {
  id: string;
  isBot: boolean;
  path: PathPoint[];
  events: PlayerEvent[];
  kills: number;
  deaths: number;
  loot: number;
}

export interface MatchData {
  id: string;
  map: string;
  date: string;
  durationMs: number;
  players: Player[];
}

// Heatmap point row: [x, z, typeCode, dateIdx, isBot]
export type HeatPoint = [number, number, number, number, number];

export interface HeatData {
  map: string;
  fields: string[];
  points: HeatPoint[];
}
