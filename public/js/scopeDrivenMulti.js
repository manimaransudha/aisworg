// Owner: "what kind of coding is this? isn't this fundamental?" — a driven
// multi-select (Policy's own applicabilityDeliverableNames, switching
// between Ontology deliverable-names and plain Authority Vocabulary nouns by
// `scope`) has to swap LIVE the instant the driver field changes, same
// standard dynamicOntologyField.js already meets for a single-value driven
// field. _generatedFieldGroups.ejs renders every variant as its own
// <fieldset>, all present in the DOM (composableMultiSelect.js already
// initialises whichever ones are composable, regardless of visibility) —
// this file only ever toggles hidden/disabled between them; `disabled` on a
// <fieldset> cascades to every descendant control, so a hidden variant's
// values never submit alongside the visible one's.
(function () {
  function activate(container, driverValue) {
    var variants = container.querySelectorAll('.scope-driven-variant');
    var namedMatches = false;
    variants.forEach(function (v) {
      if (v.getAttribute('data-is-default') !== '1' && v.getAttribute('data-match-value') === driverValue) namedMatches = true;
    });
    variants.forEach(function (v) {
      var isDefault = v.getAttribute('data-is-default') === '1';
      var isActive = isDefault ? !namedMatches : v.getAttribute('data-match-value') === driverValue;
      v.hidden = !isActive;
      v.disabled = !isActive;
    });
  }

  function initScopeDrivenMulti(container) {
    var driverFieldName = container.getAttribute('data-driver-field');
    if (!driverFieldName) return;
    var form = container.closest('form');
    var driverEl = form ? form.elements[driverFieldName] : null;
    if (!driverEl) return;
    driverEl.addEventListener('change', function () { activate(container, driverEl.value); });
  }

  document.querySelectorAll('.scope-driven-multi').forEach(initScopeDrivenMulti);
  // Exposed for referentialListGroup.js's own "+ Add another" clone handler
  // — Policy's applicabilityDeliverables[].name (item-level, driven by the
  // TOP-LEVEL `scope`) is the first .scope-driven-multi to live inside a
  // repeatable row; a row cloned after page load needs this same wiring,
  // same as window.initOntologyCombo/initComposableMulti already provide
  // for their own widgets.
  window.initScopeDrivenMulti = initScopeDrivenMulti;
})();
