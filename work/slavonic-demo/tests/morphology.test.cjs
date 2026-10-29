'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const directory=path.resolve(__dirname,'../../../outputs/slavonic-demo');
const source=name=>fs.readFileSync(path.join(directory,name),'utf8');
const NEBO=['Не́бо','небо','<p>небо</p>'];
function setup(entries=[NEBO]){const context={window:{}};vm.createContext(context);vm.runInContext(source('morphology-profiles.js'),context);vm.runInContext(source('forms.js').split('/* ---------- интерфейс:')[0],context);let calls=0;const decline=context.window.FORMS.declineNoun;context.window.FORMS.declineNoun=(...args)=>{calls++;return decline(...args);};vm.runInContext(source('morphology.js'),context);const morph=context.window.MORPH;const stats=morph.prepare(entries);return {morph,stats,calls:()=>calls};}
const flat=value=>JSON.parse(JSON.stringify(value));
test('prepare indexes real single-word lemmas without generating all forms and is idempotent',()=>{
 const entries=[NEBO,['Сы́нъ Человѣ́ческїй','Сын человеческий','<p>compound</p>'],['Не́бослово','небослово','<p>неизвестная часть речи</p>']];
 const e=setup(entries);assert.equal(e.calls(),0);assert.equal(e.stats.indexedLemmas,1);assert.equal(e.morph.prepare(entries).noop,true);assert.equal(e.calls(),0);assert.equal(e.morph.paradigm(1),null);assert.equal(e.morph.paradigm(2),null);
});
test('nebesekh maps to the real dictionary lemma and the exact case, number, stem and ending',()=>{
 const {morph}=setup();const result=morph.analyze('небесѣ́хъ');assert.equal(result.status,'matched');assert.equal(result.analyses.length,1);
 const a=result.analyses[0];assert.equal(a.entryIndex,0);assert.equal(a.lemma,'не́бо');assert.equal(a.confidence,'verified');assert.equal(a.matches.length,1);
 const m=a.matches[0];assert.equal(m.case,'locative');assert.equal(m.number,'pl');assert.equal(m.stem,'небес');assert.equal(m.ending,'ѣ́хъ');assert.equal(m.augmentation,'ес');assert.match(m.explanation,/наращение/);assert.match(a.source.url,/\/11_1$/);
});
test('the verified table replaces the generator’s incorrect dual form',()=>{
 const {morph}=setup();const p=morph.paradigm(0,'небєсѝ');assert.equal(p.rows.length,7);assert.deepEqual(flat(p.rows[0].du),['небєсѝ']);
 assert.deepEqual(flat(p.matches.map(m=>m.case)),['nominative','accusative','vocative']);
 assert.equal(p.matches[0].stem,'небєс');assert.equal(p.matches[0].ending,'ѝ');assert.equal(p.matches[0].augmentation,'ес');
 assert.equal(morph.analyze('небеси̑').status,'unmatched');
});
test('ambiguous cases remain explicit instead of choosing the first case',()=>{
 const {morph}=setup();const result=morph.analyze('небесѝ');assert.equal(result.status,'matched');assert.equal(result.ambiguous,true);
 assert.deepEqual(flat(result.analyses[0].matches.map(m=>[m.number,m.case])),[['sg','dative'],['sg','locative']]);
 const lemma=morph.analyze('небо');assert.equal(lemma.analyses[0].lemma,'не́бо');assert.equal(lemma.analyses[0].matches.length,3);
});
test('NFC/NFD and unmarked queries work but historical letters and wrong accents are not folded',()=>{
 const {morph}=setup();assert.equal(morph.analyze('небесѝ'.normalize('NFD')).analyses[0].matches.length,2);
 assert.equal(morph.analyze('небесѣхъ').analyses[0].matches[0].orthography,'unmarked');
 for(const query of ['небесехъ','небеси́хъ','небесѵхъ','небе́сѣхъ','небесѣ́хъ-то','небо небо'])assert.equal(morph.analyze(query).status,'unmatched',query);
});
test('prefix or guessed stems never count as a validated form',()=>{
 const {morph}=setup();for(const query of ['небес','небесѣ','небесѣ́хъникъ','небеснѣ́хъ'])assert.equal(morph.analyze(query).status,'unmatched',query);
 assert.equal(morph.analyze('небесѣ́хъ',[]).status,'unmatched');assert.equal(morph.analyze('небесѣ́хъ',[99]).status,'unmatched');
});
test('noun classification excludes explicit non-nouns and unmarked ambiguous endings',()=>{
 const {morph,stats}=setup([NEBO,['Ско́ро','скоро','<p>наречие, быстро</p>'],['При','при','<p>предлог</p>'],['Нестѝ','нести','<p>глагол</p>'],['До́брый','добрый','<p>прилагательное</p>'],['Бы́стро','быстро','<p>быстро</p>']]);
 assert.equal(stats.indexedLemmas,1);for(const index of [1,2,3,4,5])assert.equal(morph.paradigm(index),null);
});
test('explicit noun markers allow a generated profile but never mark it verified',()=>{
 const {morph}=setup([['Лꙋ́на','луна','<p>сущ., ж. р.</p>']]);const result=morph.analyze('лꙋ́нѣ');assert.equal(result.analyses.length,1);assert.equal(result.analyses[0].confidence,'generated');assert.ok(result.analyses[0].limitations.length);assert.equal(result.analyses[0].source.verified,false);
});
test('the shortlist caps generation, caches forms and preserves multiple real dictionary entries',()=>{
 const entries=Array.from({length:60},()=>['Ра́дъ','рад','<p>сущ., м. р.</p>']);const e=setup(entries);assert.equal(e.calls(),0);const result=e.morph.analyze('ра́дъ');assert.equal(result.status,'ambiguous');assert.equal(result.analyses.length,40);assert.equal(e.calls(),40);e.morph.analyze('ра́дъ');assert.equal(e.calls(),40);
});
test('all selected paradigm cells have explanations and canonical stem/ending decomposition',()=>{
 const {morph}=setup();const p=morph.paradigm(0);
 for(const row of p.rows)for(const number of ['sg','du','pl'])for(const form of row[number]){const explanation=morph.explain(0,number,row.case,form);assert.ok(explanation,`${number}/${row.case}/${form}`);assert.ok(explanation.explanation);assert.equal((explanation.stem+explanation.ending).normalize('NFD'),form.normalize('NFD'));}
 assert.equal(morph.explain(0,'bad','locative','небесѣ́хъ'),null);assert.equal(morph.explain(0,'pl','locative','небесехъ'),null);
});
test('returned models cannot mutate cached paradigms or prepared source data',()=>{
 const {morph}=setup();const first=morph.paradigm(0);first.rows[0].du[0]='corrupted';first.source.label='corrupted';assert.equal(morph.paradigm(0).rows[0].du[0],'небєсѝ');assert.notEqual(morph.paradigm(0).source.label,'corrupted');
});
test('real dictionary lookup uses the actual entry rather than a synthetic lemma',()=>{
 const c={window:{}};vm.createContext(c);vm.runInContext(source('slovar-data.js'),c);const entries=c.window.SLOVAR.e,{morph}=setup(entries),result=morph.analyze('небесѣ́хъ');
 assert.equal(result.analyses.length,1);const a=result.analyses[0];assert.equal(entries[a.entryIndex][1],'небо');assert.equal(entries[a.entryIndex][0],'Не́бо');
});


