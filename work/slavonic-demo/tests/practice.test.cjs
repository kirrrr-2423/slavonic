'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const directory=path.resolve(__dirname,'../../../outputs/slavonic-demo');
const source=name=>fs.readFileSync(path.join(directory,name),'utf8');
const decode=value=>value.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
function node(attrs={}){
 const n={attrs:{...attrs},dataset:{},listeners:{},value:attrs.value||'',checked:!!attrs.checked,hidden:!!attrs.hidden,selectionStart:0,selectionEnd:0,
  hasAttribute(name){return Object.hasOwn(this.attrs,name);},setAttribute(name,value){this.attrs[name]=String(value);},
  closest(selector){return selector.split(',').some(part=>{const key=part.match(/^\[([^=\]]+)/)?.[1];return key&&this.hasAttribute(key);})?this:null;},
  addEventListener(name,fn){(this.listeners[name]||=[]).push(fn);},focus(){this.focused=true;},setSelectionRange(s,e){this.selectionStart=s;this.selectionEnd=e;}};
 for(const [key,value]of Object.entries(attrs))if(key.startsWith('data-'))n.dataset[key.slice(5).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase())]=String(value);
 return n;
}
function harness(lessons,initial={}){
 const storage=new Map(Object.entries(initial).map(([key,value])=>[key,JSON.stringify(value)])),root=node(),elements=new Map();
 let html='',attached=0,insertions=0,editorText='пользовательский черновик';
 Object.defineProperty(root,'innerHTML',{get:()=>html,set(value){html=value;elements.clear();const input=value.match(/<input id="practiceInput"([^>]*)>/);if(input){const value=input[1].match(/value="([^"]*)"/)?.[1]||'';const n=node({'data-p-input':'',value:decode(value)});elements.set('[data-p-input]',n);}if(value.includes('class="answer-feedback"'))elements.set('.answer-feedback',node());if(value.includes('class="practice-empty-answer"'))elements.set('.practice-empty-answer',node({hidden:true}));}});
 root.querySelector=selector=>elements.get(selector)||null;
 const dispatch=(name,target)=>{for(const fn of root.listeners[name]||[])fn({target,preventDefault(){}});};
 const context={window:{PRACTICE_DATA:lessons,scrollTo(){},KB:{mount(){throw Error('KB.mount must not be used by practice');},attachLayout(input){attached++;input.layoutAttached=true;},insertInto(input,text){insertions++;input.value=input.value.slice(0,input.selectionStart)+text+input.value.slice(input.selectionEnd);input.selectionStart=input.selectionEnd=input.selectionStart+text.length;dispatch('input',input);}}},localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value))},document:{getElementById:()=>null}};
 vm.createContext(context);vm.runInContext(source('practice.js'),context);const api=context.window.TEXTBOOK_PRACTICE;
 api.mount(root,{header:(_unused,title)=>`<h1>${title}</h1>`,icon:()=>''});
 return {api,root,storage,html:()=>html,attached:()=>attached,insertions:()=>insertions,editorText:()=>editorText,
  click(attribute,value=''){const button=node({[attribute]:String(value)});dispatch('click',button);return button;},
  changeReason(id,checked=true){const input=node({'data-p-reason':id});input.checked=checked;dispatch('change',input);},
  type(value){const input=root.querySelector('[data-p-input]');assert.ok(input,'practice input exists');input.value=value;input.selectionStart=input.selectionEnd=value.length;dispatch('input',input);},
  record(id){return JSON.parse(storage.get('cs-studio-textbook-progress-v1'))[id];},
  remount(){api.mount(root,{header:(_unused,title)=>`<h1>${title}</h1>`,icon:()=>''});}
 };
}
const initial={window:{}};vm.createContext(initial);vm.runInContext(source('practice-data.js'),initial);const real=JSON.parse(JSON.stringify(initial.window.PRACTICE_DATA));
const fixture=[{id:'kp-01',number:1,title:'Проверка',description:'Три типа заданий',source:{short:'Учебник',chapter:'Глава',url:'https://example.test/lesson',basis:'Проверенный ключ'},questions:[
 {id:'choice',glyph:'ѣ',q:'Первый вопрос',a:['неверно','верно'],correct:1,note:'Объяснение',rule:'azbuka'},
 {id:'selection',type:'select-words',text:'Ѱало́мъ и ѳѷмїа́ма.',q:'Выберите признаки',correctWords:['w0','w2'],reasons:[{id:'psi',label:'Пси'},{id:'theta',label:'Фита'},{id:'omega',label:'Омега'}],correctReasons:['psi','theta'],note:'Графика, не полная этимология',rule:'azbuka'},
 {id:'input',type:'input',glyph:'землѧ же',q:'Наберите',accept:['землѧ́'],initial:'землѧ',keys:['ѧ'],note:'Нужна оксия',rule:'znaki'}]}];
