'use strict';
/* Практика с проверенными ключами. Первая попытка и повторение ошибок хранятся отдельно. */
(() => {
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const read=(k,d)=>{try{return JSON.parse(localStorage.getItem('cs-studio-'+k))??d;}catch{return d;}};
 const save=(k,v)=>{try{localStorage.setItem('cs-studio-'+k,JSON.stringify(v));return true;}catch{return false;}};
 const plural=(n,one,few,many)=>n%100>=11&&n%100<=14?many:n%10===1?one:n%10>=2&&n%10<=4?few:many;
 const kind=q=>q.type||'choice';
 // Только каноническая эквивалентность Unicode: буквы, ударения и регистр сохраняют значение.
 const normalizeText=s=>String(s).trim().normalize('NFD');
 const tokenize=text=>Array.from(String(text).matchAll(/[\p{L}\p{M}]+/gu),(m,i)=>({id:'w'+i,text:m[0],start:m.index,end:m.index+m[0].length}));
 function normalizeAnswer(q,value){
  if(kind(q)==='choice')return Number.isInteger(value)&&value>=0&&value<q.a.length?value:null;
  if(kind(q)==='input')return typeof value==='string'&&value.length<=512?value:null;
  if(kind(q)==='select-words'){
   if(!value||!Array.isArray(value.words)||!Array.isArray(value.reasons))return null;
   const words=new Set(tokenize(q.text).map(w=>w.id)),reasons=new Set((q.reasons||[]).map(r=>r.id));
   if(value.words.some(id=>!words.has(id))||value.reasons.some(id=>!reasons.has(id)))return null;
   return {words:[...new Set(value.words)].sort(),reasons:[...new Set(value.reasons)].sort()};
  }
  return null;
 }
 const sameSet=(a,b)=>a.length===b.length&&a.every(x=>b.includes(x));
 function grade(q,value){
  const answer=normalizeAnswer(q,value);if(answer===null)return false;
  if(kind(q)==='choice')return answer===q.correct;
  if(kind(q)==='input')return (q.accept||[]).some(text=>normalizeText(text)===normalizeText(answer));
  return sameSet(answer.words,q.correctWords||[])&&sameSet(answer.reasons,q.correctReasons||[]);
 }
 function migrateRecord(lesson,old){
  const answersById={},retryById={},questions=new Map(lesson.questions.map(q=>[q.id,q]));
  const previous=old?.answersById&&typeof old.answersById==='object'?old.answersById:{};
  for(const [id,value] of Object.entries(previous)){const q=questions.get(id);if(q){const answer=normalizeAnswer(q,value);if(answer!==null)answersById[id]=answer;}}
  if(!old?.answersById&&Array.isArray(old?.answers)&&typeof old.signature==='string'){
   old.signature.split('|').forEach((id,i)=>{const q=questions.get(id);if(q){const answer=normalizeAnswer(q,old.answers[i]);if(answer!==null)answersById[id]=answer;}});
  }
  for(const [id,value] of Object.entries(old?.retryById||{})){
   const q=questions.get(id);if(!q||!value||!Number.isInteger(value.attempts)||!Number.isInteger(value.correct)||value.attempts<0||value.correct<0||value.correct>value.attempts)continue;
   const last=normalizeAnswer(q,value.last);if(last!==null)retryById[id]={attempts:value.attempts,correct:value.correct,last};
  }
  return {schema:2,answersById,retryById,done:!!old?.done&&lesson.questions.every(q=>Object.hasOwn(answersById,q.id))};
 }
 const assessment=Object.freeze({kind,normalizeText,tokenize,normalizeAnswer,grade,migrateRecord});
 const getLessons=()=>window.PRACTICE_DATA||[];
 let root=null,ctx=null,selectedBook='kp',active=null,current=0,reviewing=false,repeat=null,progressSaved=true;
 let records=read('textbook-progress-v1',{});
 if(!records||typeof records!=='object'||Array.isArray(records))records={};
 const bound=new WeakSet(),drafts=new Map();
 function record(lesson){records[lesson.id]=migrateRecord(lesson,records[lesson.id]);return records[lesson.id];}
 function persist(){progressSaved=save('textbook-progress-v1',records);}
 function score(lesson){const r=record(lesson);return lesson.questions.filter(q=>Object.hasOwn(r.answersById,q.id)&&grade(q,r.answersById[q.id])).length;}
 function answered(r,q){return repeat?Object.hasOwn(repeat.answers,q.id):Object.hasOwn(r.answersById,q.id);}
 function answerOf(r,q){return repeat?repeat.answers[q.id]:r.answersById[q.id];}
 function draft(q){const key=(repeat?'repeat:':'first:')+q.id;if(!drafts.has(key))drafts.set(key,kind(q)==='input'?(q.initial||''):{words:[],reasons:[]});return drafts.get(key);}
 function saveDraft(q,value){drafts.set((repeat?'repeat:':'first:')+q.id,value);}
 const sourceHTML=source=>`<div class="lesson-source"><span>${esc(source.short)} · ${esc(source.chapter)}</span><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">Открыть учебник ↗</a></div>`;
 function mount(el,options){
  root=el;ctx=options;
  if(!bound.has(root)){root.addEventListener('click',onClick);root.addEventListener('input',onInput);root.addEventListener('change',onChange);root.addEventListener('mousedown',e=>{if(e.target.closest('[data-p-key],[data-p-delete]'))e.preventDefault();});bound.add(root);}
  if(active&&!getLessons().some(l=>l.id===active)){active=null;repeat=null;}
  render();persist();
 }
 function render(){if(!root)return;const lesson=getLessons().find(l=>l.id===active);if(lesson)renderLesson(lesson);else{active=null;catalog();}}
 function catalog(){
  const books=[{id:'kp',title:'Плетнёва, Кравецкий',name:'Церковнославянский язык'},{id:'sm',title:'А. Е. Смирнова',name:'Церковнославянский язык в таблицах'}];
  const visible=getLessons().filter(l=>l.id.startsWith(selectedBook+'-')),complete=visible.filter(l=>record(l).done).length;
  root.innerHTML=ctx.header('','Практика')+`<div class="practice-library"><div class="practice-books" role="group" aria-label="Учебник">${books.map(b=>`<button data-p-book="${b.id}" aria-pressed="${selectedBook===b.id}"><strong>${b.title}</strong><span>${b.name}</span></button>`).join('')}</div><div class="practice-list-info"><span>${visible.length} ${selectedBook==='kp'?'уроков':'темы'} · пройдено ${complete}</span><span>Упражнения по учебникам</span></div><div class="lesson-list">${visible.map(l=>{const r=record(l),n=Object.keys(r.answersById).length;return `<button class="lesson-row" data-p-start="${l.id}"><span class="lesson-number">${String(l.number).padStart(2,'0')}</span><span class="lesson-label"><strong>${esc(l.title)}</strong><small>${esc(l.description)}</small></span><span class="lesson-state ${r.done?'completed':''}">${r.done?`${score(l)}/${l.questions.length} · Результат`:n?`${n}/${l.questions.length} · Продолжить`:`${l.questions.length} ${plural(l.questions.length,'задание','задания','заданий')}`}</span><span class="lesson-arrow" aria-hidden="true">→</span></button>`;}).join('')}</div><p class="practice-source-note">Интерактивная адаптация. У каждого урока есть ссылка на конкретный раздел источника.</p></div>`;
 }
 const helpKeys=[['є','є'],['ѧ','ѧ'],['ѣ','ѣ'],['ꙋ','ꙋ'],['і','і'],['҆','Звательце'],['́','Оксия'],['̀','Вария'],['̑','Камора'],['҃','Титло']];
 function exerciseHTML(q,value,locked){
  if(kind(q)==='choice')return `<div class="quiz-options">${q.a.map((a,i)=>`<button data-p-answer="${i}" ${locked?'disabled':''} class="${locked?(i===q.correct?'correct':i===value?'incorrect':''):''}"><span>${i+1}</span><span class="answer-label ${/[ѣѧꙋѿ҃҆ⷭ]/u.test(a)&&a.length<45?'cs':''}">${esc(a)}</span></button>`).join('')}</div>`;
  if(kind(q)==='input'){
   const keys=[...new Set([...(q.keys||[]),...helpKeys.map(([text])=>text)])];
   return `<div class="practice-entry"><label for="practiceInput">${esc(q.inputLabel||'Ваш ответ')}</label><input id="practiceInput" class="cs" data-p-input type="text" value="${esc(value)}" maxlength="512" spellcheck="false" autocomplete="off" autocapitalize="off" ${locked?'readonly':''} aria-describedby="practiceInputHelp"><p id="practiceInputHelp" class="practice-input-help">${esc(q.inputHint||'Введите слово целиком, включая надстрочные знаки. Можно пользоваться клавишами ниже.')}</p><div class="practice-input-keys" role="group" aria-label="Буквы и надстрочные знаки">${keys.map(text=>`<button type="button" data-p-key="${esc(text)}" aria-label="Вставить: ${esc(helpKeys.find(([key])=>key===text)?.[1]||text)}" ${locked?'disabled':''}><span class="cs">${/^\p{M}+$/u.test(text)?'а':''}${esc(text)}</span></button>`).join('')}<button type="button" data-p-delete aria-label="Удалить предыдущий знак" ${locked?'disabled':''}>⌫</button></div></div>`;
  }
  const tokens=tokenize(q.text);let position=0,text='';
  for(const token of tokens){text+=esc(q.text.slice(position,token.start));const selected=value.words.includes(token.id),correct=(q.correctWords||[]).includes(token.id);text+=`<button type="button" class="practice-word ${locked?(correct?'correct-word':selected?'incorrect-word':''):''}" data-p-word="${token.id}" aria-pressed="${selected}" ${locked?'disabled':''}>${esc(token.text)}</button>`;position=token.end;}
  text+=esc(q.text.slice(position));
  return `<div class="practice-selection"><p class="practice-selection-help">Нажмите на нужные слова. Повторное нажатие снимает выделение.</p><div class="practice-select-text cs" role="group" aria-label="Слова в задании">${text}</div>${q.reasons?.length?`<fieldset class="practice-reasons"><legend>${esc(q.reasonPrompt||'Укажите основания выбора')}</legend>${q.reasons.map(reason=>`<label><input type="checkbox" data-p-reason="${esc(reason.id)}" ${value.reasons.includes(reason.id)?'checked':''} ${locked?'disabled':''}><span>${esc(reason.label)}</span></label>`).join('')}</fieldset>`:''}</div>`;
 }
 function solution(q,value){
  if(kind(q)==='choice')return `<span>${esc(q.a[q.correct])}</span>`;
  if(kind(q)==='input')return `<span class="cs practice-solution">${esc(q.accept[0])}</span>`;
  const tokens=tokenize(q.text),selected=value?.words||[],reasons=value?.reasons||[];
  const missing=tokens.filter(w=>(q.correctWords||[]).includes(w.id)&&!selected.includes(w.id));
  const extra=tokens.filter(w=>selected.includes(w.id)&&!(q.correctWords||[]).includes(w.id));
  return `<span class="cs practice-solution">${tokens.filter(w=>(q.correctWords||[]).includes(w.id)).map(w=>esc(w.text)).join(' · ')}</span>${missing.length?`<p>Пропущено: <span class="cs">${missing.map(w=>esc(w.text)).join(', ')}</span>.</p>`:''}${extra.length?`<p>Лишнее выделение: <span class="cs">${extra.map(w=>esc(w.text)).join(', ')}</span>.</p>`:''}${q.reasons?.length?`<p>Основания: ${q.reasons.filter(r=>(q.correctReasons||[]).includes(r.id)).map(r=>esc(r.label)).join('; ')}.</p>${!sameSet(reasons,q.correctReasons||[])?'<p>Проверьте отмеченные основания.</p>':''}`:''}`;
 }
 function feedback(q,value,locked,last){
  if(!locked)return `${kind(q)==='choice'?'<p class="quiz-hint">Выберите ответ.</p>':'<button class="primary-button" data-p-check>Проверить ответ</button><p class="practice-empty-answer" role="status" hidden></p>'}`;
  const correct=grade(q,value);
  return `<div class="quiz-feedback"><strong>${correct?'Верно':'Нужно исправить'}</strong>${!correct?`<div class="practice-answer-key"><span>Правильный ответ:</span>${solution(q,value)}</div>`:''}<p>${esc(q.note)}</p>${q.wordNotes?`<ul class="practice-word-notes">${q.wordNotes.map(note=>`<li><span class="cs">${esc(note.word)}</span> — ${esc(note.note)}</li>`).join('')}</ul>`:''}<div class="feedback-actions"><button class="quiet" data-route="${esc(q.rule)}">Посмотреть правило ↗</button><button class="quiet" data-p-editor>Разобрать в клавиатуре ↗</button></div></div><button class="primary-button" data-p-next>${last?(repeat?'Результат повторения':'Завершить урок'):'Следующее задание'} ${ctx.icon('arrow')}</button>`;
 }
 function renderLesson(lesson){
  const r=record(lesson);current=Math.max(0,Math.min(current,lesson.questions.length-1));
  const q=lesson.questions[current],locked=answered(r,q),value=locked?answerOf(r,q):draft(q),last=repeat?repeat.position===repeat.queue.length-1:current===lesson.questions.length-1;
  const complete=repeat?.done||r.done&&!reviewing&&!repeat;
  root.innerHTML=`<div class="lesson-navigation"><button class="quiet" data-p-back>← Все уроки</button><button class="quiet" data-p-reset>Начать заново ↻</button></div>`+ctx.header('',esc(lesson.title))+sourceHTML(lesson.source)+`<div class="textbook-exercise"><div class="practice-top"><span>${repeat?(repeat.done?'Результат повторения':`Повторение ошибок · ${repeat.position+1} из ${repeat.queue.length}`):r.done&&!reviewing?'Результат':`Задание ${current+1} из ${lesson.questions.length}`}</span>${repeat?`<button class="quiet" data-p-original>Первая попытка: ${score(lesson)}/${lesson.questions.length}</button>`:''}</div>${!repeat?`<div class="practice-progress" role="img" aria-label="Выполнено ${Object.keys(r.answersById).length} из ${lesson.questions.length}">${lesson.questions.map(item=>`<span class="${Object.hasOwn(r.answersById,item.id)?'done':item.id===q.id?'current':''}"></span>`).join('')}</div>`:''}${complete?results(lesson):`<div class="quiz-question textbook-question" data-question-type="${kind(q)}">${kind(q)!=='select-words'?`<span class="question-stimulus cs ${Array.from(q.glyph||'').length>14?'long':''}">${esc(q.glyph||'')}</span>`:''}<h2>${esc(q.q)}</h2>${exerciseHTML(q,value,locked)}<div class="answer-feedback" tabindex="-1" aria-live="polite">${feedback(q,value,locked,last)}</div></div>`}<p class="exercise-basis">${esc(q.basis||lesson.source.basis)}</p>${progressSaved?'':'<p class="practice-save-status" role="status">Прогресс не удалось сохранить. Ответы доступны, пока открыта эта страница.</p>'}</div>`;
  const input=root.querySelector('[data-p-input]');if(input&&!locked){input.setSelectionRange(input.value.length,input.value.length);if(window.KB)window.KB.attachLayout(input);input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();checkDraft(lesson);}});}
 }
 function results(lesson){
  const r=record(lesson),correct=score(lesson),wrong=lesson.questions.map((q,i)=>({q,i})).filter(({q})=>!grade(q,r.answersById[q.id]));
  const next=getLessons().find(l=>l.id.startsWith(selectedBook+'-')&&l.number===lesson.number+1);
  if(repeat){const count=repeat.queue.filter(i=>grade(lesson.questions[i],repeat.answers[lesson.questions[i].id])).length;return `<div class="quiz-complete"><h2>${count} из ${repeat.queue.length}</h2><p>Результат повторения. Первая попытка сохранена: ${correct} из ${lesson.questions.length}.</p><div class="lesson-finish-actions">${count<repeat.queue.length?'<button class="primary-button" data-p-repeat>Повторить оставшиеся ошибки</button>':''}<button class="quiet" data-p-original>К результату первой попытки</button></div></div>`;}
  return `<div class="quiz-complete"><h2>${correct} из ${lesson.questions.length}</h2><p>Правильные ответы с первой попытки.</p>${wrong.length?`<button class="primary-button" data-p-repeat>Повторить ошибки · ${wrong.length}</button>`:''}<div class="quiz-review">${lesson.questions.map((q,i)=>`<button data-p-review="${i}"><span>${grade(q,r.answersById[q.id])?'✓':'↗'}</span><span>${esc(q.q)}</span>${ctx.icon('arrow')}</button>`).join('')}</div><div class="lesson-finish-actions">${next?`<button class="primary-button" data-p-start="${next.id}">Следующий урок ${ctx.icon('arrow')}</button>`:''}<button class="quiet" data-p-back>К списку уроков</button></div></div>`;
 }
 function submit(lesson,value){
  const q=lesson.questions[current],r=record(lesson);if(answered(r,q))return;
  const answer=normalizeAnswer(q,value);if(answer===null)return;
  if(repeat){repeat.answers[q.id]=answer;const old=r.retryById[q.id]||{attempts:0,correct:0};r.retryById[q.id]={attempts:old.attempts+1,correct:old.correct+Number(grade(q,answer)),last:answer};}
  else r.answersById[q.id]=answer;
  persist();render();root.querySelector('.answer-feedback')?.focus({preventScroll:true});
 }
 function checkDraft(lesson){
  const q=lesson.questions[current];if(answered(record(lesson),q))return;
  const input=root.querySelector('[data-p-input]'),value=kind(q)==='input'?(input?.value||''):draft(q);
  if((kind(q)==='input'&&!value.trim())||(kind(q)==='select-words'&&!value.words.length)){
   const hint=root.querySelector('.practice-empty-answer');if(hint){hint.hidden=false;hint.textContent=kind(q)==='input'?'Введите ответ.':'Выберите хотя бы одно слово.';}return;
  }
  submit(lesson,value);
 }
 function onInput(e){const input=e.target.closest('[data-p-input]');if(!input)return;const lesson=getLessons().find(l=>l.id===active);if(lesson&&!answered(record(lesson),lesson.questions[current]))saveDraft(lesson.questions[current],input.value);}
 function onChange(e){const input=e.target.closest('[data-p-reason]');if(!input)return;const lesson=getLessons().find(l=>l.id===active);if(!lesson)return;const q=lesson.questions[current];if(answered(record(lesson),q))return;const value=draft(q),set=new Set(value.reasons);if(input.checked)set.add(input.dataset.pReason);else set.delete(input.dataset.pReason);saveDraft(q,{...value,reasons:[...set]});}
 function onClick(e){
  const button=e.target.closest('[data-p-book],[data-p-start],[data-p-back],[data-p-reset],[data-p-answer],[data-p-next],[data-p-review],[data-p-editor],[data-p-word],[data-p-check],[data-p-key],[data-p-delete],[data-p-repeat],[data-p-original]');if(!button)return;
  if(button.hasAttribute('data-p-book')){selectedBook=button.dataset.pBook;active=null;repeat=null;render();return;}
  if(button.hasAttribute('data-p-start')){const lesson=getLessons().find(l=>l.id===button.dataset.pStart);if(!lesson)return;active=lesson.id;reviewing=false;repeat=null;selectedBook=active.split('-')[0];const r=record(lesson);current=lesson.questions.findIndex(q=>!Object.hasOwn(r.answersById,q.id));if(current<0)current=r.done?0:lesson.questions.length-1;save('last-practice-lesson',active);render();window.scrollTo(0,0);return;}
  if(button.hasAttribute('data-p-back')){active=null;repeat=null;render();window.scrollTo(0,0);return;}
  const lesson=getLessons().find(l=>l.id===active);if(!lesson)return;const r=record(lesson),q=lesson.questions[current];
  if(button.hasAttribute('data-p-reset')){records[lesson.id]=null;for(const item of lesson.questions){drafts.delete('first:'+item.id);drafts.delete('repeat:'+item.id);}current=0;reviewing=false;repeat=null;record(lesson);persist();render();return;}
  if(button.hasAttribute('data-p-original')){repeat=null;reviewing=false;render();return;}
  if(button.hasAttribute('data-p-repeat')){const candidates=repeat?repeat.queue:lesson.questions.map((_,i)=>i);const queue=candidates.filter(i=>!grade(lesson.questions[i],repeat?repeat.answers[lesson.questions[i].id]:r.answersById[lesson.questions[i].id]));if(!queue.length)return;repeat={queue,position:0,answers:{},done:false};queue.forEach(i=>drafts.delete('repeat:'+lesson.questions[i].id));current=queue[0];reviewing=false;render();return;}
  if(button.hasAttribute('data-p-review')){const index=Number(button.dataset.pReview);if(!Number.isInteger(index)||index<0||index>=lesson.questions.length)return;current=index;repeat=null;reviewing=true;render();return;}
  if(button.hasAttribute('data-p-next')){if(!answered(r,q))return;if(repeat){if(repeat.position===repeat.queue.length-1)repeat.done=true;else current=repeat.queue[++repeat.position];}else if(current===lesson.questions.length-1){r.done=lesson.questions.every(item=>Object.hasOwn(r.answersById,item.id));reviewing=false;persist();if(!r.done)current=lesson.questions.findIndex(item=>!Object.hasOwn(r.answersById,item.id));}else current++;render();return;}
  if(button.hasAttribute('data-p-editor')){const text=q.text||q.glyph;window.APP.go('klaviatura');const editor=document.getElementById('kbEd');if(editor)window.KB.insertInto(editor,(editor.value&&!/\s$/.test(editor.value)?'\n':'')+text);return;}
  if(answered(r,q))return;
  if(button.hasAttribute('data-p-answer')&&kind(q)==='choice'){submit(lesson,Number(button.dataset.pAnswer));return;}
  if(button.hasAttribute('data-p-word')&&kind(q)==='select-words'){const id=button.dataset.pWord;if(!tokenize(q.text).some(w=>w.id===id))return;const value=draft(q),set=new Set(value.words);if(set.has(id))set.delete(id);else set.add(id);saveDraft(q,{...value,words:[...set]});button.setAttribute('aria-pressed',String(set.has(id)));return;}
  if(button.hasAttribute('data-p-check')){checkDraft(lesson);return;}
  if(button.hasAttribute('data-p-key')||button.hasAttribute('data-p-delete')){const input=root.querySelector('[data-p-input]');if(!input||!window.KB)return;if(button.hasAttribute('data-p-delete')&&input.selectionStart===input.selectionEnd){const before=input.value.slice(0,input.selectionStart),last=Array.from(before).at(-1)||'';input.setSelectionRange(input.selectionStart-last.length,input.selectionEnd);}window.KB.insertInto(input,button.dataset.pKey||'');saveDraft(q,input.value);}
 }
 window.TEXTBOOK_PRACTICE=Object.freeze({mount,assessment});
})();
