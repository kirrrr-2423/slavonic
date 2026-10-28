'use strict';
/* Формы слова: склонение существительных и прилагательных, спряжение глаголов, местоимения.
   Окончания и образцы — по таблицам учебника А. Г. Кравецкого и А. А. Плетнёвой (раздел 25),
   правила образования аориста, имперфекта и повелительного наклонения — по урокам 5, 6, 13. */
(() => {
  const OX = '́', VAR = '̀', KAM = '̑', PSI = '҆';
  const ACC_RE = /[̀́̑]/g;
  const HAS_ACC = /[̀́̑]/;
  const isMark = (ch) => /\p{M}/u.test(ch);
  const VOW = 'аеєиіїоѻѡѽуꙋюꙗѧѣыѵѷяэ';
  const SIB = 'жшчщ';
  const nfc = (s) => s.normalize('NFC').replace(/ѝ/g, 'ѝ').replace(/Ѝ/g, 'Ѝ').replace(/ѐ/g, 'ѐ').replace(/Ѐ/g, 'Ѐ');
  const prep = (s) => String(s).normalize('NFD').replace(/й/g, 'й').replace(/Й/g, 'Й').replace(/ї/g, 'ї').replace(/Ї/g, 'Ї');

  /* ---------- буквы со знаками ---------- */
  function cl(s) {
    const out = [];
    for (const ch of prep(s)) {
      if (isMark(ch) && out.length) out[out.length - 1].m += ch;
      else out.push({ c: ch, m: '' });
    }
    return out;
  }
  const str = (a) => nfc(a.map((x) => x.c + x.m).join(''));
  const low = (x) => x.c.toLowerCase();
  const copy = (a) => a.map((x) => ({ c: x.c, m: x.m }));
  const plainOf = (a) => a.map(low).join('');
  // ключ для сравнения форм: буквы и место ударения
  const formKey = (a) => plainOf(a) + '@' + a.findIndex((x) => /[\u0300\u0301\u0311]/.test(x.m));
  const lastLetter = (a) => { for (let i = a.length - 1; i >= 0; i--) if (/\p{L}/u.test(a[i].c)) return i; return -1; };
  function vowelFlags(a) {
    return a.map((x, i) => {
      const b = low(x);
      if ((b === 'о' || b === 'ᲂ') && a[i + 1] && low(a[i + 1]) === 'у') return false;
      return VOW.includes(b);
    });
  }
  const stressAt = (a) => a.findIndex((x) => HAS_ACC.test(x.m));
  const clear = (a) => { a.forEach((x) => { x.m = x.m.replace(ACC_RE, ''); }); return a; };
  // ударение: на последней букве слова — вария, иначе оксия; камора — для различения форм
  function put(a, i, kind) {
    if (i < 0 || !a[i]) return a;
    const mark = kind === 'k' ? KAM : (i === lastLetter(a) ? VAR : OX);
    const x = a[i];
    if (x.c === 'ї') x.c = 'і';
    if (x.c === 'Ї') x.c = 'І';
    x.m = x.m.replace(ACC_RE, '');
    x.m = x.m.includes(PSI) ? x.m.replace(PSI, PSI + mark) : x.m + mark;
    return a;
  }
  const PAL1 = { к: 'ч', г: 'ж', х: 'ш', ц: 'ч' };
  const PAL2 = { к: 'ц', г: 'з', х: 'с' };
  function palat(a, table) {
    const i = lastLetter(a);
    if (i < 0) return;
    const b = low(a[i]);
    if (table[b]) a[i].c = a[i].c === b ? table[b] : table[b].toUpperCase();
  }

  /* основа + окончание. Окончание: '¹…' — первая палатализация (к→ч), '²…' — вторая (к→ц).
     mode: S — ударение основы, E — на окончании, L — на последнем слоге основы, N — без ударения */
  function build(stem, ending, mode, num) {
    let e = ending, pal = null;
    if (e[0] === '¹' || e[0] === '²') { pal = e[0]; e = e.slice(1); }
    const s = copy(stem);
    if (pal === '¹') palat(s, PAL1);
    if (pal === '²') palat(s, PAL2);
    const li = lastLetter(s);
    const lb = li >= 0 ? low(s[li]) : '';
    if (e) {
      if (SIB.includes(lb) || lb === 'ц') e = e.replace(/^ю/, 'ꙋ').replace(/^ѧ/, 'а').replace(/^о/, 'е').replace(/^ѡ/, 'є');
      if (lb === 'ц') e = e.replace(/^и/, 'ы');
      if (SIB.includes(lb) && num && num !== 'sg') e = e.replace(/^и(?![̀-ͯ])/, 'ы').replace(/^имъ$/, 'ымъ');
      if ('кгх'.includes(lb)) e = e.replace(/^ы(?=[аеиоуюѧꙗѣй])/, 'ї').replace(/^ы/, 'и');
      if (e === 'ь' && SIB.includes(lb)) e = 'ъ';
      if (e === 'ь' && VOW.includes(lb)) e = 'й';
    }
    const ec = cl(e);
    const a = s.concat(ec);
    const stemLen = s.length;
    const si = stressAt(s);
    const vf = vowelFlags(a);
    let firstEndV = -1;
    for (let i = stemLen; i < a.length; i++) if (vf[i]) { firstEndV = i; break; }
    let lastStemV = -1;
    for (let i = stemLen - 1; i >= 0; i--) if (vf[i]) { lastStemV = i; break; }
    clear(a);
    let at = -1;
    if (mode === 'S') at = si >= 0 ? si : (firstEndV >= 0 ? firstEndV : lastStemV);
    else if (mode === 'E') at = firstEndV >= 0 ? firstEndV : lastStemV;
    else if (mode === 'L') at = lastStemV >= 0 ? lastStemV : firstEndV;
    if (mode !== 'N' && at >= 0) put(a, at);
    return { a, stemLen };
  }
  const asIs = (input, stemLen) => ({ a: copy(input), stemLen });

  // форма мн. или дв. числа совпала с формой ед. числа: о → ѡ, е → є в основе или камора
  function distinguish(f) {
    const a = f.a, sl = f.stemLen;
    const si = stressAt(a);
    if (si >= sl) { put(a, si, 'k'); return 'k'; }
    for (let i = Math.min(sl, a.length) - 1; i >= 1; i--) {
      const b = low(a[i]);
      if (b === 'о' && !(a[i + 1] && low(a[i + 1]) === 'у')) { a[i].c = a[i].c === 'о' ? 'ѡ' : 'Ѡ'; return 'o'; }
      if (b === 'е') { a[i].c = a[i].c === 'е' ? 'є' : 'Є'; return 'e'; }
    }
    if (si >= 0) { put(a, si, 'k'); return 'k'; }
    return '';
  }

  /* ---------- ввод: русские буквы → церковнославянские ---------- */
  function fromCivil(w) {
    let s = w.toLowerCase().replace(/ё/g, 'е');
    const first = s[0];
    let head = { е: 'є', э: 'є', о: 'ѻ', у: 'ᲂу', я: 'ꙗ' }[first] || first;
    let rest = s.slice(1).replace(/э/g, 'е').replace(/у/g, 'ꙋ').replace(/я/g, 'ѧ').replace(/и(?=[аеиоуꙋыэюѧй])/g, 'ї').replace(/тися$/, 'тисѧ');
    if (VOW.includes(first) || first === 'у') head += PSI;
    let out = head + rest;
    if (/[бвгджзклмнпрстфхцчшщ]$/.test(out)) out += 'ъ';
    return out;
  }
  // ударение на последней букве в начальной форме — вария
  function fixFinal(w) {
    const a = cl(w);
    const si = stressAt(a);
    if (si >= 0 && si === lastLetter(a) && !a[si].m.includes(KAM)) put(a, si);
    return str(a);
  }
  function normalizeInput(raw) {
    const w = String(raw).trim().split(/\s+/)[0] || '';
    if (!w) return { word: '', civil: false };
    if (/^[а-яё]+$/i.test(w)) {
      // русские окончания → церковнославянские: любить → любити, святой → святый
      const lw = w.toLowerCase();
      const cands = [lw];
      if (/ться$/.test(lw)) cands.unshift(lw.replace(/ться$/, 'тися'));
      else if (/ть$/.test(lw)) cands.unshift(lw.replace(/ть$/, 'ти'));
      else if (/чь$/.test(lw)) cands.unshift(lw.replace(/чь$/, 'щи'));
      if (/ой$/.test(lw)) cands.unshift(lw.replace(/ой$/, 'ый'));
      const D = window.DICT && window.DICT.ready && window.DICT.csForm ? window.DICT : null;
      for (const c of cands) {
        const d = D ? D.csForm(c) : null;
        if (d && !/[҃ⷠ-ⷿ]/.test(d)) return { word: fixFinal(d.charAt(0).toLowerCase() + d.slice(1)), civil: true, fromDict: true };
      }
      let cs = fromCivil(cands[0]);
      if (/ой$/.test(lw)) cs = cs.replace(/ый$/, 'ы́й');
      return { word: cs.normalize('NFC'), civil: true };
    }
    return { word: fixFinal(w), civil: false };
  }
  const plainWord = (w) => plainOf(cl(w)).replace(/ᲂ/g, 'о').replace(/[^\p{L}]/gu, '');

  /* ---------- существительные ---------- */
  const NOUN = {
    m_hard: { label: '1-е скл., м. р., твёрдое', ex: 'ра́бъ, и҆споли́нъ', g: 'm',
      sg: ['=', 'а', 'ꙋ', 'а|=', 'омъ', '²ѣ', '¹е'], du: ['а', 'ꙋ', 'ома'], pl: ['²и', '=|ѡвъ', 'ѡмъ', 'ы|ѡвъ', 'ы|ами', '²ѣхъ'] },
    m_soft: { label: '1-е скл., м. р., мягкое', ex: 'па́стырь, ца́рь, кра́й', g: 'm',
      sg: ['=', 'ѧ', 'ю|еви', 'ѧ|=', 'емъ', 'и|ѣ', 'ю'], du: ['ѧ', 'ю', 'ема'], pl: ['їе', 'ей', 'ємъ', 'и|ей', 'и|ѧми|ьми', 'ехъ'] },
    n_hard: { label: '1-е скл., ср. р., твёрдое', ex: 'ча́до', g: 'n',
      sg: ['=', 'а', 'ꙋ', '=', 'омъ', '²ѣ', '='], du: ['а', 'ꙋ', 'ома'], pl: ['а', 'ъ', 'ѡмъ|амъ', 'а', 'ы|ами', '²ѣхъ|ахъ'] },
    n_soft: { label: '1-е скл., ср. р., мягкое', ex: 'по́ле, зна́менїе', g: 'n',
      sg: ['=', 'ѧ', 'ю', '=', 'емъ', 'и|ѣ', '='], du: ['ѧ', 'ю', 'ема'], pl: ['ѧ', 'ей', 'ємъ', 'ѧ', 'и|ѧми|ьми', 'ѧхъ|ехъ|ихъ'] },
    f_hard: { label: '2-е скл., твёрдое', ex: 'ри́за, рꙋка̀, влады́ка', g: 'f',
      sg: ['=', 'ы', '²ѣ', 'ꙋ', 'ою', '²ѣ', 'о'], du: ['²ѣ', 'ꙋ', 'ама'], pl: ['ы', 'ъ', 'амъ', 'ы', 'ами', 'ахъ'] },
    f_soft: { label: '2-е скл., мягкое', ex: 'пꙋсты́нѧ, землѧ̀, дꙋша̀', g: 'f',
      sg: ['=', 'и', 'и', 'ю', 'ею', 'и', 'е|ѧ'], du: ['и|ѣ', 'ю', 'ѧма'], pl: ['и', 'ь', 'ѧмъ', 'и', 'ѧми', 'ѧхъ'] },
    f_third: { label: '3-е скл.', ex: 'мꙋ́дрость, ко́сть', g: 'f',
      sg: ['=', 'и', 'и', '=', 'їю', 'и', 'е'], du: ['и', 'їю', 'ема|ьма'], pl: ['и', 'ей', 'емъ', 'и', 'ьми', 'ехъ'] },
    n_men: { label: '4-е скл., на -мѧ', ex: 'и҆́мѧ, сѣ́мѧ, вре́мѧ', g: 'n',
      sg: ['=', 'е', 'и', '=', 'емъ', 'и', '='], du: ['и', 'ꙋ', 'ема|ама'], pl: ['а', 'ъ', 'ємъ|ѡмъ', 'а', 'ы', 'ѣхъ'],
      st: { du: ['S', 'E', 'E'], pl: ['E', 'L', 'S', 'E', 'E', 'S'] } },
    n_jat: { label: '4-е скл., на -ѧ (-ѧт-)', ex: 'ѻ҆слѧ̀, ѻ҆́трочѧ', g: 'n',
      sg: ['=', 'е', 'и', '=', 'емъ', 'и', '='], du: ['и', 'ꙋ', 'ема|ама'], pl: ['а', 'ъ', 'ємъ|ѡмъ', 'а', 'ы', 'ѣхъ'] },
    n_es: { label: '4-е скл., на -о (-ес-)', ex: 'сло́во, не́бо, чꙋ́до', g: 'n',
      sg: ['=', 'е', 'и', '=', 'емъ', 'и', '='], du: ['и|а', 'ꙋ', 'ема|ама'], pl: ['а', 'ъ', 'ємъ', 'а', 'ы|ами', 'ѣхъ'],
      st: { sg: ['S', 'E', 'E', 'S', 'E', 'E', 'S'], du: ['E', 'E', 'E'], pl: ['E', 'L', 'E', 'E', 'E', 'E'] } },
    f_mater: { label: '4-е скл., ма́ти, дщи', ex: 'ма́ти, дщѝ', g: 'f',
      sg: ['=', 'е', 'и', 'ь', 'їю', 'и', '='], du: ['и', 'їю', 'ема'], pl: ['и', 'їй|ей', 'емъ', 'ей|и', 'ьми', 'ехъ'] },
    m_men: { label: '4-е скл., м. р. на -ень', ex: 'ка́мень, ко́рень', g: 'm',
      sg: ['=', 'е', 'и', '=', 'емъ', 'и', '='], du: ['и', 'ꙋ', 'ьма'], pl: ['и|їѧ', 'їй', 'ємъ', 'и', 'ьми', 'ехъ'] },
    f_ov: { label: '4-е скл., на -ы (-ов-)', ex: 'любы̀, свекры̀', g: 'f',
      sg: ['=', 'е', 'и', 'ь', 'їю', 'и', '='], du: ['и', 'їю', 'ама'], pl: ['и', 'ей', 'амъ', 'и', 'ами', 'ахъ'],
      st: { sg: ['S', 'L', 'L', 'L', 'L', 'L', 'S'], du: ['L', 'L', 'L'], pl: ['L', 'L', 'L', 'L', 'L', 'L'] } }
  };
  const M_MEN = ['камен', 'корен', 'пламен', 'ремен', 'кремен', 'ячмен', 'перстен'];
  const N_ES = ['слов', 'неб', 'чуд', 'тел', 'древ', 'кол'];
  const F_WORDS = /(ость|есть|сть|рть|ль|щь|чь|шь|жь|нь)$/;

  function detectNoun(w) {
    const p = plainWord(w);
    if (/^(мати|дщи)$/.test(p)) return 'f_mater';
    if (/мѧ$/.test(p)) return 'n_men';
    if (/[ѧꙗ]$/.test(p)) return 'f_soft';
    if (/ы$/.test(p)) return 'f_ov';
    if (/а$/.test(p)) return /[жшчщц]а$/.test(p) ? 'f_soft' : 'f_hard';
    if (/о$/.test(p)) return N_ES.includes(p.slice(0, -1).replace(/ѣ/g, 'е')) ? 'n_es' : 'n_hard';
    if (/е$/.test(p)) return 'n_soft';
    if (/й$/.test(p)) return 'm_soft';
    if (/ь$/.test(p)) {
      const st = p.slice(0, -1).replace(/[ѣє]/g, 'е');
      if (M_MEN.includes(st)) return 'm_men';
      if (/(тель|арь|ырь|ерь)$/.test(p)) return 'm_soft';
      return F_WORDS.test(p) ? 'f_third' : 'm_soft';
    }
    return 'm_hard';
  }

  // основа для каждого типа
  function nounStem(input, type) {
    const a = cl(input);
    const li = lastLetter(a);
    const p = plainWord(input);
    const cut = (n) => a.slice(0, a.length - n);
    if (type === 'n_men') return { stem: cut(1).concat(cl('ен')), nomStem: a.length - 1 };
    if (type === 'n_jat') return { stem: copy(a).concat(cl('т')), nomStem: a.length };
    if (type === 'n_es') return { stem: cut(1).concat(cl('ес')), nomStem: a.length - 1 };
    if (type === 'f_mater') return { stem: cut(1).concat(cl('ер')), nomStem: a.length - 1, lmode: stressAt(cut(1)) < 0 };
    if (type === 'f_ov') return { stem: cut(1).concat(cl('ов')), nomStem: a.length - 1 };
    if (type === 'm_hard') {
      const base = /ъ$/.test(p) ? cut(1) : copy(a);
      const nom = base.length;
      // беглый е: ѻ҆те́цъ — ѻ҆тца̀
      if (/[^аеиоуыѣ]ец$/.test(p.replace(/ъ$/, '')) && base.length > 3) {
        const st = copy(base);
        st.splice(st.length - 2, 1);
        return { stem: st, nomStem: nom, fleeting: true };
      }
      return { stem: base, nomStem: nom };
    }
    if (li >= 0 && /[ъьйаѧꙗоеы]/.test(low(a[li]))) return { stem: cut(1), nomStem: a.length - 1 };
    return { stem: copy(a), nomStem: a.length };
  }

  function nounTable(type, st) {
    const T = NOUN[type];
    const sl = st.stem;
    const p = plainOf(sl);
    const tab = { sg: T.sg.slice(), du: T.du.slice(), pl: T.pl.slice() };
    if (type === 'm_soft' && VOW.includes(p.slice(-1))) {
      // кра́й, і҆ере́й
      tab.sg[5] = 'и'; tab.pl[0] = 'и'; tab.pl[4] = 'и|ѧми';
      tab.pl[1] = 'євъ';
      if (/е$/.test(p)) { tab.sg[1] = 'а'; tab.sg[3] = 'а|='; tab.du[0] = 'а'; tab.pl[0] = 'є'; tab.pl[1] = 'й'; }
    }
    if (type === 'n_soft' && /[їи]$/.test(p)) { tab.sg[5] = 'и'; tab.pl[1] = 'й'; tab.pl[4] = 'и|ѧми'; tab.pl[5] = 'ихъ|ѧхъ'; }
    if (type === 'f_soft' && /[їи]$/.test(p)) tab.pl[1] = 'й';
    if (type === 'm_hard' && /ц$/.test(p)) tab.sg[4] = 'емъ';
    return tab;
  }

  function declineNoun(input, type, opts = {}) {
    const T = NOUN[type];
    const st = nounStem(input, type);
    const tab = nounTable(type, st);
    const inp = cl(input);
    const hasStress = stressAt(inp) >= 0;
    const endStressed = hasStress && stressAt(inp) >= st.nomStem;
    let base = opts.stress || 'auto';
    const modeFor = (num, i) => {
      if (base === 'none' || !hasStress) return st.lmode && base !== 'none' && hasStress ? 'L' : 'N';
      if (base === 'stem') return 'S';
      if (base === 'end') return 'E';
      if (T.st && T.st[num]) return T.st[num][i];
      if (st.lmode) return 'L';
      return endStressed && type !== 'n_jat' ? 'E' : 'S';
    };
    const out = { sg: [], du: [], pl: [] };
    ['sg', 'du', 'pl'].forEach((num) => {
      tab[num].forEach((cell, i) => {
        out[num][i] = cell.split('|').map((ending) => {
          let f;
          if (ending === '=') f = asIs(inp, st.nomStem);
          else if (st.fleeting && num === 'sg' && i === 6 && modeFor(num, i) !== 'N') f = build(st.stem, ending, 'L', num);
          else f = build(st.stem, ending, modeFor(num, i), num);
          if (!hasStress || base === 'none') clear(f.a);
          return f;
        });
      });
    });
    // различение форм
    const sgPlain = new Set();
    out.sg.forEach((cell) => cell.forEach((f) => sgPlain.add(formKey(f.a))));
    const notes = new Set();
    if (hasStress && base !== 'none') ['du', 'pl'].forEach((num) => out[num].forEach((cell) => cell.forEach((f) => {
      if (sgPlain.has(formKey(f.a))) { const k = distinguish(f); if (k) notes.add(k); }
    })));
    const S = (cell) => cell.map((f) => str(f.a));
    return {
      pos: 'noun', type, label: T.label,
      sg: out.sg.map(S), du: out.du.map(S), pl: out.pl.map(S),
      notes: Array.from(notes), animate: T.g === 'm', fleeting: !!st.fleeting, noStress: !hasStress
    };
  }

  /* ---------- прилагательные ---------- */
  const ADJ_HARD = {
    m: { sg: ['ый', 'агѡ', 'омꙋ', 'ый|аго', 'ымъ', '²ѣмъ|омъ'], du: ['аѧ', 'ꙋю', 'ыма'], pl: ['їи', 'ыхъ', 'ымъ', 'ыѧ|ыхъ', 'ыми', 'ыхъ'] },
    n: { sg: ['ое', 'агѡ', 'омꙋ', 'ое', 'ымъ', '²ѣмъ|омъ'], du: ['²ѣи', 'ꙋю', 'ыма'], pl: ['аѧ', 'ыхъ', 'ымъ', 'аѧ', 'ыми', 'ыхъ'] },
    f: { sg: ['аѧ', 'ыѧ', '²ѣй|ой', 'ꙋю', 'ою', '²ѣй|ой'], du: ['²ѣи', 'ꙋю', 'ыма'], pl: ['ыѧ', 'ыхъ', 'ымъ', 'ыѧ|ыхъ', 'ыми', 'ыхъ'] }
  };
  const ADJ_SOFT = {
    m: { sg: ['їй', 'ѧгѡ', 'емꙋ', 'їй|ѧго', 'имъ', 'емъ|ѣмъ'], du: ['ѧѧ', 'юю', 'има'], pl: ['їи', 'ихъ', 'имъ', 'їѧ|ихъ', 'ими', 'ихъ'] },
    n: { sg: ['ее', 'ѧгѡ', 'емꙋ', 'ее', 'имъ', 'емъ|ѣмъ'], du: ['їи', 'юю', 'има'], pl: ['ѧѧ', 'ихъ', 'имъ', 'ѧѧ', 'ими', 'ихъ'] },
    f: { sg: ['ѧѧ', 'їѧ', 'ей', 'юю', 'ею', 'ей|ѣй'], du: ['їи', 'юю', 'има'], pl: ['їѧ', 'ихъ', 'имъ', 'їѧ|ихъ', 'ими', 'ихъ'] }
  };
  // смешанный (после шипящих, то́щїй): как мягкий, но а вместо ѧ, ꙋ вместо ю; во мн. ч. — ы
  const ADJ_MIX = {
    m: { sg: ['їй', 'агѡ', 'емꙋ', 'їй|аго', 'имъ', 'емъ'], du: ['аѧ', 'ꙋю', 'има'], pl: ['їи', 'ихъ', 'ымъ', 'ыѧ|ихъ', 'ими', 'ихъ'] },
    n: { sg: ['ее', 'агѡ', 'емꙋ', 'ее', 'имъ', 'емъ'], du: ['їи', 'ꙋю', 'има'], pl: ['аѧ', 'ихъ', 'ымъ', 'аѧ', 'ими', 'ихъ'] },
    f: { sg: ['аѧ', 'їѧ', 'ей', 'ꙋю', 'ею', 'ей'], du: ['їи', 'ꙋю', 'има'], pl: ['ыѧ', 'ихъ', 'ымъ', 'ыѧ|ихъ', 'ими', 'ихъ'] }
  };
  // притяжательные на -їй (бо́жїй, вра́жїй): бж҃їѧ, бж҃їю, бж҃їимъ
  const ADJ_POSS = {
    m: { sg: ['їй', 'їѧ', 'їю', 'їй|їѧ', 'їимъ', 'їи'], du: ['їѧ', 'їю', 'їима'], pl: ['їи', 'їихъ', 'їимъ', 'їѧ|їихъ', 'їими', 'їихъ'] },
    n: { sg: ['їе', 'їѧ', 'їю', 'їе', 'їимъ', 'їи'], du: ['їи', 'їю', 'їима'], pl: ['їѧ', 'їихъ', 'їимъ', 'їѧ', 'їими', 'їихъ'] },
    f: { sg: ['їѧ', 'їѧ', 'їи', 'їю', 'їею', 'їи'], du: ['їи', 'їю', 'їима'], pl: ['їѧ', 'їихъ', 'їимъ', 'їѧ', 'їими', 'їихъ'] }
  };
  const ADJ_SHORT = {
    hard: { m: ['ъ', 'а', '²и'], n: ['о', '²ѣ', 'а'], f: ['а', '²ѣ', 'ы'] },
    soft: { m: ['ь', 'ѧ', 'и'], n: ['е', 'и', 'ѧ'], f: ['ѧ', 'и', 'и'] },
    mix: { m: ['ь', 'а', 'и'], n: ['е', 'и', 'а'], f: ['а', 'и', 'ы'] },
    poss: { m: ['їй', 'їѧ', 'їи'], n: ['їе', 'їи', 'їѧ'], f: ['їѧ', 'їи', 'їѧ'] }
  };
  const ADJ_KIND = { hard: 'твёрдое (млады́й, до́брый)', velar: 'на к, г, х (вели́кїй, бла́гїй)', soft: 'мягкое (си́нїй, и҆́скреннїй)', mix: 'на шипящую (то́щїй, ѻ҆́тчїй)', poss: 'притяжательное (бо́жїй, вра́жїй)' };
  const COMP_IRREG = { великий: ['бо́лїй', 'бо́лшїй · вѧ́щшїй'], добрый: ['лꙋ́чшїй', 'лꙋ́чшїй'], благий: ['ᲂу҆́нїй', 'ᲂу҆́ншїй'], малый: ['ме́нїй', 'ме́ншїй'], злый: ['го́рїй', 'го́ршїй'] };

  function detectAdj(w) {
    const a = cl(w);
    const p = plainWord(w).replace(/ї/g, 'і');
    const m = p.match(/(ый|ій|ий|ой|аѧ|ѧѧ|ое|ее|ъ|ь|а|ѧ|о|е)$/);
    const endLen = m ? cl(m[1]).length : 0;
    const stem = a.slice(0, a.length - endLen);
    const sp = plainOf(stem);
    const lastc = sp.slice(-1);
    let kind;
    if (/^(ий|ій|ѧѧ|ее|ь|ѧ|е)$/.test(m ? m[1] : '')) kind = SIB.includes(lastc) ? 'mix' : 'soft';
    else kind = SIB.includes(lastc) ? 'mix' : 'hard';
    if (kind !== 'mix' && 'кгх'.includes(lastc)) kind = 'velar';
    if (kind === 'soft' && 'кгх'.includes(lastc)) kind = 'velar';
    if (kind === 'mix' && lastc === 'ж' && /[ії]й$/.test(p)) kind = 'poss';
    return { stem, kind, endStressed: stressAt(a) >= stem.length, hasStress: stressAt(a) >= 0, lemma: p };
  }

  function declineAdj(input, kindOverride, opts = {}) {
    const d = detectAdj(input);
    const kind = kindOverride || d.kind;
    const TAB = kind === 'soft' ? ADJ_SOFT : kind === 'mix' ? ADJ_MIX : kind === 'poss' ? ADJ_POSS : ADJ_HARD;
    const stressMode = opts.stress || 'auto';
    const mode = !d.hasStress || stressMode === 'none' ? 'N' : stressMode === 'stem' ? 'S' : stressMode === 'end' ? 'E' : (d.endStressed ? 'E' : 'S');
    const res = { pos: 'adj', kind, label: ADJ_KIND[kind], full: {}, short: {}, notes: [] };
    const all = [];
    ['m', 'n', 'f'].forEach((g) => {
      res.full[g] = {};
      ['sg', 'du', 'pl'].forEach((num) => {
        res.full[g][num] = TAB[g][num].map((cell) => cell.split('|').map((e) => {
          const f = build(d.stem, e, mode, num);
          f.num = num;
          all.push(f);
          return f;
        }));
      });
    });
    const sgPlain = new Set(all.filter((f) => f.num === 'sg').map((f) => formKey(f.a)));
    const notes = new Set();
    all.filter((f) => f.num !== 'sg').forEach((f) => { if (sgPlain.has(formKey(f.a))) { const k = distinguish(f); if (k) notes.add(k); } });
    ['m', 'n', 'f'].forEach((g) => ['sg', 'du', 'pl'].forEach((num) => { res.full[g][num] = res.full[g][num].map((cell) => cell.map((f) => str(f.a))); }));
    // краткие формы: И. ед., дв., мн. (у прилагательных с ударным окончанием — как мла́дъ, мла́до, млада̀)
    const SH = ADJ_SHORT[kind === 'velar' ? 'hard' : kind];
    const SHM = { m: ['L', 'L', 'L'], n: ['L', 'E', 'L'], f: ['E', 'E', 'L'] };
    const shMode = (g, i) => (mode === 'E' ? SHM[g][i] : mode);
    const shortAll = [];
    ['m', 'n', 'f'].forEach((g) => {
      res.short[g] = SH[g].map((e, i) => { const f = build(d.stem, e, shMode(g, i), ['sg', 'du', 'pl'][i]); f.num = i ? 'x' : 'sg'; shortAll.push(f); return f; });
    });
    // для сравнения — и косвенные падежи ед. ч. кратких форм (Р., Д., П.)
    const shSg = new Set(shortAll.filter((f) => f.num === 'sg').map((f) => formKey(f.a)));
    const OBL = kind === 'soft' ? { m: ['ѧ', 'ю', 'и'], f: ['и', 'и', 'и'] } : kind === 'mix' ? { m: ['а', 'ꙋ', 'и'], f: ['и', 'и', 'и'] } : kind === 'poss' ? { m: ['їѧ', 'їю', 'їи'], f: ['їѧ', 'їи', 'їи'] } : { m: ['а', 'ꙋ', '²ѣ'], f: ['ы', '²ѣ', '²ѣ'] };
    ['m', 'f'].forEach((g) => OBL[g].forEach((e) => { shSg.add(formKey(build(d.stem, e, mode === 'E' ? (g === 'm' ? 'L' : 'E') : mode, 'sg').a)); }));
    shortAll.filter((f) => f.num !== 'sg').forEach((f) => { if (shSg.has(formKey(f.a))) distinguish(f); });
    ['m', 'n', 'f'].forEach((g) => { res.short[g] = res.short[g].map((f) => str(f.a)); });
    // сравнительная степень
    const key = d.lemma.replace(/і/g, 'и').replace(/ї/g, 'и');
    const ir = COMP_IRREG[key];
    if (ir) res.comp = { short: ir[0], full: ir[1] };
    else if (kind === 'poss') res.comp = null;
    else {
      const stem = copy(d.stem);
      const lc = low(stem[lastLetter(stem)] || { c: '' });
      let suf = 'ѣ';
      if ('кгх'.includes(lc) || SIB.includes(lc)) { palat(stem, PAL1); suf = 'а'; }
      const mk = (e) => { const f = build(stem, suf + e, d.hasStress ? 'E' : 'N', 'sg'); return str(f.a); };
      res.comp = { short: `${mk('й')} · ${mk('е')} · ${mk('йши')}`, full: `${mk('йшїй')} · ${mk('йшее')} · ${mk('йшаѧ')}` };
    }
    const pre = cl('пре' + str(clear(cl(input))));
    res.super = str(d.hasStress ? (() => { const a2 = cl('пре' + input); return a2; })() : pre);
    res.notes = Array.from(notes);
    return res;
  }

  /* ---------- глаголы ---------- */
  const PRES_I = ['ꙋ', 'еши', 'етъ', 'ева|евѣ', 'ета|етѣ', 'ета|етѣ', 'емъ', 'ете', 'ꙋтъ'];
  const PRES_II = ['ю', 'иши', 'итъ', 'ива|ивѣ', 'ита|итѣ', 'ита|итѣ', 'имъ', 'ите', 'ѧтъ'];
  const IRR_VERBS = {
    быти: { pres: ['є҆́смь', 'є҆сѝ', 'є҆́сть', 'є҆сва̀ · є҆свѣ̀', 'є҆ста̀ · є҆стѣ̀', 'є҆ста̀ · є҆стѣ̀', 'є҆смы̀', 'є҆стѐ', 'сꙋ́ть'],
      aor: ['бы́хъ', 'бы̀', 'бы́сть · бы̀', 'бы́хова · бы́ховѣ', 'бы́ста · бы́стѣ', 'бы́ста · бы́стѣ', 'бы́хомъ', 'бы́сте', 'бы́ша'],
      aor2: ['бѣ́хъ', 'бѣ̀', 'бѣ̀', 'бѣ́хова · бѣ́ховѣ', 'бѣ́ста · бѣ́стѣ', 'бѣ́ста · бѣ́стѣ', 'бѣ́хомъ', 'бѣ́сте', 'бѣ́ша'],
      imp: ['бѧ́хъ', 'бѧ́ше', 'бѧ́ше', 'бѧ́хова · бѧ́ховѣ', 'бѧ́ста · бѧ́стѣ', 'бѧ́ста · бѧ́стѣ', 'бѧ́хомъ', 'бѧ́сте', 'бѧ́хꙋ · бѣ́хꙋ'],
      fut: ['бꙋ́дꙋ', 'бꙋ́деши', 'бꙋ́детъ', 'бꙋ́дева · бꙋ́девѣ', 'бꙋ́дета · бꙋ́детѣ', 'бꙋ́дета · бꙋ́детѣ', 'бꙋ́демъ', 'бꙋ́дете', 'бꙋ́дꙋтъ'],
      impv: ['—', 'бꙋ́ди', '—', 'бꙋ́дева', 'бꙋ́дита', '—', 'бꙋ́демъ', 'бꙋ́дите', '—'], l: 'бы́лъ' },
    дати: { pres: ['да́мъ', 'да́си', 'да́стъ', 'да́ва · да́вѣ', 'да́ста · да́стѣ', 'да́ста · да́стѣ', 'да́мы', 'да́сте', 'дадꙋ́тъ · дадѧ́тъ'], futNote: true,
      aor: ['да́хъ', 'дадѐ · да̀', 'дадѐ · да̀', 'да́хова · да́ховѣ', 'да́ста · да́стѣ', 'да́ста · да́стѣ', 'да́хомъ', 'да́сте', 'да́ша'],
      impv: ['—', 'да́ждь', '—', 'да́дива', 'да́дита', '—', 'да́димъ', 'да́дите', '—'], l: 'да́лъ' },
    ꙗсти: { pres: ['ꙗ҆́мъ', 'ꙗ҆́си', 'ꙗ҆́стъ', 'ꙗ҆́ва · ꙗ҆́вѣ', 'ꙗ҆́ста · ꙗ҆́стѣ', 'ꙗ҆́ста · ꙗ҆́стѣ', 'ꙗ҆́мы', 'ꙗ҆́сте', 'ꙗ҆дѧ́тъ'],
      aor: ['ꙗ҆́дохъ', 'ꙗ҆дѐ', 'ꙗ҆дѐ', 'ꙗ҆́дохова · ꙗ҆́доховѣ', 'ꙗ҆́доста · ꙗ҆́достѣ', 'ꙗ҆́доста · ꙗ҆́достѣ', 'ꙗ҆́дохомъ', 'ꙗ҆́досте', 'ꙗ҆́доша'],
      impv: ['—', 'ꙗ҆́ждь', '—', 'ꙗ҆ди́ва', 'ꙗ҆ди́та', '—', 'ꙗ҆ди́мъ', 'ꙗ҆ди́те', '—'], l: 'ꙗ҆́лъ' },
    ведети: { pres: ['вѣ́мъ', 'вѣ́си', 'вѣ́сть', 'вѣ́ва · вѣ́вѣ', 'вѣ́ста · вѣ́стѣ', 'вѣ́ста · вѣ́стѣ', 'вѣ́мы', 'вѣ́сте', 'вѣ́дѧтъ'],
      aor: ['вѣ́дѣхъ', 'вѣ́дѣ', 'вѣ́дѣ', 'вѣ́дѣхова · вѣ́дѣховѣ', 'вѣ́дѣста · вѣ́дѣстѣ', 'вѣ́дѣста · вѣ́дѣстѣ', 'вѣ́дѣхомъ', 'вѣ́дѣсте', 'вѣ́дѣша'],
      impv: ['—', 'вѣ́ждь', '—', 'вѣ́дива', 'вѣ́дита', '—', 'вѣ́димъ', 'вѣ́дите', '—'], l: 'вѣ́дѣлъ' },
    имети: { pres: ['и҆́мамъ', 'и҆́маши', 'и҆́мать', 'и҆́мава · и҆́мавѣ', 'и҆́мата · и҆́матѣ', 'и҆́мата · и҆́матѣ', 'и҆́мамы', 'и҆́мате', 'и҆́мꙋтъ'], l: 'и҆мѣ́лъ' },
    имати: { pres: ['и҆́мамъ', 'и҆́маши', 'и҆́мать', 'и҆́мава · и҆́мавѣ', 'и҆́мата · и҆́матѣ', 'и҆́мата · и҆́матѣ', 'и҆́мамы', 'и҆́мате', 'и҆́мꙋтъ'], l: 'и҆мѣ́лъ' }
  };

  // догадка о 1-м лице ед. ч. настоящего времени
  const MUT = [[/ст$/, 'щ'], [/зд$/, 'жд'], [/д$/, 'жд'], [/т$/, 'щ'], [/з$/, 'ж'], [/с$/, 'ш'], [/([бвмпф])$/, '$1л']];
  function guessPresent(inf) {
    const r = guessPresent0(inf);
    // ити: ударение на суффиксе (ходи́ти) — в 1-м лице на окончании (хождꙋ̀)
    const a = cl(inf);
    const si = stressAt(a);
    if (si >= 0 && r.cons && si === lastLetter(a)) {
      const pc = clear(cl(r.p1));
      put(pc, pc.length - 1);
      r.p1 = str(pc);
    }
    if (si >= 0 && r.conj === 2 && /ити$/.test(plainWord(inf)) && si >= a.length - 3) {
      const pc = clear(cl(r.p1));
      put(pc, pc.length - 1);
      r.p1 = str(pc);
    }
    return r;
  }
  function guessPresent0(inf) {
    const p = plainWord(inf);
    const a = cl(inf);
    const stemCut = (n) => str(a.slice(0, a.length - n));
    if (/(ова|ева)ти$/.test(p)) return { conj: 1, p1: str(a.slice(0, a.length - 5)) + (/ова/.test(p.slice(-5)) ? 'ꙋю' : 'юю'), sure: true };
    if (/нꙋти$/.test(p) || /нути$/.test(p)) return { conj: 1, p1: stemCut(3) + 'ꙋ', sure: true };
    if (/[жшчщ]ати$/.test(p)) return { conj: 2, p1: stemCut(3) + 'ꙋ', sure: false };
    if (/[аѧ]ти$/.test(p)) return { conj: 1, p1: stemCut(2) + 'ю', sure: false };
    if (/ѣти$/.test(p)) return { conj: 1, p1: stemCut(2) + 'ю', sure: false };
    if (/ити$/.test(p) && p.length > 4) {
      const stem = cl(stemCut(3));
      const sp = plainOf(stem);
      for (const [re, rep] of MUT) {
        if (re.test(sp)) {
          const m = sp.match(re);
          const keep = stem.slice(0, stem.length - m[0].length);
          const repl = m[0].replace(re, rep);
          return { conj: 2, p1: str(keep) + repl + (SIB.includes(repl.slice(-1)) || repl.endsWith('жд') ? 'ꙋ' : 'ю'), sure: true };
        }
      }
      return { conj: 2, p1: str(stem) + (SIB.includes(sp.slice(-1)) ? 'ꙋ' : 'ю'), sure: true };
    }
    if (/(сти|зти)$/.test(p)) return { conj: 1, p1: stemCut(2) + 'ꙋ', sure: false, cons: true };
    if (/щи$/.test(p)) return { conj: 1, p1: stemCut(2) + 'кꙋ', sure: false, cons: true };
    return { conj: 1, p1: stemCut(2) + 'ю', sure: false };
  }

  function conjugate(inf, p1raw, conjOverride, opts = {}) {
    const key = plainWord(inf).replace(/ѣ/g, 'е').replace(/[іїѵ]/g, 'и').replace(/сѧ$/, '');
    const irr = IRR_VERBS[key];
    const res = { pos: 'verb', inf, tenses: [], notes: [] };
    const infCl = cl(inf);
    const hasStress = stressAt(infCl) >= 0 && opts.stress !== 'none';
    const p1 = p1raw && p1raw.trim() ? p1raw.trim() : guessPresent(inf).p1;
    const guess = guessPresent(inf);
    let conj = conjOverride || (irr ? 0 : guess.conj);
    if (!conjOverride && !irr && p1raw && p1raw.trim()) {
      const pp = plainWord(p1raw);
      const ip = plainWord(inf);
      if (/ѣти$/.test(ip)) conj = /ѣю$/.test(pp) ? 1 : 2;
      else if (/ати$/.test(ip)) conj = /[жшчщ]ꙋ$/.test(pp) && /[жшчщ]ати$/.test(ip) ? 2 : 1;
      else if (/ити$/.test(ip) && ip.length > 4) conj = 2;
    }
    res.p1 = p1; res.conj = conj; res.guessSure = guess.sure;
    const p1cl = cl(p1);
    const p1p = plainOf(p1cl);
    const infP = plainOf(infCl);
    // основы
    const infStem = infCl.slice(0, infCl.length - (/щи$/.test(infP) ? 2 : 2));      // без -ти
    const presStem = p1cl.slice(0, p1cl.length - 1);                                     // без -ꙋ/-ю
    const presStemPlain = plainOf(presStem);
    const nuCons = /[^аеиоуꙋыѣѧюꙗ]нꙋ$/.test(plainOf(infStem));                     // воскре́с-нꙋ-ти
    const consStem = !VOW.includes(plainOf(infStem).slice(-1)) || /щи$/.test(infP) || nuCons;  // нес-тѝ, ре-щѝ
    const stressMode = !hasStress ? 'N' : opts.stress === 'stem' ? 'S' : opts.stress === 'end' ? 'E' : null;
    const P1E = stressAt(p1cl) >= presStem.length; // 1-е лицо с ударением на окончании
    const mk = (stem, e, m, num) => str(build(stem, e, stressMode || m, num).a);
    const row = (arr) => arr.map((x) => x.split('|').join(' · '));

    if (irr) {
      if (irr.pres) res.tenses.push({ id: 'pres', title: irr.futNote ? 'Настоящее (по значению — будущее простое)' : 'Настоящее время', forms: irr.pres });
      if (irr.fut) res.tenses.push({ id: 'fut', title: 'Будущее время', forms: irr.fut });
      if (irr.aor) res.tenses.push({ id: 'aor', title: 'Аорист', forms: irr.aor });
      if (irr.aor2) res.tenses.push({ id: 'aor2', title: 'Аорист (от основы бѣ-)', forms: irr.aor2 });
      if (irr.imp) res.tenses.push({ id: 'imp', title: 'Имперфект', forms: irr.imp });
      if (irr.impv) res.tenses.push({ id: 'impv', title: 'Повелительное наклонение', forms: irr.impv });
      res.l = irr.l;
    } else {
      // настоящее время
      let pres;
      if (conj === 2) {
        const s2 = infStem.slice(0, infStem.length - 1); // хвал-
        const sib = SIB.includes(plainOf(s2).slice(-1));
        // как хвали́ти — хвалю̀, хва́лиши: если в основе нет ударения, оно переходит на её последний слог
        const m = stressAt(s2) >= 0 ? 'S' : 'L';
        pres = PRES_II.map((e, i) => (i === 0 ? p1 : e.split('|').map((x) => mk(s2, sib && x === 'ѧтъ' ? 'атъ' : x, m, 'sg')).join(' · ')));
      } else {
        const st = copy(presStem);
        const vowelStem = VOW.includes(presStemPlain.slice(-1));
        const ends = PRES_I.map((e) => e.replace(/^ꙋ/, vowelStem ? 'ю' : 'ꙋ'));
        const m = stressAt(presStem) >= 0 ? 'S' : 'E';
        pres = ends.map((e, i) => (i === 0 ? p1 : e.split('|').map((x) => {
          const pal = /^[кг]$/.test(presStemPlain.slice(-1)) && x[0] === 'е' ? '¹' : '';
          return mk(st, pal + x, m, 'sg');
        }).join(' · ')));
      }
      res.tenses.push({ id: 'pres', title: 'Настоящее время (у глаголов совершенного вида — будущее простое)', forms: pres });

      // аорист
      let aor;
      if (consStem) {
        const st = nuCons ? infStem.slice(0, infStem.length - 2) : copy(presStem);
        const infStemStressed = stressAt(infCl) >= 0 && stressAt(infCl) < infStem.length - (nuCons ? 2 : 0);
        const third = mk(st, '¹е', infStemStressed ? 'S' : 'E', 'sg');
        aor = ['охъ', 'е', 'е', 'охова|оховѣ', 'оста|остѣ', 'оста|остѣ', 'охомъ', 'осте', 'оша']
          .map((e, i) => (i === 1 || i === 2 ? third : e.split('|').map((x) => mk(clear(copy(st)), x, 'E', 'sg')).join(' · ')));
        if (key === 'рещи') { aor[0] = 'рѣ́хъ · ' + aor[0]; aor[8] = 'рѣ́ша · ' + aor[8]; }
      } else {
        let st = copy(infStem);
        if (/нꙋ$/.test(plainOf(st)) && !VOW.includes(plainOf(st).slice(-3, -2))) st = st.slice(0, st.length - 2);
        const bare = str(build(st, '', stressMode || 'S', 'sg').a);
        aor = ['хъ', '', '', 'хова|ховѣ', 'ста|стѣ', 'ста|стѣ', 'хомъ', 'сте', 'ша']
          .map((e, i) => (e === '' ? bare : e.split('|').map((x) => mk(st, x, 'S', 'sg')).join(' · ')));
      }
      res.tenses.push({ id: 'aor', title: 'Аорист', forms: aor });

      // имперфект
      let impStem, impSuf;
      const infStemP = plainOf(infStem);
      if (/[аѧ]$/.test(infStemP)) { impStem = copy(infStem); impSuf = ''; }
      else if (/ѣ$/.test(infStemP)) { impStem = infStem.slice(0, infStem.length - 1); impSuf = SIB.includes(plainOf(impStem).slice(-1)) ? 'а' : 'ѧ'; }
      else if (conj === 2 || consStem) {
        impStem = copy(presStem);
        if (consStem) palat(impStem, { к: 'ч', г: 'ж' });
        impSuf = SIB.includes(plainOf(impStem).slice(-1)) || /жд$/.test(plainOf(impStem)) ? 'а' : 'ѧ';
      } else { impStem = copy(infStem); impSuf = ''; }
      const impM = impSuf ? (stressAt(impStem) >= 0 && !(conj === 2 && P1E) && !consStem ? 'S' : 'E') : 'S';
      const imp = ['хъ', 'ше', 'ше', 'хова|ховѣ', 'ста|стѣ', 'ста|стѣ', 'хомъ', 'сте', 'хꙋ']
        .map((e) => e.split('|').map((x) => mk(impM === 'E' ? clear(copy(impStem)) : impStem, impSuf + x, impM, 'sg')).join(' · '));
      res.tenses.push({ id: 'imp', title: 'Имперфект', forms: imp });

      // повелительное наклонение
      let impv;
      if (conj === 2) {
        const s2 = infStem.slice(0, infStem.length - 1);
        const endSt = stressAt(infStem) >= infStem.length - 1; // хвали́ти — ударение на суффиксе
        const m = endSt ? 'E' : 'S';
        const s2c = endSt ? clear(copy(s2)) : s2;
        const m1 = stressAt(s2) >= 0 ? 'S' : 'L';
        impv = ['—', mk(s2c, 'и', m, 'sg'), '—', mk(s2, 'ива', m1, 'sg'), mk(s2c, 'ита', m, 'sg'), '—', mk(s2, 'имъ', m1, 'sg'), mk(s2c, 'ите', m, 'sg'), '—'];
      } else {
        const st = copy(presStem);
        const vowelStem = VOW.includes(presStemPlain.slice(-1));
        if (vowelStem) {
          impv = ['—', mk(st, 'й', 'S', 'sg'), '—', mk(st, 'ива', 'S', 'sg'), mk(st, 'йта', 'S', 'sg'), '—', mk(st, 'имъ', 'S', 'sg'), mk(st, 'йте', 'S', 'sg'), '—'];
        } else {
          const z = copy(st); palat(z, PAL2);
          const zh = copy(st); palat(zh, { г: 'ж', к: 'ч' });
          const m = stressAt(st) >= 0 ? 'S' : 'E';
          impv = ['—', mk(z, 'и', m, 'sg'), '—', mk(zh, 'ева', m, 'sg'), mk(z, 'ита', m, 'sg'), '—', mk(zh, 'емъ', m, 'sg'), mk(z, 'ите', m, 'sg'), '—'];
        }
      }
      if (key === 'рещи') impv = ['—', 'рцы̀', '—', 'рце́ва', 'рцы́та', '—', 'рце́мъ', 'рцы́те', '—'];
      if (key === 'видети') impv[1] = 'ви́ждь · ' + impv[1];
      res.tenses.push({ id: 'impv', title: 'Повелительное наклонение', forms: impv });

      // причастие на -лъ
      let lst = nuCons ? infStem.slice(0, infStem.length - 2) : consStem ? copy(presStem) : copy(infStem);
      if (consStem && /[дт]$/.test(plainOf(lst))) lst = lst.slice(0, lst.length - 1);
      const lm = consStem ? (stressAt(lst) >= 0 ? 'S' : 'L') : 'S';
      res.l = mk(lst, 'лъ', lm, 'sg');
      res.lf = [mk(lst, 'ла', consStem ? 'E' : 'S', 'sg'), mk(lst, 'ло', consStem ? 'E' : 'S', 'sg'), mk(lst, 'ли', consStem ? 'E' : 'S', 'sg')];
    }
    // аналитические формы
    const l = res.l;
    if (l) {
      const lf = res.lf || [];
      const lpl = lf[2] || l.replace(/лъ$/, 'ли');
      const lfem = lf[0] ? lf[0].replace(/^.*?/, '') : '';
      const BE = ['є҆́смь', 'є҆сѝ', 'є҆́сть', 'є҆сва̀', 'є҆ста̀', 'є҆ста̀', 'є҆смы̀', 'є҆стѐ', 'сꙋ́ть'];
      const PQ = ['бѣ́хъ', 'бѣ̀', 'бѣ̀', 'бѣ́хова', 'бѣ́ста', 'бѣ́ста', 'бѣ́хомъ', 'бѣ́сте', 'бѣ́ша'];
      const CD = ['бы́хъ', 'бы̀', 'бы̀', 'бы́хова', 'бы́ста', 'бы́ста', 'бы́хомъ', 'бы́сте', 'бы́ша'];
      const part = (i) => (i < 3 ? l : i < 6 ? (lf[0] ? lf[0].replace(/а̀?$/, (x) => x) : l) : lpl);
      const duPart = lf[0] ? str(cl(lf[0]).slice(0, -1)) + 'а' : l;
      const pick = (i) => (i < 3 ? l : i < 6 ? duPart : lpl);
      res.tenses.push({ id: 'perf', title: 'Перфект (причастие + є҆́смь)', forms: BE.map((b, i) => `${pick(i)} ${b}`), compound: true });
      res.tenses.push({ id: 'pqp', title: 'Плюсквамперфект (бѣ́хъ + причастие)', forms: PQ.map((b, i) => `${b} ${pick(i)}`), compound: true });
      res.tenses.push({ id: 'cond', title: 'Условное наклонение (причастие + бы́хъ)', forms: CD.map((b, i) => `${pick(i)} ${b}`), compound: true });
      void part; void lfem;
    }
    const infStr = str(infCl);
    res.tenses = res.tenses.filter((t) => t.forms && t.forms.length);
    res.tenses.push({ id: 'fut2', title: 'Будущее сложное (и҆́мамъ, хощꙋ̀ или бꙋ́дꙋ + инфинитив)', forms: ['и҆́мамъ', 'и҆́маши', 'и҆́мать', 'и҆́мава', 'и҆́мата', 'и҆́мата', 'и҆́мамы', 'и҆́мате', 'и҆́мꙋтъ'].map((x) => `${x} ${infStr}`), compound: true });
    return res;
  }

  /* ---------- местоимения: готовые таблицы (учебник, разд. 25_12–25_16) ---------- */
  // строки: [И, Р, Д, В, Т, П] для ед.; [И-В, Р-П, Д-Т] для дв.; [И, Р, Д, В, Т, П] для мн.
  const PRON = [
    { id: 'az', title: 'а҆́зъ (я)', cols: ['1-е лицо'], sg: [['а҆́зъ'], ['менє̀'], ['мнѣ̀ · мѝ'], ['менѐ · мѧ̀'], ['мно́ю'], ['мнѣ̀']], du: [['мы̀'], ['на́ю'], ['на́ма']], pl: [['мы̀'], ['на́съ'], ['на́мъ'], ['на́съ · ны̀'], ['на́ми'], ['на́съ']] },
    { id: 'ty', title: 'ты̀ (ты)', cols: ['2-е лицо'], sg: [['ты̀'], ['тебє̀'], ['тебѣ̀ · тѝ'], ['тебѐ · тѧ̀'], ['тобо́ю'], ['тебѣ̀']], du: [['вы̀'], ['ва́ю'], ['ва́ма']], pl: [['вы̀'], ['ва́съ'], ['ва́мъ'], ['ва́съ · вы̀'], ['ва́ми'], ['ва́съ']] },
    { id: 'sebe', title: 'себѐ (себя)', cols: ['возвратное'], sg: [['—'], ['себє̀'], ['себѣ̀ · сѝ'], ['себѐ · сѧ̀'], ['собо́ю'], ['себѣ̀']] },
    { id: 'on', title: 'ѻ҆́нъ, ѻ҆но̀, ѻ҆на̀ (он, оно, она)', cols: ['м.', 'ср.', 'ж.'],
      sg: [['ѻ҆́нъ', 'ѻ҆но̀', 'ѻ҆на̀'], ['є҆гѡ̀', 'є҆гѡ̀', 'є҆ѧ̀'], ['є҆мꙋ̀', 'є҆мꙋ̀', 'є҆́й'], ['є҆го̀ · и҆̀', 'є҆̀', 'ю҆̀'], ['и҆́мъ', 'и҆́мъ', 'є҆́ю'], ['(н)е́мъ', '(н)е́мъ', '(н)е́й']],
      du: [['ѻ҆́на · ѧ҆̀', 'ѻ҆́нѣ', 'ѻ҆́нѣ'], ['є҆ю̀', 'є҆ю̀', 'є҆ю̀'], ['и҆́ма', 'и҆́ма', 'и҆́ма']],
      pl: [['ѻ҆нѝ', 'ѻ҆на̀', 'ѻ҆нѣ̀'], ['и҆́хъ', 'и҆́хъ', 'и҆́хъ'], ['и҆́мъ', 'и҆́мъ', 'и҆́мъ'], ['ѧ҆̀ · и҆̀хъ', 'ѧ҆̀', 'ѧ҆̀ · и҆̀хъ'], ['и҆́ми', 'и҆́ми', 'и҆́ми'], ['(н)и́хъ', '(н)и́хъ', '(н)и́хъ']],
      note: 'В именительном падеже — ѻ҆́нъ, в косвенных — формы от и҆̀: є҆гѡ̀, є҆мꙋ̀… После предлога — с н: ѿ негѡ̀, въ не́мъ.' },
    { id: 'izhe', title: 'и҆́же, є҆́же, ꙗ҆́же (который)', cols: ['м.', 'ср.', 'ж.'],
      sg: [['и҆́же', 'є҆́же', 'ꙗ҆́же'], ['є҆гѡ́же', 'є҆гѡ́же', 'є҆ѧ́же'], ['є҆мꙋ́же', 'є҆мꙋ́же', 'є҆́йже'], ['и҆́же · є҆го́же', 'є҆́же', 'ю҆́же'], ['и҆́мже', 'и҆́мже', 'є҆́юже'], ['(н)е́мже', '(н)е́мже', '(н)е́йже']],
      du: [['ꙗ҆̀же', 'ꙗ҆̀же', 'ꙗ҆̀же'], ['є҆ю́же', 'є҆ю́же', 'є҆ю́же'], ['и҆́маже', 'и҆́маже', 'и҆́маже']],
      pl: [['и҆̀же', 'ꙗ҆̀же', 'ꙗ҆̀же'], ['и҆̀хже', 'и҆̀хже', 'и҆̀хже'], ['и҆̀мже', 'и҆̀мже', 'и҆̀мже'], ['ꙗ҆̀же · и҆̀хже', 'ꙗ҆̀же', 'ꙗ҆̀же'], ['и҆́миже', 'и҆́миже', 'и҆́миже'], ['(н)и́хже', '(н)и́хже', '(н)и́хже']] },
    { id: 'moi', title: 'мо́й, моѐ, моѧ̀ (мой)', cols: ['м.', 'ср.', 'ж.'], tvoi: true,
      sg: [['мо́й', 'моѐ', 'моѧ̀'], ['моегѡ̀', 'моегѡ̀', 'моеѧ̀'], ['моемꙋ̀', 'моемꙋ̀', 'мое́й'], ['мо́й · моего̀', 'моѐ', 'мою̀'], ['мои́мъ', 'мои́мъ', 'мое́ю'], ['мое́мъ', 'мое́мъ', 'мое́й']],
      du: [['моѧ̑', 'моѝ', 'моѝ'], ['моє́ю', 'моє́ю', 'моє́ю'], ['мои́ма', 'мои́ма', 'мои́ма']],
      pl: [['моѝ', 'моѧ̑', 'моѧ̑'], ['мои́хъ', 'мои́хъ', 'мои́хъ'], ['мои̑мъ', 'мои̑мъ', 'мои̑мъ'], ['моѧ̑ · мои́хъ', 'моѧ̑', 'моѧ̑ · мои́хъ'], ['мои́ми', 'мои́ми', 'мои́ми'], ['мои́хъ', 'мои́хъ', 'мои́хъ']],
      note: 'Так же склоняются тво́й и сво́й.' },
    { id: 'nash', title: 'на́шъ, на́ше, на́ша (наш)', cols: ['м.', 'ср.', 'ж.'], vash: true,
      sg: [['на́шъ', 'на́ше', 'на́ша'], ['на́шегѡ', 'на́шегѡ', 'на́шеѧ'], ['на́шемꙋ', 'на́шемꙋ', 'на́шей'], ['на́шъ · на́шего', 'на́ше', 'на́шꙋ'], ['на́шымъ', 'на́шымъ', 'на́шею'], ['на́шемъ', 'на́шемъ', 'на́шей']],
      du: [['на̑ша', 'на́ши', 'на́ши'], ['на́шею', 'на́шею', 'на́шею'], ['на́шима', 'на́шима', 'на́шима']],
      pl: [['на́ши', 'на̑ша', 'на́шѧ'], ['на́шихъ', 'на́шихъ', 'на́шихъ'], ['на́шымъ', 'на́шымъ', 'на́шымъ'], ['на́шѧ · на́шихъ', 'на̑ша', 'на́шѧ · на́шихъ'], ['на́шими', 'на́шими', 'на́шими'], ['на́шихъ', 'на́шихъ', 'на́шихъ']],
      note: 'Так же склоняется ва́шъ.' },
    { id: 'ves', title: 'ве́сь, всѐ, всѧ̀ (весь)', cols: ['м.', 'ср.', 'ж.'],
      sg: [['ве́сь', 'всѐ', 'всѧ̀'], ['всегѡ̀', 'всегѡ̀', 'всеѧ̀'], ['всемꙋ̀', 'всемꙋ̀', 'все́й'], ['ве́сь · всего̀', 'всѐ', 'всю̀'], ['всѣ́мъ', 'всѣ́мъ', 'все́ю'], ['все́мъ', 'все́мъ', 'все́й']],
      du: [['всѧ̑', 'всѝ', 'всѝ'], ['всє́ю', 'всє́ю', 'всє́ю'], ['всѣ́ма', 'всѣ́ма', 'всѣ́ма']],
      pl: [['всѝ', 'всѧ̑', 'всѧ̑'], ['всѣ́хъ', 'всѣ́хъ', 'всѣ́хъ'], ['всѣ̑мъ', 'всѣ̑мъ', 'всѣ̑мъ'], ['всѧ̑ · всѣ́хъ', 'всѧ̑', 'всѧ̑ · всѣ́хъ'], ['всѣ́ми', 'всѣ́ми', 'всѣ́ми'], ['всѣ́хъ', 'всѣ́хъ', 'всѣ́хъ']] },
    { id: 'sei', title: 'се́й, сїѐ, сїѧ̀ (этот)', cols: ['м.', 'ср.', 'ж.'],
      sg: [['се́й · сі́й', 'сїѐ · сѐ', 'сїѧ̀'], ['сегѡ̀', 'сегѡ̀', 'сеѧ̀'], ['семꙋ̀', 'семꙋ̀', 'се́й'], ['се́й · сего̀', 'сїѐ · сѐ', 'сїю̀'], ['си́мъ', 'си́мъ', 'се́ю'], ['се́мъ', 'се́мъ', 'се́й']],
      du: [['сїѧ̑', 'сїѝ', 'сїѝ'], ['сє́ю', 'сє́ю', 'сє́ю'], ['си́ма', 'си́ма', 'си́ма']],
      pl: [['сі́и', 'сїѧ̑', 'сїѧ̑'], ['си́хъ', 'си́хъ', 'си́хъ'], ['си̑мъ', 'си̑мъ', 'си̑мъ'], ['сїѧ̑ · си́хъ', 'сїѧ̑', 'сїѧ̑ · си́хъ'], ['си́ми', 'си́ми', 'си́ми'], ['си́хъ', 'си́хъ', 'си́хъ']] },
    { id: 'toi', title: 'то́й, то́е, та́ѧ (тот)', cols: ['м.', 'ср.', 'ж.'],
      sg: [['то́й', 'то́е · то̀', 'та́ѧ · та̀'], ['тогѡ̀', 'тогѡ̀', 'тоѧ̀'], ['томꙋ̀', 'томꙋ̀', 'то́й'], ['то́й · того̀', 'то́е · то̀', 'тꙋ́ю · тꙋ̀'], ['тѣ́мъ', 'тѣ́мъ', 'то́ю'], ['то́мъ', 'то́мъ', 'то́й']],
      du: [['та̑ · та̑ѧ', 'тѣ̀', 'тѣ̀'], ['тѡ́ю', 'тѡ́ю', 'тѡ́ю'], ['тѣ́ма', 'тѣ́ма', 'тѣ́ма']],
      pl: [['ті́и', 'та̑ · та̑ѧ', 'ты̑ · ты́ѧ'], ['тѣ́хъ', 'тѣ́хъ', 'тѣ́хъ'], ['тѣ̑мъ', 'тѣ̑мъ', 'тѣ̑мъ'], ['ты̑ · тѣ́хъ', 'та̑ · та̑ѧ', 'ты̑ · ты́ѧ'], ['тѣ́ми', 'тѣ́ми', 'тѣ́ми'], ['тѣ́хъ', 'тѣ́хъ', 'тѣ́хъ']] },
    { id: 'ov', title: 'ѻ҆́въ, ѻ҆́во, ѻ҆́ва (иной, один… другой)', cols: ['м.', 'ср.', 'ж.'],
      sg: [['ѻ҆́въ', 'ѻ҆́во', 'ѻ҆́ва'], ['ѻ҆́вогѡ', 'ѻ҆́вогѡ', 'ѻ҆́воѧ'], ['ѻ҆́вомꙋ', 'ѻ҆́вомꙋ', 'ѻ҆́вой'], ['ѻ҆́въ · ѻ҆́вого', 'ѻ҆́во', 'ѻ҆́вꙋ'], ['ѻ҆́вѣмъ', 'ѻ҆́вѣмъ', 'ѻ҆́вою'], ['ѻ҆́вомъ', 'ѻ҆́вомъ', 'ѻ҆́вой']],
      du: [['ѻ҆́ва', 'ѻ҆́вѣ', 'ѻ҆́вѣ'], ['ѻ҆́вѡю', 'ѻ҆́вѡю', 'ѻ҆́вѡю'], ['ѻ҆́вѣма', 'ѻ҆́вѣма', 'ѻ҆́вѣма']],
      pl: [['ѻ҆́ви', 'ѻ҆́ва', 'ѻ҆́вы'], ['ѻ҆́вѣхъ', 'ѻ҆́вѣхъ', 'ѻ҆́вѣхъ'], ['ѻ҆́вѣмъ', 'ѻ҆́вѣмъ', 'ѻ҆́вѣмъ'], ['ѻ҆́вы · ѻ҆́вѣхъ', 'ѻ҆́ва', 'ѻ҆́вы'], ['ѻ҆́вѣми', 'ѻ҆́вѣми', 'ѻ҆́вѣми'], ['ѻ҆́вѣхъ', 'ѻ҆́вѣхъ', 'ѻ҆́вѣхъ']] },
    { id: 'kto', title: 'кто̀, что̀ (кто, что)', cols: ['кто̀', 'что̀'],
      sg: [['кто̀', 'что̀'], ['когѡ̀', 'чегѡ̀ · чесѡ̀'], ['комꙋ̀', 'чемꙋ̀ · чесомꙋ̀'], ['кого̀', 'что̀ · чесо̀'], ['ки́мъ', 'чи́мъ'], ['ко́мъ', 'че́мъ · чесо́мъ']] },
    { id: 'koi', title: 'кі́й (ко́й), ко́е, ка́ѧ (какой, который)', cols: ['м.', 'ср.', 'ж.'],
      sg: [['кі́й · ко́й', 'ко́е', 'ка́ѧ'], ['ко́егѡ', 'ко́егѡ', 'коеѧ̀'], ['ко́емꙋ', 'ко́емꙋ', 'ко́ей'], ['кі́й · ко́его', 'ко́е', 'кꙋ́ю'], ['кі́имъ · ко́имъ', 'кі́имъ · ко́имъ', 'ко́ею'], ['ко́емъ', 'ко́емъ', 'ко́ей']],
      du: [['ка̑ѧ', 'кі́и', 'кі́и'], ['ко́єю', 'ко́єю', 'ко́єю'], ['кі́има · ко́има', 'кі́има · ко́има', 'кі́има · ко́има']],
      pl: [['кі́и · ко́и', 'ка̑ѧ', 'кі́ѧ'], ['кі́ихъ · ко́ихъ', 'кі́ихъ · ко́ихъ', 'кі́ихъ · ко́ихъ'], ['кі̑имъ · ко́имъ', 'кі̑имъ · ко́имъ', 'кі̑имъ · ко́имъ'], ['кі́ѧ · кі́ихъ', 'ка̑ѧ', 'кі́ѧ · кі́ихъ'], ['кі́ими · ко́ими', 'кі́ими · ко́ими', 'кі́ими · ко́ими'], ['кі́ихъ · ко́ихъ', 'кі́ихъ · ко́ихъ', 'кі́ихъ · ко́ихъ']] }
  ];
  // тво́й, сво́й, ва́шъ — по образцам мо́й и на́шъ
  function derivePron(base, from, to, id, title) {
    const re = new RegExp('^' + from);
    const mapCell = (c) => c.split(' · ').map((x) => x.replace(re, to)).join(' · ');
    const mapRows = (rows) => rows && rows.map((r) => r.map(mapCell));
    return { id, title, cols: base.cols, sg: mapRows(base.sg), du: mapRows(base.du), pl: mapRows(base.pl), note: `Склоняется как ${base.title.split(' (')[0].split(',')[0]}.` };
  }
  const MOI = PRON.find((x) => x.id === 'moi'), NASH = PRON.find((x) => x.id === 'nash');
  PRON.splice(PRON.indexOf(MOI) + 1, 0, derivePron(MOI, 'м', 'тв', 'tvoi', 'тво́й, твоѐ, твоѧ̀ (твой)'), derivePron(MOI, 'м', 'св', 'svoi', 'сво́й, своѐ, своѧ̀ (свой)'));
  PRON.splice(PRON.indexOf(NASH) + 1, 0, derivePron(NASH, 'н', 'в', 'vash', 'ва́шъ, ва́ше, ва́ша (ваш)'));

  const pk = (s) => plainWord(s).replace(/ѡ/g, 'о').replace(/є/g, 'е').replace(/[іїѵ]/g, 'и').replace(/ꙗ/g, 'я').replace(/ѧ/g, 'я').replace(/ꙋ/g, 'у').replace(/ѻ/g, 'о');
  function findPronoun(w) {
    const k = pk(w);
    if (!k) return null;
    const RU = { я: 'az', ты: 'ty', себя: 'sebe', он: 'on', она: 'on', оно: 'on', они: 'on', иже: 'izhe', который: 'izhe', мой: 'moi', твой: 'tvoi', свой: 'svoi', наш: 'nash', ваш: 'vash', весь: 'ves', этот: 'sei', тот: 'toi', кто: 'kto', что: 'kto', какой: 'koi', кий: 'koi', кой: 'koi', сей: 'sei', ов: 'ov', иной: 'ov' };
    if (RU[k]) return { p: PRON.find((x) => x.id === RU[k]), hit: null };
    for (const pr of PRON) {
      for (const num of ['sg', 'du', 'pl']) {
        const rows = pr[num];
        if (!rows) continue;
        for (let r = 0; r < rows.length; r++) for (let c = 0; c < rows[r].length; c++) {
          if (rows[r][c].split(' · ').some((x) => pk(x.replace(/[()]/g, '')) === k)) return { p: pr, hit: { num, r, c } };
        }
      }
    }
    return null;
  }

  /* ---------- определение части речи ---------- */
  function guessPos(w) {
    const p = plainWord(w);
    if (findPronoun(w)) return 'pron';
    if (/(ти|щи|тисѧ|щисѧ|ть|ться|тись)$/.test(p) && p.length > 3) return 'verb';
    if (/(ый|ій|ий|їй|ой|аѧ|ѧѧ|ая|яя|ое|ее)$/.test(p) && p.length > 3) return 'adj';
    return 'noun';
  }

  window.FORMS = { normalizeInput, guessPos, detectNoun, declineNoun, declineAdj, detectAdj, conjugate, guessPresent, findPronoun, PRON, NOUN, ADJ_KIND, fromCivil };
})();

