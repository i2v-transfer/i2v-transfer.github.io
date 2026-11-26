// Page chrome: promo player, section nav highlight, BibTeX copy.
(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  // Promo: autoplay muted loop, played only while on screen, with pause and replay.
  const video = document.getElementById('promo-video');
  const toggle = document.getElementById('promo-toggle');
  const replay = document.getElementById('promo-replay');
  if (video && toggle && replay) {
    let wanted = !reduced.matches; // what the visitor asked for
    let onScreen = false;
    const label = toggle.querySelector('.mini-label');
    const render = () => {
      const paused = video.paused;
      toggle.classList.toggle('is-paused', paused);
      label.textContent = paused ? 'Play' : 'Pause';
      toggle.setAttribute('aria-label', paused ? 'Play overview video' : 'Pause overview video');
    };
    const sync = () => {
      if (wanted && onScreen && !document.hidden) video.play().catch(() => { wanted = false; render(); });
      else video.pause();
    };
    if (!wanted) { video.removeAttribute('autoplay'); video.pause(); }
    video.addEventListener('play', render);
    video.addEventListener('pause', render);
    toggle.addEventListener('click', () => { wanted = video.paused; onScreen = true; sync(); });
    replay.addEventListener('click', () => { video.currentTime = 0; wanted = true; onScreen = true; sync(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(entries => { onScreen = entries[0].isIntersecting; sync(); }, { threshold: 0.25 }).observe(video);
    } else { onScreen = true; sync(); }
    document.addEventListener('visibilitychange', sync);
    render();
  }

  // Nav: mark the section in view.
  const nav = document.querySelector('.nav-links');
  if (nav && 'IntersectionObserver' in window) {
    const links = new Map();
    nav.querySelectorAll('a[href^="#"]').forEach(a => {
      const s = document.getElementById(a.getAttribute('href').slice(1));
      if (s) links.set(s, a);
    });
    const visible = new Set();
    const mark = () => {
      const current = [...links.keys()].find(s => visible.has(s));
      links.forEach((a, s) => { if (s === current) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    };
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) visible.add(e.target); else visible.delete(e.target); });
      mark();
    }, { rootMargin: '-45% 0px -45% 0px' });
    links.forEach((_, s) => io.observe(s));
  }

  // First-principle animation: step through five states while on screen; reduced motion keeps the final state.
  const fp = document.getElementById('first-principle');
  if (fp) {
    const durations = [4500, 4500, 6500, 6500, 5500]; // ms per step, a 27.5 s loop: every caption stays at least 4.5 s
    let step = 5, timer = null, inView = false;
    const set = n => { step = n; fp.dataset.step = String(n); };
    const stop = () => { clearTimeout(timer); timer = null; };
    const run = () => { stop(); if (!inView || reduced.matches || document.hidden) return; timer = setTimeout(() => { set(step % 5 + 1); run(); }, durations[step - 1]); };
    fp.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => { set(Number(b.dataset.go)); run(); }));
    if (reduced.matches) fp.classList.add('fp-static');
    else if ('IntersectionObserver' in window) {
      new IntersectionObserver(entries => {
        const now = entries[0].isIntersecting;
        if (now && !inView) { fp.classList.add('fp-static'); set(1); void fp.offsetWidth; fp.classList.remove('fp-static'); }
        inView = now; run();
      }, { threshold: 0.35 }).observe(fp);
      document.addEventListener('visibilitychange', run);
    }
    reduced.addEventListener('change', e => { fp.classList.toggle('fp-static', e.matches); if (e.matches) { stop(); set(5); } else run(); });
  }

  // BibTeX copy.
  const copy = document.getElementById('copy-bibtex');
  const code = document.querySelector('.bibtex code');
  if (copy && code) {
    if (!navigator.clipboard) copy.hidden = true;
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(code.textContent); copy.textContent = 'Copied'; }
      catch (e) { copy.textContent = 'Press Ctrl+C'; }
      setTimeout(() => { copy.textContent = 'Copy'; }, 1600);
    });
  }
})();
