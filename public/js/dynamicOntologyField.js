// CR-079 step (d) — a field whose Ontology concept type is DRIVEN by another
// field's current value (Pack's own `code`, driven by `category`:
// _generatedFieldGroups.ejs's own dynamicSourceField branch). Every possible
// driver value's own option list is pre-embedded server-side
// (data-driver-values, a JSON blob keyed by driver value) so filtering needs
// no server round trip — the author can pick a different category before
// ever saving, and the code field's own suggestions update immediately.
//
// Bug fix (owner: "this is really very bad... is this how dropdown+text is
// implemented" / "how do you expect the user to know what is already
// available?") — a first version used a native <input list>/<datalist>. Its
// suggestion popup is drawn entirely by the browser/OS: unstyleable,
// inconsistent across browsers, and shows the raw code ahead of the friendly
// label, with no visible hint that clicking the field does anything at all.
// Rebuilt as a real on-page combo box: a plain text input (still free-text
// capable — nothing here stops typing a code that isn't listed) plus a
// JS-driven, Bootstrap-styled suggestion list that opens on focus (browsing
// every option for the current category before typing anything) and filters
// live as you type — entirely within the page's own CSS, not a native
// picker's.
(function () {
  document.querySelectorAll('.ontology-combo').forEach(function (combo) {
    var input = combo.querySelector('.ontology-combo-input');
    var menu = combo.querySelector('.ontology-combo-menu');
    if (!input || !menu) return;

    var driverFieldName = combo.getAttribute('data-driver-field');
    var form = combo.closest('form');
    var driverEl = driverFieldName ? (form || document).querySelector('[name="' + driverFieldName + '"]') : null;

    var optionsByDriverValue;
    try {
      optionsByDriverValue = JSON.parse(combo.getAttribute('data-driver-values') || '{}');
    } catch (e) {
      optionsByDriverValue = {};
    }

    function currentOptions() {
      return optionsByDriverValue[driverEl ? driverEl.value : ''] || [];
    }

    // CR-081 — Pack's own `code` combo additionally carries data-code-
    // versions (only present on that one field; every other combo's
    // getAttribute here is null, so this whole block is a no-op for them).
    // version is a SEQUENCE per code (owner: "If it['s] taken, assign the
    // next"), never hand-typed and never shown until Code actually has a
    // value — updateVersionPanel only ever runs in response to a real
    // 'input' event (typing, or picking a suggestion), never on page load,
    // so an existing Draft's own already-saved version is never silently
    // overwritten just by the page rendering with Code pre-filled.
    var codeVersionsRaw = combo.getAttribute('data-code-versions');
    if (codeVersionsRaw) {
      var codeVersions;
      try {
        codeVersions = JSON.parse(codeVersionsRaw);
      } catch (e) {
        codeVersions = {};
      }
      var versionInput = form ? form.querySelector('[name="packVersion"]') : null;
      // CR-081 (owner: "Did i not already say the computed version should be
      // muted belongside the name") — two separate pieces of version
      // information, two separate homes: the computed value itself is a
      // muted span next to Name's own label, while the branch-picker panel
      // lives in its own column beside Code. Both found form-wide, not via
      // DOM proximity to this combo, since neither is a sibling of it any
      // more.
      var versionDisplay = form ? form.querySelector('#packVersion-display') : null;
      var versionPanel = form ? form.querySelector('.pack-code-versions') : null;

      var updateVersionPanel = function () {
        var info = codeVersions[input.value];
        var nextVersion = info ? info.nextVersion : '1.0.0';
        if (versionInput) versionInput.value = nextVersion;
        if (versionDisplay) versionDisplay.textContent = '(v' + nextVersion + ')';
        if (!versionPanel) return;
        versionPanel.innerHTML = '';
        if (!info || !info.versions.length) return;
        var label = document.createElement('div');
        label.className = 'text-muted mb-1';
        label.textContent = 'Existing versions for this code — click one to start from its content:';
        versionPanel.appendChild(label);
        var list = document.createElement('div');
        list.className = 'd-flex flex-wrap gap-2';
        info.versions.forEach(function (v) {
          var link = document.createElement('a');
          link.className = 'badge text-decoration-none bg-secondary-subtle text-dark border';
          link.href = '?fromPackId=' + encodeURIComponent(v.id);
          link.textContent = 'v' + v.version + ' — ' + v.status;
          // Bug fix (owner: "the page take a while to load, there is no
          // loading overlay, so the user may wonder what happens") — this
          // link is a real, plain <a>, so the click DOES work the instant
          // it's pressed, but the reload it triggers re-derives this Pack's
          // full inherited content server-side and can take several
          // seconds, with nothing on screen to show it's in flight. Reusing
          // the same site-wide overlay (navbar.ejs -> loadingOverlay.ejs)
          // other slow actions already use, rather than building a
          // page-local one.
          link.addEventListener('click', function () {
            if (window.showLoadingOverlay) window.showLoadingOverlay();
          });
          list.appendChild(link);
        });
        versionPanel.appendChild(list);
      };
      input.addEventListener('input', updateVersionPanel);
    }

    function open() { menu.classList.add('show'); }
    function close() { menu.classList.remove('show'); }

    function setActive(index) {
      var items = menu.querySelectorAll('.ontology-combo-item');
      items.forEach(function (el) { el.classList.remove('active'); });
      if (index >= 0 && index < items.length) {
        items[index].classList.add('active');
        items[index].scrollIntoView({ block: 'nearest' });
      }
    }

    function render(filterText) {
      var options = currentOptions();
      var text = (filterText || '').trim().toLowerCase();
      var filtered = text
        ? options.filter(function (opt) { return opt.code.toLowerCase().indexOf(text) !== -1 || opt.label.toLowerCase().indexOf(text) !== -1; })
        : options;
      menu.innerHTML = '';
      if (!filtered.length) {
        var empty = document.createElement('div');
        empty.className = 'ontology-combo-empty';
        empty.textContent = options.length ? 'No match — this will be a new code' : 'No existing codes for this category yet';
        menu.appendChild(empty);
      } else {
        filtered.forEach(function (opt) {
          var item = document.createElement('button');
          item.type = 'button';
          item.className = 'ontology-combo-item';
          item.dataset.code = opt.code;
          var labelEl = document.createElement('span');
          labelEl.textContent = opt.label;
          item.appendChild(labelEl);
          var codeEl = document.createElement('span');
          codeEl.className = 'ontology-combo-item-code';
          codeEl.textContent = opt.code;
          item.appendChild(codeEl);
          // mousedown, not click — fires before the input's own blur would
          // otherwise close the menu first and swallow the selection.
          //
          // Bug fix — close() must run AFTER dispatching 'input', not
          // before: the dispatched event is handled synchronously by the
          // OTHER 'input' listener below (render(input.value)), which itself
          // calls open() unconditionally at its end. Closing first meant
          // that same synchronous call chain immediately reopened the menu
          // right after this handler closed it — every selection, mouse or
          // keyboard, silently popped the suggestion list back open over
          // whatever the user had just picked, making a correct selection
          // look like it had done nothing at all. Confirmed by executing
          // this file's own unmodified logic against real category/code
          // data: menu.show was still true immediately after a mousedown
          // select, though the Version panel underneath had in fact updated
          // correctly the whole time.
          item.addEventListener('mousedown', function (e) {
            e.preventDefault();
            input.value = opt.code;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            close();
          });
          menu.appendChild(item);
        });
      }
      open();
    }

    input.addEventListener('focus', function () { render(input.value); });
    input.addEventListener('input', function () { render(input.value); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { close(); return; }
      var items = menu.querySelectorAll('.ontology-combo-item');
      if (!items.length) return;
      var activeIndex = -1;
      items.forEach(function (el, i) { if (el.classList.contains('active')) activeIndex = i; });
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive(Math.min(activeIndex + 1, items.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive(Math.max(activeIndex - 1, 0));
      } else if (e.key === 'Enter' && activeIndex >= 0) {
        e.preventDefault();
        input.value = items[activeIndex].dataset.code;
        // Bug fix — unlike the mousedown handler above, this never dispatched
        // an 'input' event, so selecting a suggestion by keyboard (arrow keys
        // + Enter) silently never ran updateVersionPanel: the Version field
        // stayed blank and the branch-picker never appeared, even though the
        // exact same code selected by mouse-click worked correctly. Confirmed
        // by executing this file's own logic against a DOM built from the
        // real rendered page — the only difference between a working and a
        // silently-broken selection was this missing dispatch.
        //
        // close() runs AFTER the dispatch, not before, for the same reason
        // as the mousedown handler above — the dispatch synchronously runs
        // render(), which calls open() at its end, so closing first just
        // gets immediately undone within the same call stack.
        input.dispatchEvent(new Event('input', { bubbles: true }));
        close();
      }
    });

    document.addEventListener('click', function (e) {
      if (!combo.contains(e.target)) close();
    });

    // Category changed — don't clobber whatever the author already typed
    // into Code, just refresh what the menu offers the next time it's open.
    if (driverEl) {
      driverEl.addEventListener('input', function () {
        if (menu.classList.contains('show')) render(input.value);
      });
    }
  });
})();
