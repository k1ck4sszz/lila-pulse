interface Props {
  onClose: () => void;
}

export default function HelpModal({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">How to use LILA Pulse</h2>
            <p className="text-xs text-slate-500">
              A telemetry viewer for level designers — no data skills required.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md bg-base-800 px-2.5 py-1 text-sm text-slate-300 ring-1 ring-white/10 hover:bg-base-700"
          >
            ✕
          </button>
        </div>

        <Step n="1" title="Pick a mode">
          <b className="text-cyan-300">Map analytics</b> shows aggregate
          heatmaps across every match on a map — where people walk, fight, loot
          and die. <b className="text-cyan-300">Match replay</b> lets you watch
          a single match unfold step by step.
        </Step>
        <Step n="2" title="Choose map & dates">
          Use the left panel to select a map and filter by day. The heatmap and
          stats update instantly.
        </Step>
        <Step n="3" title="Read the map">
          Cyan = human players, amber = bots. Markers: ◆ kill, ✕ death, ▣ loot,
          ▲ storm death. Toggle any layer on the left. Hover a marker for
          details.
        </Step>
        <Step n="4" title="Heatmaps">
          Turn on the heatmap and switch the metric (traffic, kill zones, death
          zones, loot, storm). Tune radius/intensity to taste. Red = hottest.
        </Step>
        <Step n="5" title="Replay a match">
          Switch to <b>Match replay</b>, pick a match on the right, then press
          play. Paths draw as the match progresses; event ticks sit on the
          timeline. Scrub or change speed.
        </Step>
        <Step n="6" title="Bring your own data">
          Drop new <code className="text-cyan-300">.nakama-0</code> / parquet
          files in the left panel — they’re parsed in your browser, no upload,
          no pipeline run. For a permanent dataset, re-run{" "}
          <code className="text-cyan-300">python pipeline/process.py</code>.
        </Step>

        <div className="mt-4 rounded-lg bg-base-800/60 p-3 text-[11px] leading-relaxed text-slate-400 ring-1 ring-white/5">
          <b className="text-slate-300">Navigation:</b> scroll to zoom, drag to
          pan, “Reset view” to recenter. The <code>y</code> column is elevation
          and is intentionally not plotted — the map is top-down (x, z).
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full rounded-lg bg-cyan-400 py-2 text-sm font-semibold text-base-900 hover:bg-cyan-300"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex gap-3">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-400/20 text-xs font-bold text-cyan-300">
        {n}
      </div>
      <div>
        <h4 className="text-sm font-semibold text-slate-200">{title}</h4>
        <p className="text-[12px] leading-relaxed text-slate-400">{children}</p>
      </div>
    </div>
  );
}
