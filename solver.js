/**
 * Quanah Hologram Skill Solver
 * Pure solver logic for finding optimal 6-piece gear loadouts (1 per gear type)
 * matching the Quanah Hologram skill requirements (White Hole + Dimension Leap build).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.QuanahSolver = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const GEAR_TYPES = [
    'Hat',
    'Top',
    'Bottom',
    'Gloves',
    'Shoes',
    'Cape',
  ];

  // Master list of all known Hologram skills
  const ALL_SKILLS = [
    { id: 'Dimension Leap', label: 'Dimension Leap', category: 'special' },
    { id: 'White Hole', label: 'White Hole', category: 'special' },
    { id: 'Registry', label: 'Registry', category: 'core' },
    { id: 'Attack', label: 'Attack', category: 'core' },
    { id: 'Crit Damage', label: 'Crit Damage', category: 'stat' },
    { id: 'Warrior Skill', label: 'Warrior Skill', category: 'class' },
    { id: 'Bowman Skill', label: 'Bowman Skill', category: 'class' },
    { id: 'Magician Skill', label: 'Magician Skill', category: 'class' },
    { id: 'Thief Skill', label: 'Thief Skill', category: 'class' },
    { id: 'Pirate Skill', label: 'Pirate Skill', category: 'class' },
    { id: 'Boss Damage', label: 'Boss Damage', category: 'other' },
    { id: 'Ignore Defense', label: 'Ignore Defense', category: 'other' },
    { id: 'Damage', label: 'Damage', category: 'other' },
    { id: 'None', label: 'None', category: 'none' },
  ];

  const ALL_SKILL_IDS = ALL_SKILLS.map((s) => s.id);
  const ALL_SKILL_INDEX = Object.fromEntries(ALL_SKILL_IDS.map((id, idx) => [id, idx]));

  // Skill aliases for flexible input/import (case-insensitive normalized)
  const SKILL_ALIASES = {
    'registry': 'Registry',
    'damage': 'Damage',
    'dmg': 'Damage',
    'boss damage': 'Boss Damage',
    'boss dmg': 'Boss Damage',
    'boss': 'Boss Damage',
    'bd': 'Boss Damage',
    'ignore defense': 'Ignore Defense',
    'ignore def': 'Ignore Defense',
    'ied': 'Ignore Defense',
    'none': 'None',
    'empty': 'None',
    '-': 'None',
    'attack': 'Attack',
    'att': 'Attack',
    'dimension leap': 'Dimension Leap',
    'leap': 'Dimension Leap',
    'white hole': 'White Hole',
    'whitehole': 'White Hole',
    'crit damage': 'Crit Damage',
    'critdmg': 'Crit Damage',
    'crit dmg': 'Crit Damage',
    'critical damage': 'Crit Damage',
    'warrior skill': 'Warrior Skill',
    'warrior': 'Warrior Skill',
    'bowman skill': 'Bowman Skill',
    'bowman': 'Bowman Skill',
    'archer skill': 'Bowman Skill',
    'archer': 'Bowman Skill',
    'magician skill': 'Magician Skill',
    'magician': 'Magician Skill',
    'mage skill': 'Magician Skill',
    'mage': 'Magician Skill',
    'thief skill': 'Thief Skill',
    'thief': 'Thief Skill',
    'pirate skill': 'Pirate Skill',
    'pirate': 'Pirate Skill',
  };

  /**
   * Normalizes a skill string to its canonical skill ID, or null if unknown.
   * @param {string} raw
   * @returns {string|null}
   */
  function normalizeSkillId(raw) {
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (ALL_SKILL_INDEX[trimmed] !== undefined) return trimmed;
    const lower = trimmed.toLowerCase();
    return SKILL_ALIASES[lower] || null;
  }

  const GOAL = {
    id: 'whiteHoleLeap',
    name: 'Dimensional (3 Leap / 3 White Hole / 3 Registry / 3 Attack / 1 Crit Dmg / 1 Classes)',
    shortName: '3 Leap / 3 White Hole',
    description: '3 Dimension Leap, 3 White Hole, 3 Registry, 3 Attack, 1 Crit Damage, 1 of each Class Skill',
    skills: [
      { id: 'Dimension Leap', label: 'Dimension Leap', target: 3, category: 'special' },
      { id: 'White Hole', label: 'White Hole', target: 3, category: 'special' },
      { id: 'Registry', label: 'Registry', target: 3, category: 'core' },
      { id: 'Attack', label: 'Attack', target: 3, category: 'core' },
      { id: 'Crit Damage', label: 'Crit Damage', target: 1, category: 'stat' },
      { id: 'Warrior Skill', label: 'Warrior Skill', target: 1, category: 'class' },
      { id: 'Bowman Skill', label: 'Bowman Skill', target: 1, category: 'class' },
      { id: 'Magician Skill', label: 'Magician Skill', target: 1, category: 'class' },
      { id: 'Thief Skill', label: 'Thief Skill', target: 1, category: 'class' },
      { id: 'Pirate Skill', label: 'Pirate Skill', target: 1, category: 'class' },
    ],
    sampleItems: [
      { name: 'Cosmic Hat A', gearType: 'Hat', lines: ['Dimension Leap', 'White Hole', 'Warrior Skill'] },
      { name: 'Cosmic Hat B (equiv)', gearType: 'Hat', lines: ['Warrior Skill', 'Dimension Leap', 'White Hole'] },
      { name: 'Cosmic Top A', gearType: 'Top', lines: ['Dimension Leap', 'Registry', 'Magician Skill'] },
      { name: 'Cosmic Bottom A', gearType: 'Bottom', lines: ['Dimension Leap', 'Attack', 'Bowman Skill'] },
      { name: 'Cosmic Gloves A', gearType: 'Gloves', lines: ['White Hole', 'Attack', 'Thief Skill'] },
      { name: 'Cosmic Shoes A', gearType: 'Shoes', lines: ['White Hole', 'Registry', 'Pirate Skill'] },
      { name: 'Cosmic Cape A', gearType: 'Cape', lines: ['Registry', 'Attack', 'Crit Damage'] },
      { name: 'Backup Gloves', gearType: 'Gloves', lines: ['Attack', 'Crit Damage', 'Thief Skill'] },
    ],
  };

  /**
   * Validate an item has a valid gearType and 3 valid skill lines.
   * @param {{ gearType: string, lines: string[] }} item
   * @returns {boolean}
   */
  function isValidItem(item) {
    if (!item || !GEAR_TYPES.includes(item.gearType)) return false;
    if (!Array.isArray(item.lines) || item.lines.length !== 3) return false;
    return item.lines.every((line) => normalizeSkillId(line) !== null);
  }

  /**
   * Order-independent canonical signature for a gear item's skills (scoped by gearType).
   * @param {{ gearType: string, lines: string[] }} item
   * @returns {string}
   */
  function itemEquivalenceKey(item) {
    const sorted = item.lines.map((l) => normalizeSkillId(l) || l).sort();
    return `${item.gearType}|${sorted.join(',')}`;
  }

  /**
   * Identify groups of gear items of the same gearType that have equivalent skills
   * regardless of line order.
   * @param {Array<{ id: string, gearType: string, lines: string[] }>} items
   * @returns {{
   *   groups: Array<{ key: string, gearType: string, lines: string[], items: object[] }>,
   *   equivalentPeersById: Record<string, object[]>
   * }}
   */
  function findEquivalentGroups(items) {
    const map = new Map();
    for (const item of items || []) {
      if (!isValidItem(item)) continue;
      const key = itemEquivalenceKey(item);
      if (!map.has(key)) {
        map.set(key, {
          key,
          gearType: item.gearType,
          lines: item.lines.map((l) => normalizeSkillId(l) || l).sort(),
          items: [item],
        });
      } else {
        map.get(key).items.push(item);
      }
    }

    const groups = [];
    const equivalentPeersById = {};
    for (const group of map.values()) {
      if (group.items.length > 1) {
        groups.push(group);
        for (const item of group.items) {
          equivalentPeersById[item.id] = group.items.filter((other) => other.id !== item.id);
        }
      }
    }

    return { groups, equivalentPeersById };
  }

  /**
   * Convert an item's 3-line array into a count vector for a given skill list.
   * @param {string[]} lines
   * @param {Record<string, number>} skillIndex
   * @param {number} vectorLength
   * @returns {number[]}
   */
  function linesToVector(lines, skillIndex, vectorLength) {
    const vec = new Array(vectorLength).fill(0);
    if (!Array.isArray(lines)) return vec;
    for (let i = 0; i < lines.length; i++) {
      const canonical = normalizeSkillId(lines[i]);
      if (canonical && skillIndex[canonical] !== undefined) {
        vec[skillIndex[canonical]] += 1;
      }
    }
    return vec;
  }

  function vectorKey(vec) {
    return vec.join(',');
  }

  /**
   * Solve for exact 6-piece loadouts (1 per gear type) matching GOAL.
   * If no exact match exists, falls back to findBestPartial prioritizing
   * having at least 1 of each target skill first, then total target lines covered,
   * then fewest wasted lines.
   *
   * @param {Array<{ id: string, name?: string, gearType: string, lines: string[] }>} items
   * @param {{ maxSolutions?: number }} [options]
   */
  function solve(items, options = {}) {
    const maxSolutions = options.maxSolutions ?? 50;

    const skills = GOAL.skills;
    const skillIds = skills.map((s) => s.id);
    const skillIndex = Object.fromEntries(skillIds.map((id, idx) => [id, idx]));
    const targetVector = skills.map((s) => s.target);
    const totalTarget = targetVector.reduce((sum, v) => sum + v, 0); // 18

    const validItems = (items || []).filter(isValidItem).map((item) => ({
      ...item,
      lines: item.lines.map((l) => normalizeSkillId(l) || l),
    }));

    // Group items by gear type
    const byGear = {};
    for (const gt of GEAR_TYPES) {
      byGear[gt] = [];
    }
    for (const item of validItems) {
      byGear[item.gearType].push({
        item,
        vec: linesToVector(item.lines, skillIndex, skillIds.length),
      });
    }

    const missingGearTypes = GEAR_TYPES.filter((gt) => byGear[gt].length === 0);

    function exceedsAnyTarget(vec) {
      for (let i = 0; i < vec.length; i++) {
        if (vec[i] > targetVector[i]) return true;
      }
      return false;
    }

    const groupedExactByGear = {};
    let canAttemptExact = missingGearTypes.length === 0;

    if (canAttemptExact) {
      for (const gt of GEAR_TYPES) {
        const map = new Map();
        for (const entry of byGear[gt]) {
          const vecSum = entry.vec.reduce((sum, v) => sum + v, 0);
          if (vecSum !== 3 || exceedsAnyTarget(entry.vec)) continue;
          const key = vectorKey(entry.vec);
          if (!map.has(key)) {
            map.set(key, { vec: entry.vec, items: [entry.item] });
          } else {
            map.get(key).items.push(entry.item);
          }
        }
        const groups = Array.from(map.values());
        if (groups.length === 0) {
          canAttemptExact = false;
          break;
        }
        groupedExactByGear[gt] = groups;
      }
    }

    const exactSolutions = [];
    let totalCombinationsChecked = 0;

    if (canAttemptExact) {
      const orderedGears = [...GEAR_TYPES].sort(
        (a, b) => groupedExactByGear[a].length - groupedExactByGear[b].length
      );

      const remaining = [...targetVector];
      const chosen = new Array(orderedGears.length);

      function backtrackExact(depth) {
        if (exactSolutions.length >= maxSolutions) return;

        if (depth === orderedGears.length) {
          totalCombinationsChecked += 1;
          if (!remaining.every((r) => r === 0)) return;
          const itemsByGear = {};
          const alternativesByGear = {};
          for (let i = 0; i < orderedGears.length; i++) {
            const gt = orderedGears[i];
            const group = chosen[i];
            itemsByGear[gt] = group.items[0];
            alternativesByGear[gt] = group.items;
          }
          exactSolutions.push({ itemsByGear, alternativesByGear });
          return;
        }

        const gt = orderedGears[depth];
        const groups = groupedExactByGear[gt];

        for (let g = 0; g < groups.length; g++) {
          const group = groups[g];
          const vec = group.vec;

          let feasible = true;
          for (let s = 0; s < vec.length; s++) {
            if (vec[s] > remaining[s]) {
              feasible = false;
              break;
            }
          }
          if (!feasible) continue;

          for (let s = 0; s < vec.length; s++) {
            remaining[s] -= vec[s];
          }
          chosen[depth] = group;

          backtrackExact(depth + 1);

          for (let s = 0; s < vec.length; s++) {
            remaining[s] += vec[s];
          }

          if (exactSolutions.length >= maxSolutions) return;
        }
      }

      backtrackExact(0);
    }

    let bestPartial = null;
    if (exactSolutions.length === 0 && validItems.length > 0) {
      bestPartial = findBestPartial(byGear, targetVector, skillIds, totalTarget);
    }

    return {
      skills,
      exactSolutions,
      bestPartial,
      missingGearTypes,
      totalCombinationsChecked,
      totalTarget,
    };
  }

  /**
   * Find the best partial loadout (at most 1 item per gear type).
   * Objective order:
   *   1. Maximize completed 3/3 skills (target === 3 skills reaching >= 3)
   *   2. Maximize total lines covered toward 3/3 skills
   *   3. Maximize distinct target skills with at least 1 instance
   *   4. Maximize total target skill lines covered (clamped at targetVector)
   *   5. Minimize wasted / overcapped lines
   */
  function findBestPartial(byGear, targetVector, skillIds, totalTarget) {
    const groupedByGear = {};
    for (const gt of GEAR_TYPES) {
      const map = new Map();
      for (const entry of byGear[gt]) {
        const key = vectorKey(entry.vec);
        if (!map.has(key)) {
          map.set(key, { vec: entry.vec, items: [entry.item] });
        } else {
          map.get(key).items.push(entry.item);
        }
      }
      groupedByGear[gt] = Array.from(map.values());
    }

    const activeGears = GEAR_TYPES.filter((gt) => groupedByGear[gt].length > 0).sort(
      (a, b) => groupedByGear[a].length - groupedByGear[b].length
    );

    const threeTargetIndices = [];
    let totalCoreTarget = 0;
    for (let i = 0; i < targetVector.length; i++) {
      if (targetVector[i] === 3) {
        threeTargetIndices.push(i);
        totalCoreTarget += 3;
      }
    }

    let bestCompleted3 = -1;
    let bestCoreCovered = -1;
    let bestDistinct = -1;
    let bestScore = -1;
    let bestWaste = Infinity;
    let bestChosen = null;

    const currentCounts = new Array(skillIds.length).fill(0);
    const chosen = new Array(activeGears.length).fill(null);

    function computeStats(vec) {
      let completed3 = 0;
      let coreCovered = 0;
      let distinctCovered = 0;
      let covered = 0;
      let waste = 0;
      for (let i = 0; i < vec.length; i++) {
        if (targetVector[i] === 3) {
          if (vec[i] >= 3) completed3 += 1;
          coreCovered += Math.min(vec[i], 3);
        }
        if (vec[i] > 0 && targetVector[i] > 0) {
          distinctCovered += 1;
        }
        if (vec[i] <= targetVector[i]) {
          covered += vec[i];
        } else {
          covered += targetVector[i];
          waste += vec[i] - targetVector[i];
        }
      }
      return { completed3, coreCovered, distinctCovered, covered, waste };
    }

    function isBetter(stats) {
      if (stats.completed3 !== bestCompleted3) {
        return stats.completed3 > bestCompleted3;
      }
      if (stats.coreCovered !== bestCoreCovered) {
        return stats.coreCovered > bestCoreCovered;
      }
      if (stats.distinctCovered !== bestDistinct) {
        return stats.distinctCovered > bestDistinct;
      }
      if (stats.covered !== bestScore) {
        return stats.covered > bestScore;
      }
      return stats.waste < bestWaste;
    }

    function maxAdditionalCompleted3(counts, remainingLines) {
      const needs = [];
      for (let i = 0; i < threeTargetIndices.length; i++) {
        const idx = threeTargetIndices[i];
        if (counts[idx] < 3) {
          needs.push(3 - counts[idx]);
        }
      }
      needs.sort((a, b) => a - b);
      let budget = remainingLines;
      let extra = 0;
      for (let i = 0; i < needs.length; i++) {
        if (budget >= needs[i]) {
          budget -= needs[i];
          extra += 1;
        } else {
          break;
        }
      }
      return extra;
    }

    function searchPartial(depth) {
      if (depth === activeGears.length) {
        const stats = computeStats(currentCounts);
        if (isBetter(stats)) {
          bestCompleted3 = stats.completed3;
          bestCoreCovered = stats.coreCovered;
          bestDistinct = stats.distinctCovered;
          bestScore = stats.covered;
          bestWaste = stats.waste;
          bestChosen = [...chosen];
        }
        return;
      }

      const {
        completed3: curCompleted3,
        coreCovered: curCoreCovered,
        distinctCovered: curDistinct,
        covered: curCovered,
      } = computeStats(currentCounts);
      const remainingLines = (activeGears.length - depth) * 3;
      const maxPossibleCompleted3 = curCompleted3 + maxAdditionalCompleted3(currentCounts, remainingLines);
      const maxPossibleCoreCovered = Math.min(totalCoreTarget, curCoreCovered + remainingLines);
      const maxPossibleDistinct = curDistinct + Math.min(skillIds.length - curDistinct, remainingLines);
      const maxPossibleCovered = Math.min(totalTarget, curCovered + remainingLines);

      if (maxPossibleCompleted3 < bestCompleted3) return;
      if (maxPossibleCompleted3 === bestCompleted3 && maxPossibleCoreCovered < bestCoreCovered) return;
      if (
        maxPossibleCompleted3 === bestCompleted3 &&
        maxPossibleCoreCovered === bestCoreCovered &&
        maxPossibleDistinct < bestDistinct
      ) return;
      if (
        maxPossibleCompleted3 === bestCompleted3 &&
        maxPossibleCoreCovered === bestCoreCovered &&
        maxPossibleDistinct === bestDistinct &&
        maxPossibleCovered < bestScore
      ) return;

      const gt = activeGears[depth];
      const groups = groupedByGear[gt];

      // Rank groups by 3/3 completions, core lines gained, distinct skills gained, then total lines gained
      const ranked = groups
        .map((group) => {
          let completes3Gain = 0;
          let coreGain = 0;
          let distinctGain = 0;
          let totalGain = 0;
          for (let s = 0; s < group.vec.length; s++) {
            const added = group.vec[s];
            if (targetVector[s] === 3) {
              if (currentCounts[s] < 3 && currentCounts[s] + added >= 3) {
                completes3Gain += 1;
              }
              coreGain += Math.min(3 - currentCounts[s], added);
            }
            if (added > 0 && currentCounts[s] === 0 && targetVector[s] > 0) {
              distinctGain += 1;
            }
            const need = Math.max(0, targetVector[s] - currentCounts[s]);
            totalGain += Math.min(need, added);
          }
          return { group, completes3Gain, coreGain, distinctGain, totalGain };
        })
        .sort(
          (a, b) =>
            (b.completes3Gain - a.completes3Gain) ||
            (b.coreGain - a.coreGain) ||
            (b.distinctGain - a.distinctGain) ||
            (b.totalGain - a.totalGain)
        );

      for (let g = 0; g < ranked.length; g++) {
        const { group } = ranked[g];
        for (let s = 0; s < group.vec.length; s++) {
          currentCounts[s] += group.vec[s];
        }
        chosen[depth] = group;
        searchPartial(depth + 1);
        for (let s = 0; s < group.vec.length; s++) {
          currentCounts[s] -= group.vec[s];
        }
      }
    }

    searchPartial(0);

    const itemsByGear = {};
    const alternativesByGear = {};
    for (const gt of GEAR_TYPES) {
      itemsByGear[gt] = null;
      alternativesByGear[gt] = [];
    }
    const finalVec = new Array(skillIds.length).fill(0);
    if (bestChosen) {
      for (let i = 0; i < activeGears.length; i++) {
        const gt = activeGears[i];
        const group = bestChosen[i];
        if (group) {
          itemsByGear[gt] = group.items[0];
          alternativesByGear[gt] = group.items;
          for (let s = 0; s < group.vec.length; s++) {
            finalVec[s] += group.vec[s];
          }
        }
      }
    }

    const counts = {};
    const missing = {};
    const excess = {};
    for (let s = 0; s < skillIds.length; s++) {
      const id = skillIds[s];
      counts[id] = finalVec[s];
      missing[id] = Math.max(0, targetVector[s] - finalVec[s]);
      excess[id] = Math.max(0, finalVec[s] - targetVector[s]);
    }

    return {
      completed3: bestCompleted3,
      totalThreeTargets: threeTargetIndices.length,
      coreCovered: bestCoreCovered,
      distinctCovered: bestDistinct,
      totalDistinct: skillIds.length,
      covered: bestScore,
      totalTarget,
      itemsByGear,
      alternativesByGear,
      counts,
      missing,
      excess,
    };
  }

  return {
    GEAR_TYPES,
    ALL_SKILLS,
    ALL_SKILL_IDS,
    GOAL,
    SKILLS: GOAL.skills,
    SKILL_IDS: GOAL.skills.map((s) => s.id),
    TARGET_VECTOR: GOAL.skills.map((s) => s.target),
    TOTAL_TARGET: 18,
    normalizeSkillId,
    isValidItem,
    itemEquivalenceKey,
    findEquivalentGroups,
    solve,
    linesToVector: (lines) => linesToVector(
      lines,
      Object.fromEntries(GOAL.skills.map((s, idx) => [s.id, idx])),
      GOAL.skills.length
    ),
  };
}));
