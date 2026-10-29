'use strict';
/* Проверка орфографии по словарю Slavonic Computing Initiative (hunspell-cu, лицензия MIT).
   В словаре 141 тыс. словоформ, но не все формы всех слов — поэтому незнакомое слово
   отмечается как совет, а не как ошибка. Если в словаре есть то же слово с другими
   знаками или буквами (е/ѣ, о/ѡ, ударение), предлагается словарное написание. */
(() => {
  const S = { ready: false, failed: false, loading: null, words: null, skel: null };
  const listeners = [];
  const MARKS = /[\p{M}҃-҉ⷠ-ⷿ꙯-ꙿ]/gu;

  const key = (w) => w.normalize('NFC').replace(/ᲂ/g, 'о').replace(/[꙾꙼]/g, '');
  const FOLD = { ѻ: 'о', ѡ: 'о', ѽ: 'о', ᲂ: 'о', є: 'е', ѣ: 'е', э: 'е', ё: 'е', і: 'и', ї: 'и', ѵ: 'и', ѷ: 'и', ꙋ: 'у', ѧ: 'я', ꙗ: 'я', ѕ: 'з', ѯ: 'кс', ѱ: 'пс', ѳ: 'ф', ѿ: 'от' };
  function skeleton(w) {
    const t = w.normalize('NFD').replace(MARKS, '').toLowerCase();
    let out = '';
    for (const ch of t) out += FOLD[ch] !== undefined ? FOLD[ch] : ch;
    return out.replace(/оу/g, 'у');
  }

  function decode(body) {
    const D = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const words = [];
    let prev = '';
    for (const line of body.split('\n')) {
      const n = D.indexOf(line[0]);
      prev = prev.slice(0, n) + line.slice(1);
      words.push(prev);
    }
    return words;
  }

  function prepare(data) {
    S.list = decode(data.words);
    S.words = new Set(S.list);
    S.meta = data.meta;
    S.ready = true;
    // указатель для подсказок строим понемногу, чтобы не останавливать интерфейс
    S.skel = new Map();
    S.skelPos = 0;
    const step = () => { buildSkel(15000); if (S.skelPos < S.list.length) setTimeout(step, 0); };
    setTimeout(step, 0);
  }
  function buildSkel(n) {
    const end = Math.min(S.list.length, S.skelPos + n);
    for (let i = S.skelPos; i < end; i++) {
      const k = skeleton(S.list[i]);
      const a = S.skel.get(k);
      if (a) a.push(i); else S.skel.set(k, [i]);
    }
    S.skelPos = end;
  }

  function load() {
    if (S.ready) return Promise.resolve(true);
    if (S.loading) return S.loading;
    S.loading = new Promise((resolve) => {
      const done = () => {
        try { if (window.SPELL_DATA) { prepare(window.SPELL_DATA); window.SPELL_DATA = null; resolve(true); return; } } catch (e) { /* повреждённые данные */ }
        S.failed = true;
        resolve(false);
      };
      if (window.SPELL_DATA) { done(); return; }
      const s = document.createElement('script');
      s.src = 'spell-data.js';
      s.onload = done;
      s.onerror = () => { S.failed = true; resolve(false); };
      document.head.appendChild(s);
    }).then((ok) => { listeners.splice(0).forEach((f) => f(ok)); return ok; });
    return S.loading;
  }
  const onReady = (f) => { if (S.ready || S.failed) f(S.ready); else listeners.push(f); };

  function skelIndex() {
    if (S.skelPos < S.list.length) buildSkel(S.list.length);
    return S.skel;
  }

  const lowerFirst = (w) => w.charAt(0).toLowerCase() + w.slice(1);
  const upperFirst = (w) => w.charAt(0).toUpperCase() + w.slice(1);
  // в словаре начальное «оу»; в программе — ᲂу (Оу у прописной)
  const display = (w) => w.replace(/^оу/, 'ᲂу');

  /* Есть ли слово в словаре (с учётом прописной буквы в начале) */
  function has(word) {
    if (!S.ready) return null;
    const k = key(word);
    if (S.words.has(k)) return true;
    const lf = lowerFirst(k);
    if (lf !== k && S.words.has(lf)) return true;
    if (k.length > 1 && k === k.toUpperCase() && S.words.has(k.toLowerCase())) return true;
    return false;
  }

  /* Словарные написания с теми же буквами без учёта знаков и парных букв (е/ѣ, о/ѡ, и/і…) */
  function suggest(word, max = 4) {
    if (!S.ready) return [];
    const list = skelIndex().get(skeleton(word)) || [];
    const cap = word.charAt(0) !== word.charAt(0).toLowerCase();
    const seen = new Set();
    const out = [];
    for (const i of list) {
      let w = display(S.list[i]);
      const wcap = w.charAt(0) !== w.charAt(0).toLowerCase();
      if (cap && !wcap) w = upperFirst(w).replace(/^ᲂу/, 'Оу');
      if (!cap && wcap) continue;
      if (!seen.has(w)) { seen.add(w); out.push(w); }
      if (out.length >= max) break;
    }
    return out;
  }

  window.SPELL = {
    load, onReady, has, suggest, skeleton,
    get ready() { return S.ready; },
    get failed() { return S.failed; },
    get size() { return S.words ? S.words.size : 0; }
  };
})();
