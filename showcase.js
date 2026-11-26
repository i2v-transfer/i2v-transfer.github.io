// Video players: a synced row (source + models) driven by task tabs and example thumbnails.
// One mounts as the showcase (source + the I2VT models), one as the comparison with other editors.
// Videos load only when a player nears the viewport and play only while it is on screen.
(() => {
  'use strict';
  // opts.prefix keeps element ids unique per player; opts.section is the section that old #task links scroll to.
  function mount(data, root, opts) {
  if (!data || !root) return;
  const pid = opts.prefix || '';

  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const roles = [{ label: 'Source', role: 'source' }, ...data.models];
  const byCat = new Map(data.categories.map(c => [c.id, data.examples.filter(e => e.category === c.id)]));

  let cat = data.categories[0].id;
  const index = new Map(data.categories.map(c => [c.id, 0]));
  let armed = false;      // the showcase is near the viewport, so sources may load
  let onScreen = false;   // enough of the player is visible to play
  let wanted = !reduced.matches; // the visitor has not paused
  let ready = false, playing = false, generation = 0, raf = null, duration = 0;

  root.textContent = '';

  // Task tabs
  const tabsWrap = el('div', 'sc-tabs');
  const tablist = el('div', 'sc-tablist'); tablist.setAttribute('role', 'tablist'); tablist.setAttribute('aria-label', 'Editing task');
  const tabs = data.categories.map(c => {
    const b = el('button', 'sc-tab', c.label); b.type = 'button'; b.id = `${pid}tab-${c.id}`; b.setAttribute('role', 'tab'); b.setAttribute('aria-controls', `${pid}sc-panel`);
    b.addEventListener('click', () => show(c.id, index.get(c.id)));
    b.addEventListener('keydown', e => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const i = data.categories.findIndex(x => x.id === cat) + (e.key === 'ArrowRight' ? 1 : -1);
      const next = data.categories[(i + data.categories.length) % data.categories.length];
      show(next.id, index.get(next.id)); document.getElementById(`${pid}tab-${next.id}`).focus();
    });
    tablist.append(b); return b;
  });
  tabsWrap.append(tablist);

  // Card: instruction, videos, controls, thumbnails
  const card = el('div', 'card sc-card'); card.id = `${pid}sc-panel`; card.setAttribute('role', 'tabpanel');
  const prompt = el('div', 'sc-prompt');
  const body = el('div', 'sc-prompt-body');
  const instruction = el('h3', 'sc-instruction');
  body.append(instruction);
  prompt.append(el('span', 'sc-chip', 'Instruction'), body);

  const status = el('div', 'sc-status'); status.setAttribute('role', 'status');
  const grid = el('div', `sc-grid${opts.gridClass ? ' ' + opts.gridClass : ''}`);
  const videos = roles.map(r => {
    const panel = el('div', `sc-panel${r.role === 'source' || r.baseline ? '' : ' is-ours'}`);
    const label = el('div', 'sc-label'); const name = el('span', '', r.label); label.append(name);
    if (r.role === 'source') label.append(el('small', '', 'input'));
    const well = el('div', 'sc-well');
    const v = document.createElement('video');
    v.muted = true; v.defaultMuted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'none'; v.dataset.role = r.role; v.dataset.label = r.label; v.nameEl = name; v.baseLabel = r.label;
    ['loadeddata', 'canplay'].forEach(t => v.addEventListener(t, checkReady));
    v.addEventListener('error', () => { if (!v.getAttribute('src')) return; pause(); status.textContent = 'Video unavailable. Reload to retry.'; });
    const note = el('div', 'sc-note'); note.hidden = true; v.noteEl = note;
    well.append(v); panel.append(label, well, note); grid.append(panel);
    return v;
  });
  const master = videos[1];
  master.addEventListener('ended', () => { if (playing) restart(); });

  const controls = el('div', 'sc-controls');
  const playBtn = el('button', 'mini-button sc-play is-paused'); playBtn.type = 'button';
  const playIcon = el('span', 'icon'); playIcon.setAttribute('aria-hidden', 'true'); const playLabel = el('span', '', 'Play');
  playBtn.append(playIcon, playLabel);
  playBtn.addEventListener('click', () => { wanted = !playing; if (playing) pause(); else { arm(); play(); } });
  const timeline = el('input', 'sc-timeline'); Object.assign(timeline, { type: 'range', min: '0', max: '1', step: '0.01', value: '0', disabled: true });
  timeline.setAttribute('aria-label', 'Video position'); timeline.addEventListener('input', () => seek(Number(timeline.value)));
  const paging = el('div', 'sc-paging');
  const prev = el('button', 'mini-button sc-arrow', '←'); const next = el('button', 'mini-button sc-arrow', '→'); prev.type = next.type = 'button';
  prev.setAttribute('aria-label', 'Previous example'); next.setAttribute('aria-label', 'Next example');
  const count = el('span', 'sc-count'); count.setAttribute('aria-live', 'polite');
  prev.addEventListener('click', () => show(cat, index.get(cat) - 1)); next.addEventListener('click', () => show(cat, index.get(cat) + 1));
  paging.append(prev, count, next); controls.append(playBtn, timeline, paging);
  const thumbs = el('div', 'sc-thumbs'); thumbs.setAttribute('role', 'group'); thumbs.setAttribute('aria-label', 'Examples');
  card.append(prompt, grid, controls, status, thumbs);
  root.append(tabsWrap, card);

  function show(nextCat, nextIndex, quiet) {
    const list = byCat.get(nextCat); if (!list) return;
    const i = (nextIndex + list.length) % list.length;
    const catChanged = nextCat !== cat || !thumbs.childElementCount;
    cat = nextCat; index.set(cat, i);
    const item = list[i];
    pause(); ready = false; duration = 0; status.textContent = '';
    tabs.forEach((b, k) => { const on = data.categories[k].id === cat; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    card.setAttribute('aria-labelledby', `${pid}tab-${cat}`);
    instruction.textContent = `“${item.caption}”`;
    grid.classList.toggle('is-portrait', !!item.portrait);
    count.textContent = `${i + 1} / ${list.length}`; count.setAttribute('aria-label', `Example ${i + 1} of ${list.length}`);
    timeline.value = '0'; timeline.disabled = true;
    videos.forEach(v => {
      const m = item[v.dataset.role];
      v.dataset.label = m.label || v.baseLabel; v.nameEl.textContent = v.dataset.label; // an example may name the model it shows
      v.noteEl.textContent = m.note || ''; v.noteEl.hidden = !m.note; // and say what a panel shows, in a few words
      v.removeAttribute('src'); v.poster = m.poster; v.dataset.src = m.src; v.playbackRate = 1;
      v.setAttribute('aria-label', `${v.dataset.label}: ${item.caption}${m.note ? ` (${m.note})` : ''}`);
      if (armed) { v.preload = 'auto'; v.src = m.src; }
      v.load();
    });
    if (catChanged) {
      thumbs.textContent = '';
      list.forEach((e, k) => {
        const b = el('button', 'sc-thumb'); b.type = 'button'; b.title = e.caption; b.setAttribute('aria-label', `Example ${k + 1}: ${e.caption}`);
        const img = el('img'); img.src = e.source.poster; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; img.width = 160; img.height = 90;
        b.append(img, el('span', '', String(k + 1)));
        b.addEventListener('click', () => show(cat, k));
        thumbs.append(b);
      });
    }
    [...thumbs.children].forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
    if (!quiet && opts.section && history.replaceState) history.replaceState(null, '', `#${cat}`);
  }

  function arm() {
    if (armed) return; armed = true;
    videos.forEach(v => { if (!v.getAttribute('src') && v.dataset.src) { v.preload = 'auto'; v.src = v.dataset.src; v.load(); } });
  }
  function checkReady() {
    if (ready || !videos.every(v => v.getAttribute('src') && !v.error && v.readyState >= 2 && Number.isFinite(v.duration) && v.duration > 0)) return;
    ready = true; duration = master.duration;
    videos.forEach(v => { v.playbackRate = v.duration / duration; }); // clips of slightly different length stay in step
    timeline.max = String(duration); timeline.disabled = false; updateTime();
    if (wanted && onScreen && !document.hidden) play();
  }
  async function play() {
    if (!ready || playing) return;
    if (master.currentTime >= duration - 0.04) seek(0);
    playing = true; const g = ++generation; updateButton();
    const p = master.currentTime / duration;
    videos.forEach(v => { const t = p * v.duration; if (Math.abs(t - v.currentTime) > 0.06) v.currentTime = t; });
    try { await Promise.all(videos.map(v => v.play())); if (g !== generation || !playing) return; status.textContent = ''; tick(); }
    catch (e) { if (g !== generation) return; pause(); wanted = false; status.textContent = 'Press Play to start this comparison.'; }
  }
  function pause() {
    generation++; playing = false; videos.forEach(v => v.pause());
    if (raf !== null) cancelAnimationFrame(raf); raf = null; updateButton(); if (ready) updateTime();
  }
  function seek(t) { if (!ready) return; const p = Math.max(0, Math.min(t, duration)) / duration; videos.forEach(v => { v.currentTime = p * v.duration; }); updateTime(); }
  function restart() { pause(); seek(0); if (wanted && onScreen && !document.hidden) play(); }
  function tick() {
    if (!playing) return;
    if (master.currentTime >= duration - 0.035) { restart(); return; }
    videos.forEach(v => { if (v === master) return; const target = master.currentTime / duration * v.duration; if (!v.seeking && Math.abs(v.currentTime - target) > 0.12) v.currentTime = target; });
    updateTime(); raf = requestAnimationFrame(tick);
  }
  function updateTime() { const t = master.currentTime || 0; timeline.value = String(t); timeline.setAttribute('aria-valuetext', `${fmt(t)} of ${fmt(duration || 0)}`); }
  function updateButton() { playBtn.classList.toggle('is-paused', !playing); playLabel.textContent = playing ? 'Pause' : 'Play'; playBtn.setAttribute('aria-label', playing ? 'Pause comparison' : 'Play comparison'); }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries, io) => { if (entries.some(e => e.isIntersecting)) { arm(); io.disconnect(); } }, { rootMargin: '500px 0px' }).observe(root);
    new IntersectionObserver(entries => {
      onScreen = entries[0].isIntersecting;
      if (!onScreen) pause(); else if (wanted) play();
    }, { threshold: 0.3 }).observe(grid);
  } else { armed = true; onScreen = true; }
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); else if (wanted && onScreen) play(); });
  addEventListener('pagehide', pause);
  reduced.addEventListener('change', e => { if (e.matches) { wanted = false; pause(); } });

  // Old links to a task group (#action, #expression, #motion, #relight) open that tab.
  function fromHash(scroll) {
    const id = location.hash.slice(1);
    if (!opts.section || !byCat.has(id)) return false;
    show(id, index.get(id), true);
    if (scroll) document.getElementById(opts.section).scrollIntoView();
    return true;
  }
  if (!fromHash(true)) show(cat, 0, true);
  addEventListener('hashchange', () => fromHash(true));
  }

  mount(window.SHOWCASE_DATA, document.getElementById('showcase-root'), { section: 'showcase' });
  mount(window.COMPARE_DATA, document.getElementById('compare-root'), { prefix: 'cmp-', gridClass: 'sc-grid-5' });
})();
