'use strict';
// Exercise the dictionary's public lookup with the shipped data and morphology,
// rather than asserting implementation strings or substituting a toy lemmatizer.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '../../../outputs/slavonic-demo');
const source = name => fs.readFileSync(path.join(ROOT, name), 'utf8');

async function dictionary() {
  const context = vm.createContext({ window: { getSelection: () => null }, document: {}, localStorage: { getItem: () => null } });
  const app = source('app.js');
  const start = app.indexOf('  const norm =');
  const end = app.indexOf('  const words =', start);
  vm.runInContext(app.slice(start, end) + '\nwindow.SEARCH={norm,normX};', context);
  for (const file of ['checker.js', 'titla.js', 'forms.js', 'morphology-profiles.js', 'morphology.js', 'slovar-data.js', 'dictionary.js']) {
    vm.runInContext(source(file), context, { filename: file });
  }
  assert.equal(await context.window.DICT.load(), true);
  return context.window.DICT;
}
const ready = dictionary();

test('a verified inflection immediately resolves to the actual dictionary article', async () => {
  const D = await ready;
  const result = D.lookupWord('небесѣ́хъ');
  assert.equal(result.exact, true);
  assert.equal(result.items.length, 1);
  assert.equal(D.entry(result.items[0])[1], 'небо');
  assert.deepEqual(Array.from(result.analyses[0].matches, m => [m.case, m.number]), [['locative', 'pl']]);
  assert.deepEqual(Array.from(D.lookupWord('небесѣ́хъ'.normalize('NFD')).items), Array.from(result.items));
  for (const word of ['нбⷭ҇ѣ́хъ', 'нбⷭ҇ѣхъ', 'нб҃сѣ́хъ']) {
    const abbreviated = D.lookupWord(word);
    assert.deepEqual(Array.from(abbreviated.items), Array.from(result.items), word);
    assert.equal(abbreviated.analyses[0].matches[0].case, 'locative', word);
  }
});

test('case ambiguity does not force the user to choose the same lexical article twice', async () => {
  const D = await ready;
  const result = D.lookupWord('небесѝ');
  assert.equal(result.items.length, 1);
  assert.equal(result.analyses[0].matches.length, 2);
  assert.deepEqual(Array.from(result.analyses[0].matches, m => m.case), ['dative', 'locative']);
});

test('an inflected masculine noun does not hide a real homographic feminine headword', async () => {
  const D = await ready;
  const result = D.lookupWord('раба̀');
  assert.equal(result.exact, true);
  assert.equal(result.items.length, 2);
  assert.deepEqual(Array.from(result.items, i => D.entry(i)[1].toLowerCase()).sort(), ['раб', 'раба']);
});

test('whole headwords outrank an article whose compound heading merely starts with the word', async () => {
  const D = await ready;
  const result = D.lookupWord('сын');
  assert.equal(result.exact, true);
  assert.equal(result.items.length, 1);
  assert.equal(D.entry(result.items[0])[1].toLowerCase(), 'сын');
  for (const query of ['Сын Человеческий', 'слово и дело', 'Господь Саваоф']) {
    const compound = D.lookupWord(query);
    assert.equal(compound.exact, true, query);
    assert.equal(compound.items.length, 1, query);
    assert.match(D.entry(compound.items[0])[0], /\s/u, query);
  }
});

test('the existing titlo and vocative lookup still resolves without losing the source word', async () => {
  const D = await ready;
  for (const [word, lemma] of [['бг҃ъ', 'бог'], ['ѻ҆́тче', 'отец'], ['гдⷭ҇ь', 'господь']]) {
    const r = D.lookupWord(word);
    assert.ok(r?.exact, word);
    assert.ok(r.items.some(i => D.entry(i)[1].toLowerCase() === lemma), word);
  }
});

test('unrelated words and partial stems are never promoted to a verified inflection', async () => {
  const D = await ready;
  for (const word of ['небесѣ́хъникъ', 'небеснѣ́хъ', 'небес']) {
    assert.equal(D.lookupWord(word)?.how === 'form', false, word);
  }
  assert.equal(D.lookupWord(''), null);
  assert.equal(await D.openPopup(-1), false);
});
