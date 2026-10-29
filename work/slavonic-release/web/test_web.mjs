import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url)), app=path.join(root,'slavonic-web');
const source=path.resolve(root,'../../../outputs/slavonic-demo');
const read=p=>fs.readFileSync(path.join(app,p),'utf8');
let checks=0;
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(d=>d.isDirectory()?files(path.join(dir,d.name)):path.join(dir,d.name));}
for(const f of files(app).filter(f=>f.endsWith('.js'))){execFileSync(process.execPath,['--check',f]);checks++;}
for(const f of files(source)){
 const rel=path.relative(source,f);
 if(path.basename(f)==='.DS_Store'||path.basename(f).startsWith('._'))continue;
 if(['index.html','README.md'].includes(rel))continue;
 eq(fs.readFileSync(path.join(app,rel)),fs.readFileSync(f),'Canonical renderer unchanged: '+rel);
}
const report=JSON.parse(fs.readFileSync(path.join(root,'build-manifest.json')));
const release=JSON.parse(fs.readFileSync(path.join(root,'../release.json')));
eq(report.version,release.version,'Build report follows the shared release configuration');
eq(read('index.html').match(/<meta name="application-version" content="([^"]+)">/)?.[1],report.version,'Packaged page and build report share a release version');
ok(report.precache.every(name=>!name.split('/').some(part=>part.startsWith('.'))),'Precache excludes local metadata');
const manifest=JSON.parse(read('manifest.webmanifest'));
eq(manifest.start_url,'./#klaviatura','Keyboard remains the app entry');
eq(manifest.scope,'./','PWA works from nested deployment');
for(const icon of manifest.icons){
 const data=fs.readFileSync(path.join(app,icon.src));
 eq(data.subarray(1,4).toString(),'PNG','Icon is PNG');
 eq(`${data.readUInt32BE(16)}x${data.readUInt32BE(20)}`,icon.sizes,'Icon size matches manifest');
}
for(const file of report.precache)ok(fs.existsSync(path.join(app,file)),'Precache file exists: '+file);
for(const name of ['spell-data.js','slovar-data.js','practice-data.js','fonts/Ponomar-Regular.otf','fonts/FreeSerif.woff','dictionary-popup.css','rule-popup.js','rule-popup.css'])ok(report.precache.includes(name),'Offline content: '+name);
for(const match of read('index.html').matchAll(/(?:src|href)="([^"#]+)"/g)){
 const url=match[1]; if(!/^https?:/.test(url))ok(fs.existsSync(path.join(app,url)),'HTML local path: '+url);
}
for(const f of ['styles.css','studio.css','pwa.css','dictionary-popup.css','rule-popup.css'])for(const match of read(f).matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)){
 ok(!/^https?:/.test(match[1]),'No remote CSS resource');ok(fs.existsSync(path.join(app,match[1])),'Local font path '+match[1]);
}
const dataContext={window:{}};vm.createContext(dataContext);vm.runInContext(read('practice-data.js'),dataContext);
eq(dataContext.window.PRACTICE_DATA.length,22,'22 lessons');
eq(dataContext.window.PRACTICE_DATA.reduce((s,l)=>s+l.questions.length,0),70,'70 exercises, including word selection and typing');

// Exercise service-worker lifecycle/fetch handlers without a browser or a network.
const handlers={},cacheStore=new Map(),deleted=[],network=[],messages=[];
const scope='https://example.test/tools/slavonic/';
const editor={id:'editor',type:'window',url:scope,postMessage:message=>messages.push(message.status)};
const self={registration:{scope},clients:{claim:async()=>messages.push('claim'),matchAll:async()=>[editor]},skipWaiting:async()=>messages.push('skipWaiting'),addEventListener:(name,fn)=>handlers[name]=fn};
const cache={addAll:async reqs=>{for(const req of reqs)cacheStore.set(req.url,{asset:req.url});},match:async key=>cacheStore.get(typeof key==='string'?key:key.url)};
const caches={open:async()=>cache,keys:async()=>['unrelated-app-v1','slavonic-web:https://example.test/another/:old','slavonic-web:'+scope+':old','slavonic-web:'+scope+':'+report.cacheVersion],delete:async key=>{deleted.push(key);return true;}};
const context={self,caches,URL,Request,Set,fetch:async req=>{network.push(req.url);return{network:req.url};}};
vm.createContext(context);vm.runInContext(read('sw.js'),context);
let install;handlers.install({waitUntil:p=>install=p});await install;
eq(cacheStore.size,report.precache.length,'Atomic install includes all runtime assets');
eq(messages.length,0,'Update does not activate automatically at install');
let activation;handlers.activate({waitUntil:p=>activation=p});await activation;
eq(deleted,[],'Activation retains the prior release cache');
eq(messages,[],'Update does not claim uncontrolled pages from other versions');
for(const url of [scope,scope+'index.html?open=1',scope+'spell-data.js',scope+'slovar-data.js?version=1',scope+'fonts/Ponomar-Regular.otf',scope+'dictionary-popup.css',scope+'rule-popup.js',scope+'rule-popup.css']){
 let response;handlers.fetch({request:{url,method:'GET',mode:/\.(js|otf|css)/.test(url)?'cors':'navigate'},respondWith:p=>response=p});
 ok(response,'App fetch handled');ok((await response).asset,'App content available offline');
}
eq(network,[],'No network needed after precache');
for(const request of [{url:'https://azbyka.ru/book',method:'GET',mode:'navigate'},{url:'https://example.test/elsewhere.js',method:'GET',mode:'cors'},{url:scope+'not-an-asset',method:'GET',mode:'cors'},{url:scope+'index.html',method:'POST',mode:'cors'}]){
 let handled=false;handlers.fetch({request,respondWith:()=>handled=true});eq(handled,false,'Unrelated request is not intercepted');
}
handlers.message({data:{type:'OTHER'}});eq(messages.includes('skipWaiting'),false,'Only explicit activation message changes worker');
let accepted;handlers.message({data:{type:'ACTIVATE_UPDATE',requestId:1},source:editor,waitUntil:p=>accepted=p});await accepted;
eq(messages.slice(-2),['accepted','skipWaiting'],'Only the remaining window can activate an explicit update');

