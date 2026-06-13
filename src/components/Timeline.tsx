import type { MatchData } from "../lib/types";
import { categoryOf, CODE_TO_EVENT } from "../lib/types";
import { CATEGORY_COLOR } from "../lib/palette";

interface Props {
  match: MatchData;
  playhead: number;
  setPlayhead: (n: number) => void;
  playing: boolean;
  setPlaying: (v: boolean) => void;
  speed: number;
  setSpeed: (n: number) => void;
}

const SPEEDS = [0.5, 1, 2, 4];

export default function Timeline({
  match,
  playhead,
  setPlayhead,
  playing,
  setPlaying,
  speed,
  setSpeed,
}: Props) {
  const duration = Math.max(match.durationMs, 1);
  const pct = (playhead / duration) * 100;

  // event tick marks along the track
  const ticks = match.players.flatMap((p) =>
    p.events
      .filter((e) => categoryOf(e.type) !== "position")
      .map((e) => ({
        left: (e.t / duration) * 100,
        cat: categoryOf(e.type),
        name: CODE_TO_EVENT[e.type],
      })),
  );

  return (
    <div className="glass flex items-center gap-3 border-t border-white/5 px-4 py-3">
      <button
        onClick={() => {
          if (playhead >= duration) setPlayhead(0);
          setPlaying(!playing);
        }}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-400 text-base-900 hover:bg-cyan-300"
        title={playing ? "Pause" : "Play"}
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>

      <div className="relative min-w-0 flex-1">
        {/* event ticks */}
        <div className="pointer-events-none absolute inset-x-0 -top-2 h-2">
          {ticks.map((t, i) => (
            <span
              key={i}
              className="absolute top-0 h-2 w-0.5 -translate-x-1/2 rounded"
              style={{ left: `${t.left}%`, background: CATEGORY_COLOR[t.cat] }}
              title={t.name}
            />
          ))}
        </div>
        <input
          type="range"
          className="timeline w-full"
          min={0}
          max={duration}
          step={Math.max(1, Math.round(duration / 500))}
          value={playhead}
          onChange={(e) => {
            setPlaying(false);
            setPlayhead(parseFloat(e.target.value));
          }}
          style={{
            background: `linear-gradient(90deg, rgba(34,211,238,0.6) ${pct}%, var(--color-base-600) ${pct}%)`,
          }}
        />
      </div>

      <div className="shrink-0 text-right">
        <div className="font-mono text-xs text-slate-300">
          {playhead.toFixed(0)}
          <span className="text-slate-600"> / {duration} ms</span>
        </div>
        <div className="text-[10px] text-slate-500">match time</div>
      </div>

      <div className="flex shrink-0 gap-1">
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            className={`rounded px-2 py-1 text-[11px] font-medium ring-1 transition ${
              speed === s
                ? "bg-cyan-400/20 text-cyan-200 ring-cyan-400/40"
                : "bg-base-800 text-slate-400 ring-white/10 hover:bg-base-700"
            }`}
          >
            {s}×
          </button>
        ))}
      </div>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
    </svg>
  );
}