test('curated mati overrides an infinitive-like ending and hand preserves every ambiguous case',()=>{
 const entries=[['Ма́ти','мати','<p>мать</p>'],['Рꙋка̀','рука','<p>рука</p>']],{morph}=setup(entries);
 const m=morph.analyze('матере');assert.equal(m.analyses[0].entryIndex,0);assert.equal(m.analyses[0].matches[0].case,'genitive');
 assert.deepEqual(flat(morph.analyze('мати').analyses[0].matches.map(m=>m.case)),['nominative','vocative']);
 const hand=morph.analyze('рꙋцѣ');assert.deepEqual(flat(hand.analyses[0].matches.map(m=>[m.number,m.case])),[['sg','dative'],['sg','locative'],['du','nominative'],['du','accusative'],['du','vocative']]);
 assert.match(hand.analyses[0].matches[0].explanation,/чередование/);assert.equal(morph.analyze('рꙋце').status,'unmatched');
});

test('ordinary definition words are not mistaken for grammatical gender labels',()=>{
 const e=setup([NEBO,['Му́жакъ','мужак','<p>мужчина</p>'],['Жено́къ','женок','<p>женщина</p>']]);assert.equal(e.stats.indexedLemmas,1);
});

test('all active verified dictionary profiles roundtrip and explain their table cells',()=>{
 const c={window:{}};vm.createContext(c);vm.runInContext(source('slovar-data.js'),c);const entries=c.window.SLOVAR.e,e=setup(entries);assert.equal(e.stats.indexedLemmas,13);let cells=0;
 for(let index=0;index<entries.length;index++){const p=e.morph.paradigm(index);if(!p)continue;assert.equal(p.confidence,'verified');assert.ok(p.source.verified);
 for(const row of p.rows)for(const number of ['sg','du','pl'])for(const form of row[number]){cells++;const a=e.morph.analyze(form).analyses.find(a=>a.entryIndex===index);assert.ok(a,`${p.lemma}: ${form}`);assert.ok(a.matches.some(m=>m.number===number&&m.case===row.case));const detail=e.morph.explain(index,number,row.case,form);assert.equal((detail.stem+detail.ending).normalize('NFD'),form.normalize('NFD'));assert.ok(detail.explanation);}}
 assert.ok(cells>250);assert.equal(e.calls(),0,'verified profiles do not invoke an uncertain generator');
});
