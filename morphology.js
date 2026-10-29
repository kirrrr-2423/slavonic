'use strict';
/* Морфология словарного попапа. Требует FORMS из forms.js; не использует DOM и SEARCH.norm.
 * prepare(entries): только реальные однословные заголовки словаря, без генерации всех форм.
 * analyze(query, entryIds?): shortlist + проверка полной формы; все падежные совпадения сохраняются.
 * paradigm(entryIndex, query?): семь строк падежей, три числа, matches и объяснения без HTML.
 */
(() => {
 const BOOK='https://azbyka.ru/otechnik/Aleksandr-Kraveckij/uchebnoe-rukovodstvo-po-tserkovnoslavjanskomu-jazyku/';
 const CASES=[['nominative','Именительный'],['genitive','Родительный'],['dative','Дательный'],['accusative','Винительный'],['instrumental','Творительный'],['locative','Предложный'],['vocative','Звательный']];
 const NUMBERS={sg:'Единственное число',du:'Двойственное число',pl:'Множественное число'};
 const ACCENT=/[\u0300\u0301\u0311]/u;
 const strictKey=value=>String(value).trim().normalize('NFD').toLowerCase();
 // Снимаем только ударения и звательце. Ять, ижица, краткость й, кендема и исторические буквы сохраняются.
 const graphicKey=value=>strictKey(value).replace(/[\u0300\u0301\u0311\u0486]/gu,'');
 const oneWord=value=>/^[\p{L}\p{M}]+$/u.test(String(value).trim());
 const copy=value=>JSON.parse(JSON.stringify(value));
 const SOURCE_NOUN={title:'Плетнёва, Кравецкий. Церковнославянский язык',url:BOOK+'25',lesson:'Таблицы именного изменения',table:null,label:'Таблицы именного изменения',verified:false};
 const NEBO={
  lemma:'не́бо',type:'n_es',typeLabel:'4-е склонение, средний род, основа с наращением -ес-',gender:'n',confidence:'verified',stems:['неб','небес','небєс'],baseStem:'неб',augmentation:'ес',
  explanation:'Наращение -ес- появляется во всех формах, кроме именительного, винительного и звательного единственного числа.',
  source:{title:'Плетнёва, Кравецкий. Церковнославянский язык',url:BOOK+'11_1',lesson:'Урок 11',table:'Таблица 28',label:'Урок 11 · таблица 28',verified:true},
  sg:[['не́бо'],['небесѐ'],['небесѝ'],['не́бо'],['небесе́мъ'],['небесѝ'],['не́бо']],
  du:[['небєсѝ'],['небесꙋ̀'],['небесе́ма']],
  pl:[['небеса̀'],['небе́съ'],['небесє́мъ'],['небеса̀'],['небесы̀'],['небесѣ́хъ']]
 };
 // Дополнительные классы ниже требуют явной словарной пометы. Одно окончание не устанавливает часть речи.
 const TYPE_FROM_GENDER={m:{'ъ':'m_hard','ь':'m_soft','й':'m_soft'},f:{'а':'f_hard','ѧ':'f_soft','ь':'f_third'},n:{'о':'n_hard','е':'n_soft'}};
 const EXCLUDED=/^(?:(?:нарѣч(?:їе)?|нареч(?:ие)?|предлог|союз|частица|междометие|местоимение|глагол|прилагательное|причастие|числительное)(?=\s|[.,;:]|$)|(?:нарѣч|нареч|предл|союз|част|межд|мест|гл|прил|прич|числ)\.)/iu;
 let entriesRef=null,profiles=new Map(),byLemma=new Map(),byStem=new Map(),cache=new Map(),catalog=new Map(),stats={entries:0,indexedLemmas:0};
 const LIMITATIONS=['Разбор охватывает проверенные словарные профили и явно помеченные существительные; это не полный морфологический словарь.','Не определяем падеж по контексту предложения; совпадающие формы показываются отдельно.','Глаголы, прилагательные, местоимения, числительные и непроверенные нерегулярные типы здесь не разбираются.'];
 function add(map,key,index){if(!map.has(key))map.set(key,[]);if(!map.get(key).includes(index))map.get(key).push(index);}
 function lemmaText(head){return String(head).trim().replace(/^\p{Lu}/u,letter=>letter.toLowerCase());}
 function grammarText(html){return String(html||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();}
 function lexicalProfile(entry){
  if(!Array.isArray(entry)||typeof entry[0]!=='string'||!oneWord(entry[0])||/[҃҇ⷠ-ⷿ]/u.test(entry[0]))return null;
  const lemma=lemmaText(entry[0]),key=graphicKey(lemma),text=grammarText(entry[2]);
  if(EXCLUDED.test(text))return null;
  if(catalog.has(key))return {...copy(catalog.get(key)),entryLemma:lemma};
  if(/(?:ти|щи|тисѧ|щисѧ|ый|їй|ий|аѧ|ѧѧ|ое|ее)$/u.test(key))return null;
  // Класс выбирается по помете рода/части речи вместе с окончанием, а не по внешнему сходству основы.
  const marker=text.match(/^(?:сущ(?:ествительное)?\.?(?:\s*[,;:])?\s*)?(мужской\s+род|женский\s+род|средний\s+род|м\.\s*р\.|ж\.\s*р\.|ср\.\s*р\.)(?=\s|[,;:]|$)/iu);
  if(!marker)return null;
  const gender=/^(?:муж|м\.)/iu.test(marker[1])?'m':/^(?:жен|ж\.)/iu.test(marker[1])?'f':'n';
  if(key.length<3||/(?:мѧ|ецъ)$/u.test(key)||['мати','дщи','любы','свекры'].includes(key))return null;
  const type=TYPE_FROM_GENDER[gender][Array.from(key).at(-1)];
  if(!type||!window.FORMS?.NOUN?.[type])return null;
  const stem=Array.from(key).slice(0,-1).join('');
  if(stem.length<2)return null;
  const stems=[stem];
  if(/[кгх]$/u.test(stem)){const last=stem.at(-1),base=stem.slice(0,-1);stems.push(base+({к:'ц',г:'з',х:'с'}[last]),base+({к:'ч',г:'ж',х:'ш'}[last]));}
  return {lemma,type,typeLabel:window.FORMS.NOUN[type].label,gender,confidence:'generated',stems,source:copy(SOURCE_NOUN),explanation:'Тип предположен по явной словарной помете рода и окончанию. Формы построены генератором; словарная статья не подтверждает всю таблицу.',limitations:['Ударение и варианты форм генератора требуют сверки с учебником.']};
 }
 function prepare(entries){
  if(entries===entriesRef)return {...stats,noop:true,limitations:LIMITATIONS.slice()};
  if(!Array.isArray(entries))throw new TypeError('MORPH.prepare expects dictionary entries');
  entriesRef=entries;profiles=new Map();byLemma=new Map();byStem=new Map();cache=new Map();
  catalog=new Map([[graphicKey(NEBO.lemma),NEBO]]);
  const supplied=Array.isArray(window.MORPH_PROFILES)?window.MORPH_PROFILES:Object.values(window.MORPH_PROFILES||{});
  for(const profile of supplied){
   if(!profile||!oneWord(profile.lemma)||profile.confidence!=='verified'||!Array.isArray(profile.stems)||!profile.stems.length||!profile.source?.verified)continue;
   if(![['sg',7],['du',3],['pl',6]].every(([num,length])=>Array.isArray(profile[num])&&profile[num].length===length&&profile[num].every(cell=>Array.isArray(cell)&&cell.length&&cell.every(form=>typeof form==='string'&&oneWord(form)))))continue;
   const key=graphicKey(profile.lemma);if(!catalog.has(key))catalog.set(key,profile);
  }
  entries.forEach((entry,index)=>{const profile=lexicalProfile(entry);if(!profile)return;profiles.set(index,profile);add(byLemma,graphicKey(profile.lemma),index);profile.stems.forEach(stem=>add(byStem,graphicKey(stem),index));});
  stats={entries:entries.length,indexedLemmas:profiles.size};return {...stats,noop:false,limitations:LIMITATIONS.slice()};
 }
 function makeRows(table){
  const dual=[0,1,2,0,2,1,0],plural=[0,1,2,3,4,5,0];
  return CASES.map(([id,label],i)=>({case:id,label,caseLabel:label,sg:(table.sg[i]||[]).slice(),du:(table.du[dual[i]]||[]).slice(),pl:(table.pl[plural[i]]||[]).slice()}));
 }
 function baseParadigm(entryIndex){
  if(cache.has(entryIndex))return cache.get(entryIndex);
  const profile=profiles.get(entryIndex);if(!profile)return null;
  let table=profile;
  if(profile.confidence!=='verified'){
   if(!window.FORMS?.declineNoun)return null;
   try{table=window.FORMS.declineNoun(profile.lemma,profile.type);}catch{return null;}
  }
  const result={entryIndex,lemma:profile.lemma,pos:'noun',type:profile.type,typeLabel:profile.typeLabel,label:profile.typeLabel,gender:profile.gender,confidence:profile.confidence,source:copy(profile.source),explanation:profile.explanation,baseStem:profile.baseStem||profile.stems[0],augmentation:profile.augmentation||'',rows:makeRows(table),limitations:(profile.limitations||[]).slice()};
  cache.set(entryIndex,result);return result;
 }
 function partsOf(form,profile){
  const clusters=[];for(const char of form.normalize('NFD')){if(/\p{M}/u.test(char)&&clusters.length)clusters[clusters.length-1]+=char;else clusters.push(char);}
  const stems=profile.stems.slice().sort((a,b)=>b.length-a.length);
  for(const stem of stems)for(let i=1;i<=clusters.length;i++)if(graphicKey(clusters.slice(0,i).join(''))===graphicKey(stem))return {stem:clusters.slice(0,i).join('').normalize('NFC'),ending:clusters.slice(i).join('').normalize('NFC')};
  return {stem:form,ending:''};
 }
 function formMatches(query,form){
  if(strictKey(query)===strictKey(form))return 'exact';
  // Допускаем пропущенное ударение для поиска, но не исправляем неверную букву или другое поставленное ударение.
  if(!ACCENT.test(String(query).normalize('NFD'))&&graphicKey(query)===graphicKey(form))return 'unmarked';
  return null;
 }
 function matchesOf(model,query){
  if(!oneWord(query))return [];
  const profile=profiles.get(model.entryIndex),matches=[];
  for(const [number,numberLabel] of Object.entries(NUMBERS))for(const row of model.rows)for(const form of row[number]){
   const match=formMatches(query,form);if(!match)continue;
   const parts=partsOf(form,profile);
   matches.push({case:row.case,caseLabel:row.label,number,numberLabel,form,...explain(model.entryIndex,number,row.case,form),orthography:match});
  }
  return matches;
 }
 function explain(entryIndex,number,caseId,form){
  const model=baseParadigm(entryIndex),profile=profiles.get(entryIndex);
  if(!model||!Object.hasOwn(NUMBERS,number))return null;
  const row=model.rows.find(item=>item.case===caseId);if(!row||!row[number].some(value=>strictKey(value)===strictKey(form)))return null;
  const descriptions={nominative:'Называет предмет; обычно отвечает на вопросы «кто?» или «что?».',genitive:'Обычно отвечает на вопросы «кого?» или «чего?».',dative:'Обычно отвечает на вопросы «кому?» или «чему?».',accusative:'Обычно отвечает на вопросы «кого?» или «что?»; функцию определяет связь слов.',instrumental:'Обычно отвечает на вопросы «кем?» или «чем?».',locative:'Употребляется с предлогом; обычно отвечает на вопросы «о ком?» или «о чём?».',vocative:'Форма обращения.'};
  const parts=partsOf(form,profile),augmented=!!profile.augmentation&&graphicKey(parts.stem)!==graphicKey(profile.baseStem||profile.stems[0]);
  let explanation=`${row.label} падеж, ${NUMBERS[number].toLowerCase()}. ${descriptions[caseId]}`;
  if(augmented)explanation+=' В этой форме основа имеет наращение.';
  if(/[кгх]$/u.test(graphicKey(profile.baseStem||''))&&/[цзс]$/u.test(graphicKey(parts.stem)))explanation+=' Перед этим окончанием происходит чередование согласных основы.';
  if(profile.type==='n_es'&&graphicKey(parts.stem).includes('є'))explanation+=' Широкое є в основе различает совпадающие формы единственного и двойственного числа.';
  if(number==='du')explanation+=['nominative','accusative','vocative'].includes(caseId)?' В двойственном числе именительный, винительный и звательный совпадают.':['genitive','locative'].includes(caseId)?' В двойственном числе родительный и предложный совпадают.':' В двойственном числе дательный и творительный совпадают.';
  return {...parts,baseStem:profile.baseStem||profile.stems[0],augmentation:augmented?profile.augmentation:'',explanation};
 }
 function paradigm(entryIndex,query=''){
  if(!Number.isInteger(entryIndex))return null;
  const model=baseParadigm(entryIndex);if(!model)return null;
  const result=copy(model);result.query=String(query);result.matches=matchesOf(result,query);result.ambiguous=result.matches.length>1;return result;
 }
 function analyze(query,entryIds){
  query=String(query??'').trim();const empty={query,status:'unmatched',analyses:[],limitations:LIMITATIONS.slice()};
  if(!oneWord(query)||!entriesRef)return empty;
  let ids;
  if(Array.isArray(entryIds))ids=[...new Set(entryIds)].filter(id=>Number.isInteger(id)&&profiles.has(id)).slice(0,40);
  else{
   const key=graphicKey(query),found=new Set(byLemma.get(key)||[]);
   for(let i=key.length;i>=2&&found.size<40;i--)for(const id of byStem.get(key.slice(0,i))||[]){found.add(id);if(found.size>=40)break;}
   ids=[...found].slice(0,40);
  }
  const analyses=ids.map(id=>paradigm(id,query)).filter(model=>model&&model.matches.length);
  return {query,status:analyses.length>1?'ambiguous':analyses.length?'matched':'unmatched',ambiguous:analyses.length>1||analyses.some(model=>model.ambiguous),analyses,limitations:LIMITATIONS.slice()};
 }
 window.MORPH=Object.freeze({prepare,analyze,paradigm,explain});
})();
