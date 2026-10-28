'use strict';
/* Проверка правописания: правила справочника и, когда загружен, словарь SCI (spell.js). */
(() => {
  const PSILI = '҆', OXIA = '́', VARIA = '̀', KAMORA = '̑', TITLO = '҃', POKR = '҇', THOUS = '҂';
  const VOWELS = new Set('аеєиіїоѻѡѽуꙋюꙗѧѣыэяѵѷᲂ');
  const CONS = new Set('бвгджзклмнпрстфхцчшщѯѱѳѕ');
  const NUMERAL = new Set('авгдєѕзиѳіклмнѯѻпчрстуфхѱѿѡц');
  const ENCL = new Set(['бо', 'же', 'ли', 'мѧ', 'ми', 'тѧ', 'ти', 'сѧ', 'си', 'ны', 'вы', 'не']);
  const LATIN = { a: 'а', e: 'е', o: 'о', p: 'р', c: 'с', x: 'х', y: 'у', k: 'к', m: 'м', t: 'т', i: 'і', A: 'А', E: 'Е', O: 'О', P: 'Р', C: 'С', X: 'Х', Y: 'У', K: 'К', M: 'М', T: 'Т', B: 'В', H: 'Н', I: 'І' };
  const SACRED = {
    'богъ': ['бг҃ъ', 'Бог истинный пишется под титлом; без титла — языческий бог'],
    'господь': ['гдⷭ҇ь', 'Слово «Господь» пишется под титлом'],
    'иисусъ': ['і҆и҃съ', 'Имя Иисус пишется под титлом'],
    'христосъ': ['хрⷭ҇то́съ', 'Имя Христос пишется под титлом'],
    'богородица': ['бцⷣа', 'Слово «Богородица» пишется под титлом'],
    'ангелъ': ['а҆́гг҃лъ', 'Ангел Божий — под титлом; без титла (а҆́ггелъ) — падший ангел'],
    'владыка': ['влⷣка', 'Если речь о Боге — пишется под титлом'],
    'владычица': ['влⷣчца', 'Если речь о Богородице — пишется под титлом'],
    'троица': ['трⷪ҇ца', 'Слово «Троица» пишется под титлом'],
    'спасъ': ['сп҃съ', 'Слово «Спас» пишется под титлом']
  };

  const isMark = (ch) => /\p{M}/u.test(ch);
  const isLetter = (ch) => /\p{L}/u.test(ch);
  const low = (ch) => ch.toLowerCase();
  const isUpper = (ch) => ch !== ch.toLowerCase();
  const withCase = (orig, repl) => (isUpper(orig) ? repl.charAt(0).toUpperCase() + repl.slice(1) : repl);

  function clustersOf(token) {
    const out = [];
    for (const ch of token) {
      if (isMark(ch) && out.length) out[out.length - 1].marks += ch;
      else out.push({ ch, marks: '' });
    }
    return out;
  }
  const join = (cl) => cl.map((c) => c.ch + c.marks).join('');
  const clone = (cl) => cl.map((c) => ({ ch: c.ch, marks: c.marks }));
  const baseOf = (cl) => cl.filter((c) => isLetter(c.ch)).map((c) => low(c.ch)).join('');
  const isDigraphAt = (cl, i) => cl[i] && 'оᲂ'.includes(low(cl[i].ch)) && cl[i + 1] && low(cl[i + 1].ch) === 'у';

  function tokenize(text) {
    const tokens = [];
    const re = /[\p{L}\p{M}҂]+|\d+|\?/gu;
    let m;
    while ((m = re.exec(text))) tokens.push({ text: m[0], start: m.index, end: m.index + m[0].length });
    return tokens;
  }

  function isNumeral(cl) {
    const letters = cl.filter((c) => isLetter(c.ch));
    if (!letters.length) return false;
    const hasSign = cl.some((c) => c.ch === THOUS || c.marks.includes(TITLO));
    if (!hasSign) return false;
    const onlyTitlo = cl.every((c) => c.marks.replace(new RegExp(TITLO, 'g'), '') === '');
    return onlyTitlo && letters.every((c) => NUMERAL.has(low(c.ch)));
  }

  function check(text) {
    const issues = [];
    const tokens = tokenize(text);
    const words = tokens.filter((t) => /\p{L}/u.test(t.text));
    const widx = new Map(words.map((w, i) => [w, i]));
    const nextWordBase = (tok) => {
      const i = widx.get(tok);
      const nx = words[i + 1];
      if (!nx) return null;
      const between = text.slice(tok.end, nx.start);
      if (/[.,:;!?·\n]/.test(between)) return null;
      return baseOf(clustersOf(nx.text));
    };

    for (const tok of tokens) {
      const add = (sev, rule, msg, op) => {
        let fixed = null;
        if (op) {
          const cl = clone(clustersOf(tok.text));
          const res = op(cl);
          fixed = typeof res === 'string' ? res : join(cl);
          if (fixed === tok.text) fixed = null;
        }
        issues.push({ sev, rule, msg, start: tok.start, end: tok.end, word: tok.text, fixed });
        return issues[issues.length - 1];
      };
      const before = issues.length;

      if (tok.text === '?') { add('error', 'punct', 'Вопросительный знак в церковнославянском — «;»', () => ';'); continue; }
      if (/^\d+$/.test(tok.text)) {
        const n = Number(tok.text);
        const cs = window.CIFIR && n >= 1 && n <= 999999 ? window.CIFIR.toCS(n) : null;
        add('hint', 'digits', 'Числа пишутся буквами с титлом', cs ? () => cs.text : null);
        continue;
      }

      const cl = clustersOf(tok.text);
      if (!cl.some((c) => isLetter(c.ch))) continue;

      // латиница внутри кириллического слова
      const latin = cl.map((c, i) => [c, i]).filter(([c]) => /[A-Za-z]/.test(c.ch));
      if (latin.length && cl.some((c) => /[Ѐ-ӿꙀ-ꚟᲀ-ᲈ]/.test(c.ch))) {
        add('error', 'latin', 'В слове латинская буква, похожая на кириллическую', (x) => { latin.forEach(([c, i]) => { if (LATIN[c.ch]) x[i].ch = LATIN[c.ch]; }); });
        continue;
      }
      if (isNumeral(cl)) continue;

      const base = baseOf(cl);
      const hasTitlo = cl.some((c) => /[҃҇ⷠ-ⷿ]/.test(c.marks));
      const last = cl.length - 1;
      let lastLetter = last;
      while (lastLetter > 0 && !isLetter(cl[lastLetter].ch)) lastLetter--;
      const c0 = low(cl[0].ch);
      const digraph0 = isDigraphAt(cl, 0);

      // буквы, которых нет в церковнославянском
      cl.forEach((c, i) => {
        const l = low(c.ch);
        if (l === 'я') add('error', 'ya', 'Буквы «я» нет: в начале слова пишется ꙗ, дальше — ѧ', (x) => { x[i].ch = withCase(c.ch, i === 0 ? 'ꙗ' : 'ѧ'); });
        if (l === 'э') add('error', 'e', 'Буквы «э» нет: в начале слова пишется є, дальше — е', (x) => { x[i].ch = withCase(c.ch, i === 0 ? 'є' : 'е'); });
        if (l === 'ё') add('error', 'yo', 'Буквы «ё» нет — пишется е, и читается она как [е]', (x) => { x[i].ch = withCase(c.ch, 'е'); });
      });

      // ѿ
      if (base === 'отъ' || base === 'от') { add('error', 'ot', 'Предлог «от» пишется одной буквой ѿ', () => withCase(cl[0].ch, 'ѿ')); continue; }

      // титла у священных слов
      const plain = base.replace(/[іїѵ]/g, 'и').replace(/ꙋ/g, 'у').replace(/оу/g, 'у').replace(/ᲂу/g, 'у');
      if (!hasTitlo && SACRED[plain]) add('hint', 'sacred', SACRED[plain][1], () => withCase(cl[0].ch, SACRED[plain][0]));

      // е → є, о → ѻ в начале слова
      if (c0 === 'е') add('error', 'e-start', 'В начале слова пишется є (широкое)', (x) => { x[0].ch = withCase(cl[0].ch, 'є'); });
      if (c0 === 'о' && !digraph0) add('error', 'o-start', 'В начале слова пишется ѻ (широкое) или ѡ', (x) => { x[0].ch = withCase(cl[0].ch, 'ѻ'); });

      // оу / ꙋ / у
      cl.forEach((c, i) => {
        const l = low(c.ch);
        if (l === 'ꙋ' && i === 0) add('error', 'uk', 'В начале слова пишется оу, ꙋ — только дальше', (x) => { x.splice(0, 1, { ch: withCase(c.ch, 'ᲂ'), marks: '' }, { ch: 'у', marks: c.marks }); });
        if (l === 'у' && !(i > 0 && 'оᲂ'.includes(low(cl[i - 1].ch)))) {
          add('error', 'u', 'Отдельной «у» нет: в начале слова — оу, в середине и в конце — ꙋ', (x) => {
            if (i === 0) x.splice(0, 1, { ch: withCase(c.ch, 'ᲂ'), marks: '' }, { ch: 'у', marks: c.marks });
            else x[i].ch = withCase(c.ch, 'ꙋ');
          });
        }
        if (i > 0 && isDigraphAt(cl, i)) add('hint', 'uk-mid', 'В середине и в конце слова обычно пишется ꙋ', (x) => { x.splice(i, 2, { ch: withCase(c.ch, 'ꙋ'), marks: cl[i].marks + cl[i + 1].marks }); });
      });

      // ꙗ / ѧ
      if (c0 === 'ѧ' && !(base === 'ѧ' || base.startsWith('ѧзык'))) add('warn', 'ya-start', 'В начале слова пишется ꙗ (исключения: ѧ҆зы́къ — орган, речь; ѧ҆̀ — «их»)', (x) => { x[0].ch = withCase(cl[0].ch, 'ꙗ'); });
      cl.forEach((c, i) => { if (i > 0 && low(c.ch) === 'ꙗ') add('error', 'ya-mid', 'В середине и в конце слова пишется ѧ', (x) => { x[i].ch = withCase(c.ch, 'ѧ'); }); });

      // и / і
      cl.forEach((c, i) => {
        const l = low(c.ch), nx = cl[i + 1] ? low(cl[i + 1].ch) : '';
        if (l === 'и' && nx && (VOWELS.has(nx) || nx === 'й')) add('error', 'i-before-vowel', 'Перед гласной пишется і (десятеричное)', (x) => { x[i].ch = withCase(c.ch, i === 0 ? 'і' : 'ї'); });
        if ((l === 'і' || l === 'ї') && i > 0 && CONS.has(nx) && !/^м[іїi]р/.test(base) && !/^в[іїi]н/.test(base) && !/[ѳѯѱѵѷѡф]/.test(base)) {
          add('hint', 'i-before-cons', 'Перед согласной обычно пишется и (і — в мі́ръ и в греческих словах)', (x) => { x[i].ch = withCase(c.ch, 'и'); });
        }
      });

      // ѕ, ѱ, ѯ
      if (/^(звѣзд|звезд|звѣр|звер|змі|змї|змий|змій|зѣл|зело|зел[їи]|злак|зл(о|ы|ѣ|ꙋ|а$))/.test(base) && !base.startsWith('злат')) {
        add('hint', 'zelo', 'В этом корне пишется ѕ: ѕвѣ́рь, ѕвѣзда̀, ѕе́лїе, ѕла́къ, ѕло̀, ѕмі́й, ѕѣлѡ̀', (x) => { x[0].ch = withCase(cl[0].ch, 'ѕ'); });
      }
      if (/^ѳимї?а/.test(base)) add('hint', 'fymiam', 'Пишется через ижицу: ѳѷмїа́мъ (греч. θυμίαμα)', null);
      if (base.startsWith('псал')) add('hint', 'psi', 'В греческих словах пс пишется ѱ: ѱало́мъ, ѱалти́рь', (x) => { x.splice(0, 2, { ch: withCase(cl[0].ch, 'ѱ'), marks: cl[0].marks + cl[1].marks }); });
      const ks = base.indexOf('алекс');
      if (ks === 0) add('hint', 'ksi', 'В греческих словах кс пишется ѯ: а҆леѯа́ндръ', null);

      // ер на конце
      const lastL = low(cl[lastLetter].ch);
      if (!hasTitlo && CONS.has(lastL)) {
        const caps = base.length > 1 && cl.filter((c) => isLetter(c.ch)).every((c) => isUpper(c.ch));
        add('error', 'yer', 'После согласной на конце слова пишется ъ', (x) => { x.splice(lastLetter + 1, 0, { ch: caps ? 'Ъ' : 'ъ', marks: '' }); });
      }

      // придыхание
      if (VOWELS.has(c0) && c0 !== 'ѽ') {
        const at = digraph0 ? 1 : 0;
        if (!cl[at].marks.includes(PSILI)) add('error', 'psili', 'Над начальной гласной нужно придыхание (звательце)', (x) => { x[at].marks = PSILI + x[at].marks; });
      }
      cl.forEach((c, i) => {
        const allowed = i === 0 || (i === 1 && digraph0);
        if (!allowed && c.marks.includes(PSILI)) add('warn', 'psili-mid', 'Придыхание ставится только над первой гласной слова', (x) => { x[i].marks = x[i].marks.replace(PSILI, ''); });
        if (/[̀́̑]҆/.test(c.marks)) add('warn', 'order', 'Сначала придыхание, затем ударение (иначе знаки встанут неверно)', (x) => { x[i].marks = x[i].marks.replace(/([̀́̑])҆/, '҆$1'); });
      });

      // ударения
      const stressIdx = [];
      cl.forEach((c, i) => { if (/[̀́̑]/.test(c.marks)) stressIdx.push(i); });
      const vowelCount = cl.reduce((n, c, i) => n + (VOWELS.has(low(c.ch)) && !(i > 0 && isDigraphAt(cl, i - 1)) && low(c.ch) !== 'ᲂ' ? 1 : 0), 0) + (cl.some((c) => low(c.ch) === 'ᲂ') ? 1 : 0);
      const next = nextWordBase(tok);
      const beforeEnclitic = next !== null && ENCL.has(next);

      cl.forEach((c, i) => {
        if (c.marks.includes(VARIA) && i !== lastLetter && !c.marks.includes(PSILI)) {
          add('error', 'varia-mid', 'Вария ставится только над последней буквой слова — здесь нужна оксия', (x) => { x[i].marks = x[i].marks.replace(VARIA, OXIA); });
        }
      });
      const lastC = cl[lastLetter];
      if (VOWELS.has(low(lastC.ch)) && base.length > 1) {
        if (lastC.marks.includes(OXIA) && !beforeEnclitic) add('warn', 'oxia-end', 'На конце слова ставится вария (кроме случая, когда дальше идёт безударное бо, же, ли, мѧ…)', (x) => { x[lastLetter].marks = x[lastLetter].marks.replace(OXIA, VARIA); });
        if (lastC.marks.includes(VARIA) && beforeEnclitic) add('warn', 'varia-encl', 'Перед безударным словом вария сменяется оксией', (x) => { x[lastLetter].marks = x[lastLetter].marks.replace(VARIA, OXIA); });
      }
      if (base.length === 1 && VOWELS.has(c0) && cl[0].marks.includes(PSILI + OXIA) && !beforeEnclitic) {
        add('hint', 'apostrof', 'В слове из одной ударной гласной ставится апостроф (звательце + вария)', (x) => { x[0].marks = x[0].marks.replace(OXIA, VARIA); });
      }
      if (stressIdx.length === 0 && vowelCount >= 2 && !hasTitlo && !ENCL.has(base)) add('hint', 'no-stress', 'Нет знака ударения', null);
      if (stressIdx.length > 1) add('hint', 'two-stress', 'В слове больше одного знака ударения', null);

      // словарь SCI: только если правила к слову претензий не имеют
      const SP = window.SPELL;
      if (SP && SP.ready && !issues.slice(before).some((i) => i.sev !== 'hint') && SP.has(tok.text) === false) {
        const sug = SP.suggest(tok.text);
        if (sug.length) {
          const iss = add('warn', 'spell', `В словаре SCI: ${sug.join(', ')}`, sug.length === 1 ? () => sug[0] : null);
          iss.noAuto = true;
          iss.alts = sug;
        } else {
          add('hint', 'unknown', 'Этого слова нет в словаре SCI (в нём есть не все формы слов)', null);
        }
      }
    }
    const order = { error: 0, warn: 1, hint: 2 };
    issues.sort((a, b) => a.start - b.start || order[a.sev] - order[b.sev]);
    return issues;
  }

  function fixAll(text, sevs) {
    let t = text;
    for (let guard = 0; guard < 500; guard++) {
      const iss = check(t).find((i) => i.fixed !== null && !i.noAuto && sevs.includes(i.sev));
      if (!iss) break;
      t = t.slice(0, iss.start) + iss.fixed + t.slice(iss.end);
    }
    return t;
  }

  window.CHECK = { check, fixAll };
})();
