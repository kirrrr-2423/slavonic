'use strict';
/* Конвертер титл: полное слово ⇄ слово под титлом.
   Под титлом пишется определённый круг слов (и их формы): какие буквы опускаются — задано для каждого слова,
   окончание пишется полностью. Таблица ниже: [полная основа, основа под титлом, тип, параметры].
   Тип 'd' — дальше идёт только окончание; 'p' — основа может продолжаться (производные слова). */
(() => {
  const ACC = /[̀́̑]/g;
  const noAcc = (s) => s.replace(ACC, '');
  const ACC1 = /[\u0300\u0301\u0311]/;
  const N_BOG = 'Под титлом — Бог истинный; языческий бог пишется полностью: бо́гъ';
  const N_ANG = 'Ангел Божий — под титлом; падший ангел — полностью: а҆́ггелъ';
  const N_SYN = 'Сын Божий — под титлом; в других случаях — полностью: сы́нъ';
  const N_DUH = 'Дух Святой и дух человека — под титлом; ветер, дыхание — полностью';
  const N_OTEC = 'Бог Отец, святые отцы — под титлом; отец в обычном смысле — чаще полностью';
  const N_DEVA = 'О Богородице — под титлом; в других случаях — полностью';
  const N_MATI = 'О Богородице — под титлом';
  const N_VLAD = 'О Боге и Богородице — под титлом';
  const N_CAR = 'О Боге и Христе — под титлом; о земных царях часто полностью';
  const N_OPT = 'Часто пишется и полностью';

  const E = [
    // Бог, Божий, Богородица
    ['бо́г', 'бг҃', 'd', { onlyR: ['', 'а', 'у', 'ом'], note: N_BOG }],
    ['бо́ж', 'бж҃', 'd', { note: N_BOG }],
    ['бо́з', 'бз҃', 'd', { only: ['е'], note: N_BOG }],
    ['боже́ств', 'бжⷭ҇тв', 'p'],
    ['бого', 'бг҃о', 'p', { minRest: 3 }],
    ['богоро́диц', 'бцⷣ', 'd'],
    ['богоро́дич', 'бцⷣч', 'p'],
    // Господь
    ['го́спод', 'гдⷭ҇', 'd', { not: ['ь'] }],
    ['госпо́д', 'гдⷭ҇', 'd', { only: ['ь'] }],
    ['госпо́ден', 'гдⷭ҇ен', 'd', { only: ['ь'] }],
    ['госпо́дн', 'гдⷭ҇н', 'd'],
    ['господи́н', 'гдⷭ҇и́н', 'd'],
    ['госпо́дств', 'гдⷭ҇тв', 'p'],
    ['госꙋда́р', 'гдⷭ҇р', 'd'],
    // Иисус Христос, Спас
    ['і҆исꙋ́с', 'і҆и҃с', 'd', { onlyR: ['', 'а', 'у', 'ом', 'ѣ', 'е'], note: 'Имя Спасителя всегда пишется под титлом' }],
    ['хрїст', 'хрⷭ҇т', 'p', { note: 'Христос и производные (христианин, христолюбивый) — под титлом' }],
    ['спа́с', 'сп҃с', 'p', { free: true }],
    // Дева, Мария, Мати
    ['дѣ́в', 'дв҃', 'd', { note: N_DEVA }],
    ['дѣ́вств', 'дв҃ств', 'p'],
    ['присноде́в', 'прⷭ҇нодв҃', 'd', { note: N_DEVA }],
    ['марі́', 'мр҃і́', 'd', { only: ['а', 'и', 'ю', 'е'], note: 'Мария — Богородица' }],
    ['ма́тер', 'мт҃р', 'd', { note: N_MATI }],
    ['ма́ти', 'мт҃и', 'd', { only: [''], note: N_MATI }],
    // Дух, Сын, Отец
    ['дꙋ́х', 'дх҃', 'd', { onlyR: ['', 'а', 'у', 'ом'], note: N_DUH }],
    ['дꙋ́с', 'дс҃', 'd', { onlyR: ['ѣ'], note: N_DUH }],
    ['дꙋхо', 'дх҃о', 'p', { minRest: 3 }],
    ['дꙋхо́вн', 'дх҃о́вн', 'p'],
    ['сы́н', 'сн҃', 'd', { onlyR: ['', 'а', 'у', 'ом', 'ѣ', 'е'], note: N_SYN }],
    ['ѻ҆те́ц', 'ѻ҆ц҃', 'd', { only: [''], note: N_OTEC }],
    ['ѻ҆тц', 'ѻ҆ц҃', 'd', { not: [''], note: N_OTEC }],
    ['ѻ҆́тч', 'ѻ҆́ч҃', 'd', { not: [''], note: N_OTEC }],
    ['ѻ҆те́честв', 'ѻ҆ч҃еств', 'p'],
    // Ангел, Архангел, Евангелие
    ['а҆́ггел', 'а҆́гг҃л', 'p', { alias: ['ангел'], note: N_ANG }],
    ['а҆рха́ггел', 'а҆рха́гг҃л', 'p', { alias: ['архангел'] }],
    ['є҆ѵа́ггел', 'є҆ѵⷢ҇л', 'p', { alias: ['евангел'] }],
    // Пророк, апостол, мученик, предтеча, святитель, епископ, священник
    ['проро́к', 'прⷪ҇ро́к', 'd'],
    ['проро́ц', 'прⷪ҇ро́ц', 'd', { onlyR: ['ѣ', 'ы', 'ѣх'] }],
    ['проро́ч', 'прⷪ҇ро́ч', 'p'],
    ['а҆по́стол', 'а҆пⷭ҇л', 'p'],
    ['а҆по́стол', 'а҆п҃л', 'p', { expandOnly: true }],
    ['мꙋ́чени', 'мч҃ни', 'p'],
    ['предте́ч', 'прⷣте́ч', 'd'],
    ['свѧти́тел', 'ст҃л', 'd', { expandOnly: true }],
    ['є҆пі́скоп', 'є҆пⷭ҇коп', 'p'],
    ['свѧщ', 'сщ҃', 'p'],
    // Свят, благ, человек
    ['свѧ́т', 'ст҃', 'p', { free: true, px: ['все', 'о'] }],
    ['пресвѧт', 'прест҃', 'p'],
    ['бла́г', 'бл҃г', 'p', { free: true, px: ['все', 'пре'] }],
    ['бла́ж', 'бл҃ж', 'p', { free: true, px: ['все', 'пре'] }],
    ['человѣ́к', 'чл҃вѣ́к', 'p'],
    ['человѣ́к', 'чл҃к', 'p', { expandOnly: true }],
    ['человѣ́ч', 'чл҃вѣ́ч', 'p', { px: ['во'] }],
    ['человѣ́ц', 'чл҃вѣ́ц', 'd', { onlyR: ['ѣ', 'ы', 'ѣх'] }],
    // Небо, Царь, Царство, Церковь
    ['не́б', 'нб҃', 'd'],
    ['небе́сн', 'нбⷭ҇н', 'p'],
    ['небе́с', 'нб҃с', 'd'],
    ['ца́р', 'цр҃', 'd', { opt: true, note: N_CAR }],
    ['ца́рств', 'црⷭ҇тв', 'p'],
    ['це́рк', 'цр҃к', 'p'],
    // Душа, милость, крест, страсть, честь, чистый
    ['дꙋ́ш', 'дш҃', 'd', { onlyR: ['а', 'и', 'ѣ', 'у', 'ею', 'ою'], note: 'Под титлом — в единственном числе; звательная форма дꙋшѐ и множественное число (дꙋ́шы, дꙋ́шъ) пишутся полностью' }],
    ['дꙋше́вн', 'дш҃е́вн', 'p'],
    ['ми́лост', 'млⷭ҇т', 'p', { px: ['все', 'пре'] }],
    ['милосе́рд', 'млⷭ҇рд', 'p'],
    ['кре́ст', 'крⷭ҇т', 'p'],
    ['крещ', 'кр҃щ', 'p'],
    ['стра́ст', 'стрⷭ҇т', 'p'],
    ['чи́ст', 'чтⷭ҇', 'd', { only: [''], expandOnly: true }],
    ['че́ст', 'чтⷭ҇', 'p', { not: [''], free: true }],
    ['пречи́ст', 'пречⷭ҇т', 'p'],
    ['ѡ҆чи́ст', 'ѡ҆чⷭ҇т', 'p', { opt: true }],
    // Имена и места
    ['і҆сра́ил', 'і҆и҃л', 'p', { alias: ['израил'] }],
    ['і҆ерусали́м', 'і҆ерⷭ҇ли́м', 'p'],
    ['дави́д', 'дв҃д', 'p'],
    ['и҆мѧре́к', 'и҆мⷬ҇к', 'd'],
    // Владыка, Троица, Рождество, Воскресение
    ['влады́к', 'влⷣк', 'd', { note: N_VLAD }],
    ['влады́ц', 'влⷣц', 'd', { onlyR: ['ѣ'], note: N_VLAD }],
    ['влады́чиц', 'влⷣчц', 'd', { note: N_VLAD }],
    ['влады́честв', 'влⷣчеств', 'p'],
    ['тро́иц', 'трⷪ҇ц', 'd'],
    ['тро́ич', 'трⷪ҇ч', 'p'],
    ['рождеств', 'ржⷭ҇тв', 'p'],
    ['воскресе́н', 'воскрⷭ҇н', 'p'],
    // Слово, молитва, мудрость, сердце, праведный, преподобный, ученик, учитель
    ['глаго́л', 'гл҃', 'p'],
    ['глаго́л', 'гл҃гол', 'p', { expandOnly: true }],
    ['моли́тв', 'мл҃тв', 'd'],
    ['мꙋ́дрост', 'мрⷣост', 'p'],
    ['премꙋ́дрост', 'премⷣрост', 'p'],
    ['се́рдц', 'срⷣц', 'd'],
    ['пра́веден', 'првⷣн', 'd', { only: [''] }],
    ['пра́вед', 'првⷣ', 'p'],
    ['преподо́бен', 'прпⷣбен', 'd', { only: [''] }],
    ['преподо́б', 'прпⷣб', 'p'],
    ['ᲂу҆чени́к', 'ᲂу҆чн҃и́к', 'd'],
    ['ᲂу҆чени́ц', 'ᲂу҆чн҃и́ц', 'd', { onlyR: ['ѣ', 'ы', 'ѣх'] }],
    ['ᲂу҆чени́ч', 'ᲂу҆чн҃и́ч', 'd', { onlyR: ['е'] }],
    ['ᲂу҆чи́тел', 'ᲂу҆чт҃л', 'd'],
    ['младе́нец', 'млⷣнц', 'd', { only: [''] }],
    ['младе́нц', 'млⷣнц', 'd', { not: [''] }],
    ['престо́л', 'прⷭ҇то́л', 'd'],
    ['є҆стеств', 'є҆стⷭ҇в', 'p'],
    // Слова, которые часто пишутся и полностью
    ['сла́в', 'сл҃в', 'd', { opt: true }],
    ['де́нь', 'дн҃ь', 'd', { only: [''], opt: true }],
    ['дне́сь', 'дн҃сь', 'd', { only: [''], opt: true }],
    ['ны́н', 'нн҃', 'p', { opt: true }],
    ['при́сн', 'прⷭ҇н', 'p', { opt: true }],
    ['кнѧ́з', 'кн҃з', 'd', { opt: true }],
    ['любо́в', 'лб҃в', 'd', { only: ['ь'], opt: true }],
    ['мѣ́сѧц', 'мцⷭ҇', 'd', { opt: true }]
  ];

  // окончания (в упрощённом написании, без ера на конце)
  const ENDINGS = new Set(['', 'ь', 'а', 'я', 'у', 'ю', 'е', 'и', 'ы', 'о', 'ом', 'ем', 'ам', 'ям', 'ами', 'ями', 'ах', 'ях', 'ех',
    'ов', 'ев', 'ови', 'еви', 'ове', 'ей', 'ий', 'ый', 'ой', 'ая', 'яя', 'ое', 'ее', 'ые', 'ие', 'ыя', 'ия', 'ую', 'юю', 'ию',
    'ых', 'их', 'ым', 'им', 'ыми', 'ими', 'аго', 'яго', 'ого', 'его', 'ому', 'ему', 'ою', 'ею', 'ии', 'иим', 'иих', 'иими',
    'иего', 'иему', 'иею', 'иа', 'ио', 'ова', 'ово', 'овы', 'ова', 'омы', 'ема']);

  /* ---------- буквы и ключи ---------- */
  const SUP = ['б', 'в', 'г', 'д', 'ж', 'з', 'к', 'л', 'м', 'н', 'о', 'п', 'р', 'с', 'т', 'х', 'ц', 'ч', 'ш', 'щ', 'ф', 'ст', 'а', 'е', 'у', 'у', 'е', 'ю', 'я', 'я', 'у', 'ю'];
  const LET = { ѣ: 'е', є: 'е', ѻ: 'о', ѡ: 'о', ѽ: 'о', ꙋ: 'у', і: 'и', ї: 'и', ѵ: 'и', ѷ: 'и', ѧ: 'я', ꙗ: 'я', ѯ: 'кс', ѱ: 'пс', ѿ: 'от', ѳ: 'ф', ѕ: 'з', ё: 'е', э: 'е', ᲂ: 'о' };
  const isSup = (ch) => ch >= 'ⷠ' && ch <= 'ⷿ';
  const isMark = (ch) => /\p{M}/u.test(ch);
  const prep = (s) => String(s).normalize('NFD').replace(/й/g, 'й').replace(/Й/g, 'Й');

  function clusters(word) {
    const out = [];
    for (const ch of prep(word)) {
      if (isMark(ch) && out.length) {
        const c = out[out.length - 1];
        if (isSup(ch)) c.sups.push(ch);
        c.marks += ch;
      } else out.push({ ch, marks: '', sups: [] });
    }
    // оу / ᲂу — одна буква
    out.forEach((c, i) => { c.key = keyCh(c.ch); if (/[оᲂ]/i.test(c.ch) && out[i + 1] && /у/i.test(out[i + 1].ch)) c.key = ''; });
    out.forEach((c) => { c.key += c.sups.map((s) => '^' + SUP[s.charCodeAt(0) - 0x2DE0]).join(''); });
    return out;
  }
  function keyCh(ch) {
    const l = ch.toLowerCase();
    if (!/\p{L}/u.test(l)) return '';
    return LET[l] !== undefined ? LET[l] : l;
  }
  const keyOf = (s) => clusters(s).map((c) => c.key).join('');
  const endKey = (cl) => cl.map((c) => c.key).join('').replace(/ъ$/, '');
  const RAW = { ꙋ: 'у', ѡ: 'о', ѻ: 'о', ѽ: 'о', ᲂ: 'о', і: 'и', ї: 'и', ѵ: 'и', ѷ: 'и', ѧ: 'я', ꙗ: 'я', є: 'е', ё: 'е', э: 'е' };
  const rawKey = (cl) => cl.map((c) => (c.key === '' ? '' : (RAW[c.ch.toLowerCase()] || c.ch.toLowerCase()))).join('').replace(/[^\p{L}]/gu, '').replace(/ъ$/, '');
  const hasTitlo = (s) => /[҃҇ⷠ-ⷿ]/.test(s);
  const NUM_U = ['', 'а', 'в', 'г', 'д', 'є', 'ѕ', 'з', 'и', 'ѳ'];
  const NUM_T = ['', 'і', 'к', 'л', 'м', 'н', 'ѯ', 'ѻ', 'п', 'ч'];
  const NUM_H = ['', 'р', 'с', 'т', 'у', 'ф', 'х', 'ѱ', 'ѿ', 'ц'];
  const NUM_VALUE = { а:1, в:2, г:3, д:4, є:5, ѕ:6, з:7, и:8, ѳ:9, і:10, к:20, л:30, м:40, н:50, ѯ:60, ѻ:70, п:80, ч:90, р:100, с:200, т:300, у:400, ф:500, х:600, ѱ:700, ѿ:800, ц:900 };
  function numeralValue(word) {
    // Требуем числовой знак и правильный порядок букв, а не только набор
    // букв-цифр. Положение титла может различаться; грамматические знаки
    // (ударение, звательце, буквенное титло) не считаем частью цифири.
    const raw = word.normalize('NFD').toLowerCase().replace(/ї/g, 'і').replace(/е/g, 'є').replace(/о/g, 'ѻ').replace(/ꙋ/g, 'у').replace(/ѡ/g, 'ѿ');
    if (!/[҃҂]/.test(raw) || /[^авгдєѕзиѳіклмнѯѻпчрстуфхѱѿц҃҂]/.test(raw)) return null;
    const letters = raw.replace(/҃/g, '');
    let value = 0, thousands = false;
    for (const ch of letters) {
      if (ch === '҂') { if (thousands) return null; thousands = true; continue; }
      value += NUM_VALUE[ch] * (thousands ? 1000 : 1);
      thousands = false;
    }
    if (thousands || value < 1 || value > 999999) return null;
    const group = n => {
      const h = Math.floor(n / 100), t = Math.floor(n % 100 / 10), u = n % 10;
      return NUM_H[h] + (t === 1 && u ? NUM_U[u] + NUM_T[t] : NUM_T[t] + NUM_U[u]);
    };
    const canonical = [...group(Math.floor(value / 1000))].map(ch => '҂' + ch).join('') + group(value % 1000);
    return letters === canonical ? value : null;
  }
  // в справочнике вария и оксия — отдельными знаками: и + ̀, а не готовая ѝ
  const nfc = (s) => s.normalize('NFC').replace(/\u045D/g, 'и\u0300').replace(/\u040D/g, 'И\u0300').replace(/\u0450/g, 'е\u0300').replace(/\u0400/g, 'Е\u0300');
  const join = (cl) => nfc(cl.map((c) => c.ch + c.marks).join(''));

  // где кончается основа: индекс кластера после основы, или -1
  function boundary(cl, key) {
    let acc = '';
    for (let i = 0; i < cl.length; i++) {
      acc += cl[i].key;
      if (acc === key) return i + 1;
      if (!key.startsWith(acc)) return -1;
    }
    return -1;
  }

  const ENTRIES = E.map(([f, a, type, o = {}]) => ({ f, a, type, ...o, fk: [keyOf(f)].concat((o.alias || []).map(keyOf)), ak: keyOf(a) }));
  const BY_FULL = ENTRIES.filter((e) => !e.expandOnly).sort((x, y) => Math.max(...y.fk.map((k) => k.length)) - Math.max(...x.fk.map((k) => k.length)));
  const BY_ABBR = ENTRIES.slice().sort((x, y) => y.ak.length - x.ak.length);

  function endingOk(e, rest, strict) {
    const rk = endKey(rest), rr = rawKey(rest), restLen = rest.length;
    if (e.onlyR && !e.onlyR.includes(rr)) return false;
    if (e.notR && e.notR.includes(rr)) return false;
    if (e.only && !e.only.includes(rk)) return false;
    if (e.not && e.not.includes(rk)) return false;
    if (strict && e.type === 'd' && !ENDINGS.has(rk)) return false;
    if (e.minRest && restLen < e.minRest) return false;
    return true;
  }

  // основа в начале слова или после приставки (все-, пре-, ѡ-, во-): [{ pre, b }]
  function matches(cl, key, px) {
    const out = [];
    const b0 = boundary(cl, key);
    if (b0 >= 0) out.push({ pre: 0, b: b0 });
    (px || []).forEach((p) => {
      const pb = boundary(cl, keyOf(p));
      if (pb <= 0) return;
      const b = boundary(cl.slice(pb), key);
      if (b >= 0) out.push({ pre: pb, b: pb + b });
    });
    return out;
  }

  const capitalize = (s) => {
    const i = s.search(/\p{L}/u);
    if (i < 0) return s;
    if (s[i] === 'ᲂ' && /у/.test(s[i + 1] || '')) return s.slice(0, i) + 'О' + s.slice(i + 1);
    return s.slice(0, i) + s[i].toUpperCase() + s.slice(i + 1);
  };
  const isUpperWord = (w) => { const m = w.match(/\p{L}/u); return !!m && m[0] !== m[0].toLowerCase(); };
  const CONS = /[бвгджзклмнпрстфхцчшщ]$/i;

  // окончание, набранное русскими буквами, — по-церковнославянски
  function civilEnding(s) {
    return s.replace(/и(?=[аеиоуыэюяй])/g, 'ї').replace(/у/g, 'ꙋ').replace(/я/g, 'ѧ').replace(/[ёэ]/g, 'е');
  }

  /* полное слово → под титлом */
  function abbreviateWord(word, opts = {}) {
    if (hasTitlo(word)) return null;
    let civil = /^[а-яё]+$/i.test(word);
    // русское написание: берём церковнославянскую форму с ударением из словаря, если она там есть
    if (civil && window.DICT && window.DICT.ready && window.DICT.csForm) {
      const f = window.DICT.csForm(word);
      if (f && !hasTitlo(f)) {
        const up = isUpperWord(word);
        word = up ? f : f.charAt(0).toLowerCase() + f.slice(1);
        if (/^ᲂу|^Оу/.test(word) && !up) word = 'ᲂ' + word.slice(1);
        civil = false;
      }
    }
    const cl = clusters(word);
    for (const e of BY_FULL) {
      if (e.opt && !opts.optional) continue;
      for (const fk of e.fk) for (const { pre, b } of matches(cl, fk, e.px)) {
        const rest = cl.slice(b);
        if (!endingOk(e, rest, true)) continue;
        const head = pre ? join(cl.slice(0, pre)) : '';
        let tail = join(rest);
        if (civil) tail = civilEnding(tail.toLowerCase());
        // і без знака над ней пишется с двумя точками: ї
        tail = tail.replace(/і(?![\u0300-\u036F\u0483-\u0489])/g, 'ї');
        let stem = e.a;
        if (ACC1.test(tail) || ACC1.test(head)) stem = noAcc(stem);
        if (pre) stem = stem.replace(/\u0486/g, '');
        let out = (civil ? head.toLowerCase() : head) + stem + tail;
        if (civil && CONS.test(out.replace(/\p{M}+$/u, ''))) out += 'ъ';
        if (isUpperWord(word)) out = capitalize(out);
        return { out: nfc(out), e };
      }
    }
    return null;
  }

  /* под титлом → полное слово */
  function expandWord(word, opts = {}) {
    if (!hasTitlo(word)) return null;
    if (numeralValue(word) !== null && (!opts.allowNumeral || word.includes('҂'))) return null;
    const cl = clusters(word);
    for (const e of BY_ABBR) for (const { pre, b } of matches(cl, e.ak, e.px)) {
      const rest = cl.slice(b);
      const rk = endKey(rest);
      if (!endingOk(e, rest, false)) continue;
      const head = pre ? join(cl.slice(0, pre)) : '';
      const tail = join(rest);
      let stem = e.f;
      // ударение в окончании — снимаем с основы; в производном слове с подвижным ударением — тоже
      if (ACC1.test(tail) || ACC1.test(head) || (e.free && !ENDINGS.has(rk))) stem = noAcc(stem);
      if (pre) stem = stem.replace(/\u0486/g, '');
      let out = head + stem + tail;
      if (isUpperWord(word)) out = capitalize(out);
      return { out: nfc(out), e };
    }
    return null;
  }

  /* текст целиком: dir 'abbr' — поставить титла, 'expand' — раскрыть */
  function convert(text, dir, opts = {}) {
    const changes = [];
    const numerals = [], ambiguous = [];
    const re = /[\p{L}\p{M}҂]+/gu;
    let out = '', last = 0, m;
    while ((m = re.exec(text))) {
      const w = m[0];
      const value = dir === 'expand' ? numeralValue(w) : null;
      let r;
      if (value !== null) {
        const reading = { word:w, value, start:m.index, end:m.index + w.length };
        const alternative = w.includes('҂') ? null : expandWord(w, { allowNumeral:true });
        if (alternative && opts.ambiguous === 'expand') r = alternative;
        else {
          numerals.push(reading);
          if (alternative) ambiguous.push({ ...reading, expanded:alternative.out });
          r = null; // Контекст не определён: исходная запись сохраняется.
        }
      } else r = dir === 'expand' ? expandWord(w) : abbreviateWord(w, opts);
      out += text.slice(last, m.index);
      if (r && r.out !== w) {
        changes.push({ from: w, to: r.out, note: r.e.note || (r.e.opt ? N_OPT : ''), start: out.length, end: out.length + r.out.length });
        out += r.out;
      } else out += w;
      last = m.index + w.length;
    }
    out += text.slice(last);
    // слова под титлом, которых нет в таблице
    const unknown = [];
    if (dir === 'expand') {
      (text.match(re) || []).forEach((w) => { if (hasTitlo(w) && !expandWord(w) && numeralValue(w) === null && !unknown.includes(w)) unknown.push(w); });
    }
    return { text: out, changes, unknown, numerals, ambiguous };
  }

  window.TITLA_CONV = { convert, abbreviateWord, expandWord, numeralValue, entries: ENTRIES, keyOf };
})();
