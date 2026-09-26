// CR-114 — the schema-registry's own recursive widget-tree editor. A new,
// dedicated component (not an extension of referentialListGroup.js, which
// only ever renders one fixed level of rows) because a "list"/"object"
// widget's own children are themselves full widget rows, to unbounded depth.
//
// Every kind-specific property panel for every row is always present in the
// DOM (never conditionally rendered server-side) so that switching a row's
// kind needs no server round trip — this file just shows/hides the relevant
// panels. Every panel's field names are unique within a row (no two
// simultaneously-present panels ever share a `name`) so a hidden panel's
// stale value is never silently double-submitted.
//
// Adding a widget clones one of two blank-row `<template>`s (new.ejs) rather
// than the "clone the last existing row" trick referentialListGroup.js uses,
// because a freshly added "list"/"object" widget's own children container
// starts genuinely empty — there is no existing row to clone from.
(function () {
  function notifyDirty() {
    if (typeof window.markDirty === 'function') window.markDirty();
  }

  function applyRowVisibility(row) {
    var cardBody = row.querySelector(':scope > .card-body');
    if (!cardBody) return;
    var kindSelect = cardBody.querySelector(':scope > .d-flex > .wt-kind');
    var kind = kindSelect ? kindSelect.value : 'text';
    var drivenSelect = cardBody.querySelector(':scope > [data-panel="driven-select"] select');
    var drivenMode = drivenSelect ? drivenSelect.value : '';
    var isItem = row.getAttribute('data-is-item') === '1';

    function show(panelName, visible) {
      var el = cardBody.querySelector(':scope > [data-panel="' + panelName + '"]');
      if (el) el.style.display = visible ? '' : 'none';
    }

    show('text', kind === 'text' || kind === 'textarea');
    show('select', kind === 'select');
    show('boolean', kind === 'boolean');
    show('json', kind === 'json');
    show('ref-source', kind === 'referential' || kind === 'referential-multi' || kind === 'list');
    show('driven-select', !isItem && (kind === 'referential' || kind === 'referential-multi'));

    var mode = '';
    if (kind === 'referential-dynamic') mode = 'suffix';
    else if (kind === 'referential-by-scope') mode = 'value';
    else if (!isItem && (kind === 'referential' || kind === 'referential-multi')) {
      if (drivenMode === 'by-suffix') mode = 'suffix';
      else if (drivenMode === 'by-value') mode = 'value';
    }
    show('driven-detail', mode !== '');
    var detailPanel = cardBody.querySelector(':scope > [data-panel="driven-detail"]');
    if (detailPanel) {
      var suffixField = detailPanel.querySelector('.wt-driven-suffix-field');
      var valueField = detailPanel.querySelector('.wt-driven-value-field');
      if (suffixField) suffixField.style.display = mode === 'suffix' ? '' : 'none';
      if (valueField) valueField.style.display = mode === 'value' ? '' : 'none';
    }

    var composableWrap = cardBody.querySelector(':scope > [data-panel="ref-source"] .wt-ontology-composable-wrap');
    if (composableWrap) composableWrap.style.display = mode === 'value' ? 'none' : '';

    show('children', kind === 'list' || kind === 'object');
  }

  function initRow(row) {
    applyRowVisibility(row);
  }

  document.querySelectorAll('.wt-row').forEach(initRow);

  document.addEventListener('change', function (e) {
    if (e.target.classList.contains('wt-kind') || e.target.classList.contains('wt-driven-mode')) {
      var row = e.target.closest('.wt-row');
      if (row) {
        if (e.target.classList.contains('wt-kind')) {
          // A deliberate kind change should get that kind's own sensible
          // default type, not the old field's literal `type` carried over.
          var rawTypeInput = row.querySelector(':scope > .card-body > .d-flex > .wt-raw-type');
          if (rawTypeInput) rawTypeInput.value = '';
        }
        applyRowVisibility(row);
        notifyDirty();
      }
    }
  });

  function replaceToken(root, token, value) {
    root.querySelectorAll('[name], [data-prefix], [data-name-prefix]').forEach(function (el) {
      ['name', 'data-prefix', 'data-name-prefix'].forEach(function (attr) {
        var v = el.getAttribute(attr);
        if (v && v.indexOf(token) !== -1) el.setAttribute(attr, v.split(token).join(value));
      });
    });
  }

  document.addEventListener('click', function (e) {
    var addBtn = e.target.closest ? e.target.closest('.wt-add') : null;
    if (addBtn) {
      var container = addBtn.previousElementSibling;
      if (!container || !container.classList.contains('wt-children')) return;
      var isItem = container.getAttribute('data-is-item') === '1';
      var template = document.getElementById(isItem ? 'wt-blank-item' : 'wt-blank-top');
      if (!template) return;
      var nextIndex = parseInt(container.getAttribute('data-next-index'), 10) || 0;
      var newPrefix = container.getAttribute('data-name-prefix') + '[' + nextIndex + ']';
      var frag = template.content.cloneNode(true);
      replaceToken(frag, '__PFX__', newPrefix);
      var newRow = frag.querySelector('.wt-row');
      if (newRow) newRow.setAttribute('data-prefix', newPrefix);
      container.appendChild(frag);
      container.setAttribute('data-next-index', String(nextIndex + 1));
      var inserted = container.querySelector('.wt-row:last-child');
      if (inserted) initRow(inserted);
      notifyDirty();
      return;
    }

    var removeBtn = e.target.closest ? e.target.closest('.wt-remove') : null;
    if (removeBtn) {
      var row = removeBtn.closest('.wt-row');
      if (row) { row.remove(); notifyDirty(); }
      return;
    }

    var notesToggle = e.target.closest ? e.target.closest('.wt-notes-toggle') : null;
    if (notesToggle) {
      var wrap = notesToggle.parentElement.querySelector('.wt-notes-wrap');
      if (wrap) wrap.style.display = wrap.style.display === 'none' ? '' : 'none';
      return;
    }

    var noteAdd = e.target.closest ? e.target.closest('.wt-note-add') : null;
    if (noteAdd) {
      var notesList = noteAdd.closest('.wt-notes-list');
      var nIdx = parseInt(notesList.getAttribute('data-next-index'), 10) || 0;
      var nPrefix = notesList.getAttribute('data-name-prefix');
      var row = document.createElement('div');
      row.className = 'wt-note-row row g-2 align-items-center mb-1';
      row.innerHTML =
        '<div class="col-auto"><input type="date" name="' + nPrefix + '[' + nIdx + '][date]" class="form-control form-control-sm"></div>' +
        '<div class="col"><input name="' + nPrefix + '[' + nIdx + '][note]" class="form-control form-control-sm" placeholder="Note"></div>' +
        '<div class="col-auto"><button type="button" class="btn btn-sm btn-outline-danger wt-note-remove"><i class="bi bi-x"></i></button></div>';
      notesList.insertBefore(row, noteAdd);
      notesList.setAttribute('data-next-index', String(nIdx + 1));
      notifyDirty();
      return;
    }
    var noteRemove = e.target.closest ? e.target.closest('.wt-note-remove') : null;
    if (noteRemove) {
      var noteRow = noteRemove.closest('.wt-note-row');
      if (noteRow) { noteRow.remove(); notifyDirty(); }
      return;
    }

    var variantAdd = e.target.closest ? e.target.closest('.wt-variant-add') : null;
    if (variantAdd) {
      var variantsList = variantAdd.closest('.wt-variants-list');
      var vIdx = parseInt(variantsList.getAttribute('data-next-index'), 10) || 0;
      var vPrefix = variantsList.getAttribute('data-name-prefix');
      var vRow = document.createElement('div');
      vRow.className = 'wt-variant-row row g-2 align-items-center mb-1';
      vRow.innerHTML =
        '<div class="col-md-3"><input name="' + vPrefix + '[' + vIdx + '][matchValue]" class="form-control form-control-sm" placeholder="Match value (blank = default)"></div>' +
        '<div class="col-md-3"><input name="' + vPrefix + '[' + vIdx + '][source]" class="form-control form-control-sm" placeholder="Source"></div>' +
        '<div class="col-auto form-check mt-1"><input type="checkbox" class="form-check-input" name="' + vPrefix + '[' + vIdx + '][ontology]"><label class="form-check-label small">Ontology</label></div>' +
        '<div class="col-auto form-check mt-1"><input type="checkbox" class="form-check-input" name="' + vPrefix + '[' + vIdx + '][composable]"><label class="form-check-label small">Composable</label></div>' +
        '<div class="col-auto"><button type="button" class="btn btn-sm btn-outline-danger wt-variant-remove"><i class="bi bi-x"></i></button></div>';
      variantsList.insertBefore(vRow, variantAdd);
      variantsList.setAttribute('data-next-index', String(vIdx + 1));
      notifyDirty();
      return;
    }
    var variantRemove = e.target.closest ? e.target.closest('.wt-variant-remove') : null;
    if (variantRemove) {
      var variantRow = variantRemove.closest('.wt-variant-row');
      if (variantRow) { variantRow.remove(); notifyDirty(); }
      return;
    }

    var groupAdd = e.target.closest ? e.target.closest('.wt-group-add') : null;
    if (groupAdd) {
      var groupsList = document.querySelector('.wt-groups-list');
      var gIdx = parseInt(groupsList.getAttribute('data-next-index'), 10) || 0;
      var gRow = document.createElement('div');
      gRow.className = 'wt-group-row row g-2 align-items-center mb-1';
      gRow.innerHTML =
        '<div class="col-md-3"><input name="groups[' + gIdx + '][key]" class="form-control form-control-sm" placeholder="key"></div>' +
        '<div class="col-md-4"><input name="groups[' + gIdx + '][label]" class="form-control form-control-sm" placeholder="Label"></div>' +
        '<div class="col-auto"><button type="button" class="btn btn-sm btn-outline-danger wt-group-remove"><i class="bi bi-x"></i></button></div>';
      groupsList.appendChild(gRow);
      groupsList.setAttribute('data-next-index', String(gIdx + 1));
      notifyDirty();
      return;
    }
    var groupRemove = e.target.closest ? e.target.closest('.wt-group-remove') : null;
    if (groupRemove) {
      var groupRow = groupRemove.closest('.wt-group-row');
      if (groupRow) { groupRow.remove(); notifyDirty(); }
      return;
    }
  });
})();
