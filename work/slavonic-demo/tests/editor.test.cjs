'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = name => fs.readFileSync(path.resolve(__dirname, '../../..', 'outputs/slavonic-demo', name), 'utf8');

function keyboard(initial = {}, options = {}) {
  const data = new Map(Object.entries(initial)), listeners = new Map();
  let now = 1700000000000;
  const failures = new Set(options.failures || []);
  const context = {
    navigator: { platform: 'MacIntel' },
    localStorage: {
      getItem: k => data.get(k) ?? null,
      setItem(k, v) {
        if (failures.has(k)) throw Error('Storage unavailable');
        const next = new Map(data); next.set(k, String(v));
        const bytes = [...next].reduce((total, [key, value]) => total + 2 * (key.length + value.length), 0);
        if (options.quotaBytes !== undefined && bytes > options.quotaBytes) { const error = Error('Storage quota exceeded'); error.name = 'QuotaExceededError'; throw error; }
        data.set(k, String(v));
      },
      removeItem(k) { data.delete(k); }
    },
    document: { body: { contains: () => false }, getElementById: () => null },
    window: { addEventListener(name, fn) { const a = listeners.get(name) || []; a.push(fn); listeners.set(name, a); }, dispatchEvent(e) { (listeners.get(e.type) || []).forEach(fn => fn(e)); } },
    CustomEvent: class { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
    Date: class extends Date { static now() { return now; } },
    setTimeout, clearTimeout
  };
  vm.createContext(context); vm.runInContext(source('keyboard.js'), context);
  return { kb: context.window.KB, data, failures, tick(ms = 31000) { now += ms; }, context };
}

function studio(options = {}) {
  const k = keyboard({ 'cs-demo-editor': options.text ?? 'Отче' });
  const elements = new Map(), timers = new Map(), toasts = [], undo = [];
  let timerId = 0, lookupCalls = 0;
  const make = () => ({ dataset: {}, style: {}, hidden: false, scrollTop: 0, value: '', textContent: '',
    classList: { add() {}, remove() {}, toggle() {} }, setAttribute(name, value) { this[name] = value; }, focus() {}, scrollIntoView() { this.scrolled = true; },
    querySelector(selector) { return elements.get(selector) || null; }, querySelectorAll() { return []; } });
  ['#kbEd','#proofText','#railBody','#railCount','#proofCount','#textStats','#saveState','#exportText','#draftList','#location','#content','#search','#main','.issue-list'].forEach(key => elements.set(key, make()));
  const ed = elements.get('#kbEd');
  Object.assign(ed, { value: options.text ?? 'Отче', selectionStart: 0, selectionEnd: 0,
    focus() { document.activeElement = ed; }, setSelectionRange(s, e) { this.selectionStart = s; this.selectionEnd = e; },
    setRangeText(text, s, e) { this.value = this.value.slice(0, s) + text + this.value.slice(e); this.selectionStart = this.selectionEnd = s + text.length; },
    dispatchEvent() { k.kb.setText(this.value); audit.bumpRevision(); } });
  const body = elements.get('#railBody');
  let bodyHTML = '';
  Object.defineProperty(body, 'innerHTML', { get: () => bodyHTML, set(value) {
    bodyHTML = value;
    for (const key of elements.keys()) if (key.startsWith('#review-issue-') || ['#wordLookup','#lookupResult','#lookupButton'].includes(key)) elements.delete(key);
    for (const match of value.matchAll(/id="(review-issue-\d+|wordLookup|lookupResult|lookupButton)"/g)) elements.set('#' + match[1], make());
    const input = elements.get('#wordLookup'); if (input) input.value = value.match(/id="wordLookup"[^>]*value="([^"]*)"/)?.[1] || '';
  } });
  const modeButtons = ['edit','proof'].map(mode => ({ ...make(), dataset: { mode } }));
  modeButtons.forEach(button => elements.set(`[data-mode="${button.dataset.mode}"]`, button));
  const document = {
    activeElement: null, querySelector: selector => elements.get(selector) || null,
    querySelectorAll: selector => selector === '[data-mode]' ? modeButtons : [], getElementById: id => elements.get('#' + id) || null,
    execCommand(command, _ui, replacement) {
      if (!options.nativeUndo) return false;
      assert.equal(command, 'insertText'); undo.push(ed.value);
      ed.setRangeText(replacement, ed.selectionStart, ed.selectionEnd); ed.dispatchEvent(); return true;
    }
  };
  const context = {
    window: { scrollX: 0, scrollY: 0, scrollTo() {} }, document, KB: k.kb,
    localStorage: { getItem: () => null }, SECTIONS: [], history: { replaceState() {} },
    APP: { toast: message => toasts.push(message) }, DICT: { ready: true, lookupWord() { lookupCalls++; return null; } },
    Event: class {}, matchMedia: () => ({ matches: true }),
    setTimeout(fn, ms) { timers.set(++timerId, { fn, ms }); return timerId; }, clearTimeout(id) { timers.delete(id); }
  };
  vm.createContext(context); vm.runInContext(source('checker.js'), context); context.CHECK = context.window.CHECK;
  const setup = source('studio.js').split(" document.addEventListener('click',e=>{")[0];
  vm.runInContext(setup + `window.audit={check,fixIssue,selectIssue,issuesPanel,dictionaryPanel,sync,setMode,updateSaveState,renderDrafts,
    bumpRevision(){revision++;},scheduleCheck(){checkTimer=setTimeout(check,240);},
    configure(value){if(value.filter!==undefined)filter=value.filter;if(value.panel!==undefined)panel=value.panel;if(value.issues!==undefined){issues=value.issues;checkedText=document.querySelector('#kbEd').value;checkedRevision=revision;}},
    state:()=>({filter,mode,issuePage,selected,pinnedIssue})};})();`, context);
  const audit = context.window.audit;
  return { ...k, audit, ed, elements, timers, toasts, context, lookupCalls: () => lookupCalls,
    input(text) { ed.value = text; ed.dispatchEvent(); }, undo() { assert.ok(undo.length); ed.value = undo.pop(); ed.dispatchEvent(); },
    flush() { const pending = [...timers.values()]; timers.clear(); pending.forEach(t => t.fn()); } };
}

