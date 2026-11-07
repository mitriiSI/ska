(function () {
  var burger = document.querySelector('.burger');
  var nav = document.getElementById('nav');
  var dds = Array.prototype.slice.call(document.querySelectorAll('.nav .dd'));
  if (!burger || !nav) return; // на главной меню нет

  function closeAll(except) {
    dds.forEach(function (d) {
      if (d !== except) {
        d.classList.remove('open');
        d.querySelector('button').setAttribute('aria-expanded', 'false');
      }
    });
  }

  burger.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    burger.setAttribute('aria-expanded', String(open));
  });

  dds.forEach(function (d) {
    var btn = d.querySelector('button');
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = d.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(open));
      closeAll(d);
    });
  });

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.nav')) closeAll();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeAll();
      nav.classList.remove('open');
      burger.setAttribute('aria-expanded', 'false');
    }
  });

  // on mobile, expand the section of the current page
  if (window.matchMedia('(max-width: 900px)').matches) {
    var active = document.querySelector('.nav .dd.active');
    if (active) active.classList.add('open');
  }
})();

// Liquid glass: блик следует за курсором
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var sel = '.card, .tile, .file, .lec, .pager a, .btn, .content > .news, .hub-tile';
  document.addEventListener('pointermove', function (e) {
    var el = e.target.closest && e.target.closest(sel);
    if (!el) return;
    var r = el.getBoundingClientRect();
    el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    el.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }, { passive: true });
})();
