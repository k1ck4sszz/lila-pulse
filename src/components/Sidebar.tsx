import { useRef, useState } from "react";
import type { Manifest } from "../lib/types";
import type { HeatMetric } from "../lib/selectors";
import type { MarkerCats, Mode } from "../App";
import { COLORS, CATEGORY_COLOR } from "../lib/palette";
import { loadDroppedFiles, type DroppedDataset } from "../lib/parquetLoader";
import { formatDayChip, formatMonthYear } from "../lib/format";

interface Props {
  manifest: Manifest;
  mode: Mode;
  setMode: (m: Mode) => void;
  map: string;
  setMap: (m: string) => void;
  dates: string[];
  dateCounts: Record<string, number>;
  selectedDates: Set<string>;
  setSelectedDates: (s: Set<string>) => void;
  uploaded: boolean;
  showHumans: boolean;
  setShowHumans: (v: boolean) => void;
  showBots: boolean;
  setShowBots: (v: boolean) => void;
  showPaths: boolean;
  setShowPaths: (v: boolean) => void;
  cats: MarkerCats;
  setCats: (c: MarkerCats) => void;
  heatVisible: boolean;
  setHeatVisible: (v: boolean) => void;
  heatMetric: HeatMetric;
  setHeatMetric: (m: HeatMetric) => void;
  heatRadius: number;
  setHeatRadius: (n: number) => void;
  heatIntensity: number;
  setHeatIntensity: (n: number) => void;
  onUploaded: (ds: DroppedDataset) => void;
  clearUploaded: () => void;
}

const HEAT_METRICS: { key: HeatMetric; label: string }[] = [
  { key: "traffic", label: "Traffic" },
  { key: "kills", label: "Kill zones" },
  { key: "deaths", label: "Death zones" },
  { key: "loot", label: "Loot" },
  { key: "storm", label: "Storm" },
];

