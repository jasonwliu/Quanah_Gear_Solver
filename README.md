# Quanah Hologram Skill Solver

A static web app for solving **MapleStory Quanah World** Hologram gear loadouts.

**Live Site:** https://jasonwliu.github.io/Quanah_Gear_Solver/

## Target Loadout

Finds a 6-piece gear combination (**1 of each gear type**: `Hat`, `Top`, `Bottom`, `Gloves`, `Shoes`, `Cape`) that satisfies all 18 Hologram skill lines:

- **3×** `Dimension Leap`
- **3×** `White Hole`
- **3×** `Registry`
- **3×** `Attack`
- **1×** `Crit Damage`
- **1×** `Warrior Skill`
- **1×** `Archer Skill`
- **1×** `Mage Skill`
- **1×** `Thief Skill`
- **1×** `Pirate Skill`

## Features

- **Exact 18/18 Solver:** Finds all valid 6-piece combinations (up to 50) using backtracking with slot ordering and deduplication.
- **Partial Fallback (1 of Each Skill First):** When no exact 18/18 match exists yet, finds the best available loadout prioritizing at least 1 instance of each of the 10 target skills first, then total target lines covered, then fewest overcapped/wasted lines, along with a missing/excess breakdown.
- **Equivalent Gear Detection:** Automatically identifies saved items of the same gear type that share the exact same 3 Hologram skills regardless of line order.
- **Browser Persistence & Import/Export:** Automatically saves your gear list in `localStorage` and supports JSON import/export plus one-click sample data.

## Local Usage

No build step or dependencies required — open `index.html` directly in your browser, or serve the directory with any static file server (e.g. `python -m http.server`).
