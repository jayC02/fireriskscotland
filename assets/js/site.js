/* Fire Risk Scotland — progressive enhancement. Every page and all content works without this file. */
(function () {
  var doc = document.documentElement;
  doc.classList.remove('no-js');
  doc.classList.add('js');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* Header shadow on scroll */
  var header = document.querySelector('.site-header');
  var onScroll = function () { if (header) header.classList.toggle('scrolled', window.scrollY > 10); };
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* Mobile navigation */
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.textContent = open ? 'Close' : 'Menu';
    });
  }
  var dd = $$('.nav details');
  document.addEventListener('click', function (e) { dd.forEach(function (d) { if (!d.contains(e.target)) d.removeAttribute('open'); }); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') dd.forEach(function (d) { d.removeAttribute('open'); }); });

  /* Spotlight that follows the pointer on blueprint surfaces */
  if (!reduce) {
    $$('.blueprint').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
        el.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
      });
    });
  }

  /* Reveal on scroll, count-ups and other in-view triggers */
  var inView = function (el, cb, opts) {
    if (!('IntersectionObserver' in window)) { cb(el); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { cb(en.target); io.unobserve(en.target); } });
    }, opts || { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
    io.observe(el);
  };
  $$('[data-reveal], [data-inview]').forEach(function (el) { inView(el, function (t) { t.classList.add('in'); }); });

  var fmt = function (n, dec) { return n.toLocaleString('en-GB', { minimumFractionDigits: dec, maximumFractionDigits: dec }); };
  $$('[data-count]').forEach(function (el) {
    var target = parseFloat(el.getAttribute('data-count'));
    var prefix = el.getAttribute('data-prefix') || '', suffix = el.getAttribute('data-suffix') || '';
    var dec = parseInt(el.getAttribute('data-dec') || '0', 10);
    if (reduce) { el.textContent = prefix + fmt(target, dec) + suffix; return; }
    el.textContent = prefix + fmt(0, dec) + suffix;
    inView(el, function () {
      var t0 = null, dur = 1400;
      var step = function (ts) {
        if (!t0) t0 = ts;
        var p = Math.min(1, (ts - t0) / dur), e = 1 - Math.pow(1 - p, 3);
        el.textContent = prefix + fmt(target * e, dec) + suffix;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  });

  /* Building explorer: hotspots, auto-tour until the visitor takes over */
  $$('[data-explorer]').forEach(function (bx) {
    var spots = $$('.hs', bx), items = $$('.bx-items li', bx), hint = bx.querySelector('.bx-hint');
    var bar = bx.querySelector('.bx-progress span'), barWrap = bx.querySelector('.bx-progress');
    var cur = -1, timer = null, manual = false;
    var show = function (i) {
      cur = i;
      spots.forEach(function (s, k) { s.setAttribute('aria-pressed', k === i ? 'true' : 'false'); });
      items.forEach(function (li, k) { li.classList.toggle('on', k === i); });
      if (hint) hint.style.display = 'none';
      if (bar && !manual && !reduce) { bar.classList.remove('run'); void bar.offsetWidth; bar.classList.add('run'); }
    };
    var stop = function () { manual = true; clearInterval(timer); if (barWrap) barWrap.classList.add('stopped'); };
    spots.forEach(function (s, k) {
      s.addEventListener('click', function () { stop(); show(k); });
    });
    bx.addEventListener('keydown', function (e) {
      if (cur < 0 || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
      stop(); var n = (cur + (e.key === 'ArrowRight' ? 1 : spots.length - 1)) % spots.length; show(n); spots[n].focus();
    });
    if (reduce) { show(0); if (barWrap) barWrap.classList.add('stopped'); return; }
    setTimeout(function () {
      if (manual) return;
      show(0);
      timer = setInterval(function () { if (!manual) show((cur + 1) % spots.length); }, 6000);
    }, 2600);
  });

  /* Premises tabs */
  $$('[data-tabs]').forEach(function (wrap) {
    var tabs = $$('[role="tab"]', wrap), panels = $$('[role="tabpanel"]', wrap);
    var select = function (i, focus) {
      tabs.forEach(function (t, k) { t.setAttribute('aria-selected', k === i ? 'true' : 'false'); t.tabIndex = k === i ? 0 : -1; });
      panels.forEach(function (p, k) { p.hidden = k !== i; p.classList.toggle('show', k === i); });
      if (focus) tabs[i].focus();
    };
    tabs.forEach(function (t, k) {
      t.addEventListener('click', function () { select(k); });
      t.addEventListener('keydown', function (e) {
        var n = null;
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') n = (k + 1) % tabs.length;
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') n = (k + tabs.length - 1) % tabs.length;
        if (e.key === 'Home') n = 0; if (e.key === 'End') n = tabs.length - 1;
        if (n !== null) { e.preventDefault(); select(n, true); }
      });
    });
    select(0);
  });

  /* Risk matrix */
  var RATINGS = {
    trivial: ['Trivial', 'var(--risk-1)', 'No action is required beyond keeping existing measures in place and reviewing the assessment as planned.'],
    tolerable: ['Tolerable', 'var(--risk-2)', 'No major additional controls are needed. Some lower-priority improvements may be recommended and existing measures must be maintained.'],
    moderate: ['Moderate', 'var(--risk-3)', 'Action is needed to reduce the risk, carried out within a defined timescale set out in your action plan.'],
    substantial: ['Substantial', 'var(--risk-4)', 'Considerable action is needed urgently. Where people are present, measures to reduce the risk should be put in place quickly.'],
    intolerable: ['Intolerable', 'var(--risk-5)', 'The premises, or the affected part, should not be occupied until the risk is reduced. You would be told on the day of the visit.']
  };
  $$('[data-matrix]').forEach(function (m) {
    var out = m.querySelector('.matrix-readout'), cells = $$('.matrix button', m);
    var show = function (btn) {
      cells.forEach(function (c) { c.setAttribute('aria-pressed', c === btn ? 'true' : 'false'); });
      var r = RATINGS[btn.getAttribute('data-rating')];
      out.innerHTML = '<h3><i style="background:' + r[1] + '"></i>' + r[0] + ' risk</h3><p><strong>' +
        btn.getAttribute('data-l') + ' likelihood, ' + btn.getAttribute('data-c').toLowerCase() + '.</strong> ' + r[2] + '</p>';
    };
    cells.forEach(function (c) { c.addEventListener('click', function () { show(c); }); c.addEventListener('mouseenter', function () { show(c); }); });
    var start = m.querySelector('.matrix button[data-start]'); if (start) show(start);
  });

  /* Report mock-up tilt */
  if (!reduce) {
    $$('.report').forEach(function (rep) {
      var inner = rep.querySelector('.report-inner');
      rep.addEventListener('pointermove', function (e) {
        var r = rep.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        inner.style.setProperty('--ry', (-14 + x * 18) + 'deg'); inner.style.setProperty('--rx', (8 - y * 12) + 'deg');
      });
      rep.addEventListener('pointerleave', function () { inner.style.removeProperty('--ry'); inner.style.removeProperty('--rx'); });
    });
  }

  /* Smooth FAQ accordions */
  if (!reduce && 'animate' in document.body) {
    $$('details.faq').forEach(function (d) {
      var sum = d.querySelector('summary'), ans = d.querySelector('.answer');
      sum.addEventListener('click', function (e) {
        e.preventDefault();
        if (d.open) {
          var h = ans.offsetHeight;
          ans.animate([{ height: h + 'px', opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 220, easing: 'ease-in' }).onfinish = function () { d.open = false; };
        } else {
          d.open = true;
          var h2 = ans.offsetHeight;
          ans.animate([{ height: '0px', opacity: 0 }, { height: h2 + 'px', opacity: 1 }], { duration: 280, easing: 'cubic-bezier(.2,.7,.1,1)' });
        }
      });
    });
  }

  /* Contents list: highlight the section in view */
  var tocLinks = $$('.toc a');
  if (tocLinks.length && 'IntersectionObserver' in window) {
    var map = {};
    tocLinks.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && map[en.target.id]) { tocLinks.forEach(function (a) { a.classList.remove('active'); }); map[en.target.id].classList.add('active'); }
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    Object.keys(map).forEach(function (id) { var el = document.getElementById(id); if (el) io.observe(el); });
  }

  /* Quote form: sends to the Resend-backed endpoint and shows a confirmation on the page */
  var form = document.getElementById('quote-form');
  if (form) {
    var status = form.querySelector('.form-status');
    var button = form.querySelector('button[type="submit"]');
    var success = document.getElementById('quote-success');
    var started = form.querySelector('input[name="form_started"]');
    if (started) started.value = String(Date.now());
    var setStatus = function (cls, msg) { status.className = 'form-status' + (cls ? ' ' + cls : ''); status.textContent = msg; };
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      var data = new FormData(form);
      var body = new URLSearchParams();
      data.forEach(function (v, k) { body.append(k, v); });
      button.disabled = true; button.classList.add('is-loading'); button.textContent = 'Sending…';
      setStatus('', '');
      fetch(form.getAttribute('data-endpoint') || form.action, {
        method: 'POST', body: body.toString(),
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }
      })
        .then(function (r) { return r.json().catch(function () { return { ok: false }; }).then(function (j) { j.status = r.status; return j; }); })
        .then(function (j) {
          if (!j.ok) throw new Error(j.error || '');
          var name = (data.get('name') || '').toString().trim().split(/\s+/)[0];
          success.querySelector('[data-fs="name"]').textContent = name ? ', ' + name : '';
          success.querySelector('[data-fs="email"]').textContent = (data.get('email') || '').toString();
          success.querySelector('[data-fs="confirm"]').hidden = j.confirmationSent === false;
          form.hidden = true; success.hidden = false; success.classList.add('show');
          success.focus({ preventScroll: true });
          success.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
        })
        .catch(function (err) {
          setStatus('err', (err && err.message) || 'Your request could not be sent. Please call 0141 255 1360 or email info@scottishenergyservices.co.uk.');
        })
        .then(function () { button.disabled = false; button.classList.remove('is-loading'); button.textContent = 'Request my quote'; });
    });
    var again = success && success.querySelector('[data-fs="again"]');
    if (again) again.addEventListener('click', function () {
      form.reset(); if (started) started.value = String(Date.now());
      success.hidden = true; success.classList.remove('show'); form.hidden = false; setStatus('', '');
      form.querySelector('input[name="name"]').focus();
    });
  }
})();
