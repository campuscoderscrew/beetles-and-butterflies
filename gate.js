/* Beetles & Butterflies: private-preview passcode screen.
   To change the passcode, edit PASSCODE below (capitals and spaces are ignored).
   To remove the screen when the site is ready to launch, delete the
   <script src="gate.js"></script> line from each page (or empty this file).
   IMPORTANT: this only keeps casual visitors out. It is not real security.
   Anyone who looks at the page source can get past it, so never put
   private participant information on this website. */
(function () {
  var PASSCODE = 'B&B';
  var KEY = 'bb-preview-unlocked';
  var norm = function (s) { return String(s || '').replace(/\s+/g, '').toUpperCase(); };
  try { if (sessionStorage.getItem(KEY) === '1') return; } catch (e) {}

  var root = document.documentElement;
  root.classList.add('bb-locked');
  var css = document.createElement('style');
  css.textContent =
    'html.bb-locked body>*:not(#bb-gate){display:none!important}' +
    '#bb-gate{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:20px;background:#2b1745;font-family:"DM Sans",system-ui,sans-serif}' +
    '#bb-gate form{width:min(400px,100%);background:#f7f0e4;border-radius:24px;padding:36px 30px;text-align:center;box-shadow:0 24px 70px rgba(0,0,0,.4)}' +
    '#bb-gate h1{font-family:"Playfair Display",Georgia,serif;color:#6b3fa0;font-size:30px;line-height:1.15;margin:0 0 10px}' +
    '#bb-gate p{color:#17131d;margin:0 0 20px;font-size:15px;line-height:1.5}' +
    '#bb-gate input{display:block;width:100%;box-sizing:border-box;padding:13px 14px;border:1px solid #cbbfd3;border-radius:12px;font:inherit;font-size:16px;text-align:center;margin-bottom:12px;background:#fff}' +
    '#bb-gate button{width:100%;padding:13px;border:0;border-radius:999px;background:#6b3fa0;color:#fff;font:inherit;font-weight:700;font-size:16px;cursor:pointer}' +
    '#bb-gate .bb-err{color:#a4262c;font-size:14px;min-height:20px;margin:10px 0 0}';
  document.head.appendChild(css);

  function build() {
    var gate = document.createElement('div');
    gate.id = 'bb-gate';
    gate.innerHTML =
      '<form autocomplete="off">' +
      '<h1>Beetles &amp; Butterflies</h1>' +
      '<p>This website is in private preview.<br>Please enter the passcode to continue.</p>' +
      '<label for="bb-code" style="position:absolute;left:-9999px">Passcode</label>' +
      '<input id="bb-code" type="password" placeholder="Passcode" autofocus>' +
      '<button type="submit">Enter site</button>' +
      '<p class="bb-err" role="alert"></p></form>';
    document.body.appendChild(gate);
    var form = gate.querySelector('form'), input = gate.querySelector('input'), err = gate.querySelector('.bb-err');
    input.focus();
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (norm(input.value) === norm(PASSCODE)) {
        try { sessionStorage.setItem(KEY, '1'); } catch (x) {}
        gate.remove();
        root.classList.remove('bb-locked');
      } else {
        err.textContent = 'That passcode is not correct. Please try again.';
        input.value = '';
        input.focus();
      }
    });
  }
  if (document.body) build(); else document.addEventListener('DOMContentLoaded', build);
})();
