'use strict';
/* Новая оболочка демо. Лингвистические движки и данные исходной программы сохранены. */
(() => {
 const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const read=(k,d)=>{try{return JSON.parse(localStorage.getItem('cs-studio-'+k))??d;}catch{return d;}};
 const save=(k,v)=>{try{localStorage.setItem('cs-studio-'+k,JSON.stringify(v));}catch{}};
 const paths={keyboard:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M6 9h1m3 0h1m3 0h1m3 0h.1M6 12h1m3 0h1m3 0h1m3 0h.1M8 16h8"/>',book:'<path d="M12 6v15M3 4c4-1 6 0 9 2 3-2 5-3 9-2v15c-4-1-6 0-9 2-3-2-5-3-9-2z"/>',dictionary:'<path d="M5 3h14v18H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM3 17h16M8 7h6m-6 4h4"/>',practice:'<path d="m15 4 5 5L9 20H4v-5zM13 6l5 5M5 4v5M2.5 6.5h5"/>',tools:'<path d="M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6m-6 0v6"/>',arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',bookmark:'<path d="M6 3h12v18l-6-4-6 4z"/>',check:'<path d="m5 12 4 4L19 6"/>',search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>'};
 const icon=n=>`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[n]||paths.book}</svg>`;
 let route='klaviatura',issues=[],filter='all',selected=0,mode='edit',panel='issues',checkTimer,lookupTimer,lookupVersion=0,revision=0,checkedRevision=-1,checkedText='',issuePage=0,pinnedIssue=null,workspaceObserver;
 let saved=read('bookmarks',[]);
 const SIGNS=[['́','Оксия','1'],['̀','Вария','2'],['̑','Камора','3'],['҆','Звательце','4'],['҆́','Исо','5'],['҆̀','Апостроф','6'],['҃','Титло','7'],['҇','Покрытие','8']];
 const SAMPLE='Отче нашъ, иже еси на небесехъ?';
 function header(k,t,lead='',actions=''){return `<header class="page-heading"><div><h1>${t}</h1>${lead?`<p class="page-lead">${lead}</p>`:''}</div>${actions?`<div class="heading-actions">${actions}</div>`:''}</header>`;}
 function sync(id){
  clearTimeout(checkTimer);checkTimer=null;cancelLookup();
  workspaceObserver?.disconnect();workspaceObserver=null;
  route=id;const section=SECTIONS.find(x=>x.id===id);
  const names={klaviatura:'Клавиатура',proverka:'Клавиатура',library:'Правила и обучение',tools:'Инструменты',practice:'Практика',saved:'Закладки',search:'Результаты поиска'};
  $('#location').textContent=names[id]||section?.title||'Мастерская';
  $$('.studio-link').forEach(b=>{const active=b.dataset.route===id||(id==='proverka'&&b.dataset.route==='klaviatura');b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  $('#content').classList.toggle('workspace-page',['klaviatura','proverka'].includes(id));
  $('#content').classList.toggle('legacy-page',!!section&&!['klaviatura','proverka'].includes(id));
  if(id!=='search'){try{history.replaceState(null,'','#'+id);}catch{} $('#search').value='';}
  $('#main').scrollTop=0;window.scrollTo(0,0);
 }
 function renderNav(){
  $('#nav').innerHTML=`${[['klaviatura','keyboard','Клавиатура'],['slovar','dictionary','Словарь'],['library','book','Правила и обучение'],['practice','practice','Практика']].map(([r,i,t])=>`<button class="studio-link" data-route="${r}">${icon(i)}<span>${t}</span>${r==='klaviatura'?'<span class="nav-dot" aria-hidden="true"></span>':''}</button>`).join('')}<div class="nav-divider" aria-hidden="true"></div><button class="studio-link" data-route="azbuka"><span class="nav-char cs">Ѣ</span><span>Азбука</span><span class="nav-detail">40</span></button><button class="studio-link" data-route="titla"><span class="nav-char cs">а҃</span><span>Титла</span></button><button class="studio-link" data-route="tools">${icon('tools')}<span>Инструменты</span></button><button class="studio-link" data-route="saved">${icon('bookmark')}<span>Закладки</span><span id="bookmarkCount" class="nav-detail">${saved.length||''}</span></button>`;
 }
 function render(id){
  if(['klaviatura','proverka'].includes(id)){sync(id);workspace();return true;}
  if(id==='library'){sync(id);library();return true;}
  if(id==='tools'){sync(id);tools();return true;}
  if(id==='saved'){sync(id);bookmarks();return true;}
  if(id==='practice'){sync(id);practice();return true;}
  return false;
 }
 function workspace(){
  mode='edit';panel='issues';filter='all';selected=0;issuePage=0;pinnedIssue=null;
  $('#content').innerHTML=`<h1 class="visually-hidden">Клавиатура и проверка правописания</h1>
  <div class="workbench">
   <section class="writing-column" aria-label="Редактор и клавиатура">
    <div class="paper" id="paper"><div class="paper-top"><div class="editor-tabs" role="group" aria-label="Режим редактора"><button data-mode="edit" aria-pressed="true">Мой текст</button><button data-mode="proof" aria-pressed="false">С разметкой <span id="proofCount"></span></button></div><button class="quiet sample-button" id="loadSample">Пример с ошибками ↗</button></div><div id="kbmount"></div></div>
    <div class="keyboard-area">
     <div class="keyboard-heading"><span class="keyboard-tip">Буква → надстрочный знак</span><div class="layers" role="group" aria-label="Слой клавиатуры"><button data-layer="base" aria-pressed="true">Аа</button><button data-layer="shift" aria-pressed="false">Shift</button><button data-layer="alt" aria-pressed="false">Alt / ⌥</button><button data-layer="both" aria-pressed="false">⇧ + ⌥</button></div></div>
     <div class="signs-row" role="group" aria-label="Надстрочные знаки">${SIGNS.map(([s,n,k])=>`<button class="sign-key" data-sign="${esc(s)}" aria-label="Вставить: ${n}"><span class="cs">а${s}</span><span>${n}</span><kbd>${k}</kbd></button>`).join('')}</div>
     <div id="keyboardDock"></div><div class="keyboard-foot"><span><span class="status-dot"></span> Набор на физической и экранной клавиатуре</span><div class="keyboard-foot-actions">${window.slavApi?.floatingKeyboard?'<button class="quiet" id="detachKeyboard" title="Клавиатура поверх окон других программ">Отделить клавиатуру ↗</button>':''}<button class="quiet" data-route="znaki">Как ставить знаки ${icon('arrow')}</button></div></div>
    </div>
   </section>
   <aside class="review-rail" aria-label="Проверка и словарь"><div class="rail-tabs" role="group" aria-label="Панель помощника"><button data-panel="issues" aria-pressed="true">Правописание <span id="railCount"></span></button><button data-panel="dictionary" aria-pressed="false">Словарь</button></div><div id="railBody"></div><div class="rail-footer"><span id="engineStatus">Загружается словарь SCI…</span><button class="quiet" data-route="istochniki">О проверке ↗</button></div></aside>
   <details class="titla-drawer" open><summary>Слова под титлом</summary><div class="titla-inserts">${TITLA_WORDS.map(([w,r])=>`<div class="titla-card"><button class="titla-word" data-insert="${esc(w)}" aria-label="Вставить: ${esc(r)}"><span class="cs">${esc(w)}</span><span>${esc(r)}</span></button>${dictionaryButton(w)}</div>`).join('')}</div></details>
  </div>`;
  KB.mount($('#kbmount'), {focus:false});
  const mount=$('#kbmount'),wrap=$('.kbwrap',mount),ed=$('#kbEd');
  $('.kbhelp',mount).remove();$('.group',mount).remove();
  $('#keyboardDock').append($('#kb'));
  const detach=$('#detachKeyboard');
  if(detach)detach.onclick=async()=>{
   detach.disabled=true;
   try{const result=await window.slavApi.detachKeyboard();if(!result.ok)APP.toast(result.message);}
   catch{APP.toast('Не удалось открыть клавиатуру. Попробуйте ещё раз.');}
   finally{detach.disabled=false;}
  };
  const proof=document.createElement('div');proof.id='proofText';proof.className='proof-text cs nocopy';proof.setAttribute('aria-label','Текст с замечаниями');proof.hidden=true;ed.after(proof);
  const foot=document.createElement('div');foot.className='editor-foot';foot.innerHTML='<span id="textStats"></span><span class="save-state" id="saveState" role="status"></span><button class="quiet" id="exportText">Скачать .txt ↗</button>';wrap.append(foot);updateSaveState();
  const layoutLabel=$('#kbLayout').closest('label');$('span',layoutLabel).textContent='Раскладка ЦСЯ';
  $('[data-k="copy"]',mount).textContent='Копировать текст';
  const actions=document.createElement('details');actions.className='text-actions';actions.innerHTML='<summary aria-label="Действия с текстом">•••</summary><div><button id="clearText">Очистить текст</button><button id="restoreText" disabled>Отменить очистку</button><div class="draft-list" id="draftList"></div></div>';
  $('.edbtns',mount).append(actions);
  let cleared=null;
  $('#clearText').onclick=()=>{KB.checkpoint();cleared=ed.value;setText('');$('#restoreText').disabled=false;actions.open=false;};
  $('#restoreText').onclick=()=>{if(cleared!==null){KB.checkpoint();setText(cleared);cleared=null;$('#restoreText').disabled=true;actions.open=false;}};
  actions.addEventListener('toggle',()=>{if(actions.open)renderDrafts();});
  $('#draftList').onclick=e=>{const button=e.target.closest('[data-draft-id]');if(!button)return;const draft=KB.getDrafts().find(d=>d.id===button.dataset.draftId);if(!draft)return;KB.checkpoint();setText(draft.text);actions.open=false;APP.toast('Черновик восстановлен. Изменение можно отменить.');};
  $('#loadSample').onclick=()=>{KB.checkpoint();setText(SAMPLE);APP.toast('Пример добавлен. Изменения можно отменить клавишами ⌘Z / Ctrl+Z.');};
  $('#exportText').onclick=()=>{const blob=new Blob(['\ufeff'+ed.value],{type:'text/plain;charset=utf-8'});const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='Церковнославянский текст.txt';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};
  ed.addEventListener('input',()=>{revision++;updateSaveState();clearTimeout(checkTimer);checkTimer=setTimeout(()=>{if($('#kbEd')===ed)check();},240);updateStats();});
  ed.addEventListener('select',()=>{if(panel==='dictionary')dictionaryPanel();});
  $('#keyboardDock').addEventListener('click',()=>setMode('edit'),true);
  $('#keyboardDock').addEventListener('click',refreshLayers);
  $('#paper').addEventListener('click',e=>{if(e.target.closest('[data-k=smaller], [data-k=bigger]'))paintProof();const b=e.target.closest('[data-mode]');if(b)setMode(b.dataset.mode);const m=e.target.closest('[data-issue]');if(m)selectIssue(Number(m.dataset.issue),false);});
  if(window.LEGACY)LEGACY.attach(ed,enc=>APP.toast(`Текст преобразован из ${LEGACY.SHORT[enc]} в Unicode`));
  SPELL.onReady(()=>{if($('#kbEd')===ed){check();engineStatus();}});SPELL.load();
  DICT.onReady(()=>{if($('#kbEd')===ed&&panel==='dictionary')dictionaryPanel();});DICT.load();
  layer('base');check();engineStatus();ed.blur();requestAnimationFrame(()=>window.scrollTo(0,0));
  const bench=$('.workbench'),paper=$('#paper'),keyboard=$('.keyboard-area'),review=$('.review-rail');
  const fitPanels=()=>{bench.style.setProperty('--editor-height',paper.offsetHeight+'px');bench.style.setProperty('--keyboard-height',keyboard.offsetHeight+'px');bench.style.setProperty('--titla-height',Math.max(150,keyboard.offsetHeight-Math.max(0,review.offsetHeight-paper.offsetHeight))+'px');};
  workspaceObserver=new ResizeObserver(fitPanels);workspaceObserver.observe(paper);workspaceObserver.observe(keyboard);workspaceObserver.observe(review);fitPanels();
 }
 function updateSaveState(){
  const el=$('#saveState');if(!el)return;
  const state=KB.getSaveState().state;
  const messages={saved:'Сохранено на устройстве',new:'Сохранится при вводе',failed:'Не сохранено — скачайте .txt','backup-failed':'Текст сохранён · резервные копии недоступны'};
  if(el.dataset.state!==state){el.dataset.state=state;el.innerHTML='<span class="status-dot"></span> '+messages[state];}
  const button=$('#exportText');if(button){button.dataset.unsaved=String(state==='failed');button.setAttribute('aria-label',state==='failed'?'Скачать несохранённый текст в файл .txt':'Скачать текст в файл .txt');}
 }
 function renderDrafts(){
  const out=$('#draftList');if(!out)return;
  const drafts=KB.getDrafts();out.innerHTML='<span class="draft-label">Последние черновики</span>'+(drafts.length?drafts.map(d=>`<button data-draft-id="${esc(d.id)}" title="Восстановить черновик"><span>${esc(new Date(d.at).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}))}</span><span class="cs">${esc(d.text.replace(/\s+/g,' ').slice(0,32))}${d.text.length>32?'…':''}</span></button>`).join(''):'<span class="draft-empty">Версии появятся по мере работы с текстом.</span>');
 }
 function dictionaryButton(word){return /\p{L}/u.test(word)?`<button class="dictionary-link" data-dlookup="${esc(word)}" aria-label="Словарная статья: ${esc(word)}" title="Открыть словарную статью">${icon('dictionary')}</button>`:'';}
 function issueMessage(i){
  if(i.rule==='spell'&&i.msg.startsWith('В словаре SCI: '))return 'В словаре SCI: <span class="cs">'+esc(i.msg.slice(15))+'</span>';
  let from=0,html='';
  for(const match of i.msg.matchAll(/[\p{L}\p{M}҂]+/gu)){
   html+=esc(i.msg.slice(from,match.index));
   html+=/[\p{M}\u0460-\u052f\u2de0-\u2dff\ua640-\ua69f]/u.test(match[0])?`<span class="cs">${esc(match[0])}</span>`:esc(match[0]);
   from=match.index+match[0].length;
  }
  return html+esc(i.msg.slice(from));
 }
 function replacementRow(k,value,label){return `<div class="replacement-row"><button class="replacement" data-fix="${k}" data-value="${esc(value)}"><span class="cs">${esc(value)}</span><span>${label}</span></button>${dictionaryButton(value)}</div>`;}
 function engineStatus(){const el=$('#engineStatus');if(el)el.textContent=SPELL.ready?'Правила + словарь SCI':SPELL.failed?'Проверка по правилам · SCI недоступен':'Загружается словарь SCI…';}
 function plural(n,one,few,many){const a=n%10,b=n%100;return b>=11&&b<=14?many:a===1?one:a>=2&&a<=4?few:many;}
 function updateStats(){const ed=$('#kbEd');if(!ed)return;const words=ed.value.match(/[\p{L}\p{M}]+/gu)||[];$('#textStats').textContent=`${words.length} ${plural(words.length,'слово','слова','слов')} · ${Array.from(ed.value).length} ${plural(Array.from(ed.value).length,'знак','знака','знаков')}`;}
 function setMode(next){mode=next;const ed=$('#kbEd');if(!ed)return;ed.hidden=mode==='proof';$('#proofText').hidden=mode!=='proof';$$('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));if(mode==='proof')paintProof();}
 function setText(text){const ed=$('#kbEd');if(!ed)return;setMode('edit');ed.focus();ed.select();if(!document.execCommand('insertText',false,text)){ed.value=text;ed.dispatchEvent(new Event('input',{bubbles:true}));}KB.setText(ed.value);check();}
 function insert(text){setMode('edit');const ed=$('#kbEd');if(ed)KB.insertInto(ed,text);}
 function check(){const ed=$('#kbEd');if(!ed)return;clearTimeout(checkTimer);checkTimer=null;checkedText=ed.value;checkedRevision=revision;issues=CHECK.check(checkedText);pinnedIssue=null;selected=Math.min(selected,Math.max(0,issues.length-1));$('#railCount').textContent=issues.length||'';$('#proofCount').textContent=issues.length||'';updateStats();paintProof();if(panel==='issues')issuesPanel();}
 function paintProof(){const box=$('#proofText'),ed=$('#kbEd');if(!box||!ed)return;let pos=0,html='';const spans=[];issues.forEach((i,k)=>{if(!spans.some(x=>x.start===i.start))spans.push({...i,k});});spans.sort((a,b)=>a.start-b.start).forEach(i=>{if(i.start<pos)return;html+=esc(ed.value.slice(pos,i.start))+`<button class="proof-mark ${i.sev}" data-issue="${i.k}" aria-label="${esc(i.msg)}">${esc(ed.value.slice(i.start,i.end))}</button>`;pos=i.end;});html+=esc(ed.value.slice(pos));box.innerHTML=html||'<span class="empty-editor">Начните печатать…</span>';box.style.fontSize=ed.style.fontSize;}
 function issuesPanel(){
  cancelLookup();
  const body=$('#railBody');if(!body)return;
  const n={error:0,warn:0,hint:0};issues.forEach(i=>n[i.sev]++);
  const visible=issues.map((i,k)=>({...i,k})).filter(i=>filter==='all'||(filter==='error'?i.sev!=='hint':i.sev==='hint'));
  issuePage=Math.min(issuePage,Math.max(0,Math.ceil(visible.length/80)-1));
  const shown=visible.slice(issuePage*80,(issuePage+1)*80);
  if(pinnedIssue!==null&&issues[pinnedIssue]&&!shown.some(i=>i.k===pinnedIssue))shown.unshift({...issues[pinnedIssue],k:pinnedIssue});
  body.innerHTML=`<div class="review-summary" aria-live="polite"><strong>${issues.length?'Есть места для проверки':'Можно продолжать'}</strong><span>${issues.length?`${n.error} ${plural(n.error,'ошибка','ошибки','ошибок')} · ${n.warn} проверить · ${n.hint} ${plural(n.hint,'совет','совета','советов')}`:$('#kbEd').value.trim()?'Нарушений известных правил не найдено.':'Наберите или вставьте текст.'}</span></div><div class="issue-filters" role="group" aria-label="Фильтр замечаний">${[['all','Все'],['error','Ошибки'],['hint','Советы']].map(([f,t])=>`<button data-filter="${f}" aria-pressed="${filter===f}">${t}</button>`).join('')}</div><div class="issue-list">${shown.length?shown.map(i=>`<article class="review-issue ${i.sev} ${selected===i.k?'expanded':''}" id="review-issue-${i.k}"><div class="issue-heading-row"><button class="issue-heading" data-select="${i.k}" aria-expanded="${selected===i.k}"><span class="issue-severity">${{error:'Ошибка',warn:'Проверьте',hint:'Совет'}[i.sev]}</span><span class="issue-word cs">${esc(i.word)}</span><span class="issue-chevron">${selected===i.k?'−':'+'}</span></button>${dictionaryButton(i.word)}</div>${selected===i.k?`<div class="issue-detail"><p>${issueMessage(i)}</p>${i.fixed!==null?replacementRow(i.k,i.fixed,'Применить ↵'):i.alts?.length?`<div class="alternative-label">Выберите по смыслу:</div>${i.alts.map(a=>replacementRow(i.k,a,'Выбрать')).join('')}`:''}<button class="quiet issue-rule" data-issue-rule="${i.k}">Посмотреть правило ${icon('arrow')}</button></div>`:''}</article>`).join(''):`<div class="review-empty">${icon('check')}<p>${issues.length?'В этой группе замечаний нет.':'Замечаний нет'}</p><span>${issues.length?'Выберите другой фильтр.':'Проверка подсказывает, решение остаётся за вами.'}</span></div>`}</div>${visible.length>80?`<div class="issue-pages"><button class="quiet" data-issues-page="${issuePage-1}" ${issuePage===0?'disabled':''}>← Назад</button><span>${issuePage*80+1}–${Math.min((issuePage+1)*80,visible.length)} из ${visible.length}</span><button class="quiet" data-issues-page="${issuePage+1}" ${(issuePage+1)*80>=visible.length?'disabled':''}>Далее →</button></div>`:''}${pinnedIssue!==null?'<p class="rail-note">Выбранное в тексте замечание показано вне текущего фильтра.</p>':''}`;
 }
 function selectIssue(k,focus=true){
  selected=k;panel='issues';
  const i=issues[k],ed=$('#kbEd');if(!i||!ed)return;
  // Показываем выбранное слово, сохраняя фильтр и режим редактора.
  const visible=issues.map((issue,index)=>({issue,index})).filter(({issue})=>filter==='all'||(filter==='error'?issue.sev!=='hint':issue.sev==='hint'));
  const position=visible.findIndex(item=>item.index===k);
  pinnedIssue=position<0?k:null;if(position>=0)issuePage=Math.floor(position/80);
  setPanelButtons();issuesPanel();
  if(focus){setMode('edit');ed.focus();ed.setSelectionRange(i.start,i.end);}
  else{
   const card=document.getElementById('review-issue-'+k);
   if(card){
    card.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    card.classList.add('issue-target');
    setTimeout(()=>card.classList.remove('issue-target'),1400);
   }
  }
 }
 function fixIssue(k,value){
  let i=issues[k];const ed=$('#kbEd');if(!i||!ed||i.fixed===null&&value===undefined)return;
  const replacement=value??i.fixed;
  if(typeof replacement!=='string'||!(i.fixed===replacement||i.alts?.includes(replacement)))return;
  if(checkedRevision!==revision||checkedText!==ed.value){
   const original=i,range=unchangedRange(checkedText,ed.value,i.start,i.end);
   check();
   i=range&&issues.find(candidate=>candidate.rule===original.rule&&candidate.start===range.start&&candidate.end===range.end&&(candidate.fixed===replacement||candidate.alts?.includes(replacement)));
   if(!i){APP.toast('Текст изменился. Проверьте обновлённое замечание.');return;}
  }
  const previousMode=mode,scrollY=window.scrollY,scrollX=window.scrollX;
  const list=$('.issue-list'),listScroll=list?.scrollTop||0;
  // insertText сохраняет обычную отмену; временный доступ к textarea не меняет выбранный режим.
  if(previousMode==='proof')setMode('edit');
  ed.focus({preventScroll:true});ed.setSelectionRange(i.start,i.end);
  if(!document.execCommand('insertText',false,replacement)){
   ed.setRangeText(replacement,i.start,i.end,'end');ed.dispatchEvent(new Event('input',{bubbles:true}));
  }
  KB.setText(ed.value);check();setMode(previousMode);
  if(previousMode==='proof')$('[data-mode="proof"]').focus({preventScroll:true});
  const updatedList=$('.issue-list');if(updatedList)updatedList.scrollTop=listScroll;
  window.scrollTo({top:scrollY,left:scrollX,behavior:'instant'});
 }
 function unchangedRange(before,after,start,end){
  if(before===after)return {start,end};
  let prefix=0,suffix=0;
  while(prefix<before.length&&prefix<after.length&&before[prefix]===after[prefix])prefix++;
  while(suffix<before.length-prefix&&suffix<after.length-prefix&&before[before.length-1-suffix]===after[after.length-1-suffix])suffix++;
  if(end<=prefix)return {start,end};
  if(start>=before.length-suffix){const delta=after.length-before.length;return {start:start+delta,end:end+delta};}
  return null;
 }
 function setPanelButtons(){$$('[data-panel]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.panel===panel)));}
 function dictionaryPanel(){
  cancelLookup();
  const body=$('#railBody'),ed=$('#kbEd');if(!body||!ed)return;
  const selection=ed.value.slice(ed.selectionStart,ed.selectionEnd).trim();
  body.innerHTML=`<div class="mini-dictionary"><label for="wordLookup">Слово из вашего текста</label><div class="lookup-row"><input id="wordLookup" class="cs" type="search" placeholder="Выделите слово или введите…" value="${esc(selection)}" spellcheck="false"><button class="icon-button" id="lookupButton" aria-label="Найти в словаре">${icon('search')}</button></div><div id="lookupResult" aria-live="polite"></div><button class="quiet" data-route="slovar">Открыть полный словарь ${icon('arrow')}</button></div>`;
  const input=$('#wordLookup'),out=$('#lookupResult'),request=lookupVersion;
  const run=()=>{if(request!==lookupVersion||panel!=='dictionary'||$('#wordLookup')!==input||$('#kbEd')!==ed)return;const q=input.value.trim();if(!q){out.innerHTML='<p class="dictionary-hint">Выделите слово в редакторе: его значение появится здесь, без перехода на другую страницу.</p>';return;}if(!DICT.ready){out.textContent=DICT.failed?'Не удалось открыть данные словаря.':'Загружается словарь…';return;}const result=DICT.lookupWord(q);out.innerHTML=result?.items.length?result.items.map(i=>{const [w,tr,b]=DICT.entry(i);return `<article class="lookup-entry"><span class="eyebrow">${result.exact?'Словарная статья':'Похожее слово'}</span><h3 class="cs">${esc(w)}</h3><small>${esc(tr)}</small><p>${esc(DICT.preview(b,180))}</p><button class="quiet" data-darticle="${i}" data-darticle-word="${esc(q)}">Вся статья ${icon('arrow')}</button></article>`;}).join(''):'<p class="dictionary-hint">Не найдено. Попробуйте начальную форму или поиск по тексту в полном словаре.</p>';};
  $('#lookupButton').onclick=run;input.onkeydown=e=>{if(e.key==='Enter')run();};input.oninput=()=>{clearTimeout(lookupTimer);lookupTimer=setTimeout(run,200);};run();
 }
 function cancelLookup(){clearTimeout(lookupTimer);lookupTimer=null;lookupVersion++;}
 function refreshLayers(){if(!$('#kb'))return;const sh=$('#kb [data-code=SHIFT]').classList.contains('on'),alt=$('#kb [data-code=OPTION]').classList.contains('on');const name=sh?(alt?'both':'shift'):(alt?'alt':'base');$$('[data-layer]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.layer===name)));}
 function layer(name){const desired={base:[false,false],shift:[true,false],alt:[false,true],both:[true,true]}[name];if(!desired)return;['SHIFT','OPTION'].forEach((code,i)=>{const b=$(`#kb [data-code="${code}"]`);if(b&&b.classList.contains('on')!==desired[i])b.click();});$$('[data-layer]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.layer===name)));}
 const GROUPS=[['Письмо и чтение','От отдельной буквы к целому тексту',['azbuka','znaki','pravopisanie','titla','chtenie']],['Числа и грамматика','Формы, связи и числовые значения',['cifir','chisla','grammatika','imena','glagol','sintaksis']]];
 function library(){
  $('#content').innerHTML=header('','Правила и обучение','',`<button class="quiet" data-route="practice">Потренироваться ${icon('arrow')}</button>`)+`${GROUPS.map(([title,desc,ids])=>`<section class="library-group"><div class="section-heading"><h2>${title}</h2><span>${desc}</span></div><div class="reference-list">${ids.map(id=>{const s=SECTIONS.find(x=>x.id===id);return `<div class="reference-row"><button class="reference-open" data-route="${id}"><span class="reference-glyph cs">${s.icon}</span><span><strong>${esc(s.title)}</strong><small>${esc(s.lead.replace(/<[^>]*>/g,'')).slice(0,145)}</small></span>${icon('arrow')}</button><button class="bookmark-button ${saved.includes(id)?'on':''}" data-bookmark="${id}" aria-label="${saved.includes(id)?'Убрать из закладок':'Добавить в закладки'}: ${esc(s.title)}" aria-pressed="${saved.includes(id)}">${icon('bookmark')}</button></div>`;}).join('')}</div></section>`).join('')}`;
 }
 function tools(){const cards=[['titla','ст҃ъ','Титла','Сократить слова или раскрыть сокращения.'],['cifir','к҃а','Цифирь','Перевести числа в буквенную запись и обратно.'],['grammatika','рабо́ма','Формы слова','Склонения, спряжения, двойственное число.'],['klaviatura','А҆','Клавиатура и проверка','Вернуться к тексту и встроенному помощнику.']];$('#content').innerHTML=header('ПИСЬМЕННАЯ МАСТЕРСКАЯ','Инструменты','Вспомогательные действия для работы с текстом.')+`<div class="tool-grid">${cards.map(([r,g,t,d])=>`<button class="tool-item" data-route="${r}"><span class="tool-glyph cs">${g}</span><h2>${t}</h2><p>${d}</p><span class="tool-open">Открыть ${icon('arrow')}</span></button>`).join('')}</div><div class="tool-note"><h2>Старые кодировки</h2><p>При вставке в клавиатуру и проверку программа распознаёт поддерживаемые старые кодировки. Если распознавание неоднозначно, появится выбор.</p><button class="quiet" data-route="klaviatura">Вставить текст в редактор ${icon('arrow')}</button></div>`;}
 function bookmarks(){const items=saved.map(id=>SECTIONS.find(s=>s.id===id)).filter(Boolean);$('#content').innerHTML=header('ЛИЧНЫЙ СПРАВОЧНИК','Закладки','Нужные правила — в одном месте.')+(items.length?`<div class="reference-list">${items.map(s=>`<div class="reference-row"><button class="reference-open" data-route="${s.id}"><span class="reference-glyph cs">${s.icon}</span><span><strong>${esc(s.title)}</strong><small>${esc(s.lead.replace(/<[^>]*>/g,''))}</small></span>${icon('arrow')}</button><button class="bookmark-button on" data-bookmark="${s.id}" aria-label="Удалить закладку: ${esc(s.title)}">${icon('bookmark')}</button></div>`).join('')}</div>`:`<div class="empty-page">${icon('bookmark')}<h2>Сохраните правило на потом</h2><p>Нажмите значок закладки рядом с разделом в библиотеке.</p><button class="primary-button" data-route="library">Открыть правила ${icon('arrow')}</button></div>`);}
 function practice(){window.TEXTBOOK_PRACTICE.mount($('#content'),{header,icon});}

 document.addEventListener('click',e=>{
  const article=e.target.closest('[data-dlookup], [data-darticle]');if(article){e.preventDefault();if(article.hasAttribute('data-darticle'))DICT.openPopup(Number(article.dataset.darticle),{word:article.dataset.darticleWord});else DICT.openPopup(article.dataset.dlookup);return;}
  const r=e.target.closest('[data-route]');if(r){e.preventDefault();APP.go(r.dataset.route);return;}
  const sign=e.target.closest('[data-sign], [data-insert]');if(sign){insert(sign.dataset.sign??sign.dataset.insert);return;}
  const l=e.target.closest('[data-layer]');if(l){layer(l.dataset.layer);return;}
  const p=e.target.closest('[data-panel]');if(p){panel=p.dataset.panel;setPanelButtons();if(panel==='issues')issuesPanel();else dictionaryPanel();return;}
  const f=e.target.closest('[data-filter]');if(f){filter=f.dataset.filter;issuePage=0;pinnedIssue=null;issuesPanel();return;}
  const page=e.target.closest('[data-issues-page]');if(page){const value=Number(page.dataset.issuesPage);if(Number.isInteger(value)&&value>=0){issuePage=value;pinnedIssue=null;issuesPanel();}return;}
  const s=e.target.closest('[data-select]');if(s){selectIssue(Number(s.dataset.select));return;}
  const fix=e.target.closest('[data-fix]');if(fix){fixIssue(Number(fix.dataset.fix),fix.dataset.value);return;}
  const rule=e.target.closest('[data-issue-rule]');if(rule){const issue=issues[Number(rule.dataset.issueRule)];if(issue)RULE_POPUP.open(issue);return;}
  const bm=e.target.closest('[data-bookmark]');if(bm){const id=bm.dataset.bookmark;saved=saved.includes(id)?saved.filter(x=>x!==id):[...saved,id];save('bookmarks',saved);$('#bookmarkCount').textContent=saved.length||'';if(route==='saved')bookmarks();else library();return;}

 });
 document.addEventListener('mousedown',e=>{if(e.target.closest('[data-sign], [data-insert], [data-layer]'))e.preventDefault();});
 window.addEventListener('keyup',refreshLayers);window.addEventListener('keydown',refreshLayers);
 window.addEventListener('hashchange',()=>{const id=location.hash.slice(1);if(id&&id!=='content'&&id!==route)APP.go(id);});
 try{history.scrollRestoration='manual';}catch{}
 const theme=read('theme','light');document.documentElement.dataset.theme=theme;
 $('#themeToggle').onclick=()=>{const t=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=t;save('theme',t);$('#themeToggle').setAttribute('aria-label',t==='dark'?'Включить светлую тему':'Включить тёмную тему');};
 window.addEventListener('cs-editor-saved',updateSaveState);
 window.STUDIO={renderNav,render,sync};
})();
