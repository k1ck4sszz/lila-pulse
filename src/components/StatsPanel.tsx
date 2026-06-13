import { useMemo, useState } from "react";
import type { Manifest, MatchData, MatchMeta } from "../lib/types";
import type { Mode } from "../App";
import { COLORS, CATEGORY_COLOR } from "../lib/palette";

interface Props {
  mode: Mode;
  manifest: Manifest;
  map: string;
  filteredMatches: MatchMeta[];
  matchId: string | null;
  setMatchId: (id: string | null) => void;
  match: MatchData | null;
  uploaded: boolean;
}

export default function StatsPanel(p: Props) {
  return (
    <aside className="scroll-thin flex w-80 shrink-0 flex-col gap-4 overflow-y-auto border-l border-white/5 bg-base-850/50 p-4">
      <Legend />
      {p.mode === "analytics" ? (
        <Aggregate map={p.map} matches={p.filteredMatches} />
      ) : (
        <Replay
          filteredMatches={p.filteredMatches}
          matchId={p.matchId}
          setMatchId={p.setMatchId}
          match={p.match}
        />
      )}
    </aside>
  );
}

function Legend() {
  return (
    <section className="glass rounded-lg p-3">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        Legend
      </h3>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-slate-300">
        <LegendRow color={COLORS.human} shape="line" label="Human path" />
        <LegendRow color={COLORS.bot} shape="line" label="Bot path" />
        <LegendRow color={CATEGORY_COLOR.kill} shape="diamond" label="Kill" />
        <LegendRow color={CATEGORY_COLOR.death} shape="x" label="Death" />
        <LegendRow color={CATEGORY_COLOR.loot} shape="square" label="Loot" />
        <LegendRow
          color={CATEGORY_COLOR.storm}
          shape="triangle"
          label="Storm death"
        />
      </div>
    </section>
  );
}

function LegendRow({
  color,
  shape,
  label,
}: {
  color: string;
  shape: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Glyph color={color} shape={shape} />
      <span>{label}</span>
    </div>
  );
}

function Glyph({ color, shape }: { color: string; shape: string }) {
  const style = { color } as const;
  if (shape === "line")
    return (
      <span
        className="inline-block h-0.5 w-4 rounded"
        style={{ background: color }}
      />
    );
  if (shape === "diamond")
    return (
      <svg width="12" height="12" viewBox="-6 -6 12 12" style={style}>
        <path d="M0 -5 L5 0 L0 5 L-5 0 Z" fill="currentColor" />
      </svg>
    );
  if (shape === "x")
    return (
      <svg width="12" height="12" viewBox="-6 -6 12 12" style={style}>
        <path
          d="M-4 -4 L4 4 M4 -4 L-4 4"
          stroke="currentColor"
          strokeWidth="2.4"
        />
      </svg>
    );
  if (shape === "square")
    return (
      <svg width="12" height="12" viewBox="-6 -6 12 12" style={style}>
        <rect x="-3.5" y="-3.5" width="7" height="7" fill="currentColor" />
      </svg>
    );
  return (
    <svg width="12" height="12" viewBox="-6 -6 12 12" style={style}>
      <path d="M0 -5.5 L5 4 L-5 4 Z" fill="currentColor" />
    </svg>
  );
}

// --- analytics aggregate --------------------------------------------------

function Aggregate({ map, matches }: { map: string; matches: MatchMeta[] }) {
  const agg = useMemo(() => {
    const a = {
      matches: matches.length,
      humans: 0,
      bots: 0,
      positions: 0,
      botKills: 0,
      botKilled: 0,
      kills: 0,
      storm: 0,
      loot: 0,
    };
    for (const m of matches) {
      a.humans += m.humans;
      a.bots += m.bots;
      a.positions += m.positions;
      a.botKills += m.botKills;
      a.botKilled += m.botKilled;
      a.kills += m.kills;
      a.storm += m.storm;
      a.loot += m.loot;
    }
    return a;
  }, [matches]);

  return (
    <section>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {prettyMap(map)} · {agg.matches} matches
      </h3>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Player journeys" value={agg.humans} accent={COLORS.human} />
        <Stat label="Bot journeys" value={agg.bots} accent={COLORS.bot} />
        <Stat
          label="Loot pickups"
          value={agg.loot}
          accent={CATEGORY_COLOR.loot}
        />
        <Stat
          label="Bot kills (by players)"
          value={agg.botKills}
          accent={CATEGORY_COLOR.kill}
        />
        <Stat
          label="Player deaths to bots"
          value={agg.botKilled}
          accent={CATEGORY_COLOR.death}
        />
        <Stat
          label="Storm deaths"
          value={agg.storm}
          accent={CATEGORY_COLOR.storm}
        />
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        Pick a heatmap metric on the left to see where these events cluster.
        Human-vs-human kills on this slice:{" "}
        <span className="text-slate-300">{agg.kills}</span>.
      </p>
    </section>
  );
}

