(() => {
  'use strict';

  const timeline = document.getElementById('timeline');
  const statusEl = document.getElementById('search-status');
  const emptyEl = document.getElementById('empty');
  const searchEl = document.getElementById('search');
  const searchClear = document.getElementById('search-clear');
  const monthBtn = document.getElementById('month-jump');
  const monthDialog = document.getElementById('month-dialog');
  const monthGrid = document.getElementById('month-grid');
  const randomBtn = document.getElementById('random-btn');
  const dialog = document.getElementById('random-dialog');
  const dlgName = document.getElementById('random-name');
  const dlgDate = document.getElementById('random-date');
  const dlgContent = document.getElementById('random-content');
  const againBtn = document.getElementById('random-again');
  const randomNo = document.getElementById('random-no');
  const noteDialog = document.getElementById('note-dialog');
  const ndName = document.getElementById('note-dialog-name');
  const ndDate = document.getElementById('note-dialog-date');
  const ndContent = document.getElementById('note-dialog-content');
  const noteNo = document.getElementById('note-dialog-no');
  const totalEl = document.getElementById('total-count');
  const rangeEl = document.getElementById('year-range');
  const heroLede = document.getElementById('hero-lede');
  const yearNav = document.getElementById('year-nav');
  const toolbarWrap = document.getElementById('toolbar-wrap');
  const toTopBtn = document.getElementById('to-top');
  const jumpVeil = document.getElementById('jump-veil');
  const themeToggle = document.getElementById('theme-toggle');

  const state = { items: [], filtered: [], query: '', lastRandom: null };

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DIALOG_CLOSE_MS = 240;
  const ZOOM_CLOSE_MS = 360;

  const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pad2 = (n) => String(n).padStart(2, '0');
  const CN_MONTHS = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

  const entityDecoder = document.createElement('textarea');
  function decodeEntities(text) {
    entityDecoder.innerHTML = text;
    return entityDecoder.value;
  }

  function splitLines(text) {
    const lines = String(text || '')
      .replace(/\r\n?/g, '\n')
      .split(/<br\s*\/?>|\n/i)
      .map((line) => decodeEntities(line));
    while (lines.length && !lines[0].trim()) lines.shift();
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    return lines;
  }

  function fillContent(target, content) {
    target.textContent = '';
    const lines = splitLines(content);
    if (!lines.length) {
      target.textContent = '（空白留言）';
      return;
    }
    lines.forEach((line, i) => {
      if (i) target.append(document.createElement('br'));
      target.append(line);
    });
  }

  function parse(raw) {
    const items = raw.map((m, index) => {
      const date = typeof m.Date === 'string' ? m.Date.trim() : '';
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
      const year = match ? Number(match[1]) : null;
      const month = match ? Number(match[2]) : null;
      const day = match ? Number(match[3]) : null;
      const ts = match ? Date.UTC(year, month - 1, day) : 0;
      const name = decodeEntities((typeof m.PersonName === 'string' && m.PersonName.trim()) || '匿名');
      const content = typeof m.Content === 'string' ? m.Content.trim() : '';
      const plain = `${name} ${splitLines(content).join(' ')} ${date}`.toLowerCase();
      return { index, date, year, month, day, ts, name, content, plain };
    });
    items.sort((a, b) => (b.ts - a.ts) || (a.index - b.index));
    for (let i = 0; i < items.length; i += 1) {
      items[i].no = items.length - i;
    }
    return items;
  }

  function splitName(name) {
    const match = /^(.*?)@([0-9a-f]{4,})$/i.exec(name);
    if (!match) return { main: name, handle: '' };
    return { main: match[1] || '匿名', handle: '@' + match[2] };
  }

  function fillName(target, name) {
    const parts = splitName(name);
    target.textContent = parts.main;
    target.title = parts.handle ? name : '';
  }

  function highlight(text, query) {
    const fragment = document.createDocumentFragment();
    if (!query) {
      fragment.append(text);
      return fragment;
    }
    const re = new RegExp(escapeRegExp(query), 'gi');
    let last = 0;
    let match;
    while ((match = re.exec(text)) !== null) {
      if (match.index > last) fragment.append(text.slice(last, match.index));
      const mark = document.createElement('mark');
      mark.textContent = match[0];
      fragment.append(mark);
      last = match.index + match[0].length;
      if (!match[0].length) re.lastIndex += 1;
    }
    if (last < text.length) fragment.append(text.slice(last));
    return fragment;
  }

  function createNote(item) {
    const note = document.createElement('article');
    note.className = 'note';
    note.tabIndex = 0;
    note.setAttribute('role', 'button');
    note.setAttribute('aria-haspopup', 'dialog');
    note.setAttribute('aria-label', `放大查看 ${item.name} 的留言`);

    const head = document.createElement('div');
    head.className = 'note-head';

    const nameEl = document.createElement('span');
    nameEl.className = 'note-name';
    const name = splitName(item.name);
    nameEl.append(highlight(name.main, state.query));
    if (name.handle) nameEl.title = item.name;

    const time = document.createElement('time');
    time.className = 'note-date';
    if (item.date) time.dateTime = item.date;
    time.title = item.date || '';
    time.textContent = item.month ? `${pad2(item.month)}.${pad2(item.day)}` : '未知日期';

    head.append(nameEl, time);

    const content = document.createElement('p');
    content.className = 'note-content';
    const lines = splitLines(item.content);
    if (!lines.length) {
      content.textContent = '（空白留言）';
    } else {
      lines.forEach((line, i) => {
        if (i) content.append(document.createElement('br'));
        content.append(highlight(line, state.query));
      });
    }

    const no = document.createElement('span');
    no.className = 'note-no';
    no.textContent = String(item.no);
    no.setAttribute('aria-label', `第 ${item.no} 条`);

    note.append(head, content, no);

    note.addEventListener('click', () => {
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) return;
      openNote(item, note);
    });
    note.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openNote(item, note);
      }
    });

    return note;
  }

  function monthKey(item) {
    return `${item.year}-${item.month}`;
  }

  function render() {
    const all = state.filtered;
    timeline.textContent = '';
    const frag = document.createDocumentFragment();

    const yearCounts = new Map();
    const monthCounts = new Map();
    for (const item of all) {
      yearCounts.set(item.year, (yearCounts.get(item.year) || 0) + 1);
      const key = monthKey(item);
      monthCounts.set(key, (monthCounts.get(key) || 0) + 1);
    }

    let currentYear;
    let currentMonth;
    let yearSection = null;
    let monthBody = null;

    for (const item of all) {
      if (item.year !== currentYear) {
        currentYear = item.year;
        currentMonth = undefined;

        yearSection = document.createElement('section');
        yearSection.className = 'year-group';

        const label = document.createElement('h2');
        label.className = 'year-label';
        if (item.year !== null) label.id = `year-${item.year}`;

        const num = document.createElement('span');
        num.className = 'year-num';
        num.textContent = item.year !== null ? String(item.year) : '年份未知';

        const rule = document.createElement('span');
        rule.className = 'year-rule';
        rule.setAttribute('aria-hidden', 'true');

        const count = document.createElement('span');
        count.className = 'year-count';
        count.textContent = `${yearCounts.get(item.year) || 0} 条`;

        label.append(num, rule, count);
        yearSection.append(label);
        frag.append(yearSection);
      }

      const key = monthKey(item);
      if (key !== currentMonth) {
        currentMonth = key;

        const group = document.createElement('div');
        group.className = 'month-group';

        const bar = document.createElement('h3');
        bar.className = 'month-bar';
        bar.id = `month-${key}`;

        const label = document.createElement('span');
        label.className = 'month-label';
        const yearText = item.year !== null ? `${item.year} 年 ` : '';
        label.textContent = yearText + (item.month ? `${pad2(item.month)} 月` : '日期未知');

        const rule = document.createElement('span');
        rule.className = 'month-rule';
        rule.setAttribute('aria-hidden', 'true');

        const count = document.createElement('span');
        count.className = 'month-count';
        count.textContent = `${monthCounts.get(key) || 0} 条`;

        bar.append(label, rule, count);
        group.append(bar);

        monthBody = document.createElement('div');
        monthBody.className = 'notes';
        group.append(monthBody);
        yearSection.append(group);
      }

      monthBody.append(createNote(item));
    }

    timeline.append(frag);
    emptyEl.hidden = all.length !== 0;
    updateStatus(all.length);
  }

  function updateStatus(total) {
    statusEl.textContent = state.query ? `找到 ${total} 条` : `共 ${total} 条留言`;
  }

  function applyFilter(query) {
    state.query = query.trim();
    const needle = state.query.toLowerCase();
    state.filtered = needle
      ? state.items.filter((item) => item.plain.includes(needle))
      : state.items.slice();
    render();
  }

  function buildYearNav() {
    yearNav.textContent = '';
    const years = [...new Set(state.items.map((item) => item.year))].filter((y) => y !== null);
    if (years.length < 2) return;

    for (const year of years) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'year-link';
      button.textContent = String(year);
      button.addEventListener('click', () => {
        const target = document.getElementById(`year-${year}`);
        if (target) target.scrollIntoView();
      });
      yearNav.append(button);
    }
  }

  function buildMonthMenu() {
    monthGrid.textContent = '';
    const counts = new Map();
    for (const item of state.items) {
      const key = monthKey(item);
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    const years = [...new Set(state.items.map((item) => item.year))]
      .filter((year) => year !== null)
      .sort((a, b) => b - a);

    for (const year of years) {
      const block = document.createElement('section');
      block.className = 'month-year';

      const head = document.createElement('h3');
      head.className = 'month-year-head';
      head.textContent = String(year);

      const months = document.createElement('div');
      months.className = 'month-months';

      for (let month = 12; month >= 1; month -= 1) {
        const key = `${year}-${month}`;
        const count = counts.get(key) || 0;
        const name = CN_MONTHS[month - 1];

        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'month-chip';
        chip.disabled = count === 0;
        chip.setAttribute('aria-label', `${year} 年${name}${count ? `，${count} 条留言` : '，暂无留言'}`);

        const label = document.createElement('span');
        label.className = 'chip-month';
        label.textContent = name;

        const badge = document.createElement('span');
        badge.className = 'chip-count';
        badge.textContent = count ? String(count) : '—';

        chip.append(label, badge);
        if (count) {
          chip.addEventListener('click', () => {
            closeModal(monthDialog, () => jumpToMonth(key));
          });
        }
        months.append(chip);
      }

      block.append(head, months);
      monthGrid.append(block);
    }
  }

  function jumpToMonth(key) {
    if (!key) return;

    if (state.query) {
      searchEl.value = '';
      syncSearchClear();
      state.query = '';
      state.filtered = state.items.slice();
      render();
    }

    const target = document.getElementById(`month-${key}`);
    if (!target) return;

    const group = target.closest('.month-group') || target;

    const scrollToTarget = () => {
      const top = Math.max(
        0,
        group.getBoundingClientRect().top + window.scrollY - toolbarWrap.offsetHeight - 10
      );
      const root = document.documentElement;
      const prevBehavior = root.style.scrollBehavior;
      root.style.scrollBehavior = 'auto';
      window.scrollTo({ top });
      root.style.scrollBehavior = prevBehavior;
    };

    if (reduceMotion) {
      scrollToTarget();
      return;
    }

    jumpVeil.classList.add('is-on');
    setTimeout(() => {
      scrollToTarget();
      jumpVeil.classList.remove('is-on');
      target.classList.remove('is-hit');
      void target.offsetWidth;
      target.classList.add('is-hit');
      target.addEventListener('animationend', () => target.classList.remove('is-hit'), { once: true });
    }, 190);
  }

  function pickRandom() {
    const pool = state.filtered.length ? state.filtered : state.items;
    if (!pool.length) return null;
    if (pool.length === 1) return pool[0];
    let item;
    do {
      item = pool[Math.floor(Math.random() * pool.length)];
    } while (item === state.lastRandom);
    state.lastRandom = item;
    return item;
  }

  function syncScrollLock() {
    document.documentElement.classList.toggle('is-modal-open', !!document.querySelector('dialog[open]'));
  }

  const dialogOrigin = new WeakMap();
  function openModal(el, originEl) {
    if (el.open) return;
    if (originEl) dialogOrigin.set(el, originEl);
    else dialogOrigin.delete(el);
    el.classList.remove('is-closing');
    el.showModal();
    el.focus({ preventScroll: true });
    document.documentElement.classList.add('is-modal-open');
    zoomIn(el, originEl);
  }

  function zoomIn(el, originEl) {
    if (reduceMotion) return;
    const card = el.querySelector('.random-card');
    if (!card) return;

    const to = card.getBoundingClientRect();
    if (!to.width || !to.height) return;

    let frames = null;
    if (originEl) {
      const from = originEl.getBoundingClientRect();
      if (from.width && from.height) {
        frames = [
          {
            transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`,
            opacity: 0
          },
          { opacity: 1, offset: .3 },
          { transform: 'none', opacity: 1 }
        ];
        card.style.transformOrigin = '0 0';
      }
    }
    if (!frames) {
      frames = [
        { transform: 'scale(.9)', opacity: 0 },
        { opacity: 1, offset: .35 },
        { transform: 'none', opacity: 1 }
      ];
      card.style.transformOrigin = '50% 50%';
    }

    card.animate(frames, {
      duration: originEl ? 420 : 340,
      easing: 'cubic-bezier(.22, 1, .36, 1)'
    }).finished.catch(() => {}).then(() => {
      if (!el.open || !el.classList.contains('is-closing')) card.style.transformOrigin = '';
    });
  }

  function closeModal(el, afterClose) {
    if (!el.open || el.classList.contains('is-closing')) return;
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) selection.removeAllRanges();
    if (reduceMotion) {
      el.close();
      if (afterClose) afterClose();
      return;
    }

    const card = el.querySelector('.random-card');
    const originEl = dialogOrigin.get(el) || null;

    if (card && originEl && originEl.isConnected) {
      card.getAnimations().forEach((anim) => anim.cancel());
      const to = card.getBoundingClientRect();
      const from = originEl.getBoundingClientRect();
      if (to.width && to.height && from.width && from.height) {
        el.classList.add('is-closing', 'is-zooming-back');
        card.style.transformOrigin = '0 0';
        card.animate([
          { transform: 'none', opacity: 1 },
          { opacity: 1, offset: .55 },
          {
            transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`,
            opacity: 0
          }
        ], {
          duration: ZOOM_CLOSE_MS,
          easing: 'cubic-bezier(.5, 0, .2, 1)'
        }).finished.catch(() => {}).then(() => {
          card.style.transformOrigin = '';
          el.classList.remove('is-closing', 'is-zooming-back');
          if (el.open) el.close();
          if (afterClose) afterClose();
        });
        return;
      }
    }

    if (card) {
      card.getAnimations().forEach((anim) => anim.cancel());
      card.style.transformOrigin = '';
    }
    el.classList.add('is-closing');
    setTimeout(() => {
      el.classList.remove('is-closing');
      el.close();
      if (afterClose) afterClose();
    }, DIALOG_CLOSE_MS);
  }

  function openNote(item, originEl) {
    fillName(ndName, item.name);
    noteNo.textContent = String(item.no);
    noteNo.setAttribute('aria-label', `第 ${item.no} 条`);
    if (item.date) {
      ndDate.dateTime = item.date;
      ndDate.textContent = `${item.year} 年 ${item.month} 月 ${item.day} 日`;
    } else {
      ndDate.removeAttribute('datetime');
      ndDate.textContent = '日期未知';
    }
    fillContent(ndContent, item.content);
    openModal(noteDialog, originEl);
  }

  function renderRandom(item) {
    fillName(dlgName, item.name);
    randomNo.textContent = String(item.no);
    randomNo.setAttribute('aria-label', `第 ${item.no} 条`);
    if (item.date) {
      dlgDate.dateTime = item.date;
      dlgDate.textContent = `${item.year} 年 ${item.month} 月 ${item.day} 日`;
    } else {
      dlgDate.removeAttribute('datetime');
      dlgDate.textContent = '日期未知';
    }

    fillContent(dlgContent, item.content);
  }

  let swapping = false;
  function showRandom() {
    const item = pickRandom();
    if (!item) return;

    if (!dialog.open) {
      renderRandom(item);
      openModal(dialog, randomBtn);
      return;
    }
    if (swapping || reduceMotion) {
      if (!swapping) renderRandom(item);
      return;
    }

    swapping = true;
    const card = dialog.querySelector('.random-card');
    card.classList.add('is-swapping');
    setTimeout(() => {
      renderRandom(item);
      card.classList.remove('is-swapping');
      swapping = false;
    }, 140);
  }

  function syncToolbarHeight() {
    document.documentElement.style.setProperty('--toolbar-h', `${toolbarWrap.offsetHeight}px`);
  }

  let searchTimer;
  function syncSearchClear() {
    searchClear.hidden = searchEl.value.length === 0;
  }
  searchEl.addEventListener('input', () => {
    syncSearchClear();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => applyFilter(searchEl.value), 120);
  });
  searchEl.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      clearTimeout(searchTimer);
      applyFilter(searchEl.value);
    }
  });
  searchClear.addEventListener('click', () => {
    clearTimeout(searchTimer);
    searchEl.value = '';
    syncSearchClear();
    applyFilter('');
    searchEl.focus({ preventScroll: true });
  });

  function dismissBackdrop(el) {
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) selection.removeAllRanges();
    closeModal(el);
  }

  function bindBackdropDismiss(el) {
    let startX = 0;
    let startY = 0;
    let pressed = false;
    el.addEventListener('pointerdown', (event) => {
      pressed = event.target === el;
      if (pressed) {
        startX = event.clientX;
        startY = event.clientY;
      }
    });
    el.addEventListener('pointerup', (event) => {
      const wasPressed = pressed;
      pressed = false;
      if (!wasPressed || event.target !== el) return;
      if (Math.hypot(event.clientX - startX, event.clientY - startY) > 10) return;
      dismissBackdrop(el);
    });
    el.addEventListener('click', (event) => {
      if (event.target === el) dismissBackdrop(el);
    });
  }

  monthBtn.addEventListener('click', () => openModal(monthDialog, monthBtn));
  randomBtn.addEventListener('click', showRandom);
  againBtn.addEventListener('click', showRandom);

  for (const el of [monthDialog, dialog, noteDialog]) bindBackdropDismiss(el);

  for (const dlg of [monthDialog, dialog, noteDialog]) {
    dlg.addEventListener('close', syncScrollLock);
    dlg.addEventListener('cancel', (event) => {
      if (reduceMotion) return;
      event.preventDefault();
      closeModal(dlg);
    });
  }

  window.addEventListener('resize', syncToolbarHeight);
  if ('ResizeObserver' in window) {
    new ResizeObserver(syncToolbarHeight).observe(toolbarWrap);
  }

  const THEME_KEY = 'letters-theme';
  const themeMetas = document.querySelectorAll('meta[name="theme-color"]');
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

  function applyTheme(theme) {
    const dark = theme === 'dark';
    document.documentElement.dataset.theme = theme;
    themeToggle.setAttribute('aria-label', dark ? '切换到浅色' : '切换到深色');
    themeMetas.forEach((meta) => {
      meta.content = dark ? '#14101d' : '#f3e9ff';
    });
  }

  function readSavedTheme() {
    try { return localStorage.getItem(THEME_KEY); } catch (err) { return null; }
  }

  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

  themeToggle.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try {
      if (next === (systemDark.matches ? 'dark' : 'light')) localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, next);
    } catch (err) {}
  });

  systemDark.addEventListener('change', (event) => {
    if (!readSavedTheme()) applyTheme(event.matches ? 'dark' : 'light');
  });

  function syncToTop() {
    toTopBtn.classList.toggle('is-visible', window.scrollY > 600);
  }
  window.addEventListener('scroll', syncToTop, { passive: true });
  toTopBtn.addEventListener('click', () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  });
  syncToTop();

  async function load() {
    try {
      const response = await fetch('data/message.json', { cache: 'no-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const raw = await response.json();
      if (!Array.isArray(raw)) throw new Error('留言数据格式不正确');

      state.items = parse(raw);

      const years = [...new Set(state.items.map((item) => item.year))]
        .filter((year) => year !== null)
        .sort((a, b) => a - b);

      totalEl.textContent = String(state.items.length);
      rangeEl.textContent = years.length ? `${years[0]} – ${years[years.length - 1]}` : '';
      heroLede.hidden = false;
      randomBtn.disabled = state.items.length === 0;

      buildYearNav();
      buildMonthMenu();
      applyFilter('');
      syncToolbarHeight();
    } catch (error) {
      console.error(error);
      timeline.textContent = '';
      statusEl.textContent = '留言读取失败，请确认通过 http(s) 打开本页面。';
      emptyEl.hidden = true;
    }
  }

  load();
})();
