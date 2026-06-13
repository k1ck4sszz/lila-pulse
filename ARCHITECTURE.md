# Architecture

## What I built with and why

| Layer | Choice | Why |
|---|---|---|
| Frontend | **React + TypeScript + Vite** | Static SPA, trivial to host on Vercel/Netlify, fast HMR. No server to operate. |
| Styling | **Tailwind v4** | Consistent dark "command-center" UI quickly. |
| Rendering | **Canvas 2D (hand-rolled)** | A level designer needs paths + markers + a density heatmap over a fixed 1024² image. Canvas gives full control of the world→pixel transform and handles ~90k points smoothly without a heavyweight map/WebGL dependency. |
| Heatmap | **Custom two-pass canvas** | Accumulate radial-blob alpha → colorize through a thermal gradient LUT. Zero deps, recolors live as filters change. |
| Offline data | **Python + pyarrow/pandas** | The dataset is parquet with byte-encoded event strings; pyarrow reads it natively and pandas makes the grouping/aggregation concise. |
| In-browser data | **hyparquet** | Lets designers drop new parquet files and see them instantly — the "plug-and-play" requirement — with no backend or pipeline run. |

The whole dataset is small (~90k event rows, ~4 MB of JSON), so a **static
precompute + static hosting** approach beats standing up a query backend. No
database, no API — just files on a CDN.

## How data flows (parquet → screen)

```
raw .nakama-0 parquet (1,243 files)
        │
        ▼  pipeline/process.py  (offline, run once / on new data)
   read + decode (event bytes→str) · classify bot vs human (UUID vs numeric id)
   group by match · compute per-match relative time (ts − match_min_ts)
        │
        ├─► public/data/manifest.json     maps config, dates, per-match stat index
        ├─► public/data/match/<id>.json   players → {path[], events[]} for replay
        └─► public/data/heatmap/<map>.json every event as [x,z,type,dateIdx,isBot]
        │
        ▼  browser (React)
   manifest drives filters → load only what's needed
   • analytics: heatmap/<map>.json → filter by metric/date/pop → heatmap + sparse markers
   • replay:    match/<id>.json     → polylines + markers + timeline scrub
        │
        ▼  MapCanvas
   world (x,z) ──worldToPixel──► minimap px ──view transform (pan/zoom)──► screen
```

The **second ingestion path** (drop files in-browser) runs hyparquet over the
same transforms (`src/lib/parquetLoader.ts`) and produces the identical
in-memory model, so every feature works on uploaded data too.

### Why split match files vs one heatmap file

- **Replay** needs ordered per-player paths for *one* match → tiny per-match
  files, lazy-loaded on click.
- **Map-wide heatmaps** need *all* events for a map but not ordering → one
  pre-flattened array per map the client filters in milliseconds. This avoids
  loading hundreds of match files to draw an aggregate heatmap.

## Coordinate mapping (the tricky part)

The data has 3D world coordinates; the minimaps are 1024×1024 top-down images.
Each map ships a `scale` and `origin (x, z)` in the README. The transform:

```
u  = (worldX − originX) / scale          # normalize to 0..1 across the map
v  = (worldZ − originZ) / scale
px = u * 1024
py = (1 − v) * 1024                       # FLIP Y: world Z grows "north/up",
                                          # image Y grows downward
```

Implemented once in `src/lib/coords.ts` and used by both the renderer and the
pipeline mental model. Key details I made sure to get right:

- **Y-flip.** Forgetting `(1 − v)` mirrors every path vertically. Verified
  against the README worked example (AmbroseValley `x=-301.45, z=-355.55` →
  `px≈78, py≈890`) — matches exactly.
- **`z`, not `y`, is the second map axis.** `y` is elevation; plotting it would
  be wrong. Only `x` and `z` are used for 2D.
- **Per-map config**, not a global one — GrandRift (scale 581) and Lockdown
  (scale 1000) map very differently from AmbroseValley (scale 900).
- On top of the fixed image-space transform sits a **view transform**
  (pan/zoom) so designers can inspect dense areas; zoom is cursor-anchored.

## Assumptions

| Ambiguity | Decision |
|---|---|
| `ts` spans only ~0.01–0.9 s per match — not a real BR match length | Treated as a **compressed/relative clock**. Playback stretches each match to ~12 s wall-clock at 1× (speed 0.5–4×); the readout shows raw match-ms. Ordering within a match is reliable, so the timeline is still meaningful. |
| `match_id` carries a `.nakama-0` server suffix | Stripped, so ids group and display cleanly. |
| Bot vs human detection | Per the README: numeric `user_id` = bot, UUID = human. Bots also use `BotPosition`/`BotKill*` events; humans use `Position`/`Kill`/`Killed`/`Loot`/`KilledByStorm`. |
| Event column is `bytes` | Decoded UTF-8 in both the pipeline and the browser loader. |
| Many matches have only 1 human + bots; some are all-bot | Kept as-is and surfaced honestly in stats (see INSIGHTS.md) rather than filtered out — it's a real signal. |
| Feb 14 is a partial day | Included and labeled; not normalized away. |
| Loot events are very dense (~13k) | Shown via heatmap only in analytics (markers would clutter); shown as markers in single-match replay where counts are small. |

## Major tradeoffs

| Considered | Chose | Rationale |
|---|---|---|
| Query backend (DuckDB/API) vs static precompute | **Static precompute** | Dataset is ~4 MB; a backend adds ops cost and latency for no benefit. |
| deck.gl / Leaflet vs raw Canvas | **Raw Canvas** | Fixed-image overlay + custom heatmap is simpler and lighter than a full mapping lib; ~90k points render fine. |
| Bundle all matches vs lazy per-match | **Lazy per-match + one heatmap file/map** | Fast first paint; analytics never pays to load replay detail. |
| Real-time playback vs scaled | **Scaled playback** | Raw `ts` is sub-second; scaling makes matches watchable. |
| Plotting elevation (`y`) | **Ignore `y`** | Map is top-down; `y` is not a 2D coordinate. |
| Precompute pixels vs store world coords | **Store world coords** | Keeps bundled and dropped-parquet paths identical and lets the client own pan/zoom; transform cost is negligible. |
