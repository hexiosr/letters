(() => {
  'use strict';

  const timeline = document.getElementById('timeline');
  const statusEl = document.getElementById('search-status');
  const emptyEl = document.getElementById('empty');
  const searchEl = document.getElementById('search');
  const monthJump = document.getElementById('month-jump');
  const randomBtn = document.getElementById('random-btn');
  const dialog = document.getElementById('random-dialog');
  const dlgName = document.getElementById('random-name');
  const dlgDate = document.getElementById('random-date');
  const dlgContent = document.getElementById('random-content');
  const againBtn = document.getElementById('random-again');
  const closeBtn = document.getElementById('random-close');
  const noteDialog = document.getElementById('note-dialog');
  const ndName = document.getElementById('note-dialog-name');
  const ndDate = document.getElementById('note-dialog-date');
  const ndContent = document.getElementById('note-dialog-content');
  const ndClose = document.getElementById('note-dialog-close');
  const totalEl = document.getElementById('total-count');
  const rangeEl = document.getElementById('year-range');
  const heroLede = document.getElementById('hero-lede');
  const yearNav = document.getElementById('year-nav');
  const toolbarWrap = document.getElementById('toolbar-wrap');
  const toTopBtn = document.getElementById('to-top');

  const state = { items: [], filtered: [], query: '', lastRandom: null };

  const THEMES = {
    glass: { name: '白玻璃', color: '#e7edf7' },
    'glass-dark': { name: '黑玻璃', color: '#0d1016' }
  };
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const themeButtons = Array.from(document.querySelectorAll('[data-theme-btn]'));
  const paletteCurrent = document.getElementById('palette-current');

  function applyTheme(id) {
    if (!THEMES[id]) id = 'glass';
    document.documentElement.dataset.theme = id;
    for (const button of themeButtons) {
      button.setAttribute('aria-pressed', String(button.dataset.themeBtn === id));
    }
    if (themeMeta) themeMeta.content = THEMES[id].color;
    if (paletteCurrent) paletteCurrent.textContent = THEMES[id].name;
  }

  for (const button of themeButtons) {
    button.addEventListener('click', () => {
      applyTheme(button.dataset.themeBtn);
      try {
        localStorage.setItem('message-theme', button.dataset.themeBtn);
      } catch (error) {}
    });
  }

  applyTheme(document.documentElement.dataset.theme || 'glass');

  const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pad2 = (n) => String(n).padStart(2, '0');

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
    return items;
  }

  function splitName(name) {
    const match = /^(.*?)@([0-9a-f]{4,})$/i.exec(name);
    if (!match) return { main: name, handle: '' };
    return { main: match[1] || '匿名', handle: '@' + match[2] };
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
    if (name.handle) {
      const handle = document.createElement('span');
      handle.className = 'note-handle';
      handle.textContent = name.handle;
      nameEl.append(handle);
    }

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

    note.append(head, content);

    note.addEventListener('click', () => {
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) return;
      openNote(item);
    });
    note.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openNote(item);
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
        timeline.append(yearSection);
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

  function buildMonthJump() {
    monthJump.textContent = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '跳到年月…';
    monthJump.append(placeholder);

    let group = null;
    let groupYear;
    let lastKey;

    for (const item of state.items) {
      const key = monthKey(item);
      if (key === lastKey) continue;
      lastKey = key;

      if (item.year !== groupYear) {
        groupYear = item.year;
        group = document.createElement('optgroup');
        group.label = item.year !== null ? `${item.year} 年` : '年份未知';
        monthJump.append(group);
      }

      const option = document.createElement('option');
      option.value = key;
      option.textContent = item.month ? `${pad2(item.month)} 月` : '日期未知';
      group.append(option);
    }
  }

  function jumpToMonth(key) {
    if (!key) return;

    if (state.query) {
      searchEl.value = '';
      state.query = '';
      state.filtered = state.items.slice();
      render();
    }

    const target = document.getElementById(`month-${key}`);
    if (target) target.scrollIntoView();
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

  function openNote(item) {
    ndName.textContent = item.name;
    if (item.date) {
      ndDate.dateTime = item.date;
      ndDate.textContent = item.date;
    } else {
      ndDate.removeAttribute('datetime');
      ndDate.textContent = '日期未知';
    }
    fillContent(ndContent, item.content);
    if (!noteDialog.open) noteDialog.showModal();
  }

  function showRandom() {
    const item = pickRandom();
    if (!item) return;

    dlgName.textContent = item.name;
    if (item.date) {
      dlgDate.dateTime = item.date;
      dlgDate.textContent = item.date;
    } else {
      dlgDate.removeAttribute('datetime');
      dlgDate.textContent = '日期未知';
    }

    fillContent(dlgContent, item.content);
    if (!dialog.open) dialog.showModal();
  }

  function syncToolbarHeight() {
    document.documentElement.style.setProperty('--toolbar-h', `${toolbarWrap.offsetHeight}px`);
  }

  let searchTimer;
  searchEl.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => applyFilter(searchEl.value), 120);
  });
  searchEl.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      clearTimeout(searchTimer);
      applyFilter(searchEl.value);
    }
  });

  monthJump.addEventListener('change', () => {
    jumpToMonth(monthJump.value);
    monthJump.value = '';
  });

  randomBtn.addEventListener('click', showRandom);
  againBtn.addEventListener('click', showRandom);
  closeBtn.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  ndClose.addEventListener('click', () => noteDialog.close());
  noteDialog.addEventListener('click', (event) => {
    if (event.target === noteDialog) noteDialog.close();
  });

  window.addEventListener('resize', syncToolbarHeight);
  if ('ResizeObserver' in window) {
    new ResizeObserver(syncToolbarHeight).observe(toolbarWrap);
  }

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
      const response = await fetch('message.json', { cache: 'no-cache' });
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
      buildMonthJump();
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