test('a pending correction follows an unchanged word after a prefix edit', () => {
  const e = studio(); e.audit.check(); e.input('а Отче'); e.audit.fixIssue(0, 'Ѻтче');
  assert.equal(e.ed.value, 'а Ѻтче'); assert.equal(e.kb.getText(), 'а Ѻтче'); assert.equal(e.toasts.length, 0);
});

test('a stale correction refuses an edited word and does not move the selection', () => {
  const e = studio(); e.audit.check(); e.input('Отец'); e.ed.setSelectionRange(1, 3); e.audit.fixIssue(0, 'Ѻтче');
  assert.equal(e.ed.value, 'Отец'); assert.equal(e.ed.selectionStart, 1); assert.equal(e.ed.selectionEnd, 3); assert.equal(e.toasts.length, 1);
});

test('fresh replacement uses normal insertText undo and preserves proof mode', () => {
  const e = studio({ nativeUndo: true }); e.audit.check(); e.audit.setMode('proof'); e.audit.fixIssue(0, 'Ѻтче');
  assert.equal(e.ed.value, 'Ѻтче'); assert.equal(e.audit.state().mode, 'proof');
  assert.equal(e.ed.hidden, true); e.undo(); assert.equal(e.ed.value, 'Отче');
});

test('a replacement cannot apply a value that is absent from current suggestions', () => {
  const e = studio(); e.audit.check(); e.audit.fixIssue(0, 'другое слово'); assert.equal(e.ed.value, 'Отче');
});

test('selection after 80 issues renders the correct page and scrolls its card', () => {
  const e = studio();
  e.audit.configure({ issues: Array.from({length: 170}, (_, i) => ({ word: 'слово'+i, start: i, end: i+1, rule: 'no-stress', msg: 'Проверить', fixed: null, sev: 'hint' })) });
  e.audit.setMode('proof'); e.audit.selectIssue(164, false);
  assert.equal(e.audit.state().issuePage, 2); assert.equal(e.audit.state().mode, 'proof');
  assert.ok(e.elements.get('#review-issue-164').scrolled); assert.ok(e.elements.get('#railBody').innerHTML.includes('161–170 из 170'));
});

test('a selected word outside the filter remains visible without resetting the filter', () => {
  const e = studio(); e.audit.configure({ filter: 'error', issues: [{ word: 'Отче', start:0, end:4, rule:'no-stress', msg:'Совет', fixed:null, sev:'hint' }] });
  e.audit.setMode('proof'); e.audit.selectIssue(0, false);
  assert.equal(e.audit.state().filter, 'error'); assert.equal(e.audit.state().mode, 'proof'); assert.ok(e.elements.get('#review-issue-0').scrolled);
  assert.match(e.elements.get('#railBody').innerHTML, /вне текущего фильтра/);
});

test('dictionary debounce does not cancel the independent editor check', () => {
  const e = studio(); e.audit.configure({ panel:'dictionary' }); e.audit.scheduleCheck(); e.audit.dictionaryPanel();
  e.elements.get('#wordLookup').value = 'слово'; e.elements.get('#wordLookup').oninput();
  assert.deepEqual([...e.timers.values()].map(t => t.ms).sort(), [200,240]);
});

test('a delayed lookup is harmless after switching panel, even if its callback was queued', () => {
  const e = studio(); e.audit.configure({ panel:'dictionary' }); e.audit.dictionaryPanel();
  e.elements.get('#wordLookup').value = 'слово'; e.elements.get('#wordLookup').oninput();
  const pending = [...e.timers.values()][0].fn, before = e.lookupCalls();
  e.audit.configure({ panel:'issues' }); e.audit.issuesPanel();
  assert.doesNotThrow(pending); assert.equal(e.lookupCalls(), before); assert.equal(e.timers.size, 0);
});

