/* Local website editor: in-page editing toolbar.
   Loaded only by _editor/server.py; it is never part of the published site. */
(function () {
  'use strict';
  var CFG = window.__SITE_EDITOR || {};
  var pending = new Map();          // key -> edit
  var original = new WeakMap();     // element -> innerHTML when the page loaded
  var active = null;                // element currently being typed in
  var linkTarget = null;            // {anchor, owner} shown in the link box
  var MAX_SIDE = 1800;              // longest side of uploaded photos, in pixels

  document.documentElement.classList.add('se-on');

  // ------------------------------------------------------------------ toolbar
  var bar = document.createElement('div');
  bar.id = 'se-bar';
  bar.innerHTML =
    '<span class="se-badge">✎ Editing</span>' +
    '<label class="se-field">Page <select id="se-pages"></select></label>' +
    '<span id="se-status"></span>' +
    '<label class="se-field" id="se-linkbox" hidden>Link goes to <input id="se-href" type="text" spellcheck="false"></label>' +
    '<button type="button" id="se-discard" disabled>Undo all</button>' +
    '<button type="button" id="se-save" class="se-primary" disabled>Save changes</button>' +
    '<button type="button" id="se-publish" hidden>Publish to website</button>' +
    '<button type="button" id="se-help" title="Help">?</button>';
  document.body.appendChild(bar);
  function $(id) { return document.getElementById(id); }

  var HINT = 'Click outlined text to type. Click or drag a photo onto a picture to replace it.';
  function status(msg, kind) {
    var s = $('se-status');
    s.textContent = msg || HINT;
    s.className = kind || '';
  }
  function key(e) { return e.id + '|' + e.type + '|' + (e.name || ''); }
  function addEdit(e) { pending.set(key(e), e); refresh(); }
  function refresh() {
    var n = pending.size;
    $('se-save').disabled = !n;
    $('se-discard').disabled = !n;
    status(n ? n + ' unsaved change' + (n > 1 ? 's' : '') + '. Click “Save changes” when you are done.' : '');
  }

  function api(name, body) {
    return fetch('/_editor/api/' + name, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Editor-Token': CFG.token },
      body: JSON.stringify(body || {})
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error(j.error || ('Error ' + r.status));
        return j;
      });
    });
  }

  fetch('/_editor/api/info').then(function (r) { return r.json(); }).then(function (info) {
    var sel = $('se-pages');
    info.pages.forEach(function (p) {
      var o = document.createElement('option');
      o.value = p; o.textContent = p; if (p === CFG.page) o.selected = true;
      sel.appendChild(o);
    });
    if (info.git) $('se-publish').hidden = false;
  });

  $('se-pages').addEventListener('change', function (e) {
    finishEdit();
    if (pending.size && !window.confirm('You have unsaved changes on this page. Leave without saving?')) {
      e.target.value = CFG.page; return;
    }
    pending.clear();
    location.href = '/' + e.target.value;
  });

  // ------------------------------------------------------------------ mark editable things
  var texts = [], imgs = [], quotes = [];
  document.querySelectorAll('[data-edit]').forEach(function (el) {
    if (el.hasAttribute('data-comment')) quotes.push(el);
    else if (el.tagName === 'IMG') imgs.push(el);
    else texts.push(el);
  });
  texts.forEach(function (el) { el.classList.add('se-text'); original.set(el, el.innerHTML); });
  imgs.forEach(function (el) { el.classList.add('se-img'); el.setAttribute('draggable', 'false'); });
  quotes.forEach(function (el) { el.classList.add('se-quote'); });

  // ------------------------------------------------------------------ text editing
  function placeCaret(x, y) {
    var range = null;
    if (document.caretRangeFromPoint) range = document.caretRangeFromPoint(x, y);
    else if (document.caretPositionFromPoint) {
      var p = document.caretPositionFromPoint(x, y);
      if (p) { range = document.createRange(); range.setStart(p.offsetNode, p.offset); }
    }
    if (range) { var s = window.getSelection(); s.removeAllRanges(); s.addRange(range); }
  }

  function startEdit(el, ev) {
    if (active === el) return;
    finishEdit();
    active = el;
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('spellcheck', 'true');
    el.classList.add('se-active');
    el.focus();
    if (ev) placeCaret(ev.clientX, ev.clientY);
    updateLinkBox();
  }

  function finishEdit() {
    if (!active) return;
    var el = active;
    active = null;
    el.removeAttribute('contenteditable');
    el.removeAttribute('spellcheck');
    el.classList.remove('se-active');
    recordText(el);
  }

  function recordText(el) {
    var e = { id: el.getAttribute('data-edit'), type: 'html', value: el.innerHTML };
    if (el.innerHTML !== original.get(el)) { el.classList.add('se-dirty'); addEdit(e); }
    else { el.classList.remove('se-dirty'); pending.delete(key(e)); refresh(); }
  }

  document.addEventListener('keydown', function (e) {
    if (!active || !active.contains(e.target)) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey && !document.execCommand('insertLineBreak')) document.execCommand('insertHTML', false, '<br>');
    } else if (e.key === 'Escape') {
      e.preventDefault(); active.blur(); finishEdit(); hideLinkBox();
    }
  }, true);

  document.addEventListener('paste', function (e) {
    if (!active || !active.contains(e.target)) return;
    e.preventDefault();
    var t = (e.clipboardData || window.clipboardData).getData('text/plain') || '';
    document.execCommand('insertText', false, t.replace(/\s*\n\s*/g, ' '));
  }, true);

  document.addEventListener('focusout', function (e) {
    if (active && e.target === active) {
      // Wait a moment: focus may be moving to the link box for this same element.
      setTimeout(function () {
        if (active && document.activeElement !== active && !bar.contains(document.activeElement)) finishEdit();
        else if (active && bar.contains(document.activeElement)) recordText(active);
      }, 0);
    }
  }, true);

  // ------------------------------------------------------------------ link box
  function currentAnchor() {
    if (!active) return null;
    if (active.tagName === 'A') return active;
    var sel = window.getSelection();
    var n = sel && sel.anchorNode;
    while (n && n !== active) { if (n.nodeType === 1 && n.tagName === 'A') return n; n = n.parentNode; }
    return null;
  }
  function updateLinkBox() {
    var a = currentAnchor();
    if (!a) { if (active) hideLinkBox(); return; }
    linkTarget = { anchor: a, owner: active };
    $('se-href').value = a.getAttribute('href') || '';
    $('se-linkbox').hidden = false;
  }
  function hideLinkBox() { linkTarget = null; $('se-linkbox').hidden = true; }
  document.addEventListener('selectionchange', function () {
    // Only react to the cursor moving *inside* the text being edited
    // (not to it moving into the toolbar's link box).
    var sel = window.getSelection();
    if (active && sel && sel.anchorNode && active.contains(sel.anchorNode)) updateLinkBox();
  });
  // Count changes while typing so "Save changes" is ready straight away.
  document.addEventListener('input', function (e) {
    if (active && active.contains(e.target)) recordText(active);
  }, true);
  $('se-href').addEventListener('change', function (e) {
    if (!linkTarget) return;
    var a = linkTarget.anchor, owner = linkTarget.owner, v = e.target.value.trim();
    a.setAttribute('href', v);
    if (a === owner) addEdit({ id: owner.getAttribute('data-edit'), type: 'attr', name: 'href', value: v });
    else recordText(owner);
    owner.classList.add('se-dirty');
    status('Link updated. Remember to save.', 'ok');
  });

  // ------------------------------------------------------------------ clicks
  document.addEventListener('click', function (ev) {
    var t = ev.target;
    if (bar.contains(t) || (t.closest && t.closest('.se-modal'))) return;
    var q = t.closest('.se-quote');
    if (q) { ev.preventDefault(); ev.stopPropagation(); openQuote(q); return; }
    var img = t.closest('.se-img');
    if (img) { ev.preventDefault(); ev.stopPropagation(); finishEdit(); hideLinkBox(); pickImage(img); return; }
    var el = t.closest('.se-text');
    if (el) { ev.preventDefault(); ev.stopPropagation(); startEdit(el, ev); return; }
    if (t.closest('a, button, input[type=submit], summary')) {
      ev.preventDefault(); ev.stopPropagation();
      status('Links and buttons are paused while editing. Use the Page menu to switch pages.');
    }
    finishEdit(); hideLinkBox();
  }, true);
  document.addEventListener('submit', function (e) { e.preventDefault(); e.stopPropagation(); }, true);

  // ------------------------------------------------------------------ images
  function hasFiles(e) { return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0; }
  window.addEventListener('dragover', function (e) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    var img = e.target.closest && e.target.closest('.se-img');
    document.querySelectorAll('.se-drop').forEach(function (x) { if (x !== img) x.classList.remove('se-drop'); });
    if (img) { img.classList.add('se-drop'); e.dataTransfer.dropEffect = 'copy'; }
    else e.dataTransfer.dropEffect = 'none';
  }, true);
  window.addEventListener('dragleave', function (e) {
    if (e.target.classList && e.target.classList.contains('se-drop')) e.target.classList.remove('se-drop');
  }, true);
  window.addEventListener('drop', function (e) {
    if (!hasFiles(e)) { if (active && active.contains(e.target)) e.preventDefault(); return; }
    e.preventDefault(); e.stopPropagation();
    document.querySelectorAll('.se-drop').forEach(function (x) { x.classList.remove('se-drop'); });
    var img = e.target.closest && e.target.closest('.se-img');
    if (!img) { status('Drop the photo directly onto the picture you want to replace.', 'err'); return; }
    replaceImage(img, e.dataTransfer.files[0]);
  }, true);

  function pickImage(img) {
    var input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.style.display = 'none';
    input.addEventListener('change', function () { if (input.files[0]) replaceImage(img, input.files[0]); input.remove(); });
    document.body.appendChild(input);
    input.click();
  }

  function readAsDataURL(blob) {
    return new Promise(function (res, rej) {
      var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsDataURL(blob);
    });
  }
  function extFor(type) { return ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg' })[type]; }

  function prepare(file) {
    // GIFs (may be animated) and SVGs are kept exactly as they are.
    if (file.type === 'image/gif' || file.type === 'image/svg+xml') return Promise.resolve({ blob: file, ext: extFor(file.type) });
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function () {
        var w = im.naturalWidth, h = im.naturalHeight, k = Math.min(1, MAX_SIDE / Math.max(w, h));
        var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
        var ctx = c.getContext('2d'); ctx.drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        var alpha = false;
        if (file.type === 'image/png' || file.type === 'image/webp') {
          var d = ctx.getImageData(0, 0, c.width, c.height).data;
          for (var i = 3; i < d.length; i += 64) { if (d[i] < 250) { alpha = true; break; } }
        }
        var type = alpha ? 'image/webp' : 'image/jpeg';
        c.toBlob(function (b) {
          if (!b) return rej(new Error('This picture could not be processed.'));
          res({ blob: b, ext: extFor(b.type) || (alpha ? 'png' : 'jpg') });
        }, type, 0.86);
      };
      im.onerror = function () { URL.revokeObjectURL(url); rej(new Error('This picture format can’t be read. Please export it as a JPG or PNG and try again.')); };
      im.src = url;
    });
  }

  function replaceImage(img, file) {
    if (!file || !/^image\//.test(file.type)) { status('That file is not a picture.', 'err'); return; }
    status('Adding picture…');
    prepare(file).then(function (p) {
      return readAsDataURL(p.blob).then(function (d) {
        return api('upload', { name: file.name, ext: p.ext, data: d.split(',')[1] });
      });
    }).then(function (res) {
      var old = img.getAttribute('src');
      var twins = imgs.filter(function (x) { return x !== img && x.getAttribute('src') === old; });
      var targets = [img];
      if (twins.length && window.confirm('This picture appears ' + (twins.length + 1) +
          ' times on this page (for example in the scrolling bar). Replace all of them?')) targets = targets.concat(twins);
      targets.forEach(function (t) {
        t.setAttribute('src', res.src); t.removeAttribute('srcset');
        t.classList.add('se-dirty');
        addEdit({ id: t.getAttribute('data-edit'), type: 'attr', name: 'src', value: res.src });
      });
    }).catch(function (err) { status(err.message, 'err'); });
  }

  // ------------------------------------------------------------------ quotes (hidden text, e.g. client feedback)
  function modal(html) {
    var m = document.createElement('div');
    m.className = 'se-modal';
    m.innerHTML = '<div class="se-modal-card">' + html + '</div>';
    m.addEventListener('click', function (e) { if (e.target === m) m.remove(); });
    document.body.appendChild(m);
    return m;
  }

  function openQuote(card) {
    finishEdit(); hideLinkBox();
    var val = card.getAttribute('data-comment') || '';
    var twins = quotes.filter(function (c) { return c.getAttribute('data-comment') === val; });
    var photo = card.querySelector('.se-img');
    var m = modal(
      '<h3>Edit this client’s words</h3>' +
      (twins.length > 1 ? '<p class="se-note">This appears ' + twins.length + ' times in the scrolling bar. All copies will be updated.</p>' : '') +
      '<textarea rows="8"></textarea>' +
      '<div class="se-modal-actions">' +
      (photo ? '<button type="button" data-a="photo">Replace photo…</button>' : '') +
      '<span></span><button type="button" data-a="cancel">Cancel</button>' +
      '<button type="button" class="se-primary" data-a="ok">Apply</button></div>');
    var ta = m.querySelector('textarea');
    ta.value = val; ta.focus();
    m.addEventListener('click', function (e) {
      var a = e.target.getAttribute && e.target.getAttribute('data-a');
      if (!a) return;
      if (a === 'photo') { m.remove(); pickImage(photo); return; }
      if (a === 'ok') {
        var v = ta.value.replace(/\s+/g, ' ').trim();
        if (v !== val) twins.forEach(function (c) {
          c.setAttribute('data-comment', v); c.classList.add('se-dirty');
          addEdit({ id: c.getAttribute('data-edit'), type: 'attr', name: 'data-comment', value: v });
        });
      }
      m.remove();
    });
  }

  // ------------------------------------------------------------------ save / undo / publish
  $('se-save').addEventListener('click', function () {
    finishEdit();
    if (!pending.size) return;
    var btn = $('se-save'); btn.disabled = true;
    status('Saving…');
    api('save', { page: CFG.page, edits: Array.from(pending.values()) }).then(function () {
      pending.clear();
      try { sessionStorage.setItem('se-scroll', String(window.scrollY)); sessionStorage.setItem('se-flash', 'Saved ✓'); } catch (e) {}
      location.reload();
    }).catch(function (err) { btn.disabled = false; status('Could not save: ' + err.message, 'err'); });
  });

  $('se-discard').addEventListener('click', function () {
    finishEdit();
    if (!window.confirm('Undo all unsaved changes on this page?')) return;
    pending.clear();
    try { sessionStorage.setItem('se-scroll', String(window.scrollY)); } catch (e) {}
    location.reload();
  });

  $('se-publish').addEventListener('click', function () {
    finishEdit();
    if (pending.size) { status('Save your changes first, then publish.', 'err'); return; }
    if (!window.confirm('Publish all saved changes to the live website now?')) return;
    status('Publishing… this can take up to a minute.');
    api('publish', {}).then(function () {
      status('Published ✓ The live site will update in a minute or two.', 'ok');
    }).catch(function (err) {
      status('Publishing did not finish.', 'err');
      var m = modal('<h3>Publishing did not finish</h3><pre></pre><div class="se-modal-actions"><span></span><button type="button" class="se-primary">OK</button></div>');
      m.querySelector('pre').textContent = err.message;
      m.querySelector('button').onclick = function () { m.remove(); };
    });
  });

  $('se-help').addEventListener('click', function () {
    var m = modal('<h3>How to edit</h3><ul>' +
      '<li><b>Text:</b> click any outlined text and type. Shift+Enter adds a line break. ' + (navigator.platform.indexOf('Mac') >= 0 ? '⌘' : 'Ctrl') + '+B / I for bold / italic.</li>' +
      '<li><b>Links:</b> click into a link and change “Link goes to” in the bar below.</li>' +
      '<li><b>Pictures:</b> click a picture to choose a new one, or drag a photo from your computer onto it.</li>' +
      '<li><b>Client photos &amp; quotes:</b> click a client in the scrolling bar.</li>' +
      '<li><b>Save changes</b> writes to the files on this computer. <b>Publish</b> sends them to the live site.</li>' +
      '</ul><div class="se-modal-actions"><span></span><button type="button" class="se-primary">Got it</button></div>');
    m.querySelector('button').onclick = function () { m.remove(); };
  });

  window.addEventListener('beforeunload', function (e) {
    if (active) recordText(active);
    if (pending.size) { e.preventDefault(); e.returnValue = ''; }
  });

  // restore scroll position + message after saving
  try {
    var y = sessionStorage.getItem('se-scroll'), f = sessionStorage.getItem('se-flash');
    sessionStorage.removeItem('se-scroll'); sessionStorage.removeItem('se-flash');
    if (y) window.scrollTo(0, parseInt(y, 10) || 0);
    if (f) { status(f, 'ok'); setTimeout(function () { if (!pending.size) status(''); }, 4000); } else status('');
  } catch (e) { status(''); }
})();