// --- replay match list + detail ------------------------------------------

function Replay({
  filteredMatches,
  matchId,
  setMatchId,
  match,
}: {
  filteredMatches: MatchMeta[];
  matchId: string | null;
  setMatchId: (id: string | null) => void;
  match: MatchData | null;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"players" | "loot" | "botKills">("players");

  const list = useMemo(() => {
    const filtered = q
      ? filteredMatches.filter((m) => m.id.includes(q))
      : filteredMatches;
    return [...filtered]
      .sort((a, b) => (b[sort] as number) - (a[sort] as number))
      .slice(0, 200);
  }, [filteredMatches, q, sort]);

  if (matchId && match) {
    return <MatchDetail match={match} onBack={() => setMatchId(null)} />;
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        Select a match ({filteredMatches.length})
      </h3>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by match id…"
        className="mb-2 w-full rounded-md bg-base-800 px-3 py-1.5 text-xs ring-1 ring-white/10 focus:outline-none focus:ring-cyan-400/50"
      />
      <div className="mb-2 flex gap-1 text-[11px]">
        <span className="text-slate-500">Sort:</span>
        {(["players", "loot", "botKills"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSort(s)}
            className={sort === s ? "text-cyan-300" : "text-slate-400"}
          >
            {s === "botKills" ? "kills" : s}
          </button>
        ))}
      </div>
      <div className="scroll-thin -mr-2 flex-1 space-y-1 overflow-y-auto pr-2">
        {list.map((m) => (
          <button
            key={m.id}
            onClick={() => setMatchId(m.id)}
            className="block w-full rounded-md bg-base-800/60 px-3 py-2 text-left ring-1 ring-white/5 transition hover:bg-base-700/60 hover:ring-cyan-400/30"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] text-slate-300">
                {m.id.slice(0, 13)}…
              </span>
              <span className="text-[10px] text-slate-500">{m.date.slice(5)}</span>
            </div>
            <div className="mt-1 flex gap-2 text-[10px] text-slate-500">
              <span style={{ color: COLORS.human }}>{m.humans}P</span>
              <span style={{ color: COLORS.bot }}>{m.bots}B</span>
              <span style={{ color: CATEGORY_COLOR.loot }}>{m.loot} loot</span>
              <span style={{ color: CATEGORY_COLOR.kill }}>
                {m.botKills} kills
              </span>
            </div>
          </button>
        ))}
        {!list.length && (
          <p className="text-xs text-slate-500">No matches for this filter.</p>
        )}
      </div>
    </section>
  );
}

function MatchDetail({
  match,
  onBack,
}: {
  match: MatchData;
  onBack: () => void;
}) {
  const players = [...match.players].sort(
    (a, b) => Number(a.isBot) - Number(b.isBot),
  );
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <button
        onClick={onBack}
        className="mb-2 self-start text-[11px] text-cyan-300 hover:underline"
      >
        ← All matches
      </button>
      <div className="mb-3 rounded-lg bg-base-800/60 p-3 ring-1 ring-white/5">
        <div className="font-mono text-[11px] text-slate-400">{match.id}</div>
        <div className="mt-1 text-xs text-slate-500">
          {prettyMap(match.map)} · {match.date} · {match.durationMs} ms
        </div>
      </div>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        Participants ({match.players.length})
      </h3>
      <div className="scroll-thin -mr-2 flex-1 space-y-1 overflow-y-auto pr-2">
        {players.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between rounded-md bg-base-800/50 px-3 py-1.5 text-xs ring-1 ring-white/5"
          >
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: p.isBot ? COLORS.bot : COLORS.human }}
              />
              <span className="font-mono text-[11px] text-slate-300">
                {p.id.length > 10 ? p.id.slice(0, 10) + "…" : p.id}
              </span>
            </div>
            <div className="flex gap-2 text-[10px] text-slate-500">
              <span title="kills">⚔ {p.kills}</span>
              <span title="deaths">✕ {p.deaths}</span>
              <span title="loot">▣ {p.loot}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="rounded-lg bg-base-800/60 p-3 ring-1 ring-white/5">
      <div
        className="text-lg font-bold tabular-nums"
        style={{ color: accent }}
      >
        {value.toLocaleString()}
      </div>
      <div className="text-[10px] leading-tight text-slate-500">{label}</div>
    </div>
  );
}

function prettyMap(m: string): string {
  return m.replace(/([a-z])([A-Z])/g, "$1 $2");
}
