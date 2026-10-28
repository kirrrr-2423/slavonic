'use strict';
/* Славянская клавиатура: экранная + перехват физических клавиш по коду (раскладка ЙЦУКЕН). */
(() => {
  const OX = '́', VA = '̀', KA = '̑', ZV = '҆', ISO = '҆́', APO = '҆̀';
  const TI = '҃', PO = '҇', KE = '̏', ER = '̾', KAV = '꙾', THOUS = '҂';
  const GL = 'ⷢ҇', DO = 'ⷣ', ON = 'ⷪ҇', RC = 'ⷬ҇', SL = 'ⷭ҇';

  const NAMES = {
    [OX]: 'оксия', [VA]: 'вария', [KA]: 'камора', [ZV]: 'звательце', [ISO]: 'исо', [APO]: 'апостроф',
    [TI]: 'титло', [PO]: 'покрытие', [KE]: 'кендема', [ER]: 'ерок', [KAV]: 'кавыка', [THOUS]: 'тысяча',
    [GL]: 'глаголь-т.', [DO]: 'добро-т.', [ON]: 'он-т.', [RC]: 'рцы-т.', [SL]: 'слово-т.',
    ';': 'вопрос', 'ꙋ': 'ук', 'ѣ': 'ять', 'ѧ': 'юс', 'ѵ': 'ижица', 'ᲂу': 'оу', 'Оу': 'Оу', 'у': 'у (400)'
  };

  const M = (b, s, o = null, os = null) => ({ b, s, o, os });
  const MAP = {
    Backquote: M('ѵ', 'Ѵ'), IntlBackslash: M('ѵ', 'Ѵ'),
    Digit1: M(OX, '1', GL), Digit2: M(VA, '2', DO), Digit3: M(KA, '3', ON), Digit4: M(ZV, '4', RC),
    Digit5: M(ISO, '5', SL), Digit6: M(APO, '6', ER), Digit7: M(TI, '7', KE), Digit8: M(PO, '8', KAV),
    Digit9: M('(', '9', '!'), Digit0: M(')', '0', ':'), Minus: M('-', '–'), Equal: M(THOUS, '='),
    KeyQ: M('й', 'Й'), KeyW: M('ц', 'Ц', 'ѡ', 'Ѡ'), KeyE: M('ꙋ', 'Ꙋ'), KeyR: M('к', 'К', 'ѯ', 'Ѯ'),
    KeyT: M('е', 'Е', 'є', 'Є'), KeyY: M('н', 'Н', 'ᲂу', 'Оу'), KeyU: M('г', 'Г'), KeyI: M('ш', 'Ш'),
    KeyO: M('щ', 'Щ'), KeyP: M('з', 'З', 'ѕ', 'Ѕ'), BracketLeft: M('х', 'Х'), BracketRight: M('ъ', 'Ъ'),
    Backslash: M(';', ':'),
    KeyA: M('ф', 'Ф', 'ѳ', 'Ѳ'), KeyS: M('ы', 'Ы', 'ї', 'Ї'), KeyD: M('в', 'В'), KeyF: M('а', 'А'),
    KeyG: M('п', 'П', 'ѱ', 'Ѱ'), KeyH: M('р', 'Р', 'у', 'У'), KeyJ: M('о', 'О', 'ѻ', 'Ѻ'), KeyK: M('л', 'Л'),
    KeyL: M('д', 'Д'), Semicolon: M('ж', 'Ж'), Quote: M('ѣ', 'Ѣ', 'ѽ', 'Ѽ'),
    KeyZ: M('ѧ', 'Ѧ', 'ꙗ', 'Ꙗ'), KeyX: M('ч', 'Ч'), KeyC: M('с', 'С'), KeyV: M('м', 'М', 'ѷ', 'Ѷ'),
    KeyB: M('и', 'И', 'і', 'І'), KeyN: M('т', 'Т'), KeyM: M('ь', 'Ь', 'ѿ', 'Ѿ'), Comma: M('б', 'Б'),
    Period: M('ю', 'Ю'), Slash: M('.', ',')
  };
  const ROWS = [
    ['Backquote', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal', 'BKSP'],
    ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft', 'BracketRight', 'Backslash'],
    ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote', 'ENTER'],
    ['SHIFT', 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash', 'OPTION'],
    ['SPACE']
  ];
  const LAT = { Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/' };
  const latOf = (code) => (code.startsWith('Key') ? code.slice(3) : code.startsWith('Digit') ? code.slice(5) : LAT[code] || '');
  const MAC = ((window.slavApi && window.slavApi.platform) || 'darwin') === 'darwin';
  const OPT = MAC ? '⌥' : 'Alt';
  const CMD = MAC ? '⌘' : 'Ctrl';
  const FN = { BKSP: '⌫', ENTER: '↵', SHIFT: '⇧ Shift', OPTION: MAC ? '⌥ Option' : 'Alt', SPACE: 'пробел' };

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* нет хранилища */ } }
  };
  const st = {
    text: store.get('cs-editor', 'Ѻ҆́тче на́шъ, и҆́же є҆сѝ на нбⷭ҇ѣхъ'),
    layout: store.get('cs-layout', '1') === '1',
    size: Number(store.get('cs-edsize', 34)) || 34,
    shift: false, opt: false, physShift: false, physOpt: false, codes: false
  };
  let ed = null, kb = null;

  const isMarkOnly = (ch) => /^\p{M}+$/u.test(ch);
  const isCased = (ch) => ch && ch.toUpperCase() !== ch.toLowerCase();
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function charFor(code, shift, opt, caps) {
    const m = MAP[code];
    if (!m) return null;
    if (opt) return shift ? m.os : m.o;
    let up = shift;
    if (caps && isCased(m.b)) up = !up;
    return up ? m.s : m.b;
  }

  function save() { if (ed) st.text = ed.value; store.set('cs-editor', st.text); renderCodes(); }

  function insertInto(el, ch) {
    el.focus();
    const ok = document.execCommand && document.execCommand('insertText', false, ch);
    if (!ok) {
      const s = el.selectionStart, e = el.selectionEnd;
      el.setRangeText(ch, s, e, 'end');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  function faceHTML(ch) {
    if (ch == null) return '';
    if (isMarkOnly(ch)) return `<span class="face cs">о${ch}</span><span class="cap">${NAMES[ch] || ''}</span>`;
    return `<span class="face cs">${esc(ch)}</span>${NAMES[ch] ? `<span class="cap">${NAMES[ch]}</span>` : ''}`;
  }

  function updateFaces() {
    if (!kb) return;
    const shift = st.shift || st.physShift, opt = st.opt || st.physOpt;
    kb.querySelectorAll('.key[data-code]').forEach((k) => {
      const code = k.dataset.code;
      if (FN[code]) {
        if (code === 'SHIFT') k.classList.toggle('on', shift);
        if (code === 'OPTION') k.classList.toggle('on', opt);
        return;
      }
      const ch = charFor(code, shift, opt, false);
      k.classList.toggle('off', ch == null);
      k.innerHTML = `<span class="lat">${esc(latOf(code))}</span>${faceHTML(ch)}`;
      k.setAttribute('aria-label', ch == null ? 'пусто' : (NAMES[ch] || ch));
    });
  }

  function renderCodes() {
    const box = document.getElementById('kbCodes');
    if (!box) return;
    box.hidden = !st.codes;
    if (!st.codes) return;
    const chars = Array.from(st.text).slice(-160);
    box.innerHTML = chars.length ? chars.map((ch) => {
      const cp = 'U+' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
      const shown = ch === '\n' ? '↵' : ch === ' ' ? '␣' : isMarkOnly(ch) ? 'о' + ch : ch;
      return `<span class="cp"><span class="cs">${esc(shown)}</span>${cp}${NAMES[ch] ? ' ' + NAMES[ch] : ''}</span>`;
    }).join('') : '<span class="cp">пусто</span>';
  }

  function flash(code) {
    if (!kb) return;
    const k = kb.querySelector(`.key[data-code="${code}"]`);
    if (!k) return;
    k.classList.add('pressed');
    setTimeout(() => k.classList.remove('pressed'), 140);
  }

  function onLayoutKey(e, after) {
    if (!st.layout || e.metaKey || e.ctrlKey || e.isComposing) return;
    if (!MAP[e.code]) return;
    const caps = e.getModifierState && e.getModifierState('CapsLock');
    const ch = charFor(e.code, e.shiftKey, e.altKey, caps);
    e.preventDefault();
    if (ch == null) return;
    insertInto(e.target, ch);
    flash(e.code);
    if (after) after();
  }

  function attachLayout(input, after) {
    input.addEventListener('keydown', (e) => onLayoutKey(e, after));
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Shift') { st.physShift = true; updateFaces(); }
    if (e.key === 'Alt') { st.physOpt = true; updateFaces(); }
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'Shift') { st.physShift = false; updateFaces(); }
    if (e.key === 'Alt') { st.physOpt = false; updateFaces(); }
  });
  window.addEventListener('blur', () => { st.physShift = false; st.physOpt = false; updateFaces(); });

  function mount(el) {
    el.innerHTML = `<div class="kbwrap">
<div class="edbar">
  <label class="switch"><input type="checkbox" id="kbLayout"${st.layout ? ' checked' : ''}><span>Славянская раскладка при наборе</span></label>
  <div class="edbtns">
    <button class="btn ghost" data-k="smaller" aria-label="Уменьшить шрифт">A−</button>
    <button class="btn ghost" data-k="bigger" aria-label="Увеличить шрифт">A+</button>
    <button class="btn ghost" data-k="codes">Коды символов</button>
    <button class="btn ghost" data-k="clear">Очистить</button>
    <button class="btn ghost" data-k="check">Проверить правописание</button>
    <button class="btn" data-k="copy">Копировать всё</button>
  </div>
</div>
<textarea id="kbEd" class="cs nocopy" spellcheck="false" autocomplete="off" aria-label="Текст на церковнославянском" placeholder="Начните печатать…"></textarea>
<div id="kbCodes" class="codes" hidden></div>
<div class="kb" id="kb" role="group" aria-label="Экранная клавиатура">${ROWS.map((row) => `<div class="kb-row">${row.map((code) => FN[code]
      ? `<button class="key fn${code === 'SPACE' ? ' space' : ''}" data-code="${code}">${FN[code]}</button>`
      : `<button class="key" data-code="${code}"></button>`).join('')}</div>`).join('')}</div>
<ul class="kbhelp">
  <li>Сначала буква, потом знак: <kbd>F</kbd> <kbd>1</kbd> → <span class="cs">а́</span></li>
  <li><kbd>⇧</kbd> + цифра — обычная цифра</li>
  <li><kbd>${OPT}</kbd> + буква — ещё буквы: <span class="cs">ѡ є ѻ оу і ї ѕ ѳ ѯ ѱ ꙗ ѿ ѷ ѽ</span>${MAC ? '' : ' (левый Alt)'}</li>
  <li><kbd>${OPT}</kbd> + <kbd>1</kbd>…<kbd>5</kbd> — буквенные титла; <kbd>${OPT}</kbd> + <kbd>6</kbd> <kbd>7</kbd> <kbd>8</kbd> — ерок, кендема, кавыка</li>
  <li><kbd>=</kbd> — знак тысяч <span class="cs">҂</span>; <kbd>\\</kbd> — <span class="cs">;</span> (вопрос)</li>
  <li><kbd>${CMD}</kbd> <kbd>C</kbd> / <kbd>${CMD}</kbd> <kbd>V</kbd> — копировать и вставить как обычно</li>
</ul>
<section class="group"><div class="ghead"><h2>Слова под титлом</h2><span class="gnote">нажмите — слово встанет в текст</span></div>
<div class="words" id="kbWords">${TITLA_WORDS.map(([w, r]) => `<button class="word" data-ins="${esc(w)}"><span class="cs">${w}</span><span class="gl">${esc(r)}</span></button>`).join('')}</div></section>
</div>`;

    ed = el.querySelector('#kbEd');
    kb = el.querySelector('#kb');
    ed.value = st.text;
    ed.style.fontSize = st.size + 'px';
    updateFaces();
    renderCodes();

    ed.addEventListener('input', save);
    attachLayout(ed);
    el.querySelector('#kbLayout').addEventListener('change', (e) => {
      st.layout = e.target.checked;
      store.set('cs-layout', st.layout ? '1' : '0');
      ed.focus();
    });

    kb.addEventListener('mousedown', (e) => e.preventDefault());
    kb.addEventListener('click', (e) => {
      const k = e.target.closest('.key');
      if (!k) return;
      const code = k.dataset.code;
      if (code === 'SHIFT') { st.shift = !st.shift; updateFaces(); return; }
      if (code === 'OPTION') { st.opt = !st.opt; updateFaces(); return; }
      if (code === 'BKSP') { ed.focus(); document.execCommand('delete'); return; }
      if (code === 'ENTER') { insertInto(ed, '\n'); return; }
      if (code === 'SPACE') { insertInto(ed, ' '); return; }
      const ch = charFor(code, st.shift || st.physShift, st.opt || st.physOpt, false);
      if (ch == null) return;
      insertInto(ed, ch);
      if (st.shift) { st.shift = false; updateFaces(); }
    });

    el.querySelector('#kbWords').addEventListener('mousedown', (e) => e.preventDefault());
    el.querySelector('#kbWords').addEventListener('click', (e) => {
      const w = e.target.closest('[data-ins]');
      if (w) insertInto(ed, w.dataset.ins);
    });

    el.querySelector('.edbtns').addEventListener('click', (e) => {
      const b = e.target.closest('[data-k]');
      if (!b) return;
      const k = b.dataset.k;
      if (k === 'bigger' || k === 'smaller') {
        st.size = Math.max(18, Math.min(72, st.size + (k === 'bigger' ? 4 : -4)));
        ed.style.fontSize = st.size + 'px';
        store.set('cs-edsize', String(st.size));
      }
      if (k === 'codes') { st.codes = !st.codes; b.classList.toggle('on', st.codes); renderCodes(); }
      if (k === 'clear') { ed.focus(); ed.select(); document.execCommand('delete'); save(); }
      if (k === 'copy' && window.APP) window.APP.copy(ed.value);
      if (k === 'check' && window.APP) { save(); window.APP.go('proverka'); }
    });
    ed.focus();
    ed.setSelectionRange(ed.value.length, ed.value.length);
  }

  function append(text) {
    st.text += text;
    store.set('cs-editor', st.text);
    if (ed && document.body.contains(ed)) ed.value = st.text;
  }
  function getText() { return ed && document.body.contains(ed) ? ed.value : st.text; }
  function setText(text) { st.text = text; store.set('cs-editor', text); }
  function getLayout() { return st.layout; }
  function setLayout(on) { st.layout = !!on; store.set('cs-layout', st.layout ? '1' : '0'); }

  window.KB = { mount, append, attachLayout, charFor, MAP, getText, setText, getLayout, setLayout, insertInto };
})();
