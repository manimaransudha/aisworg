// Owner: "I want to have a flag in the schema that will specify if an
// Ontology Composition is allowed" (x-ontology-composable, formGenerator.ts)
// — a multi-value field where an author may pick any number of existing
// Ontology options AND type values that aren't registered yet. Each chip is
// a real `<input type="hidden" name="field[]">`, so the field submits as an
// ordinary array with zero server-side special-casing; this file only adds/
// removes chips client-side. Reuses .ontology-combo/-menu/-item's styled
// suggestion-list CSS (dynamicOntologyField.js) for visual consistency, but
// is a separate, standalone widget — that file's own combo sets ONE value
// into an external input; this one appends N chips into its own field.
(function () {
  function initComposableMulti(root) {
    var fieldName = root.getAttribute('data-field-name');
    var chipsEl = root.querySelector('.ontology-multi-chips');
    var input = root.querySelector('.ontology-combo-input');
    var menu = root.querySelector('.ontology-combo-menu');
    if (!fieldName || !chipsEl) return;

    var options;
    try {
      options = JSON.parse(root.getAttribute('data-options') || '[]');
    } catch (e) {
      options = [];
    }

    function currentValues() {
      var values = [];
      chipsEl.querySelectorAll('input[type="hidden"]').forEach(function (el) { values.push(el.value); });
      return values;
    }

    function addChip(code, label, registered) {
      code = code.trim();
      if (!code || currentValues().indexOf(code) !== -1) return;
      var chip = document.createElement('span');
      chip.className = 'ontology-chip';
      var hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.name = fieldName + '[]';
      hidden.value = code;
      chip.appendChild(hidden);
      var labelEl = document.createElement('span');
      labelEl.className = 'ontology-chip-label';
      labelEl.textContent = label || code;
      chip.appendChild(labelEl);
      if (!registered) {
        var flag = document.createElement('span');
        flag.className = 'ontology-chip-flag';
        flag.title = 'Not yet in the Ontology — proposing on save';
        flag.textContent = '⚠';
        chip.appendChild(flag);
      }
      var remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'ontology-chip-remove';
      remove.setAttribute('aria-label', 'Remove');
      remove.textContent = '×';
      remove.addEventListener('click', function () { chip.remove(); });
      chip.appendChild(remove);
      chipsEl.appendChild(chip);
    }

    if (!input || !menu) return; // view mode / disabled — chips already server-rendered, nothing to wire

    function matchedOption(code) {
      return options.filter(function (o) { return o.code === code; })[0];
    }

    function open() { menu.classList.add('show'); }
    function close() { menu.classList.remove('show'); }

    function render(filterText) {
      var text = (filterText || '').trim().toLowerCase();
      var already = currentValues();
      var filtered = options.filter(function (o) {
        if (already.indexOf(o.code) !== -1) return false;
        if (!text) return true;
        return o.code.toLowerCase().indexOf(text) !== -1 || o.label.toLowerCase().indexOf(text) !== -1;
      });
      menu.innerHTML = '';
      filtered.forEach(function (opt) {
        var item = document.createElement('button');
        item.type = 'button';
        item.className = 'ontology-combo-item';
        var codeEl = document.createElement('span');
        codeEl.textContent = opt.code;
        item.appendChild(codeEl);
        var labelEl = document.createElement('span');
        labelEl.className = 'ontology-combo-item-secondary';
        labelEl.textContent = opt.label;
        item.appendChild(labelEl);
        item.addEventListener('mousedown', function (e) {
          e.preventDefault();
          addChip(opt.code, opt.label, true);
          input.value = '';
          close();
        });
        menu.appendChild(item);
      });
      if (text && !matchedOption(text) && currentValues().indexOf(text) === -1) {
        var propose = document.createElement('div');
        propose.className = 'ontology-combo-empty';
        propose.textContent = 'Enter to add "' + filterText.trim() + '" — will be proposed to the Ontology';
        menu.appendChild(propose);
      } else if (!filtered.length) {
        var empty = document.createElement('div');
        empty.className = 'ontology-combo-empty';
        empty.textContent = 'No more options to add';
        menu.appendChild(empty);
      }
      open();
    }

    input.addEventListener('focus', function () { render(input.value); });
    input.addEventListener('input', function () { render(input.value); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        var text = input.value.trim();
        if (!text) return;
        var matched = matchedOption(text);
        addChip(text, matched ? matched.label : text, !!matched);
        input.value = '';
        close();
      }
    });
    document.addEventListener('click', function (e) {
      if (!root.contains(e.target)) close();
    });
  }

  document.querySelectorAll('.ontology-multi-combo').forEach(initComposableMulti);
  window.initComposableMulti = initComposableMulti;
})();
