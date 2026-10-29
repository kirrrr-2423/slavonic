'use strict';
(() => {
  const api = window.slavApi || null;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* хранилище недоступно */ } }
  };
  const state = { section: 'azbuka', letter: Number(store.get('cs-demo-letter', 0)) || 0 };

  /* ---------- уведомление и копирование ---------- */
  let toastTimer = null;
  function toast(html) {
    const t = $('#toast');
    t.innerHTML = html;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 1600);
  }
  async function copy(text) {
    if (!text) return;
    try {
      if (api) await api.copy(text);
      else {
        let copied = false;
        if (navigator.clipboard && window.isSecureContext) {
          try { await navigator.clipboard.writeText(text); copied = true; } catch (e) {}
        }
        if (!copied) {
          const field = document.createElement('textarea');
          field.value = text; field.style.cssText = 'position:fixed;top:-1000px';
          document.body.appendChild(field); field.select();
          copied = document.execCommand('copy'); field.remove();
          if (!copied) throw new Error('copy failed');
        }
      }
      toast(`Скопировано: <span class="cs">${esc(text.length > 40 ? text.slice(0, 40) + '…' : text)}</span>`);
    } catch (e) { toast('Не удалось скопировать'); }
  }
  window.APP = { toast, copy, go: (id) => go(id) };
  const DICT = () => window.DICT;
  let dictOpts = null;
  function openDict(opts) { dictOpts = opts || {}; go('slovar'); }

  /* ---------- цифирь ---------- */
  const TITLO = '҃';
  const THOUS = '҂';
  const U = ['', 'а', 'в', 'г', 'д', 'є', 'ѕ', 'з', 'и', 'ѳ'];
  const T = ['', 'і', 'к', 'л', 'м', 'н', 'ѯ', 'ѻ', 'п', 'ч'];
  const H = ['', 'р', 'с', 'т', 'у', 'ф', 'х', 'ѱ', 'ѿ', 'ц'];
  const VAL = { а: 1, в: 2, г: 3, д: 4, е: 5, є: 5, ѕ: 6, з: 7, и: 8, ѳ: 9, і: 10, ї: 10, к: 20, л: 30, м: 40, н: 50, ѯ: 60, о: 70, ѻ: 70, п: 80, ч: 90, р: 100, с: 200, т: 300, у: 400, ꙋ: 400, ф: 500, х: 600, ѱ: 700, ѿ: 800, ѡ: 800, ц: 900 };

  function groupLetters(g) {
    const h = Math.floor(g / 100), t = Math.floor((g % 100) / 10), u = g % 10;
    const out = [];
    if (h) out.push([H[h], h * 100]);
    if (t === 1 && u > 0) { out.push([U[u], u]); out.push(['і', 10]); }
    else { if (t) out.push([T[t], t * 10]); if (u) out.push([U[u], u]); }
    return out;
  }
  function toCS(n) {
    if (!Number.isInteger(n) || n < 1 || n > 999999) return null;
    const th = Math.floor(n / 1000);
    const parts = groupLetters(th).map(([l, v]) => [THOUS + l, v * 1000]).concat(groupLetters(n % 1000));
    const idx = parts.length === 1 ? 0 : parts.length - 2;
    const text = parts.map(([l], i) => (i === idx ? l + TITLO : l)).join('');
    return { text, parts };
  }
  function fromCS(s) {
    const clean = String(s).normalize('NFC').toLowerCase()
      .replace(/ᲂ/g, '')
      .replace(/оу/g, 'у')
      .replace(/[̀-ͯ҃-҉ⷠ-ⷿ꙰-꙲\s.,·\-]/g, '');
    if (!clean) return { error: 'пусто' };
    let sum = 0, mult = 1;
    for (const ch of clean) {
      if (ch === THOUS) { mult *= 1000; continue; }
      const v = VAL[ch];
      if (v === undefined) return { error: ch };
      sum += v * mult;
      mult = 1;
    }
    return { value: sum };
  }
  window.CIFIR = { toCS, fromCS };

  /* ---------- поиск ---------- */
  const stripTags = (s) => String(s).replace(/<[^>]+>/g, ' ');
  const norm = (s) => String(s).normalize('NFD')
    .replace(/[̀-ͯ҃-҉ⷠ-ⷿ꙰-ꙿ]/g, '')
    .toLowerCase()
    .replace(/[ѣєё]/g, 'е').replace(/[ѧꙗ]/g, 'я').replace(/[ѡѻᲂ]/g, 'о').replace(/ꙋ/g, 'у')
    .replace(/[іїѵ]/g, 'и').replace(/ѕ/g, 'з').replace(/ѳ/g, 'ф').replace(/ѯ/g, 'кс')
    .replace(/ѱ/g, 'пс').replace(/ѿ/g, 'от');

  // буквы над строкой (буквенные титла) → обычные буквы: гдⷭ҇ь → гдсь
  const SUPER_LIST = ['б', 'в', 'г', 'д', 'ж', 'з', 'к', 'л', 'м', 'н', 'о', 'п', 'р', 'с', 'т', 'х', 'ц', 'ч', 'ш', 'щ', 'ф', 'ст', 'а', 'е', 'у', 'у', 'е', 'ю', 'я', 'я', 'у', 'ю'];
  const expandSup = (s) => String(s).replace(/[ⷠ-ⷿ]/g, (c) => SUPER_LIST[c.charCodeAt(0) - 0x2de0] || '');
  const normX = (s) => norm(expandSup(s));
  const words = (s) => s.replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  // текст для поиска: слова через пробел, с пробелом в начале — так ищем по началу слова
  const both = (s) => ' ' + words(norm(s) + ' ' + normX(s)) + ' ';
  const queryVariants = (raw) => Array.from(new Set([words(norm(raw)), words(normX(raw))])).filter(Boolean);
  const matches = (text, variant) => variant.split(' ').map(stem).every((t) => text.includes(' ' + t));
  // грубое отсечение окончаний, чтобы «причастие» находило «причастия»
  const stem = (t) => (t.length >= 6 ? t.replace(/(ами|ями|ого|его|ому|ему|ыми|ими|ой|ей|ий|ый|ая|яя|ое|ее|ие|ые|ия|ья|ов|ев|ам|ям|ах|ях|ом|ем|ы|и|а|я|о|е|у|ю|ь)$/, '') : t);

  const INDEX = [];
  SECTIONS.forEach((s) => INDEX.push({ kind: 'section', s, text: both(`${s.title} ${stripTags(s.lead)}`) }));
  SECTIONS.forEach((s) => (s.groups || []).forEach((g, gi) => (g.blocks || []).forEach((b, bi) => {
    INDEX.push({ kind: 'block', s, g, b, id: `${s.id}-${gi}-${bi}`, text: both(`${g.title} ${b.title} ${b.sub || ''} ${stripTags(b.html)}`) });
  })));
  LETTERS.forEach((L, i) => INDEX.push({
    kind: 'letter', i, L,
    tokens: norm(`${L.g} ${L.alt || ''}`).split(/\s+/).filter(Boolean),
    text: both(`буква ${L.g} ${L.name} ${L.snd} ${L.note || ''} ${L.word || ''} ${L.alt || ''} ${L.val ? 'число ' + L.val + ' ' + L.num : ''}`)
  }));
  TITLA_FULL.forEach(([w, r]) => INDEX.push({ kind: 'word', w, r, text: both(`титло ${w} ${r}`) }));

  function searchIndex(q) {
    const variants = queryVariants(String(q).trim());
    if (!variants.length) return [];
    if (variants.every((v) => v.length === 1)) {
      const v = variants[0];
      if (/\d/.test(v)) return INDEX.filter((x) => x.kind === 'letter' && String(x.L.val) === v);
      return INDEX.filter((x) => x.kind === 'letter' && x.tokens.includes(v));
    }
    return INDEX.filter((x) => variants.some((v) => matches(x.text, v)));
  }
  window.SEARCH = { searchIndex, norm, normX };

  /* ---------- навигация ---------- */
  function renderNav() { window.STUDIO.renderNav(); }
  function setActive(id) { $$('.navbtn').forEach((b) => b.classList.toggle('active', b.dataset.id === id)); }

  function go(id, target) {
    if (window.STUDIO.render(id)) { state.section = id; return; }
    const s = SECTIONS.find((x) => x.id === id) || SECTIONS[0];
    state.section = s.id;
    window.STUDIO.sync(s.id);
    store.set('cs-demo-section', s.id);
    $('#search').value = '';
    setActive(s.id);
    renderSection(s);
    $('#main').scrollTop = 0;
    if (target) {
      const el = document.getElementById(target);
      if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1500); }
    }
  }

  /* ---------- разделы ---------- */
  function cardHTML(b, id) {
    const title = `<h3>${esc(b.title)}${b.sub ? ` <span class="sub">${esc(b.sub)}</span>` : ''}</h3>`;
    if (b.letters) {
      return `<article class="card lcard" id="${id}"><div class="lcol cs nocopy" aria-hidden="true">${b.letters.split(' ').map((l) => `<span>${l}</span>`).join('')}</div><div>${title}${b.html}</div></article>`;
    }
    return `<article class="card" id="${id}">${title}${b.html}</article>`;
  }

  function wordsHTML(onclickAttr, list) {
    return `<div class="words">${(list || TITLA_WORDS).map(([w, r]) => `<button class="word" ${onclickAttr}="${esc(w)}" data-f="${esc(both(w + ' ' + r))}"><span class="cs">${w}</span><span class="gl">${esc(r)}</span></button>`).join('')}</div>`;
  }

  function titlaFullHTML() {
    return `<label class="search infind"><svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M13 13l4.5 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><input id="titlaFilter" type="search" placeholder="Найти слово: господь, крест, гдⷭ҇ь, бцⷣа…" aria-label="Найти слово под титлом" autocomplete="off" spellcheck="false"></label>
<p class="gl" id="titlaCount">${TITLA_FULL.length} слов</p>${wordsHTML('data-copy', TITLA_FULL)}<p class="gl" style="margin-top:10px">Другие формы этих слов пишутся так же: <span class="cs" style="font-size:20px">бж҃е, ѻ҆́ч҃е, а҆пⷭ҇ла</span>.</p><p class="empty" id="titlaEmpty" hidden>Такого слова в списке нет. Слово может писаться полностью — без титла.</p>`;
  }

  function bindTitlaFilter() {
    const input = $('#titlaFilter');
    if (!input) return;
    const items = $$('.word[data-f]', input.closest('.group'));
    input.addEventListener('input', () => {
      const variants = queryVariants(input.value.trim());
      let shown = 0;
      items.forEach((w) => {
        const ok = !variants.length || variants.some((v) => matches(w.dataset.f, v));
        w.hidden = !ok;
        if (ok) shown++;
      });
      $('#titlaCount').textContent = variants.length ? `Найдено: ${shown} из ${items.length}` : `${items.length} слов`;
      $('#titlaEmpty').hidden = shown !== 0;
    });
  }

  /* ---------- конвертер титл ---------- */
  const TC_SAMPLE = 'Сла́ва ѻ҆тцꙋ̀ и҆ сынꙋ̀ и҆ свѧто́мꙋ дꙋ́хꙋ. Пресвѧта́ѧ богоро́дице, спасѝ на́съ.';
  const tc = { dir: store.get('cs-demo-tc-dir', 'abbr') === 'expand' ? 'expand' : 'abbr', timer: null };

  function titlaConvHTML() {
    const layout = window.KB ? window.KB.getLayout() : true;
    return `<div class="tconv">
<div class="edbar">
  <div class="seg" role="radiogroup" aria-label="Что сделать">
    <button class="segbtn" data-tdir="abbr" role="radio">Поставить титла</button>
    <button class="segbtn" data-tdir="expand" role="radio">Раскрыть титла</button>
  </div>
  <div class="edbtns">
    <label class="switch"><input type="checkbox" id="tcLayout"${layout ? ' checked' : ''}><span>Славянская раскладка</span></label>
    <label class="switch" id="tcOptWrap"><input type="checkbox" id="tcOpt"${store.get('cs-demo-tc-opt', '0') === '1' ? ' checked' : ''}><span>Сокращать и <span class="cs">ца́рь, сла́ва, ны́нѣ, при́снѡ</span></span></label>
  </div>
</div>
<div class="tconv-grid">
  <div class="tconv-col"><p class="kicker" id="tcInTitle"></p><textarea id="tcIn" class="cs nocopy" spellcheck="false" autocomplete="off" aria-label="Исходный текст"></textarea><p class="gl" id="tcHint"></p></div>
  <div class="tconv-col"><p class="kicker" id="tcOutTitle"></p><div id="tcOut" class="cs tconv-out nocopy" aria-live="polite"></div>
  <div class="tconv-acts"><button class="btn" id="tcCopy">Копировать результат</button><button class="btn ghost" id="tcSwap" title="Перенести результат в исходный текст и сменить направление">⇄ Обратно</button></div></div>
</div>
<div id="tcInfo" class="tconv-info"></div>
</div>`;
  }

  function runTitlaConv() {
    const inp = $('#tcIn');
    if (!inp || !window.TITLA_CONV) return;
    const opt = $('#tcOpt').checked;
    const r = window.TITLA_CONV.convert(inp.value, tc.dir, { optional: opt });
    tc.last = r;
    tc.lastInput = inp.value;
    let html = '', pos = 0;
    r.changes.forEach((c) => { html += esc(r.text.slice(pos, c.start)) + `<mark class="tc-mk">${esc(r.text.slice(c.start, c.end))}</mark>`; pos = c.end; });
    html += esc(r.text.slice(pos));
    $('#tcOut').innerHTML = html.replace(/\n/g, '<br>') || '<span class="gl">Здесь появится результат.</span>';
    const seen = new Map();
    r.changes.forEach((c) => { const k = c.from + '→' + c.to; if (!seen.has(k)) seen.set(k, c); });
    const items = Array.from(seen.values());
    let info = '';
    if (items.length) {
      info += `<ol class="tconv-list">${items.map((c) => `<li><span class="cs w">${esc(c.from)}</span><span class="arrow" aria-hidden="true">→</span><span class="cs w hl">${esc(c.to)}</span>${c.note ? `<span class="msg">${esc(c.note)}</span>` : ''}</li>`).join('')}</ol>`;
    } else if (inp.value.trim() && !r.numerals?.length) {
      info += `<p class="gl">${tc.dir === 'abbr' ? 'В тексте нет слов, которые пишутся под титлом.' : 'В тексте нет слов под титлом.'}</p>`;
    }
    if (r.numerals?.length) info += `<p class="gl">Числовые записи сохранены: ${r.numerals.length}.</p>`;
    if (r.ambiguous?.length) info += `<div class="tconv-ambiguities">${r.ambiguous.map((entry, i) => `<div class="tconv-ambiguity"><p><span class="cs">${esc(entry.word)}</span> может обозначать число ${entry.value.toLocaleString('ru-RU')} или слово <span class="cs">${esc(entry.expanded)}</span>. Сейчас запись сохранена.</p><button class="btn ghost small" data-tc-expand="${i}">Раскрыть как слово <span class="cs">${esc(entry.expanded)}</span></button></div>`).join('')}</div>`;
    if (r.unknown && r.unknown.length) info += `<p class="gl tconv-unk">Нет в таблице — раскройте по смыслу: <span class="cs">${r.unknown.map(esc).join(', ')}</span></p>`;
    $('#tcInfo').innerHTML = info;
  }

  function bindTitlaConv() {
    const inp = $('#tcIn');
    if (!inp) return;
    inp.value = store.get('cs-demo-tc-text', '') || TC_SAMPLE;
    if (window.KB) window.KB.attachLayout(inp);
    const setDir = (d) => {
      tc.dir = d;
      store.set('cs-demo-tc-dir', d);
      $$('[data-tdir]').forEach((b) => { const on = b.dataset.tdir === d; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
      $('#tcInTitle').textContent = d === 'abbr' ? 'Текст без титл' : 'Текст с титлами';
      $('#tcOutTitle').textContent = d === 'abbr' ? 'С титлами' : 'Без титл — полностью';
      $('#tcHint').textContent = d === 'abbr' ? 'Можно печатать и по-русски: Господи, Богородица, Христос. Остальные слова не меняются.' : 'Числа (а҃, в҃і) не трогаются.';
      $('#tcOptWrap').hidden = d !== 'abbr';
      runTitlaConv();
    };
    $$('[data-tdir]').forEach((b) => b.addEventListener('click', () => setDir(b.dataset.tdir)));
    inp.addEventListener('input', () => { store.set('cs-demo-tc-text', inp.value); clearTimeout(tc.timer); tc.timer = setTimeout(runTitlaConv, 120); });
    $('#tcInfo').addEventListener('click', (event) => {
      const button = event.target.closest('[data-tc-expand]');
      if (!button) return;
      const entry = tc.last?.ambiguous?.[Number(button.dataset.tcExpand)];
      if (!entry) return;
      if (tc.lastInput !== inp.value || inp.value.slice(entry.start, entry.end) !== entry.word) {
        runTitlaConv();
        toast('Текст изменился. Выберите словесное чтение ещё раз.');
        return;
      }
      inp.focus();
      inp.setSelectionRange(entry.start, entry.end);
      if (window.KB) window.KB.insertInto(inp, entry.expanded);
      else {
        inp.setRangeText(entry.expanded, entry.start, entry.end, 'end');
        inp.dispatchEvent(new Event('input', {bubbles:true}));
      }
      clearTimeout(tc.timer);
      runTitlaConv();
    });
    $('#tcLayout').addEventListener('change', (e) => { if (window.KB) window.KB.setLayout(e.target.checked); inp.focus(); });
    $('#tcOpt').addEventListener('change', (e) => { store.set('cs-demo-tc-opt', e.target.checked ? '1' : '0'); runTitlaConv(); });
    $('#tcCopy').addEventListener('click', () => copy(tc.last ? tc.last.text : ''));
    $('#tcSwap').addEventListener('click', () => {
      if (!tc.last) return;
      inp.value = tc.last.text;
      store.set('cs-demo-tc-text', inp.value);
      setDir(tc.dir === 'abbr' ? 'expand' : 'abbr');
    });
    setDir(tc.dir);
    // русские слова берут ударение из словаря — пересчитаем, когда он загрузится
    if (DICT() && !DICT().ready && !DICT().failed) DICT().onReady((ok) => { if (ok && $('#tcIn')) runTitlaConv(); });
  }

  function numTableHTML() {
    const rows = [
      ['Единицы', U.slice(1), 1, ''], ['Десятки', T.slice(1), 10, ''],
      ['Сотни', H.slice(1), 100, ''], ['Тысячи', U.slice(1), 1000, THOUS]
    ];
    return `<div class="numtable">${rows.map(([label, letters, mult, pre]) => `<div class="rl">${label}</div>${letters.map((l, i) => `<div><span class="cs">${pre}${l}${TITLO}</span><span class="v">${((i + 1) * mult).toLocaleString('ru-RU')}</span></div>`).join('')}`).join('')}</div>`;
  }

  function converterHTML() {
    return `<div class="conv">
<div class="card"><h3>Число → цифирь</h3>
<label class="fld"><span>Число от 1 до 999 999</span><input id="convNum" type="number" min="1" max="999999" value="2026"></label>
<div class="convout"><span id="convNumOut" class="cs xl hl"></span><button class="btn ghost small" id="convCopy">Копировать</button></div>
<p class="gl" id="convNumHint"></p></div>
<div class="card"><h3>Цифирь → число</h3>
<label class="fld"><span>Буквы-цифры; можно печатать по славянской раскладке (см. «Клавиатура»)</span><input id="convCs" class="cs nocopy" type="text" value="҂ацч҃в" spellcheck="false" autocomplete="off"></label>
<div class="convout"><span id="convCsOut"></span></div>
<p class="gl" id="convCsHint"></p></div></div>`;
  }

  function groupHTML(s, g, gi) {
    let inner;
    if (g.special === 'titlaWords') inner = wordsHTML('data-copy');
    else if (g.special === 'titlaFull') inner = titlaFullHTML();
    else if (g.special === 'titlaConv') inner = titlaConvHTML();
    else if (g.special === 'forms' && window.FORMSUI) inner = window.FORMSUI.html();
    else if (g.special === 'converter') inner = converterHTML();
    else if (g.special === 'numTable') inner = numTableHTML();
    else inner = `<div class="grid" style="--cols:${g.cols || 2}">${g.blocks.map((b, bi) => cardHTML(b, `${s.id}-${gi}-${bi}`)).join('')}</div>`;
    return `<section class="group"><div class="ghead"><h2>${esc(g.title)}</h2>${g.note ? `<span class="gnote">${esc(g.note)}</span>` : ''}</div>${inner}</section>`;
  }

  function alphabetHTML() {
    const tiles = LETTERS.map((L, i) => `<button class="tile${i === state.letter ? ' sel' : ''}" data-i="${i}" aria-label="${esc(L.name)}">
<span class="tile-top"><span>${String(i + 1).padStart(2, '0')}</span>${L.num ? `<span class="badge"><span class="cs">${L.num}</span>${L.val}</span>` : ''}</span>
<span class="glyph cs">${L.g}</span>
<span class="tile-bot"><span class="name">${esc(L.name)}</span><span class="snd">${esc(L.snd)}</span></span></button>`).join('');
    const dbl = DOUBLETS.map(([snd, g]) => `<div class="dbl"><span class="snd">${snd}</span><span class="cs">${g}</span></div>`).join('');
    return `<div id="detail" class="detail"></div>
<section class="group"><div class="ghead"><h2>Все буквы</h2><span class="gnote">красная метка — числовое значение; ← → листают буквы</span></div><div class="alpha-grid" id="alpha">${tiles}</div></section>
<section class="group"><div class="ghead"><h2>Пишутся по-разному — читаются одинаково</h2></div><div class="dbl-grid">${dbl}<div class="dbl note"><span class="cs">ф ѳ ѡ ѯ ѱ ѵ</span><span class="gl">пришли из греческого алфавита</span></div></div></section>`;
  }

  function renderDetail() {
    const L = LETTERS[state.letter];
    $('#detail').innerHTML = `<div class="dglyph cs">${L.g}</div>
<div class="dinfo"><p class="kicker">Буква ${state.letter + 1} из ${LETTERS.length}</p><h2>${esc(L.name)}</h2>
<dl>
<div><dt>Звук</dt><dd>${esc(L.snd)}</dd></div>
<div><dt>Число</dt><dd>${L.num ? `<span class="cs">${L.num}</span> = ${L.val}` : 'не служит цифрой'}</dd></div>
${L.alt ? `<div><dt>Другое начертание</dt><dd class="cs">${L.alt}</dd></div>` : ''}
${L.note ? `<div><dt>Заметка</dt><dd>${esc(L.note)}</dd></div>` : ''}
${L.word ? `<div><dt>В слове</dt><dd class="cs">${L.word}</dd></div>` : ''}
</dl>
<div class="dbtns"><button class="btn" data-act="copy-letter">Копировать букву</button><button class="btn ghost" data-act="to-editor">В редактор</button><button class="btn ghost" data-act="prev" aria-label="Предыдущая буква">←</button><button class="btn ghost" data-act="next" aria-label="Следующая буква">→</button></div></div>`;
  }

  function selectLetter(i) {
    state.letter = (i + LETTERS.length) % LETTERS.length;
    store.set('cs-demo-letter', String(state.letter));
    $$('.tile').forEach((t) => t.classList.toggle('sel', Number(t.dataset.i) === state.letter));
    renderDetail();
  }

  function bindConverter() {
    const num = $('#convNum'), out = $('#convNumOut'), hint = $('#convNumHint');
    const inCs = $('#convCs'), outCs = $('#convCsOut'), hintCs = $('#convCsHint');
    if (!num) return;
    const upd1 = () => {
      const r = toCS(Number(num.value));
      if (!r) { out.textContent = ''; hint.textContent = 'Введите целое число от 1 до 999 999.'; return; }
      out.textContent = r.text;
      hint.innerHTML = r.parts.map(([l, v]) => `<span class="cs">${l}</span> = ${v.toLocaleString('ru-RU')}`).join(' · ');
    };
    const upd2 = () => {
      const r = fromCS(inCs.value);
      if (r.error === 'пусто') { outCs.textContent = ''; hintCs.textContent = ''; return; }
      if (r.error) { outCs.textContent = '—'; hintCs.innerHTML = `Знак <span class="cs">${esc(r.error)}</span> не обозначает число.`; return; }
      outCs.textContent = r.value.toLocaleString('ru-RU');
      const back = toCS(r.value);
      hintCs.innerHTML = back ? `По правилам записывается так: <span class="cs">${back.text}</span>` : '';
    };
    num.addEventListener('input', upd1);
    inCs.addEventListener('input', upd2);
    $('#convCopy').addEventListener('click', () => copy(out.textContent));
    if (window.KB) window.KB.attachLayout(inCs, upd2);
    upd1(); upd2();
  }

  /* ---------- проверка правописания ---------- */
  const SEARCH_KEY = (w) => norm(w).replace(/[^\p{L}]/gu, '').replace(/ъ$/, '');
  // служебные слова не показываем в словаре к тексту
  const COMMON = new Set('и а но же бо ли не ни во въ на по за изъ из ко къ ѿ от отъ со съ о об обо да яко ако аще егда иже яже еже сей сия сие той тая тое то тако вся все всѣ весь мы вы азъ аз ты онъ он она оно они ея его ему имъ ихъ нас насъ вас васъ нам намъ вам вамъ мене мнѣ мне тебе тебѣ себе себѣ есть еси суть бысть быти буди будетъ'.split(' ').map((x) => norm(x).replace(/ъ$/, '')));
  const SEV = { error: 'Ошибка', warn: 'Проверьте', hint: 'Совет' };
  const chk = { issues: [], timer: null };

  function checkerHTML() {
    const layout = window.KB ? window.KB.getLayout() : true;
    return `<div class="chk">
<div class="edbar">
  <label class="switch"><input type="checkbox" id="chkLayout"${layout ? ' checked' : ''}><span>Славянская раскладка при наборе</span></label>
  <div class="edbtns">
    <label class="switch"><input type="checkbox" id="chkHints"${store.get('cs-demo-hints', '1') === '1' ? ' checked' : ''}><span>Показывать советы</span></label>
    <button class="btn ghost" id="chkFixAll">Исправить все ошибки</button>
    <button class="btn" id="chkCopy">Копировать текст</button>
  </div>
</div>
<textarea id="chkEd" class="cs nocopy" spellcheck="false" autocomplete="off" aria-label="Текст для проверки" placeholder="Вставьте или наберите текст…"></textarea>
<div class="chk-summary" id="chkSummary" aria-live="polite"></div>
<div class="chk-preview cs nocopy" id="chkPreview" aria-label="Текст с отмеченными местами"></div>
<ol class="chk-list" id="chkList"></ol>
<section class="chk-dict" id="chkDict" hidden><div class="ghead"><h2>Значения слов по словарю</h2><span class="gnote">нажмите, чтобы открыть статью</span></div><div class="chk-dict-list" id="chkDictList"></div></section>
</div>`;
  }

  function runCheck() {
    const ed = $('#chkEd');
    if (!ed || !window.CHECK) return;
    const text = ed.value;
    const showHints = $('#chkHints').checked;
    chk.issues = window.CHECK.check(text).filter((i) => showHints || i.sev !== 'hint');
    const n = { error: 0, warn: 0, hint: 0 };
    chk.issues.forEach((i) => n[i.sev]++);
    const fixable = chk.issues.filter((i) => i.fixed !== null && i.sev !== 'hint').length;
    $('#chkSummary').innerHTML = text.trim()
      ? (chk.issues.length
        ? `<span class="sum sev-error">Ошибок: ${n.error}</span><span class="sum sev-warn">Проверьте: ${n.warn}</span>${showHints ? `<span class="sum sev-hint">Советов: ${n.hint}</span>` : ''}`
        : '<span class="sum ok">Нарушений правил не найдено</span>')
      : '';
    $('#chkFixAll').disabled = fixable === 0;
    $('#chkFixAll').textContent = fixable ? `Исправить все ошибки (${fixable})` : 'Исправить все ошибки';

    // текст с подчёркиваниями: на слово — самая серьёзная отметка
    const rank = { error: 0, warn: 1, hint: 2 };
    const spans = new Map();
    chk.issues.forEach((iss, k) => {
      const cur = spans.get(iss.start);
      if (!cur || rank[iss.sev] < rank[cur.sev]) spans.set(iss.start, { sev: iss.sev, end: iss.end, k });
    });
    let html = '', pos = 0;
    Array.from(spans.entries()).sort((a, b) => a[0] - b[0]).forEach(([start, sp]) => {
      if (start < pos) return;
      html += esc(text.slice(pos, start)) + `<button class="mk sev-${sp.sev}" data-iss="${sp.k}">${esc(text.slice(start, sp.end))}</button>`;
      pos = sp.end;
    });
    html += esc(text.slice(pos));
    $('#chkPreview').innerHTML = html.replace(/\n/g, '<br>') || '<span class="gl">Здесь появится текст с отмеченными местами.</span>';

    const shown = chk.issues.slice(0, 300);
    $('#chkList').innerHTML = shown.map((iss, k) => `<li class="iss sev-${iss.sev}" id="iss-${k}">
<span class="sevb">${SEV[iss.sev]}</span>
<span class="w cs">${esc(iss.word)}</span>
${iss.fixed !== null ? `<span class="arrow" aria-hidden="true">→</span><span class="w cs fixw">${esc(iss.fixed)}</span>` : ''}
<span class="msg">${esc(iss.msg)}</span>
<span class="acts">${iss.fixed !== null ? `<button class="btn small" data-fix="${k}">Исправить</button>` : ''}${iss.fixed === null && iss.alts ? iss.alts.map((a) => `<button class="btn ghost small alt" data-alt="${k}" data-v="${esc(a)}"><span class="cs">${esc(a)}</span></button>`).join('') : ''}<button class="btn ghost small" data-show="${k}">Показать</button></span></li>`).join('')
      + (chk.issues.length > shown.length ? `<li class="gl">…и ещё ${chk.issues.length - shown.length}</li>` : '');
    renderChkDict(text);
  }

  function renderChkDict(text) {
    const box = $('#chkDict');
    if (!box) return;
    if (!DICT() || !DICT().ready) {
      if (DICT() && !DICT().failed) DICT().onReady((ok) => { if (ok && $('#chkEd')) renderChkDict($('#chkEd').value); });
      box.hidden = true;
      return;
    }
    const seen = new Set();
    const out = [];
    const re = /[\p{L}\p{M}\u0483-\u0489\u2DE0-\u2DFF\uA66F-\uA67F]+/gu;
    let m;
    while ((m = re.exec(text)) && out.length < 120) {
      const w = m[0];
      const key = SEARCH_KEY(w);
      if (key.length < 3 || seen.has(key) || COMMON.has(key)) continue;
      seen.add(key);
      const r = DICT().lookupWord(w);
      if (r) out.push([w, r]);
    }
    box.hidden = !out.length;
    $('#chkDictList').innerHTML = out.map(([w, r]) => {
      const i = r.items[0];
      const [h, , b] = DICT().entry(i);
      return `<button class="dict-chip" data-dopen="${i}"><span class="cs">${esc(w)}</span><span class="arrow" aria-hidden="true">→</span><span class="hw cs">${esc(h)}</span>${r.exact ? '' : '<span class="gl">похоже</span>'}<span class="pv">${esc(DICT().preview(b, 90))}</span></button>`;
    }).join('');
  }

  function bindChecker() {
    const ed = $('#chkEd');
    if (!ed) return;
    ed.value = window.KB ? window.KB.getText() : '';
    if (window.KB) window.KB.attachLayout(ed);
    ed.addEventListener('input', () => {
      if (window.KB) window.KB.setText(ed.value);
      clearTimeout(chk.timer);
      chk.timer = setTimeout(runCheck, 200);
    });
    $('#chkLayout').addEventListener('change', (e) => { if (window.KB) window.KB.setLayout(e.target.checked); ed.focus(); });
    $('#chkHints').addEventListener('change', (e) => { store.set('cs-demo-hints', e.target.checked ? '1' : '0'); runCheck(); });
    $('#chkCopy').addEventListener('click', () => copy(ed.value));
    $('#chkFixAll').addEventListener('click', () => {
      const fixed = window.CHECK.fixAll(ed.value, ['error', 'warn']);
      if (fixed === ed.value) return;
      ed.focus();
      ed.select();
      if (!document.execCommand('insertText', false, fixed)) { ed.value = fixed; ed.dispatchEvent(new Event('input')); }
      toast('Ошибки исправлены — проверьте советы');
    });
    const showIssue = (k) => {
      const iss = chk.issues[k];
      if (!iss) return;
      ed.focus();
      ed.setSelectionRange(iss.start, iss.end);
      const li = document.getElementById('iss-' + k);
      if (li) { li.scrollIntoView({ block: 'nearest' }); li.classList.add('flash'); setTimeout(() => li.classList.remove('flash'), 1400); }
    };
    $('#chkPreview').addEventListener('click', (e) => { const m = e.target.closest('[data-iss]'); if (m) showIssue(Number(m.dataset.iss)); });
    $('#chkList').addEventListener('click', (e) => {
      const s = e.target.closest('[data-show]');
      if (s) { showIssue(Number(s.dataset.show)); return; }
      const f = e.target.closest('[data-fix], [data-alt]');
      if (f) {
        const iss = chk.issues[Number(f.dataset.fix !== undefined ? f.dataset.fix : f.dataset.alt)];
        const val = f.dataset.alt !== undefined ? f.dataset.v : iss && iss.fixed;
        if (!iss || val === null || val === undefined) return;
        ed.focus();
        ed.setSelectionRange(iss.start, iss.end);
        if (!document.execCommand('insertText', false, val)) {
          ed.setRangeText(val, iss.start, iss.end, 'end');
          ed.dispatchEvent(new Event('input'));
        }
      }
    });
    if (window.LEGACY) window.LEGACY.attach(ed, (enc) => toast(`Текст переведён из ${window.LEGACY.SHORT[enc]} в Юникод`));
    if (window.SPELL && !window.SPELL.ready) { window.SPELL.load(); window.SPELL.onReady((ok) => { if (ok && $('#chkEd') === ed) runCheck(); }); }
    runCheck();
  }

  function renderSection(s) {
    const head = `<header class="sechead"><h1>${esc(s.title)}</h1><p class="lead">${s.lead}</p></header>`;
    let body = '';
    if (s.special === 'alphabet') body = alphabetHTML();
    else if (s.special === 'keyboard') body = '<div id="kbmount"></div>';
    else if (s.special === 'checker') body = checkerHTML();
    else if (s.special === 'dictionary') body = '<div id="dictmount"></div>';
    if (s.groups) body += s.groups.map((g, gi) => groupHTML(s, g, gi)).join('');
    $('#content').innerHTML = head + body;
    if (s.special === 'alphabet') renderDetail();
    if (s.special === 'keyboard' && window.KB) {
      window.KB.mount($('#kbmount'));
      if (window.LEGACY) window.LEGACY.attach($('#kbEd'), (enc) => toast(`Текст переведён из ${window.LEGACY.SHORT[enc]} в Юникод`));
    }
    if (s.special === 'checker') bindChecker();
    if (s.special === 'dictionary' && DICT()) { DICT().mount($('#dictmount'), dictOpts || {}); dictOpts = null; }
    bindConverter();
    bindTitlaFilter();
    bindTitlaConv();
    if (window.FORMSUI && document.getElementById('fxIn')) window.FORMSUI.bind();
  }

  /* ---------- поиск: вывод ---------- */
  function renderSearch(q) {
    if (!q.trim()) { go(state.section); return; }
    window.STUDIO.sync('search');
    const hits = searchIndex(q);
    setActive(null);
    const sections = hits.filter((h) => h.kind === 'section');
    const letters = hits.filter((h) => h.kind === 'letter');
    const words = hits.filter((h) => h.kind === 'word');
    const blocks = hits.filter((h) => h.kind === 'block');
    let html = `<header class="sechead"><p class="kicker">Поиск</p><h1>«${esc(q.trim())}»</h1><p class="lead">${hits.length ? `В правилах найдено: ${hits.length}` : 'В правилах ничего не нашлось. Попробуйте другое слово — например «титло», «оксия» или «ѡ».'}</p></header>`;
    if (sections.length) {
      html += `<section class="group"><div class="ghead"><h2>Разделы</h2></div><div class="secres">${sections.map((h) => `<button class="navbtn secbtn" data-id="${h.s.id}"><span class="navicon cs" aria-hidden="true">${h.s.icon}</span><span class="navtxt">${h.s.num ? `<span class="navnum">${h.s.num}</span>` : ''}${esc(h.s.title)}</span></button>`).join('')}</div></section>`;
    }
    if (letters.length) {
      html += `<section class="group"><div class="ghead"><h2>Буквы</h2></div><div class="alpha-grid">${letters.map((h) => `<button class="tile" data-goletter="${h.i}"><span class="tile-top"><span>${String(h.i + 1).padStart(2, '0')}</span>${h.L.num ? `<span class="badge"><span class="cs">${h.L.num}</span>${h.L.val}</span>` : ''}</span><span class="glyph cs">${h.L.g}</span><span class="tile-bot"><span class="name">${esc(h.L.name)}</span><span class="snd">${esc(h.L.snd)}</span></span></button>`).join('')}</div></section>`;
    }
    if (words.length) {
      html += `<section class="group"><div class="ghead"><h2>Слова под титлом</h2></div><div class="words">${words.map((h) => `<button class="word" data-copy="${esc(h.w)}"><span class="cs">${h.w}</span><span class="gl">${esc(h.r)}</span></button>`).join('')}</div></section>`;
    }
    const dq = q.trim();
    let dictHTML = '';
    if (norm(dq).replace(/[^\p{L}\p{N}]/gu, '').length < 2 || /^\d+$/.test(dq)) { /* одна буква или число — словарь не нужен */ }
    else if (DICT() && DICT().ready) {
      const r = DICT().find(dq, 'head');
      if (r.total) {
        dictHTML = `<section class="group"><div class="ghead"><h2>Словарь</h2><span class="gnote">${r.how === 'stem' ? 'похожие слова · ' : ''}статей: ${r.total.toLocaleString('ru-RU')}</span></div><div class="dict-hits">${r.items.slice(0, 8).map((i) => { const [h, , b] = DICT().entry(i); return `<button class="card dict-hit" data-dopen="${i}" data-dq="${esc(dq)}"><span class="hw cs">${esc(h)}</span><span class="pv">${esc(DICT().preview(b, 140))}</span></button>`; }).join('')}</div><div class="open"><button class="btn ghost small" data-dsearch="${esc(dq)}">${r.total > 8 ? `Все ${r.total.toLocaleString('ru-RU')} в словаре →` : 'Открыть в словаре →'}</button></div></section>`;
      }
    } else if (DICT() && !DICT().failed) {
      DICT().onReady((ok) => { if (ok && $('#search').value === q) renderSearch(q); });
    }
    if (blocks.length) {
      html += `<section class="group"><div class="ghead"><h2>Правила</h2></div><div class="grid" style="--cols:2">${blocks.map((h) => `<article class="card result"><p class="kicker">${esc(h.s.title)} · ${esc(h.g.title)}</p><h3>${esc(h.b.title)}${h.b.sub ? ` <span class="sub">${esc(h.b.sub)}</span>` : ''}</h3>${h.b.html}<div class="open"><button class="btn ghost small" data-goto="${h.id}" data-sec="${h.s.id}">Открыть в разделе →</button></div></article>`).join('')}</div></section>`;
    }
    html += dictHTML;
    if (!hits.length && !dictHTML) html += '<div class="empty"></div>';
    $('#content').innerHTML = html;
    $('#main').scrollTop = 0;
  }

  /* ---------- шрифт ---------- */
  function fontStatus(kind) {
    const el = $('#fontstatus');
    el.classList.toggle('warn', kind === 'fallback');
    if (kind === 'loading') el.textContent = 'Загружаю шрифт Ponomar…';
    else if (kind === 'ok') el.textContent = 'Шрифт: Ponomar';
    else if (kind === 'fallback') {
      el.innerHTML = 'Сейчас стоит запасной шрифт. Ponomar точнее передаёт знаки — для загрузки нужен интернет.<div class="row"><button class="btn small" data-font="download">Загрузить Ponomar</button><button class="btn ghost small" data-font="pick">Выбрать файл…</button></div>';
    } else el.textContent = '';
  }
  async function applyFont(data) {
    try {
      const face = new FontFace('Ponomar App', data);
      await face.load();
      document.fonts.add(face);
      fontStatus('ok');
      return true;
    } catch (e) { fontStatus('fallback'); return false; }
  }
  async function initFont(force) {
    if (!api) return;
    let data = force ? null : await api.getFont();
    if (!data) { fontStatus('loading'); data = await api.downloadFont(); }
    if (data) await applyFont(data); else fontStatus('fallback');
  }

  /* ---------- события ---------- */
  document.addEventListener('click', async (e) => {
    const nav = e.target.closest('.navbtn');
    if (nav) { go(nav.dataset.id); return; }
    const link = e.target.closest('a[href]');
    if (link && /^https?:/.test(link.href)) { e.preventDefault(); if (api) api.openExternal(link.href); else window.open(link.href); return; }
    const f = e.target.closest('[data-font]');
    if (f && api) {
      if (f.dataset.font === 'download') initFont(true);
      else { const data = await api.pickFont(); if (data) applyFont(data); }
      return;
    }
    if (!e.target.closest('#content')) return;
    const dop = e.target.closest('[data-dopen]');
    if (dop) { openDict({ q: dop.dataset.dq || '', open: Number(dop.dataset.dopen) }); return; }
    const dse = e.target.closest('[data-dsearch]');
    if (dse) { openDict({ q: dse.dataset.dsearch, mode: 'head' }); return; }
    const gl = e.target.closest('[data-goletter]');
    if (gl) { state.letter = Number(gl.dataset.goletter); go('azbuka'); return; }
    const gt = e.target.closest('[data-goto]');
    if (gt) { go(gt.dataset.sec, gt.dataset.goto); return; }
    const tile = e.target.closest('.tile[data-i]');
    if (tile) { selectLetter(Number(tile.dataset.i)); return; }
    const act = e.target.closest('[data-act]');
    if (act) {
      const L = LETTERS[state.letter];
      if (act.dataset.act === 'copy-letter') copy(L.c);
      if (act.dataset.act === 'to-editor' && window.KB) { window.KB.append(L.c); toast(`<span class="cs">${L.c}</span> — добавлено в редактор`); }
      if (act.dataset.act === 'prev') selectLetter(state.letter - 1);
      if (act.dataset.act === 'next') selectLetter(state.letter + 1);
      return;
    }
    const dc = e.target.closest('[data-copy]');
    if (dc) { copy(dc.dataset.copy); return; }
    if (e.target.closest('button, a, input, textarea, .nocopy, #kbmount')) return;
    const c = e.target.closest('.cs');
    if (c) copy(c.textContent.trim());
  });

  document.addEventListener('keydown', (e) => {
    const typing = e.target.closest && e.target.closest('input, textarea');
    if (state.section === 'azbuka' && !typing && $('#detail')) {
      if (e.key === 'ArrowRight') { selectLetter(state.letter + 1); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { selectLetter(state.letter - 1); e.preventDefault(); }
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f' && !api) { $('#search').focus(); e.preventDefault(); }
  });

  let searchTimer = null;
  const search = $('#search');
  search.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => renderSearch(search.value), 120); });
  search.addEventListener('keydown', (e) => { if (e.key === 'Escape') { search.value = ''; go(state.section); search.blur(); } });

  if (api) {
    api.onMenu((cmd, arg) => {
      if (cmd === 'nav') go(arg);
      if (cmd === 'search') { search.focus(); search.select(); }
    });
  }

  document.body.classList.add('plat-' + (api && api.platform ? api.platform : 'darwin'));
  renderNav();
  go(location.hash.slice(1) || 'klaviatura');
  initFont(false);
  setTimeout(() => { if (DICT()) DICT().load(); }, 600);
  setTimeout(() => { if (window.SPELL) window.SPELL.load(); }, 1500);
})();
