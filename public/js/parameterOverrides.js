// Profile authoring: when the Base template changes, replace the Parameter Overrides rows with the ones
// that Template marks overridable. The server renders the rows (seu/sdk/_parameterOverrideRows.ejs), so
// the markup is the same as on first load.
(function () {
  var container = document.getElementById('parameter-override-rows');
  var driver = document.querySelector('[data-overrides-driver]');
  if (!container || !driver) return;
  var url = container.getAttribute('data-rows-url');
  driver.addEventListener('change', function () {
    fetch(url + '?baseTemplateCode=' + encodeURIComponent(driver.value), { credentials: 'same-origin' })
      .then(function (response) { return response.ok ? response.text() : Promise.reject(new Error('HTTP ' + response.status)); })
      .then(function (html) {
        container.innerHTML = html;
        if (typeof window.markDirty === 'function') window.markDirty();
      })
      .catch(function () {
        container.innerHTML = '<p class="text-danger small mb-0">The parameters could not be loaded. Save the Profile and reopen it.</p>';
      });
  });
})();
