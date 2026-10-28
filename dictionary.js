'use strict';
/* Словарь: загрузка, поиск, раздел «Словарь», значения слов из проверяемого текста.
   Данные — slovar-data.js: window.SLOVAR = { meta: { letters: [[буква, первая статья], ...], ... },
   e: [[слово по-церковнославянски, транскрипция, толкование (html)], ...] } */
(() => {
  const D = { ready: false, failed: false, loading: null, meta: {}, e: [], kcs: [], ktr: [], full: null, letters: [], letterOf: [], byKey: null, byStem: null };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const S = () => window.SEARCH;
  const stripTags = (s) => String(s).replace(/<\/?(?:i|b|em|strong|span|sup|sub|mark)\b[^>]*>/g, '').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  const words = (s) => s.replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  // ключ: без ударений и старых букв, без ера на конце слова, без дефисов
  const keyOf = (s, x) => words((x ? S().normX(s) : S().norm(s)).replace(/-/g, '')).replace(/ъ(?= |$)/g, '');
  // возможные основы слова: отсекаем окончания имён и глаголов (берём все варианты — так надёжнее)
  const ENDINGS = ['ами', 'ями', 'ахъ', 'ехъ', 'ыхъ', 'ихъ', 'аго', 'яго', 'ого', 'его', 'ому', 'ему', 'ыми', 'ими', 'омъ', 'емъ',
    'ах', 'ях', 'ех', 'ых', 'их', 'ам', 'ям', 'ом', 'ем', 'им', 'ою', 'ею', 'ой', 'ей', 'ый', 'ий', 'ая', 'яя', 'ое', 'ее', 'ые', 'ие', 'ия', 'ью', 'ье',
    'ати', 'яти', 'ити', 'ети', 'ути', 'ыти', 'ти', 'ть', 'иша', 'аша', 'яша', 'еша', 'ихомъ', 'ахомъ', 'исте', 'асте', 'ет', 'ит', 'ут', 'ют', 'ят', 'ат', 'ете', 'ите', 'аше', 'яше', 'ахом', 'аху', 'яху', 'ше', 'ла', 'ло', 'ли', 'л',
    'а', 'я', 'о', 'е', 'у', 'ю', 'ы', 'и', 'ь', 'й'];
  const stemsOf = (k) => {
    const w = (k.split(' ')[0] || '');
    const out = new Set([w]);
    if (w.length >= 4) ENDINGS.forEach((e) => { if (w.endsWith(e) && w.length - e.length >= 3) out.add(w.slice(0, -e.length)); });
    return Array.from(out).sort((a, b) => b.length - a.length);
  };
  const preview = (html, n = 110) => {
    const t = stripTags(html).replace(/\s+/g, ' ').trim();
    return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + '…' : t;
  };
  const add = (map, k, i) => {
    if (!k) return;
    if (!map.has(k)) map.set(k, []);
    const arr = map.get(k);
    if (arr[arr.length - 1] !== i) arr.push(i);
  };

  function prepare(data) {
    D.meta = data.meta || {};
    D.e = data.e || [];
    D.kcs = D.e.map(([cs]) => keyOf(cs));
    D.ktr = D.e.map(([, tr]) => keyOf(tr));
    D.byKey = new Map();
    D.byStem = new Map();
    D.e.forEach((_, i) => {
      [D.kcs[i], D.ktr[i]].forEach((k) => {
        add(D.byKey, k.split(' ')[0], i);
        stemsOf(k).forEach((st) => add(D.byStem, st, i));
      });
    });
    const L = D.meta.letters || [];
    D.letters = L.map(([l]) => l);
    D.letterOf = new Array(D.e.length);
    L.forEach(([l, start], j) => {
      const end = j + 1 < L.length ? L[j + 1][1] : D.e.length;
      for (let i = start; i < end; i++) D.letterOf[i] = l;
    });
    D.ready = true;
  }

  const listeners = [];
  const onReady = (f) => { if (D.ready || D.failed) f(D.ready); else listeners.push(f); };
  function load() {
    if (D.ready) return Promise.resolve(true);
    if (D.loading) return D.loading;
    D.loading = new Promise((resolve) => {
      const done = () => {
        try {
          if (window.SLOVAR && window.SEARCH) { prepare(window.SLOVAR); resolve(true); return; }
        } catch (e) { /* повреждённые данные */ }
        D.failed = true;
        resolve(false);
      };
      if (window.SLOVAR) { done(); return; }
      const s = document.createElement('script');
      s.src = 'slovar-data.js';
      s.onload = done;
      s.onerror = () => { D.failed = true; resolve(false); };
      document.head.appendChild(s);
    }).then((ok) => { listeners.splice(0).forEach((f) => f(ok)); return ok; });
    return D.loading;
  }

  function fullText() {
    if (!D.full) D.full = D.e.map(([cs, tr, b]) => ' ' + keyOf(cs + ' ' + tr + ' ' + stripTags(b)) + ' ');
    return D.full;
  }

  // статьи с той же основой: сначала по самой длинной общей основе
  function stemLookup(variants) {
    const cands = Array.from(new Set(variants.flatMap(stemsOf))).sort((a, b) => b.length - a.length);
    for (const st of cands) if (D.byStem.has(st)) return D.byStem.get(st).slice();
    return null;
  }

  /* поиск: mode 'head' — по слову (по началу), 'text' — по всему тексту статей */
  function find(q, mode = 'head') {
    const none = { total: 0, items: [], how: '' };
    if (!D.ready) return none;
    const raw = String(q).trim();
    const variants = Array.from(new Set([keyOf(raw), keyOf(raw, true)])).filter(Boolean);
    if (!variants.length) return none;
    const isHead = (i, v) => D.kcs[i].startsWith(v) || D.ktr[i].startsWith(v);
    if (mode === 'text') {
      const full = fullText();
      const head = [], rest = [];
      for (let i = 0; i < full.length; i++) {
        if (!variants.some((v) => v.split(' ').every((t) => full[i].includes(' ' + t)))) continue;
        (variants.some((v) => isHead(i, v)) ? head : rest).push(i);
      }
      const items = head.concat(rest);
      return { total: items.length, items, how: 'text' };
    }
    const exact = [], prefix = [];
    for (let i = 0; i < D.e.length; i++) {
      const a = D.kcs[i], b = D.ktr[i];
      if (variants.some((v) => a === v || b === v || a.split(' ')[0] === v || b.split(' ')[0] === v)) exact.push(i);
      else if (variants.some((v) => a.startsWith(v) || b.startsWith(v))) prefix.push(i);
    }
    let items = exact.concat(prefix);
    let how = 'head';
    if (!items.length) {
      // может быть, это форма слова: ищем по основе
      items = stemLookup(variants) || [];
      how = items.length ? 'stem' : 'head';
    }
    return { total: items.length, items, how };
  }

  /* значения слова из текста: точное совпадение, затем по основе; слова под титлом — через список титл */
  const tStem = (p) => p.replace(/[аеиоуыюяьъйѣ]+$/, '');
  const titlaMap = () => {
    if (titlaMap.m) return titlaMap.m;
    titlaMap.m = new Map();
    titlaMap.st = new Map();
    (window.TITLA_FULL || []).forEach(([w, r]) => {
      const p = S().norm(w).replace(/[^\p{L}]/gu, '');
      const reading = String(r).split(/[,;(]/)[0].trim();
      titlaMap.m.set(p, reading);
      const st = tStem(p);
      if (st.length >= 2 && !titlaMap.st.has(st)) titlaMap.st.set(st, reading);
    });
    return titlaMap.m;
  };
  // частые формы, которые не сводятся к словарному слову отсечением окончания (звательный падеж и др.)
  const IRREG = {
    боже: 'бог', отче: 'отец', господи: 'господь', христе: 'христос', иисусе: 'иисус', человече: 'человек', царю: 'царь',
    владыко: 'владыка', сыне: 'сын', спасе: 'спас', творче: 'творец', старче: 'старец', отроче: 'отрок', душе: 'душа',
    богородице: 'богородица', дево: 'дева', мати: 'мати', матере: 'мати', матерь: 'мати', дщи: 'дщерь', дщере: 'дщерь',
    отца: 'отец', отцу: 'отец', отцем: 'отец', отцы: 'отец', отцев: 'отец', агнче: 'агнец', агнца: 'агнец', сердца: 'сердце',
    церкве: 'церковь', церкви: 'церковь', любве: 'любовь', любви: 'любовь', крове: 'кровь', крови: 'кровь', имене: 'имя', имени: 'имя'
  };
  function lookupWord(word) {
    if (!D.ready) return null;
    let k = keyOf(word, true);
    if (!k || k.length < 2) return null;
    const plain = S().norm(word).replace(/[^\p{L}]/gu, '');
    if (titlaMap().has(plain)) k = keyOf(titlaMap().get(plain));
    else if (/[\u0483\u0487\u2DE0-\u2DFF]/.test(word) && titlaMap.st.has(tStem(plain))) k = keyOf(titlaMap.st.get(tStem(plain)));
    const ir = IRREG[k.split(' ')[0]];
    if (ir && D.byKey.has(ir)) return { items: D.byKey.get(ir).slice(0, 3), exact: true };
    const w = k.split(' ')[0];
    if (D.byKey.has(w)) return { items: D.byKey.get(w).slice(0, 3), exact: true };
    const st = stemLookup([w]);
    return st ? { items: st.slice(0, 3), exact: false } : null;
  }

  /* ---------- раздел «Словарь» ---------- */
  const ui = { q: '', mode: 'head', letter: '', items: [], shown: 0, sel: -1, root: null, how: '' };
  const PAGE = 200;
  const num = (n) => n.toLocaleString('ru-RU');

  function lettersHTML() {
    return D.letters.map((L) => `<button class="dl-letter cs${ui.letter === L && !ui.q ? ' on' : ''}" data-dletter="${esc(L)}">${esc(L)}</button>`).join('');
  }

  function shell() {
    return `<div class="dict">
<div class="dict-bar">
  <label class="search infind dict-search"><svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M13 13l4.5 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><input id="dictQ" type="search" placeholder="Слово: благодать, живот, ѻ҆́тче, бг҃ъ…" aria-label="Слово для поиска в словаре" autocomplete="off" spellcheck="false"></label>
  <div class="seg" role="radiogroup" aria-label="Где искать">
    <button class="segbtn" data-dmode="head" role="radio">По слову</button>
    <button class="segbtn" data-dmode="text" role="radio">По тексту толкований</button>
  </div>
</div>
<div class="dict-letters" id="dictLetters" aria-label="Буквы">${lettersHTML()}</div>
<p class="gl dict-count" id="dictCount" aria-live="polite"></p>
<div class="dict-body">
  <div class="dict-list" id="dictList" role="listbox" aria-label="Слова"></div>
  <article class="dict-art card" id="dictArt" aria-live="polite"></article>
</div>
</div>`;
  }

  function itemHTML(i, k) {
    const [cs, tr, b] = D.e[i];
    return `<button class="dict-item${k === ui.sel ? ' sel' : ''}" role="option" data-di="${i}" data-k="${k}"><span class="hw cs">${esc(cs)}</span><span class="pv">${esc(preview(b, 70))}</span></button>`;
  }

  function renderList() {
    const list = ui.root.querySelector('#dictList');
    list.innerHTML = ui.items.slice(0, ui.shown).map((i, k) => itemHTML(i, k)).join('')
      + (ui.items.length > ui.shown ? `<button class="btn ghost small dict-more" data-dmore>Показать ещё ${num(Math.min(PAGE, ui.items.length - ui.shown))}</button>` : '')
      + (!ui.items.length && ui.q ? `<p class="empty dict-empty">Ничего не нашлось.${ui.mode === 'head' ? ' Попробуйте искать «По тексту толкований».' : ''}</p>` : '');
    const n = ui.items.length;
    const cnt = ui.root.querySelector('#dictCount');
    if (ui.q) cnt.textContent = n ? `Найдено: ${num(n)}${ui.how === 'stem' ? ' — похожие слова (такой формы в словаре нет)' : ''}` : '';
    else cnt.textContent = `Буква ${ui.letter}: ${num(n)} · всего в словаре ${num(D.e.length)} слов`;
  }

  function highlight(el) {
    if (!ui.q || ui.mode !== 'text') return;
    const terms = Array.from(new Set([keyOf(ui.q), keyOf(ui.q, true)].join(' ').split(' '))).filter((t) => t.length >= 2);
    if (!terms.length) return;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const text = node.nodeValue;
      const re = /[\p{L}\p{M}]+/gu;
      let m, last = 0, frag = null;
      while ((m = re.exec(text))) {
        if (!terms.some((t) => keyOf(m[0]).startsWith(t))) continue;
        frag = frag || document.createDocumentFragment();
        frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        const mk = document.createElement('mark');
        mk.textContent = m[0];
        frag.appendChild(mk);
        last = m.index + m[0].length;
      }
      if (frag) { frag.appendChild(document.createTextNode(text.slice(last))); node.parentNode.replaceChild(frag, node); }
    });
  }

  function renderArticle(i) {
    const art = ui.root.querySelector('#dictArt');
    if (i === undefined || i === null || !D.e[i]) {
      delete art.dataset.di;
      art.innerHTML = `<p class="kicker">Словарь</p><p class="gl">${ui.q ? 'Измените запрос или выберите букву.' : 'Выберите слово в списке слева.'}</p>`;
      return;
    }
    const [cs, tr, b] = D.e[i];
    const prev = D.e[i - 1], next = D.e[i + 1];
    art.dataset.di = i;
    art.innerHTML = `<p class="kicker">Буква <span class="cs">${esc(D.letterOf[i] || '')}</span> · ${num(i + 1)} из ${num(D.e.length)}</p>
<h2 class="dict-hw cs" data-copy="${esc(cs)}" title="Нажмите, чтобы скопировать">${esc(cs)}</h2>
<p class="dict-tr">${esc(tr)}</p>
<div class="dict-text">${b}</div>
<div class="dict-acts"><button class="btn ghost small" data-dnav="-1"${prev ? '' : ' disabled'} aria-label="Предыдущее слово">← <span class="cs">${prev ? esc(prev[0]) : ''}</span></button><button class="btn ghost small" data-dcopy>Копировать статью</button><button class="btn ghost small" data-dnav="1"${next ? '' : ' disabled'} aria-label="Следующее слово"><span class="cs">${next ? esc(next[0]) : ''}</span> →</button></div>`;
    highlight(art.querySelector('.dict-text'));
    art.scrollTop = 0;
  }

  function select(k, scroll) {
    if (!ui.items.length) { ui.sel = -1; renderArticle(null); return; }
    ui.sel = Math.max(0, Math.min(k, ui.items.length - 1));
    if (ui.sel >= ui.shown) { ui.shown = Math.min(ui.items.length, ui.sel + PAGE); renderList(); }
    ui.root.querySelectorAll('.dict-item').forEach((b) => b.classList.toggle('sel', Number(b.dataset.k) === ui.sel));
    const el = ui.root.querySelector(`.dict-item[data-k="${ui.sel}"]`);
    if (el && scroll) el.scrollIntoView({ block: 'nearest' });
    renderArticle(ui.items[ui.sel]);
  }

  function letterItems(L) {
    const out = [];
    for (let i = 0; i < D.e.length; i++) if (D.letterOf[i] === L) out.push(i);
    return out;
  }

  function update(openIndex) {
    if (ui.q) {
      const r = find(ui.q, ui.mode);
      ui.items = r.items;
      ui.how = r.how;
    } else {
      ui.how = '';
      ui.items = letterItems(ui.letter);
    }
    ui.shown = Math.min(PAGE, ui.items.length);
    ui.sel = -1;
    ui.root.querySelectorAll('.segbtn').forEach((b) => { const on = b.dataset.dmode === ui.mode; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
    ui.root.querySelector('#dictLetters').innerHTML = lettersHTML();
    renderList();
    let k = 0;
    if (openIndex !== undefined && openIndex !== null && D.e[openIndex]) {
      k = ui.items.indexOf(openIndex);
      if (k < 0) { ui.items.unshift(openIndex); ui.shown = Math.min(ui.items.length, ui.shown + 1); renderList(); k = 0; }
    }
    select(k, true);
  }

  function goEntry(i) {
    if (!D.e[i]) return;
    const k = ui.items.indexOf(i);
    if (k >= 0) { select(k, true); return; }
    ui.q = '';
    ui.root.querySelector('#dictQ').value = '';
    ui.letter = D.letterOf[i];
    update(i);
  }

  function mount(root, opts = {}) {
    ui.root = root;
    if (!D.ready) {
      root.innerHTML = `<div class="card dict-wait"><p class="gl">${D.failed ? 'Файл словаря не найден — переустановите программу.' : 'Загружаю словарь…'}</p></div>`;
      if (!D.failed) load().then(() => { if (ui.root === root && root.isConnected) mount(root, opts); });
      return;
    }
    root.innerHTML = shell();
    if (!ui.letter) ui.letter = D.letters[0];
    if (opts.mode) ui.mode = opts.mode;
    if (opts.q !== undefined) ui.q = String(opts.q);
    if (opts.open !== undefined && opts.open !== null && !ui.q) ui.letter = D.letterOf[opts.open] || ui.letter;
    const input = root.querySelector('#dictQ');
    input.value = ui.q;
    let t = null;
    input.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => { ui.q = input.value.trim(); update(); }, ui.mode === 'text' ? 250 : 90);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { select(ui.sel + 1, true); e.preventDefault(); }
      if (e.key === 'ArrowUp') { select(ui.sel - 1, true); e.preventDefault(); }
      if (e.key === 'Escape' && input.value) { input.value = ''; ui.q = ''; update(); e.stopPropagation(); }
    });
    root.addEventListener('click', (e) => {
      const it = e.target.closest('.dict-item');
      if (it) { select(Number(it.dataset.k), false); return; }
      const L = e.target.closest('[data-dletter]');
      if (L) { ui.letter = L.dataset.dletter; ui.q = ''; input.value = ''; update(); return; }
      const m = e.target.closest('[data-dmode]');
      if (m) { ui.mode = m.dataset.dmode; update(); input.focus(); return; }
      if (e.target.closest('[data-dmore]')) { ui.shown = Math.min(ui.items.length, ui.shown + PAGE); renderList(); return; }
      const nv = e.target.closest('[data-dnav]');
      if (nv) { goEntry(Number(root.querySelector('#dictArt').dataset.di) + Number(nv.dataset.dnav)); return; }
      if (e.target.closest('[data-dcopy]')) {
        const i = Number(root.querySelector('#dictArt').dataset.di);
        const en = D.e[i];
        if (en && window.APP) window.APP.copy(`${en[0]} (${en[1]}) — ${stripTags(en[2].replace(/<\/p>/g, ' ')).replace(/\s+/g, ' ').trim()}`);
      }
    });
    update(opts.open);
    if (opts.focus !== false) input.focus();
  }

  // слово, набранное по-русски, — церковнославянское заглавное слово словаря (точное совпадение, одно слово)
  function csForm(word) {
    if (!D.ready) return null;
    const k = keyOf(word);
    const list = D.byKey.get(k) || [];
    const i = list.find((j) => (D.ktr[j] === k || D.kcs[j] === k) && !/\s/.test(D.e[j][0]) && !/[\u0483\u2DE0-\u2DFF]/.test(D.e[j][0]));
    return i === undefined ? null : D.e[i][0];
  }

  window.DICT = {
    load, onReady, find, lookupWord, mount, preview, csForm,
    get ready() { return D.ready; },
    get failed() { return D.failed; },
    get size() { return D.e.length; },
    get meta() { return D.meta; },
    entry: (i) => D.e[i]
  };
})();