// Exercise install/update controls and verify storage failure blocks reload.
function fakeElement(){return{hidden:true,disabled:false,textContent:'',events:{},children:[],setAttribute(){},append(...nodes){this.children.push(...nodes);},addEventListener(name,fn){this.events[name]=fn;}};}
async function boot({storageFails=false,controller=true,protocol='https:'}={}){
 const winEvents={},swEvents={},docEvents={},elements=[],button=fakeElement(),store=new Map([['cs-studio-practice','existing-progress'],['cs-studio-bookmarks','existing-bookmarks']]);
 const worker={messages:[],postMessage(m){this.messages.push(m);}},reg={waiting:worker,events:{},addEventListener(n,f){this.events[n]=f;},update:async()=>{}};
 const localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>{if(storageFails)throw Error('quota');store.set(k,v);}};
 const window={addEventListener:(n,f)=>winEvents[n]=f,KB:{getText:()=> 'А҆зъ есмь — несохранённый текст',setText:t=>store.set('cs-demo-editor',t)},APP:{toast(){}}};
 const document={visibilityState:'visible',getElementById:()=>button,createElement:()=>{const e=fakeElement();elements.push(e);return e;},body:{append(){}},addEventListener:(n,f)=>docEvents[n]=f};
 let reloads=0,registrations=0;
 const navigator={serviceWorker:{controller:controller?{}:null,register:async()=>{registrations++;return reg;},ready:Promise.resolve(),addEventListener:(n,f)=>swEvents[n]=f}};
 const location={protocol,hostname:'example.test',reload:()=>reloads++};
 const ctx={window,document,navigator,location,localStorage,setInterval(){},console};
 vm.createContext(ctx);vm.runInContext(read('pwa.js'),ctx);
 if(winEvents.load)await winEvents.load();
 return{button,elements,winEvents,swEvents,worker,store,get reloads(){return reloads;},get registrations(){return registrations;}};
}
const page=await boot();eq(page.button.hidden,true,'Install hidden without real prompt');
let prompted=0,prevented=0;
page.winEvents.beforeinstallprompt({preventDefault(){prevented++;},prompt:async()=>prompted++,userChoice:Promise.resolve({outcome:'dismissed'})});
eq(page.button.hidden,false,'Install shown only after real browser event');
await page.button.events.click();eq(prompted,1,'User click invokes real prompt');eq(prevented,1,'Browser event deferred');eq(page.button.hidden,true,'Consumed prompt hidden');
page.swEvents.controllerchange();eq(page.reloads,0,'Other tab update cannot reload current editor');
const [notice,label,update]=page.elements;eq(notice.hidden,false,'Waiting update disclosed');
update.events.click();eq(page.store.get('cs-demo-editor'),'А҆зъ есмь — несохранённый текст','Current editor value saved before activation');
eq(page.store.get('cs-studio-practice'),'existing-progress','Practice progress retained');
eq(page.store.get('cs-studio-bookmarks'),'existing-bookmarks','Bookmarks retained');
eq(page.worker.messages.length,1,'Activation requested after saving');
page.swEvents.message({source:page.worker,data:{type:'UPDATE_RESULT',status:'accepted',requestId:page.worker.messages[0].requestId}});
page.swEvents.controllerchange();eq(page.reloads,1,'Accepted update reloads only accepting tab');
const blocked=await boot({storageFails:true});blocked.elements[2].events.click();
eq(blocked.worker.messages.length,0,'Storage failure prevents activation');
blocked.swEvents.controllerchange();eq(blocked.reloads,0,'Storage failure prevents reload');
ok(blocked.elements[1].textContent.includes('.txt'),'Failure provides text export guidance');
const filePage=await boot({protocol:'file:'});eq(filePage.registrations,0,'file:// does not register a worker');eq(filePage.button.hidden,true,'file:// does not show install');
execFileSync(process.execPath,['--test',path.join(root,'../tests/pwa-update.test.mjs')],{stdio:'inherit'});
console.log(JSON.stringify({checks,lessons:22,exercises:70,precache:report.precache.length,cacheVersion:report.cacheVersion,result:'PASS',limits:'Static and mocked lifecycle checks; actual browser installation/offline runtime awaits manual smoke test.'},null,2));
