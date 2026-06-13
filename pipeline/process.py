#!/usr/bin/env python3
"""
LILA Pulse — telemetry pipeline.

Reads raw Nakama parquet match files and emits compact JSON the web tool
consumes directly. This is the "plug-and-play" path: point it at a folder of
day-subfolders containing `.nakama-0` parquet files and it regenerates the
whole dataset.

Usage:
    python pipeline/process.py --input ../Test/player_data --out public/data

Outputs (under --out):
    manifest.json            global index: maps, dates, match list + stats
    match/<match_id>.json    per-match players, paths and events (for playback)
    heatmap/<map>.json       every event on a map (for map-wide heatmaps/scatter)
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
from collections import defaultdict
from datetime import datetime
from glob import glob

import pandas as pd
import pyarrow.parquet as pq

# --- Map configuration (from the dataset README coordinate system) ----------
# scale + origin convert world (x, z) -> UV -> pixel on the 1024x1024 minimap.
MAP_CONFIG = {
    "AmbroseValley": {"scale": 900,  "originX": -370, "originZ": -473,
                      "image": "AmbroseValley_Minimap.png", "imageSize": 1024},
    "GrandRift":     {"scale": 581,  "originX": -290, "originZ": -290,
                      "image": "GrandRift_Minimap.png",     "imageSize": 1024},
    "Lockdown":      {"scale": 1000, "originX": -500, "originZ": -500,
                      "image": "Lockdown_Minimap.jpg",      "imageSize": 1024},
}

# Stable event-type codes used everywhere in the emitted JSON.
EVENT_CODES = {
    "Position": 0,
    "BotPosition": 1,
    "Kill": 2,
    "Killed": 3,
    "BotKill": 4,
    "BotKilled": 5,
    "KilledByStorm": 6,
    "Loot": 7,
}

POSITION_EVENTS = {"Position", "BotPosition"}
MONTHS = {  # folder name -> month number
    "January": 1, "February": 2, "March": 3, "April": 4, "May": 5, "June": 6,
    "July": 7, "August": 8, "September": 9, "October": 10, "November": 11,
    "December": 12,
}


DEFAULT_YEAR = 2026


def folder_to_date(folder: str, year: int = DEFAULT_YEAR) -> str | None:
    """Day-folder name -> ISO date, or None for non-day folders.

    Accepts, in order of preference:
      * `2026-02-10` / `2026_02_10`  (year explicit — future-proof, recommended)
      * `February_10_2027`           (month name + day + explicit year)
      * `February_10`                (month name + day; year from `year` arg)

    The `year` arg only applies to the last form, so data from a new year is
    handled either by naming folders with the year, or by passing --year.
    """
    iso = re.match(r"(\d{4})[-_](\d{1,2})[-_](\d{1,2})$", folder)
    if iso:
        return f"{int(iso[1]):04d}-{int(iso[2]):02d}-{int(iso[3]):02d}"
    m = re.match(r"([A-Za-z]+)_(\d{1,2})(?:_(\d{4}))?$", folder)
    if not m or m.group(1) not in MONTHS:
        return None
    yr = int(m.group(3)) if m.group(3) else year
    return f"{yr:04d}-{MONTHS[m.group(1)]:02d}-{int(m.group(2)):02d}"


def is_bot(user_id: str) -> bool:
    """Bots have short numeric user_ids; humans have UUIDs."""
    return bool(re.fullmatch(r"\d+", str(user_id)))


def decode_event(v) -> str:
    return v.decode("utf-8") if isinstance(v, (bytes, bytearray)) else str(v)


def read_day(folder_path: str) -> pd.DataFrame:
    """Read every parquet file in a day folder into one decoded DataFrame."""
    frames = []
    for path in glob(os.path.join(folder_path, "*.nakama-0")):
        try:
            df = pq.read_table(path).to_pandas()
        except Exception as exc:  # corrupt / unreadable file — skip, keep going
            print(f"  ! skip {os.path.basename(path)}: {exc}")
            continue
        frames.append(df)
    if not frames:
        return pd.DataFrame()
    df = pd.concat(frames, ignore_index=True)
    df["event"] = df["event"].map(decode_event)
    # match_id in the data carries the ".nakama-0" server suffix — strip it so
    # ids read cleanly and group correctly.
    df["match_id"] = df["match_id"].str.replace(r"\.nakama-0$", "", regex=True)
    df["is_bot"] = df["user_id"].map(is_bot)
    return df


def round_coord(v) -> float:
    return round(float(v), 1)


def build(input_dir: str, out_dir: str, year: int = DEFAULT_YEAR) -> None:
    match_dir = os.path.join(out_dir, "match")
    heat_dir = os.path.join(out_dir, "heatmap")
    os.makedirs(match_dir, exist_ok=True)
    os.makedirs(heat_dir, exist_ok=True)

    day_folders = sorted(
        d for d in os.listdir(input_dir)
        if os.path.isdir(os.path.join(input_dir, d)) and folder_to_date(d, year)
    )
    dates = sorted({folder_to_date(d, year) for d in day_folders})
    date_index = {d: i for i, d in enumerate(dates)}

    matches_meta: list[dict] = []
    heat_points: dict[str, list] = defaultdict(list)  # map -> rows
    totals = defaultdict(int)

    # Read every day into one frame, tagging each row with its day. Matches are
    # then grouped GLOBALLY by match_id — a match that straddles midnight (its
    # files split across two day folders) must merge into a single match, not
    # produce two entries / overwrite one file.
    frames = []
    for folder in day_folders:
        date = folder_to_date(folder, year)
        print(f"== {folder} ({date})")
        df = read_day(os.path.join(input_dir, folder))
        if df.empty:
            continue
        df["date"] = date
        frames.append(df)
    if not frames:
        print("No data found.")
        return
    big = pd.concat(frames, ignore_index=True)

    # Loudly flag any map present in the data but missing a coordinate config —
    # otherwise its matches would be silently dropped. New maps need a
    # scale/origin/image entry in MAP_CONFIG (a game-design constant).
    unknown_maps = sorted(set(big["map_id"].unique()) - set(MAP_CONFIG))
    if unknown_maps:
        print("\n" + "!" * 60)
        print(f"! UNKNOWN MAPS (no MAP_CONFIG): {', '.join(unknown_maps)}")
        print("! Their matches are SKIPPED. Add scale/originX/originZ/image to")
        print("! MAP_CONFIG in pipeline/process.py and drop the minimap image.")
        print("!" * 60 + "\n")

    # heat points per map (each row keeps its own date index)
    for map_id, map_df in big.groupby("map_id"):
        if map_id not in MAP_CONFIG:
            print(f"  ! unknown map {map_id} — skipped")
            continue
        for _, row in map_df.iterrows():
            heat_points[map_id].append([
                round_coord(row["x"]), round_coord(row["z"]),
                EVENT_CODES.get(row["event"], -1), date_index[row["date"]],
                1 if row["is_bot"] else 0,
            ])

    for match_id, mdf in big.groupby("match_id"):
        map_id = mdf["map_id"].iloc[0]
        if map_id not in MAP_CONFIG:
            continue
        match_date = mdf["date"].min()  # earliest day the match appears
        t0 = mdf["ts"].min()
        duration_ms = int((mdf["ts"].max() - t0).total_seconds() * 1000)

        players = []
        counts = defaultdict(int)
        for user_id, pdf in mdf.groupby("user_id"):
            pdf = pdf.sort_values("ts")
            bot = bool(pdf["is_bot"].iloc[0])
            path = []
            events = []
            p_counts = defaultdict(int)
            for _, r in pdf.iterrows():
                t = int((r["ts"] - t0).total_seconds() * 1000)
                ev = r["event"]
                x, z = round_coord(r["x"]), round_coord(r["z"])
                counts[ev] += 1
                p_counts[ev] += 1
                if ev in POSITION_EVENTS:
                    path.append([x, z, t])
                else:
                    events.append({"type": EVENT_CODES.get(ev, -1),
                                   "x": x, "z": z, "t": t})
            players.append({
                "id": str(user_id),
                "isBot": bot,
                "path": path,
                "events": events,
                "kills": p_counts["Kill"] + p_counts["BotKill"],
                "deaths": p_counts["Killed"] + p_counts["BotKilled"]
                          + p_counts["KilledByStorm"],
                "loot": p_counts["Loot"],
            })

        humans = sum(1 for p in players if not p["isBot"])
        bots = sum(1 for p in players if p["isBot"])
        matches_meta.append({
            "id": match_id,
            "map": map_id,
            "date": match_date,
            "players": len(players),
            "humans": humans,
            "bots": bots,
            "durationMs": duration_ms,
            "positions": counts["Position"] + counts["BotPosition"],
            "kills": counts["Kill"],
            "killed": counts["Killed"],
            "botKills": counts["BotKill"],
            "botKilled": counts["BotKilled"],
            "storm": counts["KilledByStorm"],
            "loot": counts["Loot"],
        })
        for k, v in counts.items():
            totals[k] += v

        with open(os.path.join(match_dir, f"{match_id}.json"), "w") as f:
            json.dump({
                "id": match_id, "map": map_id, "date": match_date,
                "durationMs": duration_ms, "players": players,
            }, f, separators=(",", ":"))

    # heatmap files per map
    for map_id, rows in heat_points.items():
        with open(os.path.join(heat_dir, f"{map_id}.json"), "w") as f:
            json.dump({"map": map_id, "fields": ["x", "z", "type", "dateIdx", "isBot"],
                       "points": rows}, f, separators=(",", ":"))

    manifest = {
        "generatedAt": datetime.utcnow().isoformat() + "Z",
        "game": "LILA BLACK",
        "maps": MAP_CONFIG,
        "eventCodes": EVENT_CODES,
        "dates": dates,
        "matches": sorted(matches_meta, key=lambda m: (m["date"], -m["players"])),
        "totals": {
            "matches": len(matches_meta),
            "events": int(sum(totals.values())),
            **{k: int(v) for k, v in totals.items()},
        },
    }
    with open(os.path.join(out_dir, "manifest.json"), "w") as f:
        json.dump(manifest, f, separators=(",", ":"))

    print(f"\nDone: {len(matches_meta)} matches, "
          f"{manifest['totals']['events']} events, {len(dates)} days.")
    _report_sizes(out_dir)


def _report_sizes(out_dir: str) -> None:
    total = 0
    for root, _, files in os.walk(out_dir):
        for name in files:
            total += os.path.getsize(os.path.join(root, name))
    print(f"Output size: {total / 1e6:.1f} MB")


def copy_minimaps(input_dir: str, dest: str) -> None:
    src = os.path.join(input_dir, "minimaps")
    if not os.path.isdir(src):
        print("! no minimaps folder found, skipping copy")
        return
    os.makedirs(dest, exist_ok=True)
    for name in os.listdir(src):
        shutil.copy2(os.path.join(src, name), os.path.join(dest, name))
    print(f"Copied minimaps -> {dest}")


def main() -> None:
    here = os.path.dirname(os.path.abspath(__file__))
    repo = os.path.dirname(here)
    ap = argparse.ArgumentParser(description="LILA Pulse telemetry pipeline")
    ap.add_argument("--input", default=os.path.join(repo, "..", "Test", "player_data"),
                    help="folder of day subfolders containing .nakama-0 parquet files")
    ap.add_argument("--out", default=os.path.join(repo, "public", "data"))
    ap.add_argument("--minimaps", default=os.path.join(repo, "public", "minimaps"))
    ap.add_argument("--year", type=int, default=DEFAULT_YEAR,
                    help="year for `Month_DD` folders without an explicit year "
                         f"(default {DEFAULT_YEAR}); ignored for ISO-named folders")
    args = ap.parse_args()

    input_dir = os.path.abspath(args.input)
    print(f"Input : {input_dir}")
    print(f"Output: {os.path.abspath(args.out)}")
    build(input_dir, args.out, args.year)
    copy_minimaps(input_dir, args.minimaps)


if __name__ == "__main__":
    main()
