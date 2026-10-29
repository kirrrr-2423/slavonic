'use strict';
// Behavioural regressions for the linguistic core. No browser/user storage is used.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '../../../outputs/slavonic-demo');
const context = vm.createContext({ window:{}, document:{}, localStorage:{ getItem:() => null }, setTimeout:() => 0 });
for (const file of ['checker.js', 'spell.js', 'spell-data.js', 'titla.js', 'forms.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { filename:file });
}
// Use the application's existing numeral encoder to test interoperability,
// rather than duplicating its expected numeric spellings in this test.
const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
vm.runInContext(app.slice(app.indexOf("  const TITLO = '҃';"), app.indexOf('  /* ---------- поиск ---------- */')), context);
const { CHECK, SPELL, TITLA_CONV:T, FORMS:F, CIFIR } = context.window;
const loaded = SPELL.load();
const plain = x => String(x).normalize('NFD');
const equalCS = (actual, expected, message) => assert.equal(plain(actual), plain(expected), message);
const tense = (r, id) => r.tenses.find(t => t.id === id).forms;
const issues = text => Array.from(CHECK.check(text), i => ({ rule:i.rule, sev:i.sev, fixed:i.fixed === null ? null : plain(i.fixed) }));
const noStress = value => assert.doesNotMatch(plain(value), /[\u0300\u0301\u0311]/u, value);

test('canonical Unicode forms receive equivalent checks, without losing source ranges', async () => {
  await loaded;
  for (const word of ['благословѝ', 'сотворѝ', 'є҆сѝ же', 'мѝ же', 'кра́й', 'ѳѷмїа́мъ', 'ѱало́мъ']) {
    assert.deepEqual(issues(word.normalize('NFC')), issues(word.normalize('NFD')), word);
  }
  assert.equal(CHECK.check('благословѝ').some(i => i.rule === 'no-stress'), false);
  const source = '🕯️ сотворѝ же\nмѝ же';
  const expected = ['сотворѝ', 'мѝ'];
  const contextual = CHECK.check(source).filter(i => i.rule === 'varia-encl');
  assert.equal(contextual.length, 2);
  contextual.forEach((issue, n) => {
    assert.equal(issue.word, expected[n]);
    assert.equal(source.slice(issue.start, issue.end), expected[n]);
  });
  const first = contextual[0];
  assert.equal(source.slice(0, first.start) + first.fixed + source.slice(first.end), '🕯️ сотвори́ же\nмѝ же');
  assert.equal(source, '🕯️ сотворѝ же\nмѝ же');
});

test('SCI exact forms suppress only the unsupported i-before-consonant suggestion', async () => {
  await loaded;
  for (const word of ['Пїла́тъ', 'Нїкола́й', 'є҆пі́скопъ']) {
    assert.equal(SPELL.has(word), true, word);
    assert.equal(CHECK.check(word).some(i => i.rule === 'i-before-cons'), false, word);
  }
  assert.equal(CHECK.check('Пїлатъ').some(i => i.rule === 'i-before-cons'), true, 'unknown spelling still gets a cautious hint');
  assert.equal(CHECK.check('є҆сѝ же').some(i => i.rule === 'varia-encl'), true, 'context must still be checked');
  assert.equal(CHECK.check('Пїла́тъ?').some(i => i.rule === 'punct'), true);
  const real = context.window.SPELL;
  context.window.SPELL = { ready:true, has:() => true };
  try {
    assert.equal(CHECK.check('е҆пі́скопъ').some(i => i.rule === 'e-start'), true, 'exact lookup cannot disable unrelated rules');
  } finally { context.window.SPELL = real; }
});

test('reflexive verbs preserve the first/second conjugation distinction', () => {
  const wash = F.conjugate('мы́тисѧ', null, null, { stress:'auto' });
  const pray = F.conjugate('моли́тисѧ', null, null, { stress:'auto' });
  assert.equal(wash.conj, 1);
  assert.equal(pray.conj, 2);
  equalCS(F.guessPresent('мы́тисѧ').p1, 'мы́юсѧ');
  equalCS(F.guessPresent('моли́тисѧ').p1, 'молю́сѧ');
  equalCS(tense(wash, 'pres')[1], 'мы́ешисѧ');
  equalCS(tense(pray, 'pres')[1], 'мо́лишисѧ');
  equalCS(tense(pray, 'pres')[2], 'мо́литсѧ');
  equalCS(wash.l, 'мы́лсѧ');
  equalCS(pray.l, 'моли́лсѧ');
  assert.equal(tense(pray, 'impv')[0], '—');
  assert.doesNotMatch(tense(pray, 'pres').join(' '), /ъсѧ/);
  assert.equal(CHECK.check(tense(pray, 'pres')[0]).some(i => i.rule === 'varia-mid'), false);
});

test('explicit reflexive first-person forms and compound tenses attach the particle to the lexical verb', () => {
  const result = F.conjugate('моли́тисѧ', 'молю̀сѧ', null, { stress:'auto' });
  equalCS(result.p1, 'молю́сѧ');
  equalCS(tense(result, 'perf')[0], 'моли́лсѧ є҆́смь');
  equalCS(tense(result, 'pqp')[0], 'бѣ́хъ моли́лсѧ');
  equalCS(tense(result, 'fut2')[0], 'и҆́мамъ моли́тисѧ');
  for (const entry of result.tenses) for (const cell of entry.forms) {
    for (const variant of cell.split(' · ')) {
      if (variant === '—') continue;
      assert.equal((variant.match(/сѧ/g) || []).length, 1, variant);
    }
  }
  assert.equal(F.guessPos(F.normalizeInput('мыться').word), 'verb');
  assert.equal(F.conjugate(F.normalizeInput('мыться').word).conj, 1);
  assert.equal(F.conjugate(F.normalizeInput('молиться').word).conj, 2);
});

test('non-reflexive paradigm remains unchanged', () => {
  const result = F.conjugate('хвали́ти', null, null, { stress:'auto' });
  equalCS(tense(result, 'pres')[0], 'хвалю̀');
  equalCS(tense(result, 'pres')[1], 'хва́лиши');
  equalCS(result.l, 'хвали́лъ');
  assert.equal(result.conj, 2);
});

test('no-stress mode covers generated, irregular, reflexive and compound verb surfaces', () => {
  for (const input of ['хвали́ти', 'бы́ти', 'да́ти', 'вѣ́дѣти', 'моли́тисѧ', 'мы́тисѧ']) {
    const result = F.conjugate(input, null, null, { stress:'none' });
    for (const value of [result.inf, result.p1, result.l, ...(result.lf || [])]) if (value) noStress(value);
    result.tenses.forEach(entry => entry.forms.forEach(noStress));
  }
  // Removing accents from one result must not mutate the shared irregular tables.
  assert.match(plain(tense(F.conjugate('бы́ти'), 'pres')[0]), /\u0301/);
});

test('no-stress mode covers adjective comparisons and nouns as well', () => {
  for (const word of ['до́брый', 'вели́кїй', 'свѧты́й', 'си́нїй']) {
    const result = F.declineAdj(word, null, { stress:'none' });
    for (const gender of ['m', 'n', 'f']) {
      for (const number of ['sg', 'du', 'pl']) result.full[gender][number].flat().forEach(noStress);
      result.short[gender].forEach(noStress);
    }
    if (result.comp) { noStress(result.comp.short); noStress(result.comp.full); }
    noStress(result.super);
  }
  for (const word of ['ра́бъ', 'рꙋка̀', 'ѻ҆те́цъ']) {
    const result = F.declineNoun(word, F.detectNoun(word), { stress:'none' });
    ['sg', 'du', 'pl'].forEach(number => result[number].flat().forEach(noStress));
  }
});

test('titla expansion preserves every tested numeric encoding from the application', () => {
  for (const n of [...Array.from({ length:9999 }, (_, i) => i + 1), 10000, 11019, 250001, 500500, 999999]) {
    const word = CIFIR.toCS(n).text;
    assert.equal(T.numeralValue(word), n, String(n));
    const result = T.convert(word, 'expand');
    assert.equal(result.text, word, String(n));
    assert.equal(result.changes.length, 0);
    assert.equal(result.unknown.length, 0);
  }
});

test('numeric/word ambiguity is explicit and opt-in word expansion remains available', () => {
  const result = T.convert('с҃н, сн҃а; сн҃ъ', 'expand');
  assert.equal(result.text, 'с҃н, сн҃а; сы́нъ');
  assert.deepEqual(Array.from(result.ambiguous, item => item.value), [250, 251]);
  result.ambiguous.forEach(item => assert.equal('с҃н, сн҃а; сн҃ъ'.slice(item.start, item.end), item.word));
  assert.equal(T.expandWord('с҃н'), null);
  equalCS(T.expandWord('с҃н', { allowNumeral:true }).out, 'сы́н');
  const explicit = T.convert('с҃н, сн҃а', 'expand', { ambiguous:'expand' });
  equalCS(explicit.text, 'сы́н, сы́на');
  assert.equal(explicit.ambiguous.length, 0);
  assert.equal(explicit.numerals.length, 0);
  const thousands = CIFIR.toCS(200050).text;
  assert.equal(T.convert(thousands, 'expand', { ambiguous:'expand' }).text, thousands);
  assert.equal(T.convert(thousands, 'expand').ambiguous.length, 0);
  assert.equal(T.expandWord(thousands, { allowNumeral:true }), null);
});

test('ordinary sacred words and noncanonical numeric-letter sequences still expand normally', () => {
  equalCS(T.expandWord('сн҃ъ').out, 'сы́нъ');
  equalCS(T.expandWord('бг҃ъ').out, 'бо́гъ');
  equalCS(T.expandWord('ст҃').out, 'свѧ́т');
  assert.equal(T.numeralValue('ст҃'), null, '300 cannot follow 200 in the numeric order');
  assert.equal(T.numeralValue('с҃нъ'), null);
  assert.equal(T.numeralValue('сн'), null, 'bare words are not labelled numbers');
  assert.equal(T.convert('бг҃ъ', 'expand').changes.length, 1);
  assert.equal(T.convert('бо́гъ', 'abbr').changes.length, 1);
});
