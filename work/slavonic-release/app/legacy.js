'use strict';
/* Перевод из старых церковнославянских кодировок в Юникод.
   Таблицы — из Church Slavonic Converter (Slavonic Computing Initiative, лицензия MIT): legacy-data.js.
   Замены идут по порядку, как в исходном конвертере: порядок важен. */
(() => {
  const NAMES = {
    ucs: 'UCS — шрифты Ирмологион, Триодион, Kyprian и др.',
    hip: 'HIP — текстовая разметка (<w>, \\т, = и т. п.)',
    ocs: 'Old Church Slavonic — шрифты Н. Симмонса',
    cyrtimes: 'Cyrillic Times Old'
  };
  const SHORT = { ucs: 'UCS', hip: 'HIP', ocs: 'Old Church Slavonic', cyrtimes: 'Cyrillic Times Old' };

  function convert(text, enc) {
    const table = window.LEGACY_TABLES && window.LEGACY_TABLES[enc];
    if (!table) return text;
    let t = text;
    for (const [from, to] of table) if (from && from !== to) t = t.split(from).join(to);
    return t;
  }

  // признаки: уже Юникод — есть настоящие славянские буквы и знаки
  const UNICODE_CS = /[Ѡ-҉Ꙁ-ꚟⷠ-ⷿᲀ-ᲈ̀́̑]/;
  const CYR = /[А-я]/;
  const UCS_EXTRA = /[ЂЃѓЉЊЌЋЏђљњќћџЎўЈҐґјЅѕЇїІєЁё¤¦§©«¬®°±µ¶·№»]/;

  /* Угадывает кодировку: 'ucs' | 'hip' | null */
  function detect(text) {
    if (!text || !CYR.test(text)) return null;
    if (UNICODE_CS.test(text)) return null;
    let ucs = 0, hip = 0, words = 0;
    for (const tok of text.split(/\s+/)) {
      if (!CYR.test(tok)) continue;
      words++;
      const core = tok.replace(/^[«"(\[]+|[.,:;!?»")\]]+$/g, '');
      if (/[А-я][0-8#$%&*+<=>@\\^_`{|}~]|[0-8#$%&@\\^_`~][А-я]/.test(core)) ucs++;
      if (UCS_EXTRA.test(core)) ucs++;
      if (/[A-Za-z]/.test(core) && /[А-я]/.test(core)) { ucs += 0.5; hip += 0.5; }
      if (/[А-яa-z]['`^~"]/.test(core) || /\\[А-яa-zA-Z]/.test(core) || /<[^>\s]{1,4}>/.test(core) || /(^|[^\s])_[А-яa-z]/.test(core)) hip++;
    }
    const need = Math.max(2, words * 0.08);
    if (ucs >= need && ucs >= hip) return 'ucs';
    if (hip >= need) return 'hip';
    return null;
  }

  /* Панель перевода над полем ввода: кнопка в панели инструментов + подсказка после вставки */
  function attach(ta, onDone) {
    if (!ta || ta.dataset.legacy) return;
    ta.dataset.legacy = '1';
    const bar = document.createElement('div');
    bar.className = 'legacy';
    bar.hidden = true;
    bar.innerHTML = `<span class="legacy-msg"></span>
<select class="legacy-enc" aria-label="Старая кодировка">${Object.keys(NAMES).map((k) => `<option value="${k}">${NAMES[k]}</option>`).join('')}</select>
<button type="button" class="btn small legacy-go">Перевести в Юникод</button>
<button type="button" class="btn ghost small legacy-close">Не нужно</button>`;
    ta.parentNode.insertBefore(bar, ta);
    const msg = bar.querySelector('.legacy-msg'), sel = bar.querySelector('.legacy-enc');
    const show = (enc, auto) => {
      if (enc) sel.value = enc;
      msg.textContent = auto ? `Похоже, текст в старой кодировке ${SHORT[enc]}.` : 'Из какой кодировки перевести?';
      bar.hidden = false;
    };
    const tools = ta.parentNode.querySelector('.edbar .edbtns');
    if (tools) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn ghost legacy-open';
      b.textContent = 'Из старой кодировки';
      b.title = 'Перевести текст, набранный шрифтами Ирмологион, Триодион и т. п., в Юникод';
      b.addEventListener('click', () => { if (bar.hidden) show(detect(ta.value) || sel.value, !!detect(ta.value)); else bar.hidden = true; });
      tools.insertBefore(b, tools.firstChild);
    }
    bar.querySelector('.legacy-close').addEventListener('click', () => { bar.hidden = true; ta.focus(); });
    bar.querySelector('.legacy-go').addEventListener('click', () => {
      const enc = sel.value;
      const out = convert(ta.value, enc);
      bar.hidden = true;
      if (out === ta.value) return;
      ta.focus();
      ta.select();
      if (!document.execCommand('insertText', false, out)) { ta.value = out; ta.dispatchEvent(new Event('input', { bubbles: true })); }
      if (onDone) onDone(enc);
    });
    ta.addEventListener('paste', () => setTimeout(() => { const enc = detect(ta.value); if (enc) show(enc, true); }, 0));
  }

  window.LEGACY = { convert, detect, attach, NAMES, SHORT };
})();
