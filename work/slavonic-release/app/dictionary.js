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
  // Оба представления статьи используют одни данные и разрешённую разметку словаря.
  function articleBody(html) {
    const source = document.createElement('template');
    source.innerHTML = String(html);
    const allowed = new Set(['P', 'B', 'I', 'EM', 'STRONG', 'SPAN', 'SUP', 'SUB', 'BR']);
    const copy = (node) => {
      if (node.nodeType === 3) return document.createTextNode(node.nodeValue);
      if (node.nodeType !== 1 || ['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT'].includes(node.tagName)) return document.createDocumentFragment();
      const target = allowed.has(node.tagName) ? document.createElement(node.tagName.toLowerCase()) : document.createDocumentFragment();
      if (target.nodeType === 1) {
        const classes = Array.from(node.classList).filter((name) => name === 'csq' || name === 'sn');
        if (classes.length) target.className = classes.join(' ');
      }
      node.childNodes.forEach((child) => target.appendChild(copy(child)));
      return target;
    };
    const output = document.createElement('div');
    source.content.childNodes.forEach((node) => output.appendChild(copy(node)));
    return output.innerHTML;
  }
  const articleText = (entry) => `${entry[0]} (${entry[1]}) — ${stripTags(entry[2].replace(/<\/p>/g, ' ')).replace(/\s+/g, ' ').trim()}`;
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
  function morphology() {
    if (!D.ready || !window.MORPH) return null;
    window.MORPH.prepare(D.e);
    return window.MORPH;
  }
  function morphologyWord(word, expanded = window.TITLA_CONV?.expandWord?.(word)) {
    const value = expanded?.out || word;
    // Ударение, добавленное конвертером к сокращённой основе, не является
    // ударением пользователя. Для исходного слова без ударения ищем без него.
    return expanded?.out && !/[\u0300\u0301\u0311]/.test(String(word).normalize('NFD'))
      ? value.normalize('NFD').replace(/[\u0300\u0301\u0311]/g, '') : value;
  }
  // Составная статья «Сынъ Человѣческїй» не создаёт омоним для отдельного «сынъ».
  function exactEntries(key) {
    const items = D.byKey.get(key) || [];
    const whole = items.filter((i) => D.kcs[i] === key || D.ktr[i] === key);
    return (whole.length ? whole : items).slice();
  }
  function lookupWord(word) {
    if (!D.ready) return null;
    let k = keyOf(word, true);
    if (!k || k.length < 2) return null;
    // Конвертер знает сокращённые основы и производные (бл҃гослови́ → благослови́).
    // Раскрытие не делает совпадение по основе точной словарной статьёй.
    const expanded = window.TITLA_CONV?.expandWord?.(word);
    if (expanded?.out) k = keyOf(expanded.out, true);
    else {
      const plain = S().norm(word).replace(/[^\p{L}]/gu, '');
      if (titlaMap().has(plain)) k = keyOf(titlaMap().get(plain));
      else if (/[\u0483\u0487\u2DE0-\u2DFF]/.test(word) && titlaMap.st.has(tStem(plain))) k = keyOf(titlaMap.st.get(tStem(plain)));
    }
    if (k.includes(' ')) {
      const items = [];
      D.e.forEach((_, i) => { if (D.kcs[i] === k || D.ktr[i] === k) items.push(i); });
      if (items.length) return { items, exact: true };
      const similar = find(word);
      return similar.items.length ? { items: similar.items, exact: false } : null;
    }
    const analysis = morphology()?.analyze(morphologyWord(word, expanded));
    if (analysis?.analyses.length) {
      // Словоформа может совпасть с отдельным заголовком другого слова.
      // Сохраняем обе реальные статьи, а не отдаём приоритет генератору.
      const lexical = exactEntries(k).filter((i) => D.kcs[i] === k || D.ktr[i] === k);
      return {
        items: Array.from(new Set([...lexical, ...analysis.analyses.map((a) => a.entryIndex)])),
        exact: true, analyses: analysis.analyses, how: 'form'
      };
    }
    const ir = IRREG[k.split(' ')[0]];
    if (ir && D.byKey.has(ir)) return { items: exactEntries(ir), exact: true };
    const w = k.split(' ')[0];
    if (D.byKey.has(w)) return { items: exactEntries(w), exact: true };
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
<div class="dict-text">${articleBody(b)}</div>
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
        if (en && window.APP) window.APP.copy(articleText(en));
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

  /* Полная статья поверх текущего раздела; состояние редактора и словаря не меняется. */
  const popup = { dialog: null, index: -1, returnFocus: null, selection: null, ranges: [], request: 0, query: '', paradigm: null, number: 'sg' };
  const NUMBERS = { sg: 'Ед. число', du: 'Дв. число', pl: 'Мн. число' };
  const CASE_QUESTIONS = {
    nominative: 'кто? что?', genitive: 'кого? чего?', dative: 'кому? чему?',
    accusative: 'кого? что?', instrumental: 'кем? чем?', locative: 'о ком? о чём?', vocative: 'обращение'
  };

  function formContextHTML(paradigm) {
    if (!popup.query || !paradigm?.matches.length) return '';
    const labels = Array.from(new Set(paradigm.matches.map((match) => `${match.caseLabel} · ${match.numberLabel}`)));
    return `<div class="dictionary-form-context"><p>В тексте <span class="cs">${esc(popup.query)}</span></p>
<ul>${labels.map((label) => `<li>${esc(label)}</li>`).join('')}</ul>
${labels.length > 1 ? '<p class="dictionary-form-ambiguity">Окончательный разбор зависит от предложения.</p>' : ''}</div>`;
  }

  function renderMorphology() {
    const root = makePopup().querySelector('.dictionary-popup-morphology');
    const p = popup.paradigm;
    root.hidden = !p;
    root.innerHTML = '';
    if (!p) return;
    root.innerHTML = `<section class="dictionary-declension" aria-labelledby="dictionaryDeclensionTitle">
<div class="dictionary-declension-heading"><h3 id="dictionaryDeclensionTitle">Склонение</h3><span>${esc(p.label || p.type)}</span></div>
${p.explanation ? `<p class="dictionary-declension-note">${esc(p.explanation)}</p>` : ''}
<div class="dictionary-number-tabs" role="tablist" aria-label="Число существительного">${Object.entries(NUMBERS).map(([number, label]) => `<button type="button" role="tab" id="dictionaryNumber-${number}" data-morph-number="${number}" aria-controls="dictionaryDeclensionPanel" aria-selected="${number === popup.number}" tabindex="${number === popup.number ? 0 : -1}">${label}</button>`).join('')}</div>
<div id="dictionaryDeclensionPanel" role="tabpanel" aria-labelledby="dictionaryNumber-${popup.number}"></div>
<p class="dictionary-morph-source"></p></section>`;
    const source = root.querySelector('.dictionary-morph-source');
    const sourceURL = typeof p.source === 'string' ? p.source : p.source?.url;
    const sourceLabel = typeof p.source === 'object' ? p.source.label || p.source.title : '';
    if (sourceURL && /^https:\/\/azbyka\.ru\//.test(sourceURL)) {
      const a = document.createElement('a');
      a.href = sourceURL; a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.textContent = sourceLabel || 'Кравецкий, Плетнёва · таблицы склонения ↗';
      source.appendChild(a);
    }
    const limitations = Array.isArray(p.limitations) ? p.limitations : p.limitations ? [p.limitations] : [];
    if (limitations.length) {
      const note = document.createElement('span');
      note.textContent = limitations.join(' '); source.appendChild(note);
    }
    renderMorphNumber();
  }

  function renderMorphNumber() {
    const p = popup.paradigm;
    if (!p) return;
    const dialog = makePopup(), number = popup.number;
    dialog.querySelectorAll('[data-morph-number]').forEach((button) => {
      const on = button.dataset.morphNumber === number;
      button.setAttribute('aria-selected', String(on)); button.tabIndex = on ? 0 : -1;
    });
    const panel = dialog.querySelector('#dictionaryDeclensionPanel');
    panel.setAttribute('aria-labelledby', `dictionaryNumber-${number}`);
    const matches = p.matches.filter((match) => match.number === number);
    panel.innerHTML = `<div class="dictionary-morph-detail" aria-live="polite"></div>
<table class="dictionary-declension-table"><thead><tr><th scope="col">Падеж</th><th scope="col">Форма</th></tr></thead><tbody>${p.rows.map((row, rowIndex) => {
      const hit = matches.some((match) => match.case === row.case);
      return `<tr${hit ? ' class="dictionary-form-hit"' : ''}><th scope="row">${esc(row.label)}<span>${esc(CASE_QUESTIONS[row.case] || '')}</span>${hit ? '<small>Форма из текста</small>' : ''}</th><td>${(row[number] || []).map((form, formIndex) => `<button type="button" class="cs dictionary-paradigm-form" data-morph-row="${rowIndex}" data-morph-form="${formIndex}" aria-pressed="false" aria-label="${esc(form + ' — ' + row.label)}">${esc(form)}</button>`).join('<span class="dictionary-form-separator"> / </span>') || '—'}</td></tr>`;
    }).join('')}</tbody></table>`;
    const first = matches[0];
    const row = first ? p.rows.findIndex((item) => item.case === first.case) : 0;
    const forms = p.rows[row]?.[number] || [];
    const index = Math.max(0, forms.indexOf(first?.form));
    showMorphDetail(row, index);
  }

  function showMorphDetail(rowIndex, formIndex) {
    const p = popup.paradigm;
    const row = p?.rows[rowIndex], form = row?.[popup.number]?.[formIndex];
    if (!form) return;
    const dialog = makePopup();
    const match = p.matches.find((item) => item.number === popup.number && item.case === row.case && item.form === form)
      || window.MORPH?.explain(p.entryIndex, popup.number, row.case, form);
    const description = match?.explanation || row.explanations?.[popup.number]?.[formIndex] || `${row.label}. ${CASE_QUESTIONS[row.case] || ''}`;
    dialog.querySelector('.dictionary-morph-detail').innerHTML = `<p><span class="cs">${esc(form)}</span><span>${esc(row.label)} · ${esc(NUMBERS[popup.number])}</span></p>
<div>${esc(description)}</div>${match?.stem !== undefined && match?.ending !== undefined ? `<div class="dictionary-form-parts">Основа <span class="cs">${esc(match.stem || '—')}</span> · окончание <span class="cs">${esc(match.ending || 'нулевое')}</span>${match.augmentation ? ` · наращение <span class="cs">-${esc(match.augmentation)}-</span>` : ''}</div>` : ''}`;
    dialog.querySelectorAll('[data-morph-row]').forEach((button) => button.setAttribute('aria-pressed', String(Number(button.dataset.morphRow) === rowIndex && Number(button.dataset.morphForm) === formIndex)));
  }

  function makePopup() {
    if (popup.dialog) return popup.dialog;
    const dialog = document.createElement('dialog');
    dialog.className = 'dictionary-popup';
    dialog.setAttribute('aria-labelledby', 'dictionaryPopupTitle');
    dialog.setAttribute('aria-describedby', 'dictionaryPopupTranscription');
    dialog.innerHTML = `<div class="dictionary-popup-shell">
<header class="dictionary-popup-head"><div><h2 id="dictionaryPopupTitle" class="cs"></h2><p id="dictionaryPopupTranscription"></p></div><button type="button" class="dictionary-popup-close" aria-label="Закрыть словарную статью" autofocus>×</button></header>
<div class="dictionary-popup-scroll" tabindex="0" role="region" aria-label="Толкование и формы слова"><div class="dictionary-popup-context"></div><div class="dict-text"></div><div class="dictionary-popup-morphology" hidden></div></div>
<footer class="dictionary-popup-foot"><button type="button" class="btn ghost small" data-popup-copy>Копировать статью</button><button type="button" class="btn small" data-popup-close>Закрыть</button></footer>
</div>`;
    const close = () => dialog.close();
    dialog.querySelector('.dictionary-popup-close').addEventListener('click', close);
    dialog.querySelector('[data-popup-close]').addEventListener('click', close);
    dialog.querySelector('[data-popup-copy]').addEventListener('click', () => {
      if (D.e[popup.index] && window.APP) window.APP.copy(articleText(D.e[popup.index]));
    });
    dialog.addEventListener('click', (event) => {
      const number = event.target.closest('[data-morph-number]');
      if (number) { popup.number = number.dataset.morphNumber; renderMorphNumber(); return; }
      const form = event.target.closest('[data-morph-row]');
      if (form) { showMorphDetail(Number(form.dataset.morphRow), Number(form.dataset.morphForm)); return; }
      const entry = event.target.closest('[data-popup-entry]');
      if (!entry) return;
      showPopupArticle(Number(entry.dataset.popupEntry));
      dialog.querySelector('.dictionary-popup-close').focus({ preventScroll: true });
    });
    dialog.addEventListener('keydown', (event) => {
      const tab = event.target.closest('[data-morph-number]');
      if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      const numbers = Object.keys(NUMBERS), current = numbers.indexOf(popup.number);
      const i = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (current + (event.key === 'ArrowRight' ? 1 : 2)) % 3;
      popup.number = numbers[i]; renderMorphNumber();
      dialog.querySelector(`[data-morph-number="${popup.number}"]`).focus(); event.preventDefault();
    });
    let pressedOutside = false;
    const outside = (event) => {
      const box = dialog.getBoundingClientRect();
      return event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom);
    };
    dialog.addEventListener('pointerdown', (event) => { pressedOutside = outside(event); });
    dialog.addEventListener('click', (event) => { if (pressedOutside && outside(event)) close(); pressedOutside = false; });
    dialog.addEventListener('close', () => {
      const target = popup.returnFocus;
      if (target?.isConnected) {
        target.focus({ preventScroll: true });
        if (popup.selection && typeof target.setSelectionRange === 'function') {
          target.setSelectionRange(...popup.selection);
        }
      }
      const ranges = popup.ranges.filter((range) => range.startContainer.isConnected && range.endContainer.isConnected);
      if (ranges.length) {
        const selection = window.getSelection();
        selection.removeAllRanges();
        ranges.forEach((range) => selection.addRange(range));
      }
      popup.returnFocus = null;
      popup.selection = null;
      popup.ranges = [];
    });
    document.body.appendChild(dialog);
    popup.dialog = dialog;
    return dialog;
  }

  function showPopupArticle(index) {
    if (!D.e[index]) return;
    const dialog = makePopup();
    const [cs, tr, body] = D.e[index];
    popup.index = index;
    popup.paradigm = morphology()?.paradigm(index, morphologyWord(popup.query)) || null;
    popup.number = popup.paradigm?.matches[0]?.number || 'sg';
    dialog.querySelector('#dictionaryPopupTitle').textContent = cs;
    dialog.querySelector('#dictionaryPopupTranscription').textContent = tr;
    const text = dialog.querySelector('.dict-text');
    text.innerHTML = articleBody(body);
    // Однословное толкование вроде «небо» уже видно под заголовком.
    text.hidden = stripTags(body).trim().toLowerCase() === String(tr).trim().toLowerCase();
    dialog.querySelector('.dictionary-popup-context').innerHTML = formContextHTML(popup.paradigm);
    renderMorphology();
    dialog.querySelector('[data-popup-copy]').hidden = false;
    dialog.querySelector('.dictionary-popup-scroll').scrollTop = 0;
  }

  function showPopupResults(query, result, failed) {
    const dialog = makePopup();
    const items = (result?.items || []).slice(0, 12);
    popup.index = -1;
    popup.paradigm = null;
    dialog.querySelector('.dict-text').hidden = false;
    dialog.querySelector('.dictionary-popup-context').innerHTML = '';
    renderMorphology();
    dialog.querySelector('#dictionaryPopupTitle').textContent = query;
    dialog.querySelector('#dictionaryPopupTranscription').textContent = failed ? 'Не удалось загрузить словарь' : items.length ? 'Выберите словарную статью' : 'Статья не найдена';
    const explanation = failed ? 'Проверьте, доступен ли файл словаря, и попробуйте ещё раз.'
      : !items.length ? 'В словаре Дьяченко не нашлось статьи для этого слова. Попробуйте начальную форму или поиск по тексту толкований в полном словаре.'
        : result.exact ? 'Для этого слова есть несколько статей.' : 'Точной статьи для этой формы нет. Ниже — возможные совпадения по основе слова.';
    dialog.querySelector('.dict-text').innerHTML = `<p class="dictionary-popup-message">${esc(explanation)}</p>`
      + items.map((i) => { const [cs, tr, body] = D.e[i]; return `<button type="button" class="dictionary-popup-match" data-popup-entry="${i}"><span class="cs">${esc(cs)}</span><span>${esc(tr)}</span><small>${esc(preview(body, 120))}</small></button>`; }).join('');
    dialog.querySelector('[data-popup-copy]').hidden = true;
    dialog.querySelector('.dictionary-popup-scroll').scrollTop = 0;
  }

  async function openPopup(entryOrQuery, options = {}) {
    if (typeof entryOrQuery !== 'number' && typeof entryOrQuery !== 'string') return false;
    const request = ++popup.request;
    const returnFocus = document.activeElement;
    const selection = typeof returnFocus?.selectionStart === 'number'
      ? [returnFocus.selectionStart, returnFocus.selectionEnd, returnFocus.selectionDirection || 'none'] : null;
    const selectedText = window.getSelection();
    const ranges = selectedText && !selectedText.isCollapsed
      ? Array.from({ length: selectedText.rangeCount }, (_, i) => selectedText.getRangeAt(i).cloneRange()) : [];
    const ready = D.ready || await load();
    if (request !== popup.request) return false;
    popup.query = typeof entryOrQuery === 'string' ? entryOrQuery.trim() : String(options.word || '').trim();
    let index = entryOrQuery;
    let result = null;
    if (typeof index === 'string') {
      const query = index.trim();
      if (!query) return false;
      result = ready ? lookupWord(query) : null;
      if (ready && !result) result = { items: find(query).items, exact: false };
      index = result?.exact && result.items.length === 1 ? result.items[0] : null;
      if (index === null) showPopupResults(query, result, !ready);
    }
    if (index !== null && (!Number.isInteger(index) || !D.e[index])) return false;
    const dialog = makePopup();
    if (index !== null) showPopupArticle(index);
    if (!dialog.open) {
      popup.returnFocus = returnFocus;
      popup.selection = selection;
      popup.ranges = ranges;
      dialog.showModal();
    }
    return true;
  }

  window.DICT = {
    load, onReady, find, lookupWord, mount, preview, csForm, openPopup,
    get ready() { return D.ready; },
    get failed() { return D.failed; },
    get size() { return D.e.length; },
    get meta() { return D.meta; },
    entry: (i) => D.e[i]
  };
})();
