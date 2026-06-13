import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HeatData, Manifest, MatchData, MatchMeta } from "./lib/types";
import {
  loadManifest,
  loadMatch,
  loadHeat,
  minimapUrl,
} from "./lib/dataClient";
import {
  filterHeatPoints,
  heatPointsFromMatches,
  markersFromHeat,
  markersFromMatch,
  type HeatMetric,
} from "./lib/selectors";
import type { DroppedDataset } from "./lib/parquetLoader";
import MapCanvas, { type CanvasLayers } from "./components/MapCanvas";
import Sidebar from "./components/Sidebar";
import Timeline from "./components/Timeline";
import StatsPanel from "./components/StatsPanel";
import HelpModal from "./components/HelpModal";

export type Mode = "replay" | "analytics";
const PLAYBACK_BASE_MS = 12000; // wall-clock seconds to traverse a full match

export interface MarkerCats {
  kill: boolean;
  death: boolean;
  loot: boolean;
  storm: boolean;
}

export default function App() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<DroppedDataset | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const [mode, setMode] = useState<Mode>("analytics");
  const [map, setMap] = useState<string>("AmbroseValley");
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [matchId, setMatchId] = useState<string | null>(null);
  const [match, setMatch] = useState<MatchData | null>(null);

  const [showHumans, setShowHumans] = useState(true);
  const [showBots, setShowBots] = useState(true);
  const [showPaths, setShowPaths] = useState(true);
  const [cats, setCats] = useState<MarkerCats>({
    kill: true,
    death: true,
    loot: true,
    storm: true,
  });

  const [heatVisible, setHeatVisible] = useState(true);
  const [heatMetric, setHeatMetric] = useState<HeatMetric>("traffic");
  const [heatRadius, setHeatRadius] = useState(14);
  const [heatIntensity, setHeatIntensity] = useState(0.18);

  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const [speed, setSpeed] = useState(1);

  const [bundledHeat, setBundledHeat] = useState<HeatData | null>(null);

  // --- initial load -------------------------------------------------------
  useEffect(() => {
    loadManifest()
      .then((m) => {
        setManifest(m);
        const first = Object.keys(m.maps)[0];
        if (first) setMap(first);
      })
      .catch((e) => setError(String(e)));
  }, []);

  // --- match metas (bundled or uploaded) ----------------------------------
  const allMetas: MatchMeta[] = useMemo(
    () => uploaded?.meta ?? manifest?.matches ?? [],
    [uploaded, manifest],
  );

  const dates = useMemo(() => {
    if (uploaded) return ["(uploaded)"];
    return manifest?.dates ?? [];
  }, [uploaded, manifest]);

  const dateIdxOf = useCallback(
    (d: string) => (manifest ? manifest.dates.indexOf(d) : 0),
    [manifest],
  );

  const dateIdxAllowed = useMemo<Set<number> | null>(() => {
    if (uploaded) return null;
    if (selectedDates.size === 0 || selectedDates.size === dates.length)
      return null;
    return new Set([...selectedDates].map(dateIdxOf));
  }, [uploaded, selectedDates, dates, dateIdxOf]);

  const filteredMatches = useMemo(
    () =>
      allMetas.filter(
        (m) =>
          m.map === map &&
          (selectedDates.size === 0 || selectedDates.has(m.date)),
      ),
    [allMetas, map, selectedDates],
  );

  // --- load selected match ------------------------------------------------
  useEffect(() => {
    if (!matchId) {
      setMatch(null);
      return;
    }
    setPlaying(false);
    setPlayhead(0);
    if (uploaded) {
      setMatch(uploaded.matches.get(matchId) ?? null);
      return;
    }
    let alive = true;
    loadMatch(matchId)
      .then((m) => alive && setMatch(m))
      .catch((e) => setError(String(e)));
    return () => {
      alive = false;
    };
  }, [matchId, uploaded]);

  // --- load bundled heat for current map ----------------------------------
  useEffect(() => {
    if (uploaded) {
      setBundledHeat(null);
      return;
    }
    let alive = true;
    loadHeat(map)
      .then((h) => alive && setBundledHeat(h))
      .catch(() => setBundledHeat(null));
    return () => {
      alive = false;
    };
  }, [map, uploaded]);

  // uploaded heat is aggregated in-memory from uploaded matches on this map
  const uploadedHeat = useMemo<HeatData | null>(() => {
    if (!uploaded) return null;
    const onMap = filteredMatches
      .map((m) => uploaded.matches.get(m.id))
      .filter((m): m is MatchData => !!m && m.map === map);
    return {
      map,
      fields: ["x", "z", "type", "dateIdx", "isBot"],
      points: heatPointsFromMatches(onMap, () => 0),
    };
  }, [uploaded, filteredMatches, map]);

  const heat = uploaded ? uploadedHeat : bundledHeat;

  // --- playback loop ------------------------------------------------------
  const rafRef = useRef<number>(0);
  const lastTsRef = useRef<number>(0);
  useEffect(() => {
    if (!playing || !match || mode !== "replay") return;
    const duration = Math.max(match.durationMs, 1);
    const step = (ts: number) => {
      if (!lastTsRef.current) lastTsRef.current = ts;
      const dt = ts - lastTsRef.current;
      lastTsRef.current = ts;
      setPlayhead((prev) => {
        const next = prev + (duration / PLAYBACK_BASE_MS) * speed * dt;
        if (next >= duration) {
          setPlaying(false);
          return duration;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(rafRef.current);
      lastTsRef.current = 0;
    };
  }, [playing, match, speed, mode]);

  // --- build canvas layers ------------------------------------------------
  const layers = useMemo<CanvasLayers | null>(() => {
    if (!manifest) return null;
    const cfg = manifest.maps[map];
    if (!cfg) return null;

    const replayActive = mode === "replay" && !!match;
    const effPlayhead = replayActive && playing ? playhead : null;
    const upTo = replayActive ? (playing ? playhead : null) : null;

    let heatPoints: Array<[number, number]> = [];
    if (heatVisible && heat) {
      if (replayActive) {
        // per-match heat from the loaded match
        const localHeat = heatPointsFromMatches([match!], () => 0);
        heatPoints = filterHeatPoints(localHeat, {
          metric: heatMetric,
          dateIdxAllowed: null,
          showHumans,
          showBots,
        });
      } else {
        heatPoints = filterHeatPoints(heat.points, {
          metric: heatMetric,
          dateIdxAllowed,
          showHumans,
          showBots,
        });
      }
    }

    const markers = replayActive
      ? markersFromMatch(match!, cats, upTo)
      : heat
        ? markersFromHeat(heat.points, cats, {
            dateIdxAllowed,
            showHumans,
            showBots,
          })
        : [];

    return {
      cfg,
      imageUrl: minimapUrl(cfg.image),
      paths: replayActive ? match!.players : [],
      showHumans,
      showBots,
      showPaths: replayActive && showPaths,
      markers,
      heatPoints,
      heatVisible: heatVisible && heatPoints.length > 0,
      heatRadius,
      heatIntensity,
      playhead: effPlayhead,
    };
  }, [
    manifest,
    map,
    mode,
    match,
    playing,
    playhead,
    heat,
    heatVisible,
    heatMetric,
    heatRadius,
    heatIntensity,
    showHumans,
    showBots,
    showPaths,
    cats,
    dateIdxAllowed,
  ]);

  const onUploaded = useCallback((ds: DroppedDataset) => {
    setUploaded(ds);
    setMode("replay");
    setMatchId(null);
    setMatch(null);
    setSelectedDates(new Set());
    if (ds.meta[0]) setMap(ds.meta[0].map);
  }, []);

  const clearUploaded = useCallback(() => {
    setUploaded(null);
    setMatchId(null);
    setSelectedDates(new Set());
    if (manifest) setMap(Object.keys(manifest.maps)[0]);
  }, [manifest]);

  if (error)
    return (
      <Centered>
        <div className="max-w-md text-center">
          <p className="mb-2 text-lg font-semibold text-red-400">
            Couldn’t load data
          </p>
          <p className="text-sm text-slate-400">{error}</p>
          <p className="mt-4 text-xs text-slate-500">
            Run <code className="text-cyan-300">npm run pipeline</code> to
            generate <code>public/data</code>, then reload.
          </p>
        </div>
      </Centered>
    );

  if (!manifest || !layers)
    return (
      <Centered>
        <div className="flex items-center gap-3 text-slate-400">
          <Spinner />
          Loading telemetry…
        </div>
      </Centered>
    );

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <Header
        game={manifest.game}
        onHelp={() => setHelpOpen(true)}
        uploaded={!!uploaded}
      />
      <div className="flex min-h-0 flex-1">
        <Sidebar
          manifest={manifest}
          mode={mode}
          setMode={setMode}
          map={map}
          setMap={(m) => {
            setMap(m);
            setMatchId(null);
          }}
          dates={dates}
          selectedDates={selectedDates}
          setSelectedDates={setSelectedDates}
          uploaded={!!uploaded}
          showHumans={showHumans}
          setShowHumans={setShowHumans}
          showBots={showBots}
          setShowBots={setShowBots}
          showPaths={showPaths}
          setShowPaths={setShowPaths}
          cats={cats}
          setCats={setCats}
          heatVisible={heatVisible}
          setHeatVisible={setHeatVisible}
          heatMetric={heatMetric}
          setHeatMetric={setHeatMetric}
          heatRadius={heatRadius}
          setHeatRadius={setHeatRadius}
          heatIntensity={heatIntensity}
          setHeatIntensity={setHeatIntensity}
          onUploaded={onUploaded}
          clearUploaded={clearUploaded}
        />

        <main className="relative flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            <MapCanvas layers={layers} />
          </div>
          {mode === "replay" && match && (
            <Timeline
              match={match}
              playhead={playhead}
              setPlayhead={setPlayhead}
              playing={playing}
              setPlaying={setPlaying}
              speed={speed}
              setSpeed={setSpeed}
            />
          )}
        </main>

        <StatsPanel
          mode={mode}
          manifest={manifest}
          map={map}
          filteredMatches={filteredMatches}
          matchId={matchId}
          setMatchId={setMatchId}
          match={match}
          uploaded={!!uploaded}
        />
      </div>
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
    </div>
  );
}

function Header({
  game,
  onHelp,
  uploaded,
}: {
  game: string;
  onHelp: () => void;
  uploaded: boolean;
}) {
  return (
    <header className="flex items-center justify-between border-b border-white/5 px-5 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 font-black text-base-900">
          P
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tight">
            LILA Pulse{" "}
            <span className="font-normal text-slate-500">
              · Player Journey Visualizer
            </span>
          </h1>
          <p className="text-[11px] text-slate-500">
            {uploaded ? "Uploaded dataset" : game} telemetry
          </p>
        </div>
      </div>
      <button
        onClick={onHelp}
        className="rounded-md bg-base-800 px-3 py-1.5 text-xs font-medium text-slate-200 ring-1 ring-white/10 hover:bg-base-700"
      >
        How to use
      </button>
    </header>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full items-center justify-center p-6">
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
  );
}
