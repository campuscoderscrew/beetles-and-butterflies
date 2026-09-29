function submitForm(event){
  event.preventDefault();
  const note=document.getElementById('form-note');
  note.textContent='Thank you! This form is currently a design preview. We will connect it to your business email when the site is published.';
  event.target.reset();
  return false;
}

const menuToggle=document.querySelector('.menu-toggle');
if(menuToggle){
  menuToggle.addEventListener('click',()=>{
    const nav=document.querySelector('.site-header nav');
    nav.style.display = nav.style.display === 'flex' ? 'none' : 'flex';
    nav.style.flexDirection='column';
    nav.style.position='absolute';
    nav.style.top='74px';
    nav.style.right='5%';
    nav.style.background='#f7f0e4';
    nav.style.padding='20px';
    nav.style.borderRadius='16px';
    nav.style.boxShadow='0 12px 35px rgba(43,23,69,.18)';
  });
}

const modal=document.getElementById('participant-modal');
function closeModal(){ if(modal){modal.classList.remove('is-open');modal.setAttribute('aria-hidden','true');} }
document.querySelectorAll('.participant-card').forEach(card=>{
  card.addEventListener('click',()=>{
    if(!modal) return;
    document.getElementById('participant-comment').textContent=card.dataset.comment || 'Reflection coming soon.';
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden','false');
  });
});
document.querySelectorAll('[data-close-modal]').forEach(el=>el.addEventListener('click',closeModal));
document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeModal(); });


/* Highlight the current page (or, on the landing page, the section in view) in the nav bar. */
(function () {
  var nav = document.querySelector('.site-header nav');
  if (!nav) return;
  var links = Array.prototype.slice.call(nav.querySelectorAll('a[href]'));
  var fileOf = function (url) { return (url.pathname.split('/').pop() || 'index.html').toLowerCase(); };
  var here = fileOf(location);
  var isIndex = here === 'index.html';
  // Program detail pages count as "Programs".
  var PROGRAM_PAGES = ['professional-development.html', 'career-coaching.html', 'foundational-leadership.html',
    'beetles-butterflies-transitions.html', 'next-generational-leadership-phase-1.html', 'next-generational-leadership-phase-2.html'];
  var info = links.map(function (a) {
    var u = new URL(a.getAttribute('href'), location.href);
    return { a: a, file: fileOf(u), hash: u.hash };
  });
  function mark(link) {
    info.forEach(function (x) {
      var on = x.a === link;
      x.a.classList.toggle('is-current', on);
      if (on) x.a.setAttribute('aria-current', isIndex ? 'location' : 'page');
      else x.a.removeAttribute('aria-current');
    });
  }
  if (!isIndex) {
    var match = info.filter(function (x) { return x.file === here && !x.hash; })[0];
    if (!match && PROGRAM_PAGES.indexOf(here) >= 0) match = info.filter(function (x) { return x.hash === '#programs'; })[0];
    mark(match ? match.a : null);
    return;
  }
  var spy = info.filter(function (x) { return x.file === 'index.html' && x.hash && document.querySelector(x.hash); })
    .map(function (x) { return { a: x.a, sec: document.querySelector(x.hash) }; });
  function update() {
    var header = document.querySelector('.site-header');
    var line = window.scrollY + (header ? header.offsetHeight : 0) + window.innerHeight * 0.3;
    var cur = null, best = -Infinity;
    spy.forEach(function (s) {
      var top = s.sec.getBoundingClientRect().top + window.scrollY;
      if (top <= line && top > best) { best = top; cur = s.a; }
    });
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4 && spy.length) {
      cur = spy.reduce(function (m, s) { return s.sec.offsetTop > m.sec.offsetTop ? s : m; }).a;
    }
    mark(cur);
  }
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  window.addEventListener('hashchange', function () { setTimeout(update, 50); });
  update();
})();
