// Profile authoring: when the Base template changes, replace the Parameter Overrides rows with the ones
// that Template marks overridable. The server renders the rows (seu/sdk/_parameterOverrideRows.ejs), so
// the markup is the same as on first load.
(function () {
  var container = document.getElementById('parameter-override-rows');
  var driver = document.querySelector('[data-overrides-driver]');
  if (!container || !driver) return;
  var url = container.getAttribute('data-rows-url');

  // A Service Level row whose Deliverables have all been removed from the catalogue is highlighted, with a note. The catalogue is read from the
  // form as it stands, so an unsaved removal shows at once. Nothing is hidden or changed, and the value and the Not required tick stay as entered.
  var form = document.getElementById('authoring-form');
  function catalogueCodes() {
    if (!form) return null;
    var codes = [];
    form.querySelectorAll('[name^="deliverableCatalogue["][name$="[code]"]').forEach(function (input) {
      if (input.closest('[data-rl-template]')) return;
      var code = (input.value || '').trim();
      if (code) codes.push(code);
    });
    return codes.length ? codes : null;
  }
  function flagRemovedDeliverables() {
    var codes = catalogueCodes();
    container.querySelectorAll('.po-row[data-deliverables]').forEach(function (row) {
      var own = row.getAttribute('data-deliverables').split(' ').filter(Boolean);
      var gone = codes !== null && own.length > 0 && !own.some(function (code) { return codes.indexOf(code) !== -1; });
      row.classList.toggle('bg-warning-subtle', gone);
      var note = row.querySelector('.po-removed-note');
      if (gone && !note) {
        note = document.createElement('div');
        note.className = 'col-12 small text-warning-emphasis po-removed-note';
        note.textContent = 'The Deliverable of this Service was removed from the catalogue. An override on this row is rejected when the Profile is saved; clear it.';
        row.appendChild(note);
      } else if (!gone && note) {
        note.remove();
      }
    });
  }
  document.addEventListener('shown.bs.tab', flagRemovedDeliverables);
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('.remove-row-btn')) flagRemovedDeliverables(); });
  document.addEventListener('change', flagRemovedDeliverables);
  flagRemovedDeliverables();
  driver.addEventListener('change', function () {
    fetch(url + '?baseTemplateCode=' + encodeURIComponent(driver.value), { credentials: 'same-origin' })
      .then(function (response) { return response.ok ? response.text() : Promise.reject(new Error('HTTP ' + response.status)); })
      .then(function (html) {
        container.innerHTML = html;
        flagRemovedDeliverables();
        if (typeof window.markDirty === 'function') window.markDirty();
      })
      .catch(function () {
        container.innerHTML = '<p class="text-danger small mb-0">The parameters could not be loaded. Save the Profile and reopen it.</p>';
      });
  });
})();