/* ---------- интерфейс: раздел «Грамматика» → «Формы слова» ---------- */
(() => {
  const F = window.FORMS;
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* хранилище недоступно */ } }
  };
  const ui = { pos: null, type: null, kind: null, conj: null, p1: '', stress: store.get('cs-fx-stress', 'auto'), last: '' };
  const EXAMPLES = ['ра́бъ', 'ѻ҆те́цъ', 'рꙋка̀', 'дꙋша̀', 'и҆́мѧ', 'сло́во', 'ма́ти', 'свѧты́й', 'бо́жїй', 'хвали́ти', 'нестѝ', 'бы́ти', 'мнѣ̀'];
  const POS = [['noun', 'Существительное'], ['adj', 'Прилагательное'], ['verb', 'Глагол'], ['pron', 'Местоимение']];
  const NOTE = {
    o: 'ѡ в основе отличает форму двойственного или множественного числа от одинаковой формы единственного: и҆спѡли́на — и҆споли́на.',
    e: 'є в основе отличает форму двойственного или множественного числа от одинаковой формы единственного: і҆ерє́й — і҆ере́й.',
    k: 'Камора ( ̑ ) вместо оксии или варии отличает форму двойственного или множественного числа от одинаковой формы единственного: ча̑да — ча́да.'
  };

  const cellHTML = (c) => (Array.isArray(c) ? c : [c]).map((x) => String(x).split(' · ')).flat()
    .map((x) => (x === '—' ? '<span class="gl">—</span>' : `<button class="fx-f cs" data-copy="${esc(x)}">${esc(x)}</button>`)).join('<span class="fx-sep">·</span>');
  const same = (t) => `<span class="gl fx-same">= ${t}</span>`;

  function html() {
    return `<div class="fx">
<div class="fx-bar">
  <label class="search infind fx-input"><svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><path d="M4 15.5 15 4.5M11 4.5h4v4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><input id="fxIn" class="cs nocopy" type="text" placeholder="Слово: ра́бъ, землѧ̀, свѧты́й, хвали́ти, мнѣ̀…" aria-label="Слово в начальной форме" autocomplete="off" spellcheck="false"></label>
  <label class="switch"><input type="checkbox" id="fxLayout"><span>Славянская раскладка</span></label>
</div>
<div class="fx-ex"><span class="gl">Примеры:</span>${EXAMPLES.map((w) => `<button class="fx-chip cs" data-fx="${esc(w)}">${w}</button>`).join('')}</div>
<div class="fx-ctl">
  <div class="seg" id="fxPos" role="radiogroup" aria-label="Часть речи">${POS.map(([id, t]) => `<button class="segbtn" data-pos="${id}" role="radio">${t}</button>`).join('')}</div>
  <div id="fxOpts" class="fx-opts"></div>
</div>
<div id="fxInfo" class="fx-info"></div>
<div id="fxOut" class="fx-out"></div>
</div>`;
  }

  function optsHTML(pos, det) {
    const stressSel = `<label class="fld fx-fld"><span>Ударение</span><select id="fxStress">
<option value="auto"${ui.stress === 'auto' ? ' selected' : ''}>по образцу учебника</option>
<option value="stem"${ui.stress === 'stem' ? ' selected' : ''}>на основе, как в начальной форме</option>
<option value="end"${ui.stress === 'end' ? ' selected' : ''}>на окончании</option>
<option value="none"${ui.stress === 'none' ? ' selected' : ''}>без ударений</option></select></label>`;
    if (pos === 'noun') {
      return `<label class="fld fx-fld"><span>Склонение</span><select id="fxType">${Object.entries(F.NOUN).map(([k, t]) => `<option value="${k}"${k === det ? ' selected' : ''}>${esc(t.label)} — ${esc(t.ex)}</option>`).join('')}</select></label>${stressSel}`;
    }
    if (pos === 'adj') {
      return `<label class="fld fx-fld"><span>Склонение</span><select id="fxKind">${Object.entries(F.ADJ_KIND).map(([k, t]) => `<option value="${k}"${k === det ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>${stressSel}`;
    }
    if (pos === 'verb') {
      return `<label class="fld fx-fld"><span>1-е лицо ед. ч. наст. вр.</span><input id="fxP1" class="cs nocopy" type="text" value="${esc(det.p1)}" autocomplete="off" spellcheck="false"></label>
<label class="fld fx-fld"><span>Спряжение</span><select id="fxConj"><option value="">авто</option><option value="1"${ui.conj === 1 ? ' selected' : ''}>I (несꙋ̀, несе́ши)</option><option value="2"${ui.conj === 2 ? ' selected' : ''}>II (хвалю̀, хва́лиши)</option></select></label>${stressSel}`;
    }
    return '';
  }

  function nounHTML(r) {
    const rows = [['И.', 0, 0, 0], ['Р.', 1, 1, 1], ['Д.', 2, 2, 2], ['В.', 3, 'И.', 3], ['Т.', 4, 'Д.', 4], ['П.', 5, 'Р.', 5], ['Зв.', 6, 'И.', 'И.']];
    const cell = (arr, k) => (typeof k === 'string' ? same(k) : cellHTML(arr[k]));
    return `<table class="tbl fx-t"><thead><tr><th>Падеж</th><th>Единственное</th><th>Двойственное</th><th>Множественное</th></tr></thead><tbody>
${rows.map(([name, a, b, c]) => `<tr><th scope="row">${name}</th><td>${cell(r.sg, a)}${a === 3 && r.animate ? '<span class="gl fx-g">одуш. · неодуш.</span>' : ''}</td><td>${cell(r.du, b)}</td><td>${cell(r.pl, c)}</td></tr>`).join('')}
</tbody></table>`;
  }

  function genderTables(get, numTitles, rowNames, cols) {
    return numTitles.map(([num, title]) => {
      const rows = rowNames[num];
      return `<div class="fx-sub"><h4>${title}</h4><table class="tbl fx-t"><thead><tr><th>Падеж</th>${cols.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>
${rows.map((rn, i) => `<tr><th scope="row">${rn}</th>${cols.map((_, g) => `<td>${cellHTML(get(num, i, g))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    }).join('');
  }
  const ROWS = { sg: ['И.', 'Р.', 'Д.', 'В.', 'Т.', 'П.'], du: ['И., В.', 'Р., П.', 'Д., Т.'], pl: ['И.', 'Р.', 'Д.', 'В.', 'Т.', 'П.'] };
  const NUMS = [['sg', 'Единственное число'], ['du', 'Двойственное число'], ['pl', 'Множественное число']];

  function adjHTML(r) {
    const G = ['m', 'n', 'f'];
    let h = `<p class="kicker fx-k">Полные формы</p>` + genderTables((num, i, g) => r.full[G[g]][num][i], NUMS, ROWS, ['м. р.', 'ср. р.', 'ж. р.']);
    h += `<div class="fx-sub"><h4>Краткие формы (именительный падеж)</h4><table class="tbl fx-t"><thead><tr><th></th><th>м. р.</th><th>ср. р.</th><th>ж. р.</th></tr></thead><tbody>
${['Ед.', 'Дв.', 'Мн.'].map((n, i) => `<tr><th scope="row">${n}</th>${G.map((g) => `<td>${cellHTML(r.short[g][i])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    if (r.comp) h += `<div class="fx-sub"><h4>Сравнительная степень</h4><p>${cellHTML(r.comp.short.split(' · '))} <span class="gl">кратк. м., ср., ж.</span></p><p>${cellHTML(r.comp.full.split(' · '))} <span class="gl">полн. м., ср., ж.</span></p><p class="gl">Та же форма служит и превосходной степенью; значение усиливают приставки пре- и все-: ${cellHTML(r.super)}.</p></div>`;
    return h;
  }

  function verbHTML(r) {
    const PERS = ['1-е л.', '2-е л.', '3-е л.'];
    const t3 = (forms) => `<table class="tbl fx-t"><thead><tr><th>Лицо</th><th>Единственное</th><th>Двойственное</th><th>Множественное</th></tr></thead><tbody>
${PERS.map((p, i) => `<tr><th scope="row">${p}</th><td>${cellHTML(forms[i])}</td><td>${cellHTML(forms[i + 3])}</td><td>${cellHTML(forms[i + 6])}</td></tr>`).join('')}</tbody></table>`;
    let h = r.tenses.map((t) => `<div class="fx-sub"><h4>${esc(t.title)}</h4>${t3(t.forms.map((x) => (t.compound ? x : x)))}</div>`).join('');
    if (r.l) h = `<p class="fx-l"><span class="gl">Причастие на -лъ (для перфекта и условного):</span> ${cellHTML([r.l].concat(r.lf || []))}</p>` + h;
    return h;
  }

  function pronHTML(found) {
    const pr = found.p;
    const hit = found.hit;
    const get = (num, i, g) => (pr[num] && pr[num][i] ? pr[num][i][g] : '—');
    const nums = NUMS.filter(([n]) => pr[n]);
    let h = genderTables(get, nums, ROWS, pr.cols);
    if (pr.note) h += `<p class="gl fx-note">${esc(pr.note)}</p>`;
    return { html: h, hit };
  }

  function info(text) { $('#fxInfo').innerHTML = text; }

  function render(force) {
    const inp = $('#fxIn');
    if (!inp) return;
    const raw = inp.value.trim();
    store.set('cs-fx-word', raw);
    if (!raw) { $('#fxOut').innerHTML = ''; info('<span class="gl">Введите слово в начальной форме — программа построит все формы по правилам учебника.</span>'); $('#fxOpts').innerHTML = ''; setPos(null); return; }
    const n = F.normalizeInput(raw);
    const w = n.word;
    if (raw !== ui.last || force === 'word') {
      ui.last = raw;
      ui.pos = F.guessPos(w);
      ui.type = null; ui.kind = null; ui.conj = null; ui.p1 = '';
    }
    setPos(ui.pos);
    let src = '';
    if (n.civil) src = n.fromDict ? `Слово найдено в словаре: <span class="cs">${esc(w)}</span>. ` : `Набрано по-русски: <span class="cs">${esc(w)}</span> — ударение не поставлено, формы даны без него. `;
    let out = '', notes = [];
    if (ui.pos === 'noun') {
      const det = ui.type || F.detectNoun(w);
      ui.type = det;
      if (!$('#fxType') || force === 'word' || force === 'pos') $('#fxOpts').innerHTML = optsHTML('noun', det);
      const r = F.declineNoun(w, det, { stress: ui.stress });
      out = nounHTML(r);
      notes = r.notes.map((k) => NOTE[k]);
      if (r.fleeting) notes.push('В косвенных падежах выпадает е: ѻ҆те́цъ — ѻ҆тца̀ (беглый гласный).');
      if (/[кгх][ъаоь]?$/.test(F.normalizeInput(w).word.normalize('NFD').replace(/\p{M}/gu, ''))) notes.push('Перед ѣ и и: к → ц, г → з, х → с (рꙋцѣ̀, бо́зѣ, ѻ҆́троцы); в звательном падеже: к → ч, г → ж, х → ш (бо́же, ѻ҆́троче).');
      info(src + `<b>Существительное</b> · ${esc(F.NOUN[det].label)} — как <span class="cs">${esc(F.NOUN[det].ex)}</span>. Если тип определён неверно, выберите другой.`);
    } else if (ui.pos === 'adj') {
      const d = F.detectAdj(w);
      const kind = ui.kind || d.kind;
      ui.kind = kind;
      if (!$('#fxKind') || force === 'word' || force === 'pos') $('#fxOpts').innerHTML = optsHTML('adj', kind);
      const r = F.declineAdj(w, kind, { stress: ui.stress });
      out = adjHTML(r);
      notes = r.notes.map((k) => NOTE[k]);
      if (kind === 'velar') notes.push('У основ на к, г, х перед ѣ: к → ц, г → з, х → с (вели́цѣй, бла́зѣ).');
      info(src + `<b>Прилагательное</b> · ${esc(F.ADJ_KIND[kind])}. Звательный падеж полных прилагательных совпадает с именительным.`);
    } else if (ui.pos === 'verb') {
      const g = F.guessPresent(w);
      if (!ui.p1) ui.p1 = g.p1;
      if (!$('#fxP1') || force === 'word' || force === 'pos') $('#fxOpts').innerHTML = optsHTML('verb', { p1: ui.p1 });
      const r = F.conjugate(w, ui.p1, ui.conj, { stress: ui.stress });
      out = verbHTML(r);
      notes.push('Аорист — от основы инфинитива (у основ на согласный — от основы настоящего времени: несо́хъ); имперфект — с суффиксами -а-/-ѧ- (хвалѧ́хъ, хожда́хъ); повелительное — от основы настоящего времени.');
      if (!g.sure && ui.p1 === g.p1) notes.push('Форму 1-го лица настоящего времени программа угадала по инфинитиву — проверьте её по словарю: многие глаголы образуют её по-своему (писа́ти — пишꙋ̀).');
      info(src + `<b>Глагол</b> · ${r.conj === 2 ? 'II спряжение' : r.conj === 1 ? 'I спряжение' : 'особое спряжение (готовая таблица)'}. Формы 3-го лица повелительного наклонения передаются сочетанием с да: да бꙋ́детъ.`);
    } else if (ui.pos === 'pron') {
      const found = F.findPronoun(w);
      $('#fxOpts').innerHTML = '';
      if (!found) { out = '<p class="empty">Такого местоимения в таблицах нет. Попробуйте а҆́зъ, ты̀, ѻ҆́нъ, и҆́же, мо́й, на́шъ, ве́сь, се́й, то́й, кто̀.</p>'; info(src); }
      else {
        const r = pronHTML(found);
        out = r.html;
        info(src + `<b>Местоимение</b> · ${esc(found.p.title)} — готовая таблица из учебника.${found.hit ? ' Введённая форма выделена.' : ''}`);
        ui.hit = found.hit ? found : null;
      }
    }
    notes.push('Ударение в формах поставлено по образцу из учебника. У слов с подвижным ударением (рꙋка̀ — рꙋ́кꙋ, ца́рь — царѧ̀) сверьтесь со словарём или текстом и при необходимости переключите «Ударение».');
    $('#fxOut').innerHTML = out + (notes.length ? `<ul class="fx-notes">${notes.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '');
    // выделяем введённую форму
    const key = (s) => s.normalize('NFD').replace(/[̀́̑]/g, '').normalize('NFC');
    const wk = key(w);
    document.querySelectorAll('#fxOut .fx-f').forEach((b) => { if (key(b.dataset.copy) === wk) b.classList.add('hit'); });
    bindOpts();
  }

  function setPos(pos) {
    document.querySelectorAll('#fxPos .segbtn').forEach((b) => { const on = b.dataset.pos === pos; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
  }

  function bindOpts() {
    const t = $('#fxType'); if (t && !t.dataset.b) { t.dataset.b = 1; t.addEventListener('change', () => { ui.type = t.value; render(); }); }
    const k = $('#fxKind'); if (k && !k.dataset.b) { k.dataset.b = 1; k.addEventListener('change', () => { ui.kind = k.value; render(); }); }
    const st = $('#fxStress'); if (st && !st.dataset.b) { st.dataset.b = 1; st.addEventListener('change', () => { ui.stress = st.value; store.set('cs-fx-stress', st.value); render(); }); }
    const p1 = $('#fxP1');
    if (p1 && !p1.dataset.b) {
      p1.dataset.b = 1;
      if (window.KB) window.KB.attachLayout(p1);
      let tm = null;
      p1.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => { ui.p1 = p1.value.trim(); render(); }, 250); });
    }
    const cj = $('#fxConj'); if (cj && !cj.dataset.b) { cj.dataset.b = 1; cj.addEventListener('change', () => { ui.conj = cj.value ? Number(cj.value) : null; render(); }); }
  }

  function bind() {
    const inp = $('#fxIn');
    if (!inp) return;
    inp.value = store.get('cs-fx-word', 'ѻ҆те́цъ');
    if (window.KB) window.KB.attachLayout(inp);
    const lay = $('#fxLayout');
    lay.checked = window.KB ? window.KB.getLayout() : false;
    lay.addEventListener('change', () => { if (window.KB) window.KB.setLayout(lay.checked); inp.focus(); });
    let tm = null;
    inp.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => render('word'), 200); });
    document.querySelector('.fx-ex').addEventListener('click', (e) => { const b = e.target.closest('[data-fx]'); if (b) { inp.value = b.dataset.fx; render('word'); } });
    $('#fxPos').addEventListener('click', (e) => { const b = e.target.closest('[data-pos]'); if (b) { ui.pos = b.dataset.pos; ui.type = null; ui.kind = null; render('pos'); } });
    render('word');
    // русские слова берут ударение из словаря — пересчитаем после его загрузки
    if (window.DICT && !window.DICT.ready && !window.DICT.failed) window.DICT.onReady((ok) => { if (ok && $('#fxIn')) render('word'); });
  }

  window.FORMSUI = { html, bind };
})();
