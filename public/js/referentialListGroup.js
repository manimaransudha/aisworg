// Generic "+ Add another" / "Remove" wiring for any .referential-list-group
// widget on the page (_referentialListGroup.ejs's own markup) — shared by
// the SDK authoring form (authoring/edit.ejs) AND the Schema Registry's own
// field-grammar editor (schema-registry/new.ejs, via _generatedFields.ejs).
//
// Extracted from authoring/edit.ejs's own inline <script> (2026-08-22) —
// schema-registry/new.ejs's referential-list field (META_SCHEMA's own
// `fields`, 9 columns wide) had no add/remove affordance at all before
// this: generateFields() only ever offers exactly one blank row, so without
// this wiring the "new schema version" form could only ever add ONE new
// field per saved version — a real functional limitation, not just a
// cosmetic one. Calling window.markDirty() (if the page defines one) keeps
// authoring/edit.ejs's own unsaved-changes tracking working identically;
// it's an optional dependency, not a hard requirement, so pages without
// dirty-tracking work the same without it.
(function () {
  function notifyDirty() {
    if (typeof window.markDirty === 'function') window.markDirty();
  }

  document.querySelectorAll('.referential-list-group').forEach(function (group) {
    var addBtn = group.querySelector('.add-row-btn');
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        var rows = group.querySelectorAll('.referential-list-row');
        if (!rows.length) return;
        var clone = rows[rows.length - 1].cloneNode(true);
        var nextIndex = parseInt(group.getAttribute('data-next-index'), 10) || rows.length;
        clone.querySelectorAll('input, select, textarea').forEach(function (el) {
          if (el.name) el.name = el.name.replace(/\[\d+\]/, '[' + nextIndex + ']');
          if (el.tagName === 'SELECT') el.selectedIndex = 0;
          else if (el.type === 'checkbox') el.checked = false;
          else el.value = '';
        });
        var badge = clone.querySelector('.badge');
        if (badge) { badge.className = 'badge bg-light text-muted border small fw-normal'; badge.textContent = 'New item — fill in to add'; }
        // The category filter resets to "All categories" above, but a
        // <select>'s `hidden` attribute on individual <option>s (left over
        // from whatever the cloned row's filter was last set to) isn't
        // touched by that — clear it explicitly so the reset filter and
        // the actually-visible Pack options agree.
        clone.querySelectorAll('.dep-pack-select option[hidden]').forEach(function (opt) { opt.hidden = false; });
        group.setAttribute('data-next-index', String(nextIndex + 1));
        addBtn.parentNode.insertBefore(clone, addBtn);
        notifyDirty();
      });
    }

    group.addEventListener('click', function (e) {
      var removeBtn = e.target.closest ? e.target.closest('.remove-row-btn') : null;
      if (!removeBtn) return;
      var row = removeBtn.closest('.referential-list-row');
      if (row) { row.remove(); notifyDirty(); }
    });

    // Dependencies tab (owner: "Pack code should include the pack and the
    // version number in the dropdown. Version should not be a text field...
    // a dropdown on the category" then "remove the text version field") —
    // Category filters which Pack <option>s are visible (never submitted —
    // it's a picker aid, not a stored field); picking a Pack fills the
    // hidden Version input from that option's own data-version.
    if (group.getAttribute('data-field-name') === 'dependencies') {
      group.addEventListener('change', function (e) {
        var row = e.target.closest ? e.target.closest('.referential-list-row') : null;
        if (!row) return;
        if (e.target.classList.contains('dep-category-filter')) {
          var category = e.target.value;
          var packSelect = row.querySelector('.dep-pack-select');
          Array.from(packSelect.options).forEach(function (opt) {
            if (!opt.value) return;
            opt.hidden = !!category && opt.getAttribute('data-category') !== category;
          });
          if (packSelect.selectedOptions[0] && packSelect.selectedOptions[0].hidden) {
            packSelect.value = '';
            var versionField = row.querySelector('.dep-version-field');
            if (versionField) versionField.value = '';
          }
        } else if (e.target.classList.contains('dep-pack-select')) {
          var chosen = e.target.selectedOptions[0];
          var versionField2 = row.querySelector('.dep-version-field');
          if (versionField2) versionField2.value = chosen ? (chosen.getAttribute('data-version') || '') : '';
        }
      });
    }
  });

  // CR-060 — the nested "+ Add item"/"Remove" wiring for any
  // .nested-list-group (Checklist's own `items`, the first two-level
  // referential-list in this codebase — _referentialListGroup.ejs's own
  // "nested-list" item-field branch). Delegated on `document` rather than
  // bound per-element at load time: a whole new .nested-list-group arrives
  // whenever the TOP-LEVEL "+ Add another" button (above) clones a brand
  // new Checklist row, and delegation means that clone's own buttons work
  // immediately without any extra re-wiring step.
  document.addEventListener('click', function (e) {
    var addBtn = e.target.closest ? e.target.closest('.add-nested-row-btn') : null;
    if (addBtn) {
      var group = addBtn.closest('.nested-list-group');
      if (!group) return;
      var rows = group.querySelectorAll('.nested-list-row');
      if (!rows.length) return;
      var clone = rows[rows.length - 1].cloneNode(true);
      var nextIndex = parseInt(group.getAttribute('data-next-index'), 10) || rows.length;
      clone.querySelectorAll('input, select, textarea').forEach(function (el) {
        // Only the LAST bracket index is this nested list's own — the ones
        // before it (the owning Checklist row's own top-level index) must
        // stay exactly as cloned.
        if (el.name) el.name = el.name.replace(/\[(\d+)\](?!.*\[\d+\])/, '[' + nextIndex + ']');
        if (el.tagName === 'SELECT') el.selectedIndex = 0;
        else if (el.type === 'checkbox') el.checked = false;
        else el.value = '';
      });
      var badge = clone.querySelector('.badge');
      if (badge) { badge.className = 'badge bg-light text-muted border small fw-normal'; badge.textContent = 'New item — fill in to add'; }
      group.setAttribute('data-next-index', String(nextIndex + 1));
      addBtn.parentNode.insertBefore(clone, addBtn);
      notifyDirty();
      return;
    }
    var removeBtn = e.target.closest ? e.target.closest('.remove-nested-row-btn') : null;
    if (removeBtn) {
      var row = removeBtn.closest('.nested-list-row');
      if (row) { row.remove(); notifyDirty(); }
    }
  });

  // Owner: "capability code is from a dropdown of capability-name" (Pack's
  // own contributionCapabilities) — generic over row/field names, not
  // specific to Capabilities: any referential-list row carrying an
  // ontology-backed "autofill source" <select> (rlg-autofill-source,
  // _referentialListGroup.ejs's own x-ontology item-field branch) drives a
  // read-only guidance echo elsewhere in its OWN row (data-autofill-from
  // matching this select's data-row-field) — a plain <div>, never a
  // submitted form field (owner, next: "just store only the code" — name/
  // description aren't stored at all any more, so there's nothing here to
  // post back). Runs once on load too (not just on change) so an existing
  // row's guidance line always reflects the Ontology's CURRENT description.
  function syncAutofillRow(select) {
    var row = select.closest('.referential-list-row, .nested-list-row');
    if (!row) return;
    var opt = select.selectedOptions[0];
    var rowField = select.getAttribute('data-row-field');
    row.querySelectorAll('[data-autofill-from="' + rowField + '"]').forEach(function (field) {
      var attr = field.getAttribute('data-autofill-attr');
      field.textContent = (opt && opt.value) ? (opt.getAttribute('data-' + attr) || '') : '';
    });
  }
  document.querySelectorAll('.rlg-autofill-source').forEach(syncAutofillRow);
  document.addEventListener('change', function (e) {
    if (e.target.classList && e.target.classList.contains('rlg-autofill-source')) {
      syncAutofillRow(e.target);
      notifyDirty();
    }
  });

  // Owner: "The services form should show all services tied to the
  // capabilities that are in contributions.capability[]" — contributionServices'
  // own Service picker (rlg-service-def-select, _referentialListGroup.ejs's
  // own isServices branch) only shows Service Definitions whose capability
  // matches one this Pack currently declares in contributionCapabilities[]
  // (read live off THAT field's own rlg-autofill-source selects — same
  // mechanism, different consumer). Never hides the row's OWN current
  // selection, even if it stops matching (owner never asked for existing
  // data to vanish) — only narrows which OTHER options are offered.
  function currentlyDeclaredCapabilityCodes() {
    var capGroup = document.querySelector('.referential-list-group[data-field-name="contributionCapabilities"]');
    var codes = new Set();
    if (capGroup) {
      capGroup.querySelectorAll('select.rlg-autofill-source').forEach(function (sel) {
        if (sel.value) codes.add(sel.value);
      });
    }
    return codes;
  }
  function refreshServiceDefFilter() {
    var capCodes = currentlyDeclaredCapabilityCodes();
    document.querySelectorAll('select.rlg-service-def-select').forEach(function (select) {
      Array.prototype.forEach.call(select.options, function (opt) {
        if (!opt.value || opt.value === select.value) { opt.hidden = false; return; }
        opt.hidden = capCodes.size > 0 && !capCodes.has(opt.getAttribute('data-capability-code'));
      });
    });
  }
  if (document.querySelector('select.rlg-service-def-select')) {
    refreshServiceDefFilter();
    document.addEventListener('change', function (e) {
      if (e.target.closest && e.target.closest('.referential-list-group[data-field-name="contributionCapabilities"]')) refreshServiceDefFilter();
    });
    document.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('.referential-list-group[data-field-name="contributionCapabilities"]')) setTimeout(refreshServiceDefFilter, 0);
    });
  }

  // CR-089 follow-on — owner: "Similar to services, pick the ones that are
  // applicable to the contributingCapabilities[]." A canonical Policy has no
  // direct Capability tie (unlike Service Definition's own capabilityCode)
  // — its own applicabilityDeliverableNames does, indirectly, through each
  // currently-declared Capability's own Service Definition outputs (the
  // capability-deliverable-names-map script tag, _generatedFieldGroups.ejs,
  // mirrors core/packs.ts's own deliverableNamesFromCapabilityCodes).
  // Dims, never hides/disables — advisory only (same "Pure UI advisories"
  // discipline the Pack Codes tab's own capability-coverage callouts use) —
  // a policy with an EMPTY applicabilityDeliverableNames ("matches every
  // deliverable today") is always shown as applicable regardless.
  function refreshPolicyFilter() {
    var rows = document.querySelectorAll('.rlg-policy-row');
    if (!rows.length) return;
    var mapEl = document.getElementById('capability-deliverable-names-map');
    var capDeliverableMap = {};
    if (mapEl) {
      try { capDeliverableMap = JSON.parse(mapEl.textContent || '{}'); } catch (e) { capDeliverableMap = {}; }
    }
    var capCodes = currentlyDeclaredCapabilityCodes();
    var requiredDeliverableNames = new Set();
    capCodes.forEach(function (code) {
      (capDeliverableMap[code] || []).forEach(function (d) { requiredDeliverableNames.add(d); });
    });
    rows.forEach(function (row) {
      var ownNames = (row.getAttribute('data-deliverable-names') || '').split(',').filter(Boolean);
      var applicable = ownNames.length === 0 || capCodes.size === 0 || ownNames.some(function (d) { return requiredDeliverableNames.has(d); });
      row.classList.toggle('opacity-50', !applicable);
    });
  }
  if (document.querySelector('.rlg-policy-row')) {
    refreshPolicyFilter();
    document.addEventListener('change', function (e) {
      if (e.target.closest && e.target.closest('.referential-list-group[data-field-name="contributionCapabilities"]')) refreshPolicyFilter();
    });
    document.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('.referential-list-group[data-field-name="contributionCapabilities"]')) setTimeout(refreshPolicyFilter, 0);
    });
  }

  // Owner, continuing the same feature: "Capability Code... Name and
  // Contract Description are display only... do not have to be stored...
  // The service level should show the Service's service level and allow
  // edits to the targets... The original service definition should not be
  // overwritten." Picking a Service rebuilds this row's read-only display
  // fields AND its Service Level rows wholesale from that option's own
  // data-service-level JSON (the Definition's current targets — a fresh
  // pick has no override yet) — label/target_level/units/code are shown or
  // carried as a hidden input, never editable; only Target is a real input.
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var SERVICE_LEVEL_OPERATOR = { minimum: '≥', maximum: '≤', exact: '=' };
  function rebuildServiceRow(select) {
    var row = select.closest('.referential-list-row');
    if (!row) return;
    var opt = select.selectedOptions[0];
    var hasSelection = !!(opt && opt.value);
    var capEl = row.querySelector('.rlg-svc-capability-code');
    var nameEl = row.querySelector('.rlg-svc-name');
    var purposeEl = row.querySelector('.rlg-svc-purpose');
    if (capEl) capEl.textContent = hasSelection ? (opt.getAttribute('data-capability-code') || '—') : '—';
    if (nameEl) nameEl.textContent = hasSelection ? (opt.getAttribute('data-name') || '—') : '—';
    if (purposeEl) purposeEl.textContent = hasSelection ? (opt.getAttribute('data-purpose') || '—') : '—';
    var levelsContainer = row.querySelector('.rlg-svc-service-level-rows');
    if (!levelsContainer) return;
    var levels = hasSelection ? (JSON.parse(opt.getAttribute('data-service-level') || '[]')) : [];
    if (!levels.length) {
      levelsContainer.innerHTML = '<p class="text-muted small mb-0">' + (hasSelection ? 'This Service declares no Service Level.' : 'Pick a Service above to see its declared Service Level.') + '</p>';
      return;
    }
    var namePrefix = select.name.replace(/\[code\]$/, '');
    levelsContainer.innerHTML = levels.map(function (base, si) {
      var op = SERVICE_LEVEL_OPERATOR[base.target_level] || '≥';
      return '<div class="row g-2 align-items-center mb-1 rlg-svc-service-level-row">' +
        '<input type="hidden" name="' + escapeHtml(namePrefix) + '[serviceLevel][' + si + '][code]" value="' + escapeHtml(base.code) + '">' +
        '<div class="col-sm-6 small">' + escapeHtml(base.label) + ' <span class="text-muted">(' + op + ' ' + escapeHtml(base.units) + ')</span></div>' +
        '<div class="col-sm-6"><input type="number" step="any" name="' + escapeHtml(namePrefix) + '[serviceLevel][' + si + '][target]" class="form-control form-control-sm" value="' + escapeHtml(base.target) + '"></div>' +
        '</div>';
    }).join('');
  }
  document.addEventListener('change', function (e) {
    if (e.target.classList && e.target.classList.contains('rlg-service-def-select')) {
      rebuildServiceRow(e.target);
    }
  });

  // View-mode referential-list tables (_referentialListGroup.ejs's
  // read-only branch) — owner: "All pages should have a search, filter and
  // sort columns", the same standing requirement (coding_principles.md
  // "List UI Requirements") the site's registry pages already meet via
  // core/dbLayer. These rows are a Pack's/Template's/Profile's own
  // contributions JSONB array, already fully loaded with the parent record
  // rather than a separately paginated resource, so filtering/sorting what's
  // already in the DOM is this widget's equivalent of "server-side" — there
  // is no separate list endpoint to page against.
  document.querySelectorAll('.rlg-view-table').forEach(function (wrapper) {
    var table = wrapper.querySelector('table');
    var tbody = table.querySelector('tbody');
    var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr'));

    var searchInput = wrapper.querySelector('.rlg-view-search');
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        var q = searchInput.value.trim().toLowerCase();
        rows.forEach(function (row) {
          row.style.display = (!q || row.textContent.toLowerCase().indexOf(q) !== -1) ? '' : 'none';
        });
      });
    }

    var sortHeaders = Array.prototype.slice.call(table.querySelectorAll('th[data-sort-key]'));
    sortHeaders.forEach(function (th, colIndex) {
      th.addEventListener('click', function () {
        var asc = th.getAttribute('data-sort-dir') !== 'asc';
        sortHeaders.forEach(function (h) {
          h.removeAttribute('data-sort-dir');
          var icon = h.querySelector('.rlg-sort-icon');
          if (icon) icon.className = 'bi bi-arrow-down-up ms-1 rlg-sort-icon';
        });
        th.setAttribute('data-sort-dir', asc ? 'asc' : 'desc');
        var activeIcon = th.querySelector('.rlg-sort-icon');
        if (activeIcon) activeIcon.className = 'bi bi-arrow-' + (asc ? 'up' : 'down') + ' ms-1 rlg-sort-icon';

        var sorted = rows.slice().sort(function (a, b) {
          var av = a.children[colIndex].textContent.trim();
          var bv = b.children[colIndex].textContent.trim();
          var an = parseFloat(av), bn = parseFloat(bv);
          var cmp = (av !== '' && bv !== '' && !isNaN(an) && !isNaN(bn)) ? (an - bn) : av.localeCompare(bv);
          return asc ? cmp : -cmp;
        });
        sorted.forEach(function (row) { tbody.appendChild(row); });
      });
    });
  });
})();