test('leaving the workspace cancels both pending timers', () => {
  const e = studio(); e.audit.configure({ panel:'dictionary' }); e.audit.scheduleCheck(); e.audit.dictionaryPanel();
  e.elements.get('#wordLookup').oninput(); e.audit.sync('library'); assert.equal(e.timers.size, 0);
});

test('storage failure retains in-memory text and shows an export action instead of saved', () => {
  const e = studio(); e.failures.add('cs-demo-editor'); e.kb.setText('мой несохранённый текст'); e.audit.updateSaveState();
  assert.equal(e.kb.getText(), 'мой несохранённый текст'); assert.equal(e.data.get('cs-demo-editor'), 'Отче');
  assert.equal(e.elements.get('#saveState').dataset.state, 'failed'); assert.match(e.elements.get('#saveState').innerHTML, /Не сохранено/);
  assert.equal(e.elements.get('#exportText').dataset.unsaved, 'true');
  e.failures.clear(); e.kb.setText(e.kb.getText()); e.audit.updateSaveState(); assert.equal(e.elements.get('#saveState').dataset.state, 'saved');
});

test('checkpoints keep five recent distinct drafts and survive reloading and clearing', () => {
  const e = keyboard({ 'cs-demo-editor': 'начальный черновик' });
  for (let i=0;i<8;i++) { e.kb.setText('версия '+i); e.tick(); }
  assert.equal(e.kb.getDrafts().length, 5); assert.equal(e.kb.getDrafts()[0].text, 'версия 6');
  e.kb.checkpoint(); e.kb.setText('');
  const restored = keyboard(Object.fromEntries(e.data));
  assert.equal(restored.kb.getText(), ''); assert.equal(restored.kb.getDrafts()[0].text, 'версия 7');
  assert.equal(new Set(restored.kb.getDrafts().map(d=>d.text)).size, 5);
});

test('checkpoints group ordinary keystrokes and explicitly preserve text before replacement', () => {
  const e = keyboard({ 'cs-demo-editor':'исходный текст' }); e.kb.setText('а'); e.tick(10); e.kb.setText('аб'); e.tick(10); e.kb.setText('абв');
  assert.equal(e.kb.getDrafts().length, 1); assert.equal(e.kb.getDrafts()[0].text, 'исходный текст');
  e.kb.checkpoint(); e.kb.setText('пример'); assert.equal(e.kb.getDrafts()[0].text, 'абв');
});

test('backup failure is distinct from primary draft failure and can recover', () => {
  const e = keyboard({ 'cs-demo-editor':'до' }, { failures:['cs-demo-drafts-v1'] }); e.kb.setText('после');
  assert.equal(e.data.get('cs-demo-editor'), 'после'); assert.equal(e.kb.getSaveState().state, 'backup-failed');
  e.failures.clear(); e.kb.setText('после'); assert.equal(e.kb.getSaveState().state, 'saved');
  assert.equal(JSON.parse(e.data.get('cs-demo-drafts-v1'))[0].text, 'до');
});

test('corrupt backup data does not prevent loading the primary draft', () => {
  const e = keyboard({ 'cs-demo-editor':'черновик', 'cs-demo-drafts-v1':'{bad json' });
  assert.equal(e.kb.getText(), 'черновик'); assert.equal(e.kb.getDrafts().length, 0); assert.equal(e.kb.getSaveState().state, 'saved');
});

test('primary draft takes priority when backup history fills the storage quota', () => {
  const initial = 'а'.repeat(200), current = 'б'.repeat(400);
  const e = keyboard({ 'cs-demo-editor': initial, 'unrelated-setting': 'keep' }, { quotaBytes: 1300 });
  e.kb.setText(current);
  assert.equal(e.data.get('cs-demo-editor'), current);
  assert.equal(e.kb.getText(), current);
  assert.equal(e.data.get('unrelated-setting'), 'keep');
  assert.equal(e.kb.getDrafts()[0].text, initial);
  assert.equal(e.data.has('cs-demo-drafts-v1'), false);
  assert.equal(e.kb.getSaveState().state, 'backup-failed');
});

test('a draft that exceeds the quota remains explicitly unsaved after backup eviction', () => {
  const initial = 'а'.repeat(200), current = 'б'.repeat(800);
  const e = keyboard({ 'cs-demo-editor': initial, 'unrelated-setting': 'keep' }, { quotaBytes: 1300 });
  e.kb.setText(current);
  assert.equal(e.data.get('cs-demo-editor'), initial);
  assert.equal(e.kb.getText(), current);
  assert.equal(e.data.get('unrelated-setting'), 'keep');
  assert.equal(e.kb.getDrafts()[0].text, initial);
  assert.equal(e.kb.getSaveState().state, 'failed');
});
