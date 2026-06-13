import { parquetReadObjects } from "hyparquet";
import { compressors } from "hyparquet-compressors";
import {
  EVENT_CODES,
  type EventName,
  type MatchData,
  type MatchMeta,
  type Player,
  type PlayerEvent,
} from "./types";

// In-browser parquet ingestion — the "plug and play" path. A level designer
// drops raw `.nakama-0` (parquet) files and we parse them client-side, with no
// backend and no pipeline run, producing the exact same in-memory model as the
// bundled JSON.

interface RawRow {
  user_id: string;
  match_id: string;
  map_id: string;
  x: number;
  y: number;
  z: number;
  ts: unknown;
  event: unknown;
}

export interface DroppedDataset {
  matches: Map<string, MatchData>;
  meta: MatchMeta[];
}

const POSITION_EVENTS = new Set<EventName>(["Position", "BotPosition"]);

function isBot(userId: string): boolean {
  return /^\d+$/.test(String(userId));
}

function decodeEvent(v: unknown): string {
  if (v instanceof Uint8Array) return new TextDecoder().decode(v);
  if (typeof v === "string") return v;
  return String(v);
}

function tsToMs(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "bigint") return Number(v);
  if (v instanceof Date) return v.getTime();
  return Number(v);
}

function asyncBufferFromFile(file: File) {
  return {
    byteLength: file.size,
    async slice(start: number, end?: number): Promise<ArrayBuffer> {
      return file.slice(start, end).arrayBuffer();
    },
  };
}

async function readFile(file: File): Promise<RawRow[]> {
  const rows = (await parquetReadObjects({
    file: asyncBufferFromFile(file),
    compressors,
  })) as unknown as RawRow[];
  return rows;
}

export async function loadDroppedFiles(
  files: File[],
): Promise<DroppedDataset> {
  const byMatch = new Map<string, RawRow[]>();
  const errors: string[] = [];

  for (const file of files) {
    try {
      const rows = await readFile(file);
      for (const r of rows) {
        const matchId = String(r.match_id).replace(/\.nakama-0$/, "");
        const arr = byMatch.get(matchId) ?? [];
        arr.push(r);
        byMatch.set(matchId, arr);
      }
    } catch (e) {
      errors.push(`${file.name}: ${(e as Error).message}`);
    }
  }

  if (errors.length) console.warn("Parquet parse issues:", errors);

  const matches = new Map<string, MatchData>();
  const meta: MatchMeta[] = [];

  for (const [matchId, rows] of byMatch) {
    rows.sort((a, b) => tsToMs(a.ts) - tsToMs(b.ts));
    const t0 = tsToMs(rows[0].ts);
    const mapId = String(rows[0].map_id);
    const date = "(uploaded)";

    const playerRows = new Map<string, RawRow[]>();
    for (const r of rows) {
      const arr = playerRows.get(r.user_id) ?? [];
      arr.push(r);
      playerRows.set(r.user_id, arr);
    }

    const players: Player[] = [];
    const counts: Record<string, number> = {};
    for (const [userId, prows] of playerRows) {
      const bot = isBot(userId);
      const path: Player["path"] = [];
      const events: PlayerEvent[] = [];
      let kills = 0;
      let deaths = 0;
      let loot = 0;
      for (const r of prows) {
        const ev = decodeEvent(r.event) as EventName;
        const t = tsToMs(r.ts) - t0;
        const x = Math.round(r.x * 10) / 10;
        const z = Math.round(r.z * 10) / 10;
        counts[ev] = (counts[ev] ?? 0) + 1;
        if (POSITION_EVENTS.has(ev)) {
          path.push([x, z, t]);
        } else {
          events.push({ type: EVENT_CODES[ev] ?? -1, x, z, t });
          if (ev === "Kill" || ev === "BotKill") kills++;
          else if (ev === "Killed" || ev === "BotKilled" || ev === "KilledByStorm")
            deaths++;
          else if (ev === "Loot") loot++;
        }
      }
      players.push({ id: userId, isBot: bot, path, events, kills, deaths, loot });
    }

    const durationMs = tsToMs(rows[rows.length - 1].ts) - t0;
    matches.set(matchId, { id: matchId, map: mapId, date, durationMs, players });
    meta.push({
      id: matchId,
      map: mapId,
      date,
      players: players.length,
      humans: players.filter((p) => !p.isBot).length,
      bots: players.filter((p) => p.isBot).length,
      durationMs,
      positions: (counts.Position ?? 0) + (counts.BotPosition ?? 0),
      kills: counts.Kill ?? 0,
      killed: counts.Killed ?? 0,
      botKills: counts.BotKill ?? 0,
      botKilled: counts.BotKilled ?? 0,
      storm: counts.KilledByStorm ?? 0,
      loot: counts.Loot ?? 0,
    });
  }

  return { matches, meta };
}