export default function Sidebar(p: Props) {
  return (
    <aside className="scroll-thin flex w-72 shrink-0 flex-col gap-5 overflow-y-auto border-r border-white/5 bg-base-850/50 p-4">
      <Section title="Mode">
        <SegToggle
          options={[
            { key: "analytics", label: "Map analytics" },
            { key: "replay", label: "Match replay" },
          ]}
          value={p.mode}
          onChange={(v) => p.setMode(v as Mode)}
        />
        <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
          {p.mode === "analytics"
            ? "Aggregate heatmaps & event zones across every match on a map."
            : "Watch one match unfold — player paths, events, timeline playback."}
        </p>
      </Section>

      <Section title="Map">
        <select
          value={p.map}
          onChange={(e) => p.setMap(e.target.value)}
          className="w-full rounded-md bg-base-800 px-3 py-2 text-sm ring-1 ring-white/10 focus:outline-none focus:ring-cyan-400/50"
        >
          {Object.keys(p.manifest.maps).map((m) => (
            <option key={m} value={m}>
              {prettyMap(m)}
            </option>
          ))}
        </select>
      </Section>

      {!p.uploaded && (
        <Section title="Dates">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">
              {formatMonthYear(p.dates)}
            </span>
            <button
              onClick={() => p.setSelectedDates(new Set())}
              className={`rounded px-2 py-0.5 text-[11px] font-medium ring-1 transition ${
                p.selectedDates.size === 0
                  ? "bg-cyan-400/20 text-cyan-200 ring-cyan-400/40"
                  : "bg-base-800 text-slate-400 ring-white/10 hover:bg-base-700"
              }`}
            >
              All
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            {p.dates.map((d) => {
              const on = p.selectedDates.has(d);
              const count = p.dateCounts[d] ?? 0;
              return (
                <button
                  key={d}
                  disabled={count === 0}
                  onClick={() => {
                    const s = new Set(p.selectedDates);
                    if (on) s.delete(d);
                    else s.add(d);
                    p.setSelectedDates(s);
                  }}
                  className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-xs font-medium ring-1 transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    on
                      ? "bg-cyan-400/20 text-cyan-200 ring-cyan-400/40"
                      : "bg-base-800 text-slate-300 ring-white/10 hover:bg-base-700"
                  }`}
                >
                  <span>{formatDayChip(d)}</span>
                  <span className="text-[10px] tabular-nums text-slate-500">
                    {count} {count === 1 ? "match" : "matches"}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500">
            {p.selectedDates.size === 0
              ? "Showing all dates on this map"
              : `${p.selectedDates.size} day(s) selected`}
          </p>
        </Section>
      )}

      <Section title="Populations">
        <Check
          label="Human players"
          color={COLORS.human}
          checked={p.showHumans}
          onChange={p.setShowHumans}
        />
        <Check
          label="Bots"
          color={COLORS.bot}
          checked={p.showBots}
          onChange={p.setShowBots}
        />
        {p.mode === "replay" && (
          <Check
            label="Movement paths"
            color="#94a3b8"
            checked={p.showPaths}
            onChange={p.setShowPaths}
          />
        )}
      </Section>

      <Section title="Event markers">
        {(["kill", "death", "loot", "storm"] as const).map((c) => (
          <Check
            key={c}
            label={catLabel(c)}
            color={CATEGORY_COLOR[c]}
            checked={p.cats[c]}
            onChange={(v) => p.setCats({ ...p.cats, [c]: v })}
          />
        ))}
        {p.mode === "analytics" && (
          <p className="mt-1 text-[11px] leading-snug text-slate-500">
            Loot is shown via heatmap only (too dense for markers).
          </p>
        )}
      </Section>

      <Section title="Heatmap">
        <Check
          label="Show heatmap"
          color="#f97316"
          checked={p.heatVisible}
          onChange={p.setHeatVisible}
        />
        {p.heatVisible && (
          <>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {HEAT_METRICS.map((m) => (
                <button
                  key={m.key}
                  onClick={() => p.setHeatMetric(m.key)}
                  className={`rounded-md px-2 py-1 text-[11px] font-medium ring-1 transition ${
                    p.heatMetric === m.key
                      ? "bg-orange-400/20 text-orange-200 ring-orange-400/40"
                      : "bg-base-800 text-slate-400 ring-white/10 hover:bg-base-700"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <Slider
              label="Radius"
              min={5}
              max={36}
              step={1}
              value={p.heatRadius}
              onChange={p.setHeatRadius}
            />
            <Slider
              label="Intensity"
              min={0.05}
              max={0.5}
              step={0.01}
              value={p.heatIntensity}
              onChange={p.setHeatIntensity}
            />
          </>
        )}
      </Section>

      <UploadSection
        uploaded={p.uploaded}
        onUploaded={p.onUploaded}
        clearUploaded={p.clearUploaded}
      />

      <p className="mt-auto pt-2 text-[10px] leading-relaxed text-slate-600">
        Generated {new Date(p.manifest.generatedAt).toLocaleDateString()} ·{" "}
        {p.manifest.totals.matches} matches · {p.manifest.totals.events} events
      </p>
    </aside>
  );
}

function UploadSection({
  uploaded,
  onUploaded,
  clearUploaded,
}: {
  uploaded: boolean;
  onUploaded: (ds: DroppedDataset) => void;
  clearUploaded: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setBusy(true);
    try {
      const ds = await loadDroppedFiles(Array.from(files));
      if (ds.meta.length) onUploaded(ds);
      else alert("No readable matches found in those files.");
    } catch (e) {
      alert("Failed to parse files: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Your own data">
      {uploaded ? (
        <button
          onClick={clearUploaded}
          className="w-full rounded-md bg-base-800 px-3 py-2 text-xs font-medium text-slate-200 ring-1 ring-white/10 hover:bg-base-700"
        >
          ← Back to bundled dataset
        </button>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer rounded-lg border border-dashed p-3 text-center text-[11px] transition ${
            drag
              ? "border-cyan-400 bg-cyan-400/10 text-cyan-200"
              : "border-white/15 text-slate-400 hover:border-white/30"
          }`}
        >
          {busy ? (
            "Parsing parquet…"
          ) : (
            <>
              Drop <code>.nakama-0</code> / parquet files here
              <br />
              <span className="text-slate-500">parsed in your browser</span>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      )}
    </Section>
  );
}

// --- small UI primitives --------------------------------------------------

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Check({
  label,
  color,
  checked,
  onChange,
}: {
  label: string;
  color: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 py-0.5 text-sm text-slate-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 accent-cyan-400"
      />
      <span
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ background: color }}
      />
      {label}
    </label>
  );
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="mt-2">
      <div className="mb-1 flex justify-between text-[11px] text-slate-500">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <input
        type="range"
        className="timeline w-full"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}

function SegToggle({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex rounded-lg bg-base-800 p-1 ring-1 ring-white/10">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition ${
            value === o.key
              ? "bg-cyan-400/20 text-cyan-100"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function prettyMap(m: string): string {
  return m.replace(/([a-z])([A-Z])/g, "$1 $2");
}
function catLabel(c: string): string {
  return { kill: "Kills", death: "Deaths", loot: "Loot", storm: "Storm deaths" }[
    c
  ]!;
}
