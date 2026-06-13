# Three things I learned about the game (using LILA Pulse)

All numbers below come straight from the bundled dataset (Feb 10–14, 2026 ·
796 matches · 89,104 events) and are reproducible in the tool.

---

## 1. The PvP loop basically isn't happening — it's a PvE game in practice

**What caught my eye:** In *Match analytics*, the "Kill zones" heatmap for
human-vs-human combat is almost empty, while "Death zones" against bots lights up.

**Evidence:**
- Across all 5 days: **human kills = 3, human deaths to other humans = 3**, vs
  **bot kills = 2,415** and **player deaths to bots = 700**.
- **779 of 796 matches (98%) contain exactly one human player**; 16 are all-bot;
  only **1 match has 2 humans**.

So players almost never encounter each other. The extraction-shooter PvP fantasy
("fight other players along the way") is, in this data, a player-versus-bots
experience.

**Actionable?** Yes.
- **Metrics affected:** human-encounter rate per match, PvP-kill rate,
  match-to-match retention, time-to-first-human-contact.
- **Actions:** raise human density per lobby (looser matchmaking windows,
  backfill, region/time-bucket pooling), or lower the bot fill ratio; instrument
  *human-encounter rate* as a first-class KPI; A/B fewer-but-fuller lobbies.

**Why a level designer cares:** maps tuned for multi-squad PvP chokepoints are
being walked through almost solo. Sightlines, cover, and rotation timings should
be validated against the *actual* near-solo + bot population, not the intended
PvP one — otherwise the level is balanced for a fight that never occurs.

---

## 2. Deaths funnel into a tight pocket at map center — movement doesn't

**What caught my eye:** On AmbroseValley, switching the heatmap between
"Traffic" and "Death zones" shows deaths collapsing into the middle while
movement stays spread across the whole map.

**Evidence (AmbroseValley, the primary map):**
- **23% of player deaths-to-bots fall within 60 world-units of map center**, but
  only **7.4% of all movement** and **7.6% of loot** do — deaths are ~3× more
  center-concentrated than where players actually spend time.
- Death spatial spread is far tighter than movement: deaths σ ≈ (86, 115) vs
  positions σ ≈ (136, 181).
- Storm is a non-threat: **39 storm deaths total** (17 on AmbroseValley) vs 700
  bot deaths — the shrinking zone almost never closes the kill.

**Actionable?** Yes.
- **Metrics affected:** death-location distribution, survival time, choke
  fairness, storm-death share.
- **Actions:** audit the central area for an over-tuned bot spawn / forced
  convergence; add cover or alternate routes through the center; if the storm is
  meant to apply pressure, tighten its timing/damage (current storm-death share
  is ~5% of deaths).

**Why a level designer cares:** a single central death-pocket means the level is
implicitly forcing everyone through one lethal area. That's either a great
intentional climax or an unfair funnel — the heatmap says decide on purpose, and
the underused storm means late-game pressure is coming from bots, not design.

---

## 3. One map carries the game, and engagement is sliding

**What caught my eye:** The map dropdown + date chips make it obvious that two of
three maps are nearly unused, and daily match counts shrink across the window.

**Evidence:**
- Match distribution: **AmbroseValley 566 (71%)**, Lockdown 171 (21%),
  **GrandRift 59 (7%)**. Loot/combat volume follow the same split (Ambrose:
  9,955 loot / 1,797 bot-kills; GrandRift: 880 / 192).
- Matches per day: **285 → 200 → 162 → 112** on Feb 10–13 (Feb 14 is a partial
  capture day at 37), a steady decline of roughly a third per day.

**Actionable?** Yes.
- **Metrics affected:** matches-per-map, daily active matches, content ROI per
  map, day-over-day retention.
- **Actions:** find why GrandRift is skipped (rotation weight? size? spawn?),
  either fix or rest it; confirm AmbroseValley isn't winning by default in the
  map rotation; pair the declining-DAU trend with a retention investigation
  before shipping more maps that may go unplayed like GrandRift.

**Why a level designer cares:** design effort should follow play. GrandRift gets
~1/10th of AmbroseValley's attention — before building map #4, it's worth
learning why an existing map is ignored, and whether the central-funnel and
solo-vs-bot issues above are what's eroding daily engagement.
