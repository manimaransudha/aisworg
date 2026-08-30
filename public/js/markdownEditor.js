// CR-077 — markdown-formatting toolbar for any .md-editor-field textarea
// (_markdownEditorField.ejs — Checklist/Quality Gate/Review Gate/Obligation
// Definition's own statement/prompt). Delegated on document, the same reason
// referentialListGroup.js delegates its own nested-row add/remove: a
// "+ Add another"/"+ Add item" clone (cloneNode(true)) carries this
// toolbar's markup with it automatically, so a delegated handler needs no
// re-init for rows added after page load. Dispatches a real 'input' event
// after each edit so authoring/edit.ejs's own form-level markDirty()
// listener picks up the change exactly as it would for native typing — no
// separate dirty hook. No live preview (CR-078, deferred) — this only ever
// inserts markdown syntax into the textarea.
(function () {
  function wrapSelection(textarea, before, after) {
    var start = textarea.selectionStart;
    var end = textarea.selectionEnd;
    var value = textarea.value;
    var selected = value.slice(start, end);
    textarea.value = value.slice(0, start) + before + selected + after + value.slice(end);
    textarea.selectionStart = start + before.length;
    textarea.selectionEnd = start + before.length + selected.length;
  }

  function prefixLines(textarea, prefix) {
    var start = textarea.selectionStart;
    var end = textarea.selectionEnd;
    var value = textarea.value;
    var lineStart = value.lastIndexOf('\n', start - 1) + 1;
    var lineEnd = value.indexOf('\n', end);
    if (lineEnd === -1) lineEnd = value.length;
    var block = value.slice(lineStart, lineEnd);
    var prefixed = block.split('\n').map(function (line) { return prefix + line; }).join('\n');
    textarea.value = value.slice(0, lineStart) + prefixed + value.slice(lineEnd);
    textarea.selectionStart = lineStart;
    textarea.selectionEnd = lineStart + prefixed.length;
  }

  function insertCodeBlock(textarea) {
    var start = textarea.selectionStart;
    var end = textarea.selectionEnd;
    var value = textarea.value;
    var selected = value.slice(start, end);
    var block = '```\n' + selected + '\n```';
    textarea.value = value.slice(0, start) + block + value.slice(end);
    var innerStart = start + 4;
    textarea.selectionStart = innerStart;
    textarea.selectionEnd = innerStart + selected.length;
  }

  function insertLink(textarea) {
    var start = textarea.selectionStart;
    var end = textarea.selectionEnd;
    var value = textarea.value;
    var selected = value.slice(start, end) || 'link text';
    var snippet = '[' + selected + '](url)';
    textarea.value = value.slice(0, start) + snippet + value.slice(end);
    var urlStart = start + selected.length + 3;
    textarea.selectionStart = urlStart;
    textarea.selectionEnd = urlStart + 3;
  }

  var ACTIONS = {
    bold: function (t) { wrapSelection(t, '**', '**'); },
    italic: function (t) { wrapSelection(t, '*', '*'); },
    code: function (t) { wrapSelection(t, '`', '`'); },
    codeblock: function (t) { insertCodeBlock(t); },
    list: function (t) { prefixLines(t, '- '); },
    link: function (t) { insertLink(t); }
  };

  document.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('.md-toolbar [data-md-action]') : null;
    if (!btn) return;
    var field = btn.closest('.md-editor-field');
    var textarea = field ? field.querySelector('.md-editor-textarea') : null;
    if (!textarea) return;
    var action = ACTIONS[btn.getAttribute('data-md-action')];
    if (!action) return;
    e.preventDefault();
    textarea.focus();
    action(textarea);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  });
})();