const clone=value=>JSON.parse(JSON.stringify(value));
const model=harness([]).api.assessment;

test('data preserves 66 original choice questions and adds four sourced exercises',()=>{
 assert.equal(real.length,22);const questions=real.flatMap(l=>l.questions);assert.equal(questions.length,70);assert.equal(questions.filter(q=>!q.type).length,66);
 assert.equal(new Set(questions.map(q=>q.id)).size,70);assert.equal(questions.filter(q=>q.type==='select-words').length,2);assert.equal(questions.filter(q=>q.type==='input').length,2);
 assert.ok(Object.isFrozen(model));
});
test('Greek graphic question targets exactly psalm and incense with the three observed signs',()=>{
 const q=real[0].questions.find(q=>q.id==='kp01-select-greek-letters');const targets=model.tokenize(q.text).filter(t=>q.correctWords.includes(t.id)).map(t=>t.text);
 assert.deepEqual(Array.from(targets),['Ѱало́мъ','ѳѷмїа́ма']);assert.equal(model.grade(q,{words:q.correctWords,reasons:['psi','theta','izhitsa']}),true);
 assert.equal(model.grade(q,{words:q.correctWords,reasons:['psi','theta','izhitsa','omega']}),false);assert.match(q.note,/не заменяет этимологический словарь/);
});
test('all forms of byti, including the negative form, are expected',()=>{
 const q=real[0].questions.find(q=>q.id==='kp01-select-byti');assert.deepEqual(Array.from(model.tokenize(q.text).filter(t=>q.correctWords.includes(t.id)).map(t=>t.text)),['є҆смы̀','є҆́сть','нѣ́сть']);
 assert.equal(model.grade(q,{words:q.correctWords,reasons:[]}),true);
});
test('input accepts NFC/NFD equivalence without folding letters, case or accents',()=>{
 const q={type:'input',accept:['ѷ']};assert.equal(model.grade(q,'ѷ'.normalize('NFD')),true);assert.equal(model.grade(q,'ѵ'),false);
 const accent=fixture[0].questions[2];assert.equal(model.grade(accent,'землѧ́'.normalize('NFC')),true);assert.equal(model.grade(accent,'земля́'),false);assert.equal(model.grade(accent,'землѧ̀'),false);assert.equal(model.grade(accent,'землѧ'),false);assert.equal(model.grade(accent,'Землѧ́'),false);
});
test('selection requires all target words and exact graphical reasons',()=>{
 const q=fixture[0].questions[1];assert.equal(model.grade(q,{words:['w2','w0'],reasons:['theta','psi']}),true);
 assert.equal(model.grade(q,{words:['w0'],reasons:['psi','theta']}),false);assert.equal(model.grade(q,{words:['w0','w1','w2'],reasons:['psi','theta']}),false);assert.equal(model.grade(q,{words:['w0','w2'],reasons:['psi']}),false);
 assert.equal(model.normalizeAnswer(q,{words:['not-a-word'],reasons:[]}),null);
});
test('legacy progress migrates by ID when questions are appended or reordered',()=>{
 const lesson={...clone(fixture[0]),questions:[fixture[0].questions[2],fixture[0].questions[0],fixture[0].questions[1]]};
 const record=model.migrateRecord(lesson,{signature:'choice|deleted',answers:[0,1],done:true});
 assert.equal(record.answersById.choice,0);assert.equal(Object.hasOwn(record.answersById,'deleted'),false);assert.equal(record.done,false);
 const old=real[0].questions.slice(0,3);const updated=model.migrateRecord(real[0],{signature:old.map(q=>q.id).join('|'),answers:old.map(q=>q.correct),done:true});
 assert.equal(Object.keys(updated.answersById).length,3);assert.equal(updated.done,false);
});
test('modern progress preserves valid types and rejects corrupt answers independently',()=>{
 const record=model.migrateRecord(fixture[0],{answersById:{choice:99,selection:{words:['w0','w2'],reasons:['psi','theta']},input:'землѧ́'},done:true});
 assert.equal(Object.hasOwn(record.answersById,'choice'),false);assert.equal(record.answersById.input,'землѧ́');assert.equal(record.done,false);
});
test('word click and reason change events grade the selection only after explicit check',()=>{
 const e=harness(clone(fixture),{'cs-studio-textbook-progress-v1':{'kp-01':{signature:'choice',answers:[1],done:false}}});e.click('data-p-start','kp-01');
 const word=e.click('data-p-word','w0');assert.equal(word.attrs['aria-pressed'],'true');e.click('data-p-word','w2');e.changeReason('psi');e.changeReason('theta');
 assert.equal(Object.hasOwn(e.record('kp-01').answersById,'selection'),false);e.click('data-p-check');
 assert.equal(model.grade(fixture[0].questions[1],e.record('kp-01').answersById.selection),true);assert.match(e.html(),/Верно/);assert.match(e.html(),/data-p-word="w0"[^>]*disabled/);
});
test('blank submissions do not consume a first attempt',()=>{
 const e=harness([{...clone(fixture[0]),questions:[fixture[0].questions[2]]}]);e.click('data-p-start','kp-01');e.type('');e.click('data-p-check');
 assert.equal(Object.keys(e.record('kp-01').answersById).length,0);assert.equal(e.root.querySelector('.practice-empty-answer').hidden,false);
});
test('input keys use attachLayout/insertInto without mounting or changing the main editor',()=>{
 const e=harness([{...clone(fixture[0]),questions:[fixture[0].questions[2]]}]);e.click('data-p-start','kp-01');assert.ok(e.attached()>0);assert.equal(e.root.querySelector('[data-p-input]').selectionEnd,'землѧ'.length);
 e.click('data-p-key','́');assert.equal(e.root.querySelector('[data-p-input]').value,'землѧ́');e.click('data-p-check');assert.match(e.html(),/Верно/);
 assert.equal(e.record('kp-01').answersById.input,'землѧ́');assert.equal(e.editorText(),'пользовательский черновик');assert.equal(e.insertions(),1);
 const before=e.attached();e.click('data-p-key','̀');assert.equal(e.attached(),before);assert.equal(e.record('kp-01').answersById.input,'землѧ́');
});
test('repeating errors has a separate score and never overwrites the first answers',()=>{
 const e=harness(clone(fixture));e.click('data-p-start','kp-01');e.click('data-p-answer',0);e.click('data-p-next');
 e.click('data-p-word','w0');e.click('data-p-word','w2');e.changeReason('psi');e.changeReason('theta');e.click('data-p-check');e.click('data-p-next');
 e.click('data-p-key','́');e.click('data-p-check');e.click('data-p-next');assert.match(e.html(),/2 из 3/);const original=JSON.stringify(e.record('kp-01').answersById);
 e.click('data-p-repeat');assert.match(e.html(),/Повторение ошибок · 1 из 1/);e.click('data-p-answer',1);e.click('data-p-next');assert.match(e.html(),/Результат повторения/);assert.match(e.html(),/1 из 1/);
 assert.equal(JSON.stringify(e.record('kp-01').answersById),original);assert.equal(e.record('kp-01').retryById.choice.attempts,1);assert.equal(e.record('kp-01').retryById.choice.correct,1);
 e.click('data-p-original');assert.match(e.html(),/2 из 3/);
});
test('reloading upgraded progress resumes the first newly added exercise',()=>{
 const original=real[0].questions.slice(0,3),stored={signature:original.map(q=>q.id).join('|'),answers:original.map(q=>q.correct),done:true};
 const e=harness(clone(real),{'cs-studio-textbook-progress-v1':{'kp-01':stored}});e.click('data-p-start','kp-01');assert.match(e.html(),/Задание 4 из 6/);assert.match(e.html(),/Выберите слова с буквами/);
 assert.equal(Object.keys(e.record('kp-01').answersById).length,3);
});
test('remounting does not duplicate delegated listeners',()=>{
 const e=harness(clone(fixture));e.remount();e.remount();assert.equal(e.root.listeners.click.length,1);assert.equal(e.root.listeners.change.length,1);assert.equal(e.root.listeners.input.length,1);
});


