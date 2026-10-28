'use strict';
/* Практика по проверенным учебникам. Данные и источники находятся в practice-data.js. */
(() => {
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const read=(k,d)=>{try{return JSON.parse(localStorage.getItem('cs-studio-'+k))??d;}catch{return d;}};
 const save=(k,v)=>{try{localStorage.setItem('cs-studio-'+k,JSON.stringify(v));}catch{}};
 const plural=(n,one,few,many)=>{const a=n%10,b=n%100;return b>=11&&b<=14?many:a===1?one:a>=2&&a<=4?few:many;};
 const getLessons=()=>window.PRACTICE_DATA||[];
 let root=null,ctx=null,selectedBook='kp',active=null,current=0,reviewing=false;
 let records=read('textbook-progress-v1',{});
 if(!records||typeof records!=='object'||Array.isArray(records))records={};
 const bound=new WeakSet();
 function record(lesson){
  const old=records[lesson.id];const signature=lesson.questions.map(q=>q.id).join('|');
  if(!old||old.signature!==signature||!Array.isArray(old.answers))records[lesson.id]={signature,answers:Array(lesson.questions.length).fill(null),done:false};
  const r=records[lesson.id];
  r.answers=lesson.questions.map((q,i)=>Number.isInteger(r.answers[i])&&r.answers[i]>=0&&r.answers[i]<q.a.length?r.answers[i]:null);
  r.done=!!r.done&&r.answers.every(v=>v!==null);
  return r;
 }
 function persist(){save('textbook-progress-v1',records);}
 function score(lesson){return record(lesson).answers.filter((a,i)=>a===lesson.questions[i].correct).length;}
 function sourceHTML(source){return `<div class="lesson-source"><span>${esc(source.short)} · ${esc(source.chapter)}</span><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">Открыть учебник ↗</a></div>`;}
 function mount(el,options){root=el;ctx=options;if(!bound.has(root)){root.addEventListener('click',onClick);bound.add(root);}const remembered=read('last-practice-lesson',null);if(active&&!getLessons().some(l=>l.id===active))active=null;if(!active&&remembered&&getLessons().some(l=>l.id===remembered)){/* Возобновление предлагается в списке, без автоматического открытия. */}render();}
 function render(){if(!root)return;if(active){const lesson=getLessons().find(l=>l.id===active);if(lesson){renderLesson(lesson);return;}active=null;}catalog();}
 function catalog(){
  const lessons=getLessons(),books=[{id:'kp',title:'Плетнёва, Кравецкий',name:'Церковнославянский язык'},{id:'sm',title:'А. Е. Смирнова',name:'Церковнославянский язык в таблицах'}];
  const visible=lessons.filter(l=>l.id.startsWith(selectedBook+'-'));
  const complete=visible.filter(l=>record(l).done).length;
  root.innerHTML=ctx.header('','Практика')+`<div class="practice-library"><div class="practice-books" role="group" aria-label="Учебник">${books.map(b=>`<button data-p-book="${b.id}" aria-pressed="${selectedBook===b.id}"><strong>${b.title}</strong><span>${b.name}</span></button>`).join('')}</div><div class="practice-list-info"><span>${visible.length} ${selectedBook==='kp'?plural(visible.length,'урок','урока','уроков'):plural(visible.length,'тема','темы','тем')} · пройдено ${complete}</span><span>Интерактивная адаптация упражнений и таблиц</span></div><div class="lesson-list">${visible.map(l=>{const r=record(l),n=r.answers.filter(v=>v!==null).length;return `<button class="lesson-row" data-p-start="${l.id}"><span class="lesson-number">${String(l.number).padStart(2,'0')}</span><span class="lesson-label"><strong>${esc(l.title)}</strong><small>${esc(l.description)}</small></span><span class="lesson-state ${r.done?'completed':''}">${r.done?`${score(l)}/${l.questions.length} · Результат`:n?`${n}/${l.questions.length} · Продолжить`:`${l.questions.length} задания`}</span><span class="lesson-arrow" aria-hidden="true">→</span></button>`;}).join('')}</div><p class="practice-source-note">Формулировки переработаны для интерактивной практики. У каждого урока есть ссылка на конкретный раздел источника.</p></div>`;
 }
 function renderLesson(lesson){
  const r=record(lesson);current=Math.max(0,Math.min(current,lesson.questions.length-1));
  const q=lesson.questions[current],answer=r.answers[current];
  root.innerHTML=`<div class="lesson-navigation"><button class="quiet" data-p-back>← Все уроки</button><button class="quiet" data-p-reset>Начать заново ↻</button></div>`+ctx.header('',esc(lesson.title))+sourceHTML(lesson.source)+`<div class="textbook-exercise"><div class="practice-top"><span>${r.done&&!reviewing?'Результат':`Задание ${current+1} из ${lesson.questions.length}`}</span></div><div class="practice-progress">${lesson.questions.map((_,i)=>`<span class="${r.answers[i]!==null?'done':i===current?'current':''}"></span>`).join('')}</div>${r.done&&!reviewing?results(lesson):`<div class="quiz-question textbook-question"><span class="question-stimulus cs ${Array.from(q.glyph).length>14?'long':''}">${esc(q.glyph)}</span><h2>${esc(q.q)}</h2><div class="quiz-options">${q.a.map((a,i)=>`<button data-p-answer="${i}" ${answer!==null?'disabled':''} class="${answer!==null?(i===q.correct?'correct':i===answer?'incorrect':''):''}"><span>${i+1}</span><span class="answer-label ${/[ѣѧꙋѿ҃҆ⷭ]/u.test(a)&&a.length<45?'cs':''}">${esc(a)}</span></button>`).join('')}</div><div class="answer-feedback" aria-live="polite">${answer!==null?`<div class="quiz-feedback"><strong>${answer===q.correct?'Верно':'Правильный ответ: '+esc(q.a[q.correct])}</strong><p>${esc(q.note)}</p><div class="feedback-actions"><button class="quiet" data-route="${esc(q.rule)}">Посмотреть правило ↗</button><button class="quiet" data-p-editor>Разобрать в клавиатуре ↗</button></div></div><button class="primary-button" data-p-next>${current===lesson.questions.length-1?'Завершить урок':'Следующее задание'} ${ctx.icon('arrow')}</button>`:'<p class="quiz-hint">Выберите ответ.</p>'}</div></div>`}<p class="exercise-basis">${esc(lesson.source.basis)}</p></div>`;
 }
 function results(lesson){const r=record(lesson),correct=score(lesson),next=getLessons().find(l=>l.id.startsWith(selectedBook+'-')&&l.number===lesson.number+1);return `<div class="quiz-complete"><h2>${correct} из ${lesson.questions.length}</h2><p>Правильные ответы с первой попытки.</p><div class="quiz-review">${lesson.questions.map((q,i)=>`<button data-p-review="${i}"><span>${r.answers[i]===q.correct?'✓':'↗'}</span><span>${esc(q.q)}</span>${ctx.icon('arrow')}</button>`).join('')}</div><div class="lesson-finish-actions">${next?`<button class="primary-button" data-p-start="${next.id}">Следующий урок ${ctx.icon('arrow')}</button>`:''}<button class="quiet" data-p-back>К списку уроков</button></div></div>`;}
 function onClick(e){
  const button=e.target.closest('[data-p-book],[data-p-start],[data-p-back],[data-p-reset],[data-p-answer],[data-p-next],[data-p-review],[data-p-editor]');if(!button)return;
  if(button.hasAttribute('data-p-book')){selectedBook=button.dataset.pBook;active=null;render();return;}
  if(button.hasAttribute('data-p-start')){const lesson=getLessons().find(l=>l.id===button.dataset.pStart);if(!lesson)return;active=lesson.id;reviewing=false;selectedBook=active.split('-')[0];const r=record(lesson);current=r.answers.findIndex(v=>v===null);if(current<0)current=0;save('last-practice-lesson',active);render();window.scrollTo(0,0);return;}
  if(button.hasAttribute('data-p-back')){active=null;render();window.scrollTo(0,0);return;}
  const lesson=getLessons().find(l=>l.id===active);if(!lesson)return;const r=record(lesson);
  if(button.hasAttribute('data-p-reset')){records[lesson.id]=null;current=0;reviewing=false;record(lesson);persist();render();return;}
  if(button.hasAttribute('data-p-answer')){if(r.answers[current]!==null)return;const value=Number(button.dataset.pAnswer);if(!Number.isInteger(value)||value<0||value>=lesson.questions[current].a.length)return;r.answers[current]=value;persist();render();return;}
  if(button.hasAttribute('data-p-next')){if(r.answers[current]===null)return;if(current===lesson.questions.length-1){r.done=r.answers.every(v=>v!==null);reviewing=false;persist();if(!r.done){current=r.answers.findIndex(v=>v===null);}}else current++;render();return;}
  if(button.hasAttribute('data-p-review')){current=Number(button.dataset.pReview);reviewing=true;render();return;}
  if(button.hasAttribute('data-p-editor')){const text=lesson.questions[current].glyph;window.APP.go('klaviatura');const editor=document.getElementById('kbEd');window.KB.insertInto(editor,(editor.value&&!/\s$/.test(editor.value)?'\n':'')+text);}
 }
 window.TEXTBOOK_PRACTICE={mount};
})();
