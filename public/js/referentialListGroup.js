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