test('catalog uses the correct plural for the expanded six-question lesson',()=>{
 const e=harness(clone(real));assert.match(e.html(),/6 заданий/);
 const greek=real[0].questions.find(q=>q.id==='kp01-select-greek-letters');assert.doesNotMatch(greek.basis,/предоставлен пользователем/);
});

test('legacy generator validates without changing canonical data or its source notes',()=>{
 const cp=require('node:child_process'),script=path.resolve(__dirname,'../build_practice.py');
 const paths=['practice-data.js','PRACTICE-SOURCES.md'].map(name=>path.join(directory,name));
 const before=paths.map(name=>({content:fs.readFileSync(name),mtime:fs.statSync(name).mtimeMs}));
 const result=cp.spawnSync('python3',[script,'--check'],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
 assert.equal(JSON.parse(result.stdout).questions,70);assert.match(result.stderr,/без перезаписи/);
 paths.forEach((name,i)=>{assert.deepEqual(fs.readFileSync(name),before[i].content);assert.equal(fs.statSync(name).mtimeMs,before[i].mtime);});
});

test('legacy validator refuses a 66-question rollback and never rewrites the supplied file',()=>{
 const cp=require('node:child_process'),os=require('node:os'),folder=fs.mkdtempSync(path.join(os.tmpdir(),'slavonic-practice-test-'));
 try{const file=path.join(folder,'practice-data.js'),data=clone(real);data.forEach(lesson=>lesson.questions=lesson.questions.filter(q=>!q.type));const content='window.PRACTICE_DATA = '+JSON.stringify(data)+';\n';fs.writeFileSync(file,content);
 const result=cp.spawnSync('python3',[path.resolve(__dirname,'../build_practice.py'),'--source',file],{encoding:'utf8'});assert.notEqual(result.status,0);assert.match(result.stderr,/rollback/);assert.equal(fs.readFileSync(file,'utf8'),content);
 }finally{fs.rmSync(folder,{recursive:true,force:true});}
});


test('Enter submits a typed answer without consuming composition keystrokes',()=>{
 const e=harness([{...clone(fixture[0]),questions:[fixture[0].questions[2]]}]);e.click('data-p-start','kp-01');e.type('землѧ́');
 const input=e.root.querySelector('[data-p-input]');for(const fn of input.listeners.keydown||[])fn({key:'Enter',isComposing:true,preventDefault(){}});
 assert.equal(Object.hasOwn(e.record('kp-01').answersById,'input'),false);
 for(const fn of input.listeners.keydown||[])fn({key:'Enter',isComposing:false,preventDefault(){}});
 assert.equal(e.record('kp-01').answersById.input,'землѧ́');
});
