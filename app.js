(function () {
  'use strict';

  const STORAGE_KEY = 'quanah_hologram_gear_v1';

  const {
    GEAR_TYPES,
    ALL_SKILLS,
    GOAL,
    normalizeSkillId,
    isValidItem,
    findEquivalentGroups,
    solve,
  } = window.QuanahSolver;

  const SKILL_CLASS_MAP = {
    'Registry': 'skill-registry',
    'Damage': 'skill-damage',
    'Crit': 'skill-crit',
    'Attack': 'skill-attack',
    'Dimension Leap': 'skill-dimension',
    'White Hole': 'skill-whitehole',
    'Crit Damage': 'skill-critdmg',
    'Warrior Skill': 'skill-warrior',
    'Archer Skill': 'skill-archer',
    'Mage Skill': 'skill-mage',
    'Thief Skill': 'skill-thief',
    'Pirate Skill': 'skill-pirate',
  };

  // Application state
  let gearItems = [];
  let selectedGearType = GEAR_TYPES[0];
  let activeFilter = 'All';
  let editingId = null;
  let currentSolutionIdx = 0;
  let lastSolveResult = null;

  // DOM references
  const els = {
    formTitle: document.getElementById('form-title'),
    gearForm: document.getElementById('gear-form'),
    gearTypePills: document.getElementById('gear-type-pills'),
    itemName: document.getElementById('item-name'),
    lineSelects: [
      document.getElementById('line-1'),
      document.getElementById('line-2'),
      document.getElementById('line-3'),
    ],
    formError: document.getElementById('form-error'),
    btnSubmit: document.getElementById('btn-submit'),
    btnCancelEdit: document.getElementById('btn-cancel-edit'),
    inventoryCount: document.getElementById('inventory-count'),
    equivSummary: document.getElementById('equiv-summary'),
    filterTabs: document.getElementById('filter-tabs'),
    gearList: document.getElementById('gear-list'),
    targetSummary: document.getElementById('target-summary'),
    targetGrid: document.getElementById('target-grid'),
    solutionNav: document.getElementById('solution-nav'),
    btnPrevSol: document.getElementById('btn-prev-sol'),
    btnNextSol: document.getElementById('btn-next-sol'),
    solutionCounter: document.getElementById('solution-counter'),
    solverStatus: document.getElementById('solver-status'),
    solverResults: document.getElementById('solver-results'),
    storageStatus: document.getElementById('storage-status'),
    btnSample: document.getElementById('btn-sample'),
    btnIo: document.getElementById('btn-io'),
    btnClearAll: document.getElementById('btn-clear-all'),
    ioModal: document.getElementById('io-modal'),
    ioTextarea: document.getElementById('io-textarea'),
    ioError: document.getElementById('io-error'),
    btnCloseIo: document.getElementById('btn-close-io'),
    btnCopyIo: document.getElementById('btn-copy-io'),
    btnImportIo: document.getElementById('btn-import-io'),
  };

  function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'gear_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isValidItem).map((item) => ({
        id: typeof item.id === 'string' && item.id ? item.id : generateId(),
        name: typeof item.name === 'string' ? item.name.slice(0, 40) : '',
        gearType: item.gearType,
        lines: item.lines.map((l) => normalizeSkillId(l) || l),
      }));
    } catch {
      return [];
    }
  }

  function saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(gearItems));
      els.storageStatus.hidden = false;
    } catch {
      els.storageStatus.textContent = 'Storage unavailable';
    }
  }

  function createSkillPill(skillId, countSuffix) {
    const span = document.createElement('span');
    span.className = 'skill-pill ' + (SKILL_CLASS_MAP[skillId] || '');
    span.textContent = countSuffix ? `${skillId} ×${countSuffix}` : skillId;
    return span;
  }

  function initFormControls() {
    els.gearTypePills.innerHTML = '';
    for (const gt of GEAR_TYPES) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'gear-pill' + (gt === selectedGearType ? ' active' : '');
      btn.textContent = gt;
      btn.dataset.gearType = gt;
      btn.addEventListener('click', () => {
        selectedGearType = gt;
        updateGearTypePills();
      });
      els.gearTypePills.appendChild(btn);
    }

    populateSkillDropdowns();
  }

  function populateSkillDropdowns() {
    const goalSkillIds = new Set(GOAL.skills.map((s) => s.id));
    const coreSkills = GOAL.skills.filter((s) => s.target > 1);
    const singleSkills = GOAL.skills.filter((s) => s.target === 1);
    const otherSkills = ALL_SKILLS.filter((s) => !goalSkillIds.has(s.id));

    els.lineSelects.forEach((select, idx) => {
      const currentVal = select.value;
      select.innerHTML = '';

      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = `Select Line ${idx + 1}...`;
      select.appendChild(placeholder);

      const coreGroup = document.createElement('optgroup');
      coreGroup.label = 'Core Skills (3× needed)';
      for (const s of coreSkills) {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.label;
        coreGroup.appendChild(opt);
      }
      select.appendChild(coreGroup);

      const singleGroup = document.createElement('optgroup');
      singleGroup.label = 'Crit Damage & Class Skills (1× needed)';
      for (const s of singleSkills) {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.label;
        singleGroup.appendChild(opt);
      }
      select.appendChild(singleGroup);

      if (otherSkills.length > 0) {
        const otherGroup = document.createElement('optgroup');
        otherGroup.label = 'Other Hologram Skills';
        for (const s of otherSkills) {
          const opt = document.createElement('option');
          opt.value = s.id;
          opt.textContent = s.label;
          otherGroup.appendChild(opt);
        }
        select.appendChild(otherGroup);
      }

      if (currentVal) {
        const norm = normalizeSkillId(currentVal);
        select.value = norm || '';
      }
    });
  }

  function updateGearTypePills() {
    const buttons = els.gearTypePills.querySelectorAll('.gear-pill');
    buttons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.gearType === selectedGearType);
    });
  }

  function showFormError(msg) {
    if (!msg) {
      els.formError.hidden = true;
      els.formError.textContent = '';
    } else {
      els.formError.hidden = false;
      els.formError.textContent = msg;
    }
  }

  function resetForm() {
    editingId = null;
    els.formTitle.textContent = 'Add Hologram Gear';
    els.btnSubmit.textContent = 'Add Gear';
    els.btnCancelEdit.hidden = true;
    els.itemName.value = '';
    els.lineSelects.forEach((sel) => {
      sel.value = '';
    });
    showFormError('');
    renderGearList();
  }

  function startEditItem(item) {
    editingId = item.id;
    selectedGearType = item.gearType;
    updateGearTypePills();
    els.formTitle.textContent = 'Edit Hologram Gear';
    els.btnSubmit.textContent = 'Save Changes';
    els.btnCancelEdit.hidden = false;
    els.itemName.value = item.name || '';
    els.lineSelects.forEach((sel, idx) => {
      sel.value = normalizeSkillId(item.lines[idx]) || '';
    });
    showFormError('');
    renderGearList();
    els.itemName.focus();
  }

  function handleFormSubmit(e) {
    e.preventDefault();
    const rawLines = els.lineSelects.map((sel) => sel.value);
    if (rawLines.some((l) => !l)) {
      showFormError('Please select all 3 Hologram lines.');
      return;
    }

    const lines = rawLines.map((l) => normalizeSkillId(l));
    const candidate = {
      id: editingId || generateId(),
      name: els.itemName.value.trim(),
      gearType: selectedGearType,
      lines,
    };

    if (!isValidItem(candidate)) {
      showFormError('Invalid gear type or Hologram skill selected.');
      return;
    }

    if (editingId) {
      const idx = gearItems.findIndex((i) => i.id === editingId);
      if (idx !== -1) {
        gearItems[idx] = candidate;
      }
    } else {
      gearItems.push(candidate);
    }

    saveToStorage();
    resetForm();
    runSolverAndRender();
  }

  function duplicateItem(item) {
    gearItems.push({
      id: generateId(),
      name: item.name ? `${item.name} (copy)` : '',
      gearType: item.gearType,
      lines: [...item.lines],
    });
    saveToStorage();
    runSolverAndRender();
  }

  function deleteItem(id) {
    gearItems = gearItems.filter((item) => item.id !== id);
    if (editingId === id) {
      resetForm();
    }
    saveToStorage();
    runSolverAndRender();
  }

  function renderFilterTabs() {
    const counts = { All: gearItems.length };
    for (const gt of GEAR_TYPES) counts[gt] = 0;
    for (const item of gearItems) {
      if (counts[item.gearType] !== undefined) counts[item.gearType] += 1;
    }

    els.filterTabs.innerHTML = '';
    const tabs = ['All', ...GEAR_TYPES];
    for (const tab of tabs) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'filter-tab' + (activeFilter === tab ? ' active' : '');
      btn.textContent = `${tab} (${counts[tab]})`;
      btn.addEventListener('click', () => {
        activeFilter = tab;
        renderFilterTabs();
        renderGearList();
      });
      els.filterTabs.appendChild(btn);
    }
  }

  function getDisplayName(item, indexInSlot) {
    if (item.name && item.name.trim()) return item.name.trim();
    return `${item.gearType} #${indexInSlot}`;
  }

  function buildDisplayNameLookup() {
    const slotCounters = {};
    const displayNameById = {};
    for (const item of gearItems) {
      slotCounters[item.gearType] = (slotCounters[item.gearType] || 0) + 1;
      displayNameById[item.id] = getDisplayName(item, slotCounters[item.gearType]);
    }
    return displayNameById;
  }

  function renderGearList() {
    els.inventoryCount.textContent = String(gearItems.length);
    renderFilterTabs();

    const displayNameById = buildDisplayNameLookup();
    const { groups: equivGroups, equivalentPeersById } = findEquivalentGroups(gearItems);

    if (equivGroups.length > 0) {
      els.equivSummary.hidden = false;
      els.equivSummary.textContent = `${equivGroups.length} equivalent ${equivGroups.length === 1 ? 'group' : 'groups'}`;
      els.equivSummary.title = 'Items of the same gear type with identical skills (regardless of order)';
    } else {
      els.equivSummary.hidden = true;
      els.equivSummary.textContent = '';
    }

    const filtered =
      activeFilter === 'All'
        ? gearItems
        : gearItems.filter((item) => item.gearType === activeFilter);

    els.gearList.innerHTML = '';

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent =
        gearItems.length === 0
          ? 'No gear saved yet. Add items above or click "Load Sample" to test.'
          : `No saved items for ${activeFilter}.`;
      els.gearList.appendChild(empty);
      return;
    }

    for (const item of filtered) {
      const equivPeers = equivalentPeersById[item.id] || [];
      const hasEquiv = equivPeers.length > 0;

      const card = document.createElement('div');
      card.className =
        'gear-item' +
        (editingId === item.id ? ' editing' : '') +
        (hasEquiv ? ' has-equiv' : '');

      const top = document.createElement('div');
      top.className = 'gear-item-top';

      const title = document.createElement('div');
      title.className = 'gear-item-title';

      const slotBadge = document.createElement('span');
      slotBadge.className = 'slot-badge';
      slotBadge.textContent = item.gearType;

      const nameEl = document.createElement('span');
      nameEl.className = 'gear-name';
      nameEl.textContent = displayNameById[item.id];

      title.appendChild(slotBadge);
      title.appendChild(nameEl);

      if (hasEquiv) {
        const peerNames = equivPeers.map((p) => displayNameById[p.id]).join(', ');
        const equivBadge = document.createElement('span');
        equivBadge.className = 'equiv-badge';
        equivBadge.textContent =
          equivPeers.length === 1
            ? `≡ Same skills as ${peerNames}`
            : `≡ ${equivPeers.length} equivalent`;
        equivBadge.title = `Same ${item.gearType} skills (order-independent) as: ${peerNames}`;
        title.appendChild(equivBadge);
      }

      const actions = document.createElement('div');
      actions.className = 'gear-item-actions';

      const btnEdit = document.createElement('button');
      btnEdit.type = 'button';
      btnEdit.className = 'btn btn-secondary btn-sm';
      btnEdit.textContent = 'Edit';
      btnEdit.addEventListener('click', () => startEditItem(item));

      const btnDup = document.createElement('button');
      btnDup.type = 'button';
      btnDup.className = 'btn btn-secondary btn-sm';
      btnDup.textContent = 'Copy';
      btnDup.title = 'Duplicate item';
      btnDup.addEventListener('click', () => duplicateItem(item));

      const btnDel = document.createElement('button');
      btnDel.type = 'button';
      btnDel.className = 'btn btn-danger-ghost btn-sm';
      btnDel.textContent = 'Delete';
      btnDel.addEventListener('click', () => deleteItem(item.id));

      actions.appendChild(btnEdit);
      actions.appendChild(btnDup);
      actions.appendChild(btnDel);

      top.appendChild(title);
      top.appendChild(actions);

      const pills = document.createElement('div');
      pills.className = 'skill-pills';
      for (const line of item.lines) {
        pills.appendChild(createSkillPill(line));
      }

      card.appendChild(top);
      card.appendChild(pills);
      els.gearList.appendChild(card);
    }
  }

  function getActiveLoadoutCounts(result) {
    const counts = {};
    for (const s of GOAL.skills) counts[s.id] = 0;

    if (result.exactSolutions.length > 0) {
      const sol = result.exactSolutions[currentSolutionIdx];
      for (const gt of GEAR_TYPES) {
        const item = sol.itemsByGear[gt];
        if (!item) continue;
        for (const line of item.lines) {
          counts[line] = (counts[line] || 0) + 1;
        }
      }
    } else if (result.bestPartial) {
      return result.bestPartial.counts;
    }
    return counts;
  }

  function renderTargets(result) {
    const counts = getActiveLoadoutCounts(result);
    let covered = 0;
    let distinctCovered = 0;

    els.targetGrid.innerHTML = '';
    for (const skill of GOAL.skills) {
      const have = counts[skill.id] || 0;
      if (have > 0) distinctCovered += 1;
      covered += Math.min(have, skill.target);

      const row = document.createElement('div');
      const statusClass =
        have >= skill.target ? 'met' : have > 0 ? 'partial' : '';
      row.className = 'target-row' + (statusClass ? ' ' + statusClass : '');

      const pill = createSkillPill(skill.id);
      const countEl = document.createElement('span');
      countEl.className = 'target-count';
      countEl.textContent = `${have} / ${skill.target}`;

      row.appendChild(pill);
      row.appendChild(countEl);
      els.targetGrid.appendChild(row);
    }

    els.targetSummary.textContent = `${distinctCovered}/${GOAL.skills.length} skills · ${covered}/${result.totalTarget} lines`;
  }

  function renderSolverResults(result) {
    els.solverStatus.innerHTML = '';
    els.solverResults.innerHTML = '';

    const displayNameById = buildDisplayNameLookup();

    if (gearItems.length === 0) {
      els.solutionNav.hidden = true;
      const banner = document.createElement('div');
      banner.className = 'status-banner info';
      banner.textContent = 'Add at least 1 gear item per slot (Hat, Top, Bottom, Gloves, Shoes, Cape) to solve.';
      els.solverStatus.appendChild(banner);
      return;
    }

    if (result.exactSolutions.length > 0) {
      const totalSol = result.exactSolutions.length;
      if (currentSolutionIdx >= totalSol) currentSolutionIdx = 0;

      els.solutionNav.hidden = totalSol <= 1;
      els.solutionCounter.textContent = `${currentSolutionIdx + 1} / ${totalSol}`;
      els.btnPrevSol.disabled = currentSolutionIdx === 0;
      els.btnNextSol.disabled = currentSolutionIdx === totalSol - 1;

      const banner = document.createElement('div');
      banner.className = 'status-banner success';
      banner.textContent =
        totalSol === 50
          ? 'Exact 18/18 match found! Showing first 50 valid 6-piece combinations.'
          : `Exact 18/18 match found! ${totalSol} valid 6-piece ${totalSol === 1 ? 'combination' : 'combinations'} available.`;
      els.solverStatus.appendChild(banner);

      const sol = result.exactSolutions[currentSolutionIdx];
      for (const gt of GEAR_TYPES) {
        const item = sol.itemsByGear[gt];
        const alts = sol.alternativesByGear[gt] || [];

        const slotCard = document.createElement('div');
        slotCard.className = 'loadout-slot';

        const header = document.createElement('div');
        header.className = 'loadout-slot-header';

        const title = document.createElement('div');
        title.className = 'loadout-slot-title';

        const slotBadge = document.createElement('span');
        slotBadge.className = 'slot-badge';
        slotBadge.textContent = gt;

        const nameEl = document.createElement('span');
        nameEl.className = 'gear-name';
        nameEl.textContent = displayNameById[item.id] || item.gearType;

        title.appendChild(slotBadge);
        title.appendChild(nameEl);
        header.appendChild(title);

        if (alts.length > 1) {
          const altNames = alts.slice(1).map((a) => displayNameById[a.id]).join(', ');
          const altNote = document.createElement('span');
          altNote.className = 'alt-note';
          altNote.textContent = `+${alts.length - 1} equivalent`;
          altNote.title = `Equivalent alternatives: ${altNames}`;
          header.appendChild(altNote);
        }

        const pills = document.createElement('div');
        pills.className = 'skill-pills';
        for (const line of item.lines) {
          pills.appendChild(createSkillPill(line));
        }

        slotCard.appendChild(header);
        slotCard.appendChild(pills);
        els.solverResults.appendChild(slotCard);
      }
      return;
    }

    // No exact solution: show closest partial match prioritizing 1 of each skill first
    els.solutionNav.hidden = true;
    const partial = result.bestPartial;

    const banner = document.createElement('div');
    banner.className = 'status-banner warning';
    const coverageText = `${partial.distinctCovered}/${partial.totalDistinct} unique skills covered (${partial.covered}/${result.totalTarget} total lines)`;
    if (result.missingGearTypes.length > 0) {
      banner.textContent = `No exact 18/18 match yet — missing slots: ${result.missingGearTypes.join(', ')}. Best loadout (prioritizing 1 of each skill): ${coverageText}.`;
    } else {
      banner.textContent = `No exact 18/18 match exists with current gear. Best loadout (prioritizing 1 of each skill): ${coverageText}.`;
    }
    els.solverStatus.appendChild(banner);

    for (const gt of GEAR_TYPES) {
      const item = partial.itemsByGear[gt];
      const alts = (partial.alternativesByGear && partial.alternativesByGear[gt]) || [];
      const slotCard = document.createElement('div');
      slotCard.className = 'loadout-slot' + (item ? '' : ' missing');

      const header = document.createElement('div');
      header.className = 'loadout-slot-header';

      const title = document.createElement('div');
      title.className = 'loadout-slot-title';

      const slotBadge = document.createElement('span');
      slotBadge.className = 'slot-badge';
      slotBadge.textContent = gt;

      const nameEl = document.createElement('span');
      nameEl.className = 'gear-name';
      nameEl.textContent = item ? displayNameById[item.id] : 'No item available';

      title.appendChild(slotBadge);
      title.appendChild(nameEl);
      header.appendChild(title);

      if (alts.length > 1) {
        const altNames = alts.slice(1).map((a) => displayNameById[a.id]).join(', ');
        const altNote = document.createElement('span');
        altNote.className = 'alt-note';
        altNote.textContent = `+${alts.length - 1} equivalent`;
        altNote.title = `Equivalent alternatives: ${altNames}`;
        header.appendChild(altNote);
      }

      slotCard.appendChild(header);

      if (item) {
        const pills = document.createElement('div');
        pills.className = 'skill-pills';
        for (const line of item.lines) {
          pills.appendChild(createSkillPill(line));
        }
        slotCard.appendChild(pills);
      }

      els.solverResults.appendChild(slotCard);
    }

    // Gap analysis (missing & excess)
    const missingList = result.skills.filter((s) => (partial.missing[s.id] || 0) > 0);
    const excessList = result.skills.filter((s) => (partial.excess[s.id] || 0) > 0);

    if (missingList.length > 0 || excessList.length > 0) {
      const gapBox = document.createElement('div');
      gapBox.className = 'gap-summary';

      if (missingList.length > 0) {
        const sec = document.createElement('div');
        const t = document.createElement('div');
        t.className = 'gap-section-title';
        t.textContent = 'Still Missing';
        const p = document.createElement('div');
        p.className = 'skill-pills';
        for (const s of missingList) {
          p.appendChild(createSkillPill(s.id, partial.missing[s.id]));
        }
        sec.appendChild(t);
        sec.appendChild(p);
        gapBox.appendChild(sec);
      }

      if (excessList.length > 0) {
        const sec = document.createElement('div');
        const t = document.createElement('div');
        t.className = 'gap-section-title';
        t.textContent = 'Overcapped / Wasted Lines in Best Partial';
        const p = document.createElement('div');
        p.className = 'skill-pills';
        for (const s of excessList) {
          p.appendChild(createSkillPill(s.id, partial.excess[s.id]));
        }
        sec.appendChild(t);
        sec.appendChild(p);
        gapBox.appendChild(sec);
      }

      els.solverResults.appendChild(gapBox);
    }
  }

  function runSolverAndRender() {
    renderGearList();
    lastSolveResult = solve(gearItems, { maxSolutions: 50 });
    currentSolutionIdx = 0;
    renderTargets(lastSolveResult);
    renderSolverResults(lastSolveResult);
  }

  function loadSampleData() {
    if (
      gearItems.length > 0 &&
      !window.confirm('Replace your current saved gear list with sample data?')
    ) {
      return;
    }

    gearItems = GOAL.sampleItems.map((item) => ({
      id: generateId(),
      name: item.name,
      gearType: item.gearType,
      lines: [...item.lines],
    }));

    saveToStorage();
    resetForm();
    runSolverAndRender();
  }

  function clearAllData() {
    if (gearItems.length === 0) return;
    if (!window.confirm('Delete all saved gear items?')) return;
    gearItems = [];
    saveToStorage();
    resetForm();
    runSolverAndRender();
  }

  function openIoModal() {
    const exportData = gearItems.map(({ name, gearType, lines }) => ({
      name,
      gearType,
      lines,
    }));
    els.ioTextarea.value = JSON.stringify(exportData, null, 2);
    els.ioError.hidden = true;
    els.ioError.textContent = '';
    els.ioModal.hidden = false;
  }

  function closeIoModal() {
    els.ioModal.hidden = true;
  }

  function handleImportIo() {
    try {
      const parsed = JSON.parse(els.ioTextarea.value);
      if (!Array.isArray(parsed)) {
        throw new Error('JSON must be an array of gear items.');
      }
      const imported = [];
      for (let i = 0; i < parsed.length; i++) {
        const entry = parsed[i];
        if (!isValidItem(entry)) {
          throw new Error(`Item at index ${i} is invalid (requires valid gearType and 3 valid Hologram lines).`);
        }
        imported.push({
          id: generateId(),
          name: typeof entry.name === 'string' ? entry.name.slice(0, 40) : '',
          gearType: entry.gearType,
          lines: entry.lines.map((l) => normalizeSkillId(l) || l),
        });
      }
      gearItems = imported;
      saveToStorage();
      resetForm();
      runSolverAndRender();
      closeIoModal();
    } catch (err) {
      els.ioError.hidden = false;
      els.ioError.textContent = err.message || 'Invalid JSON format.';
    }
  }

  async function handleCopyIo() {
    try {
      await navigator.clipboard.writeText(els.ioTextarea.value);
      const orig = els.btnCopyIo.textContent;
      els.btnCopyIo.textContent = 'Copied!';
      setTimeout(() => {
        els.btnCopyIo.textContent = orig;
      }, 1400);
    } catch {
      els.ioTextarea.select();
    }
  }

  function bindEvents() {
    els.gearForm.addEventListener('submit', handleFormSubmit);
    els.btnCancelEdit.addEventListener('click', resetForm);
    els.btnSample.addEventListener('click', loadSampleData);
    els.btnClearAll.addEventListener('click', clearAllData);

    els.btnPrevSol.addEventListener('click', () => {
      if (currentSolutionIdx > 0) {
        currentSolutionIdx -= 1;
        renderTargets(lastSolveResult);
        renderSolverResults(lastSolveResult);
      }
    });

    els.btnNextSol.addEventListener('click', () => {
      if (lastSolveResult && currentSolutionIdx < lastSolveResult.exactSolutions.length - 1) {
        currentSolutionIdx += 1;
        renderTargets(lastSolveResult);
        renderSolverResults(lastSolveResult);
      }
    });

    els.btnIo.addEventListener('click', openIoModal);
    els.btnCloseIo.addEventListener('click', closeIoModal);
    els.btnCopyIo.addEventListener('click', handleCopyIo);
    els.btnImportIo.addEventListener('click', handleImportIo);
    els.ioModal.addEventListener('click', (e) => {
      if (e.target === els.ioModal) closeIoModal();
    });
  }

  function init() {
    initFormControls();
    bindEvents();
    gearItems = loadFromStorage();
    runSolverAndRender();
  }

  init();
})();
