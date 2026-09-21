// Owner: "I already mentioned applicable lifecycle is based on Deliverable
// (for scope=transition) and depending on what is selected for
// scope=eligibility." Each condition's own applicabilityDeliverables[].transitions
// must show ONLY the transitions belonging to THIS row's own entity type —
// the constant "Deliverable" under scope=Transition, or whichever noun this
// row's own `name` currently holds under scope=Eligibility — not every
// entity's transitions with the author left to read the label and pick
// correctly. Same live option-hiding pattern the Dependencies tab's own
// category filter already uses (referentialListGroup.js's dep-pack-select
// handling): `option.hidden` toggled by a sibling field's change, nothing
// removed from the DOM so the filter can always be recomputed.
//
// Migration 216 (owner: "I am inclined to move the applicability inside the
// condition") — applicabilityDeliverables is now a NESTED list (one of each
// condition row's own item fields), not a top-level referential-list field:
// its container is `.nested-list-group`/`.nested-list-row`, and there can be
// several such groups on the page at once (one per condition row), not just
// one.
(function () {
  function activeNameValue(row) {
    var nameEls = row.querySelectorAll('[name$="[name]"]');
    for (var i = 0; i < nameEls.length; i++) {
      if (!nameEls[i].closest('fieldset[disabled]')) return nameEls[i].value;
    }
    return '';
  }

  function entityTypeForRow(row, scopeValue, hasScopeField) {
    // Migration 249 — this same .nested-list-group[data-field-name="applicabilityDeliverables"]
    // selector also matches Pack's own contributionObligationDefinitions[].applicabilityDeliverables,
    // whose form carries no top-level `scope` field at all (a Pack is never
    // Deliverable-targeted — `name` is always a noun, same as Policy's own
    // scope=Eligibility case). Absence of `scope` on this form must behave
    // like scope=Eligibility (row's own name), never fall back to the
    // scope=Transition default of "Deliverable".
    return (!hasScopeField || scopeValue === 'Eligibility') ? activeNameValue(row) : 'Deliverable';
  }

  function filterRow(row, scopeValue) {
    var transitionsSelect = row.querySelector('select[name$="[transitions][]"]');
    if (!transitionsSelect) return;
    var form = row.closest('form');
    var hasScopeField = !!(form && form.elements.scope);
    var entityType = entityTypeForRow(row, scopeValue, hasScopeField);
    Array.from(transitionsSelect.options).forEach(function (opt) {
      var optEntityType = opt.value.split('|')[0];
      opt.hidden = !!entityType && optEntityType !== entityType;
      if (opt.hidden && opt.selected) opt.selected = false;
    });
  }

  function currentScopeValue(group) {
    var form = group.closest('form');
    return form && form.elements.scope ? form.elements.scope.value : '';
  }

  function initGroup(group) {
    // No re-init guard: initGroup is only ever called once per group
    // instance — once at page load (for every group present then) and once
    // per brand-new group a clone brings along (initPolicyTransitionFilterGroup)
    // — never twice on the SAME element. A guard attribute would be
    // actively wrong here: cloneNode(true) copies attributes but never
    // event listeners, so a cloned group inherits an already-"bound" flag
    // from its template row while carrying zero real listeners of its own.
    var form = group.closest('form');
    var scopeEl = form ? form.elements.scope : null;
    function refilterAll() {
      var scopeValue = currentScopeValue(group);
      group.querySelectorAll('.nested-list-row').forEach(function (row) { filterRow(row, scopeValue); });
    }
    if (scopeEl) scopeEl.addEventListener('change', refilterAll);
    group.addEventListener('change', function (e) {
      if (!e.target.matches('[name$="[name]"]')) return;
      var row = e.target.closest('.nested-list-row');
      if (row) filterRow(row, currentScopeValue(group));
    });
    refilterAll();
  }

  document.querySelectorAll('.nested-list-group[data-field-name="applicabilityDeliverables"]').forEach(initGroup);

  // Exposed for referentialListGroup.js's own clone handlers:
  //   - a freshly cloned condition row (top-level "+ Add another") brings
  //     its own brand new applicabilityDeliverables group along with it —
  //     that group needs the same wiring initGroup gives every group found
  //     at page load.
  window.initPolicyTransitionFilterGroup = function (group) {
    if (group.getAttribute('data-field-name') === 'applicabilityDeliverables') initGroup(group);
  };
  //   - a freshly cloned applicabilityDeliverables row (nested "+ Add item",
  //     inside an already-initialised group) doesn't get a new `change`
  //     listener (the group's own delegated one already covers it) but does
  //     need its OWN initial filter applied immediately — its `name` gets
  //     reset to blank on clone, so this hides everything until a name is
  //     actually chosen (scope=Eligibility) or shows Deliverable's own
  //     transitions regardless (scope=Transition).
  window.filterPolicyTransitionsRow = function (row) {
    var group = row.closest('.nested-list-group[data-field-name="applicabilityDeliverables"]');
    if (!group) return;
    filterRow(row, currentScopeValue(group));
  };
})();
