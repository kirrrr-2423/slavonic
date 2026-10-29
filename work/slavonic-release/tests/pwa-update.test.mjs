import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../web');
const template=fs.readFileSync(path.join(root,'sw-template.js'),'utf8');
const pwa=fs.readFileSync(path.join(root,'pwa.js'),'utf8');
const scope='https://example.test/tools/slavonic/';
const prefix='slavonic-web:'+scope+':';
const assets=['index.html','slovar-data.js'];
function cacheStorage(){
 const stores=new Map(),deleted=[];
 return {stores,deleted,
  async open(name){
   if(!stores.has(name))stores.set(name,new Map());
   const map=stores.get(name);
   return {addAll:async requests=>{for(const request of requests)map.set(request.url,{asset:request.url,release:name.slice(name.lastIndexOf(':')+1)});},match:async key=>map.get(typeof key==='string'?key:key.url)};
  },
  keys:async()=>[...stores.keys()],
  delete:async name=>{deleted.push(name);return stores.delete(name);}
 };
}
function worker(version,{caches=cacheStorage(),clients=()=>[]}={}){
 const handlers={},events=[],network=[];
 const self={registration:{scope},clients:{matchAll:async options=>{assert.deepEqual(JSON.parse(JSON.stringify(options)),{type:'window',includeUncontrolled:true});return clients();},claim:async()=>events.push('claim')},skipWaiting:async()=>events.push('skipWaiting'),addEventListener:(name,handler)=>handlers[name]=handler};
 vm.runInNewContext(template.replace('__ASSET_HASH__',version).replace('__PRECACHE__',JSON.stringify(assets)),{self,caches,URL,Request,Set,fetch:async request=>{network.push(request.url);throw Error('offline');}});
 async function lifecycle(name){let pending;handlers[name]({waitUntil:value=>pending=value});await pending;}
 async function message(source,data={type:'ACTIVATE_UPDATE',requestId:1}){let pending;handlers.message({source,data,waitUntil:value=>pending=value});await pending;}
 async function fetchAsset(name){let pending;handlers.fetch({request:{url:scope+name,method:'GET',mode:'cors'},respondWith:value=>pending=value});return await pending;}
 return {handlers,events,network,caches,lifecycle,message,fetchAsset};
}
function client(id,url=scope){
 return {id,url,type:'window',messages:[],postMessage(message){this.messages.push(JSON.parse(JSON.stringify(message)));}};
}
function element(){return{hidden:true,disabled:false,textContent:'',events:{},setAttribute(){},append(){},addEventListener(name,handler){this.events[name]=handler;}};}
async function page({text='А҆зъ есмь',storageFails=false,readbackFails=false,postMessage}={}){
 const events={},swEvents={},elements=[],button=element(),store=new Map([['cs-studio-practice','progress'],['cs-studio-bookmarks','bookmarks']]);
 const waiting={messages:[],postMessage(message){this.messages.push(message);postMessage?.(message);}};
 let reloads=0,currentText=text;
 const registration={waiting,addEventListener(){},update:async()=>{}};
 const window={addEventListener:(name,handler)=>events[name]=handler,KB:{getText:()=>currentText,setText:value=>{currentText=value;}},APP:{toast(){}}};
 const document={getElementById:()=>button,createElement:()=>{const item=element();elements.push(item);return item;},body:{append(){}},addEventListener(){},visibilityState:'visible'};
 const navigator={serviceWorker:{controller:{},ready:Promise.resolve(),register:async()=>registration,addEventListener:(name,handler)=>swEvents[name]=handler}};
 const localStorage={getItem:key=>readbackFails&&key==='cs-demo-editor'?'different value':store.get(key)??null,setItem:(key,value)=>{if(storageFails)throw Error('quota');store.set(key,value);}};
 vm.runInNewContext(pwa,{window,document,navigator,localStorage,location:{protocol:'https:',hostname:'example.test',reload:()=>reloads++},setInterval(){}});
 await events.load();
 return {swEvents,waiting,store,notice:elements[0],label:elements[1],update:elements[2],dismiss:elements[3],get text(){return currentText;},set text(value){currentText=value;},get reloads(){return reloads;},reply(status,requestId=waiting.messages.at(-1)?.requestId,source=waiting){swEvents.message({source,data:{type:'UPDATE_RESULT',status,requestId}});}};
}

test('two releases: another window choosing Later keeps the entire old release active',async()=>{
 const first=client('first'),later=client('later');
 const caches=cacheStorage();
 const old=worker('v1',{caches});await old.lifecycle('install');
 const next=worker('v2',{caches,clients:()=>[first,later]});await next.lifecycle('install');
 const p=await page(),other=await page({text:'Не сохранённый текст другой вкладки'});
 other.dismiss.events.click();
 assert.equal(other.notice.hidden,true);
 p.update.events.click();
 first.postMessage=message=>{first.messages.push(message);p.reply(message.status,message.requestId);};
 await next.message(first,p.waiting.messages[0]);
 assert.deepEqual(next.events,[]);
 assert.equal((await old.fetchAsset('slovar-data.js')).release,'v1');
 assert.ok(caches.stores.has(prefix+'v1'));
 assert.equal(p.label.textContent,'Закройте другие окна приложения и повторите обновление.');
 assert.equal(p.update.disabled,false);
 p.swEvents.controllerchange();other.swEvents.controllerchange();
 assert.equal(p.reloads,0);assert.equal(other.reloads,0);
 assert.equal(other.text,'Не сохранённый текст другой вкладки');
 assert.deepEqual(old.network,[]);
});

test('closing the other app window permits a manual retry and saves the latest draft again',async()=>{
 const first=client('first'),later=client('later');let windows=[first,later];
 const next=worker('v2',{clients:()=>windows});
 const p=await page();
 first.postMessage=message=>p.reply(message.status,message.requestId);
 p.update.events.click();await next.message(first,p.waiting.messages.at(-1));
 windows=[first,client('unrelated','https://example.test/another-app/')];
 p.text='Последняя правка перед повтором';
 p.update.events.click();await next.message(first,p.waiting.messages.at(-1));
 assert.deepEqual(next.events,['skipWaiting']);
 assert.equal(p.store.get('cs-demo-editor'),'Последняя правка перед повтором');
 assert.equal(p.store.get('cs-studio-practice'),'progress');
 assert.equal(p.store.get('cs-studio-bookmarks'),'bookmarks');
 p.swEvents.controllerchange();assert.equal(p.reloads,1);
});

test('a second window opening between both client checks blocks activation',async()=>{
 const first=client('first'),late=client('late');let snapshots=0;
 const next=worker('v2',{clients:()=>++snapshots===1?[first]:[first,late]});
 await next.message(first);
 assert.equal(snapshots,2);
 assert.deepEqual(next.events,[]);
 assert.equal(first.messages[0].status,'blocked');
});

test('messages outside this app scope and messages without a window source cannot activate',async()=>{
 const next=worker('v2');
 await next.message(client('other','https://example.test/another-app/'));
 await next.message(undefined);
 await next.message(client('first'),{type:'OTHER'});
 assert.deepEqual(next.events,[]);
});

test('an unavailable client inventory refuses activation instead of assuming no other windows',async()=>{
 const first=client('first');
 const next=worker('v2',{clients:()=>{throw Error('client inventory unavailable');}});
 await next.message(first);
 assert.deepEqual(next.events,[]);
 assert.equal(first.messages[0].status,'failed');
});

test('activation bounds retention to two prior app caches and leaves other apps untouched',async()=>{
 const caches=cacheStorage();
 for(const name of ['unrelated','slavonic-web:https://example.test/other/:v0',prefix+'v0',prefix+'v1',prefix+'v2'])await caches.open(name);
 const next=worker('v3',{caches});await next.lifecycle('install');await next.lifecycle('activate');
 assert.deepEqual(caches.deleted,[prefix+'v0']);
 assert.ok(caches.stores.has(prefix+'v1'));assert.ok(caches.stores.has(prefix+'v2'));
 assert.ok(caches.stores.has('unrelated'));assert.ok(caches.stores.has('slavonic-web:https://example.test/other/:v0'));
 assert.deepEqual(next.events,[],'Upgrades do not claim uncontrolled pages');
 const fresh=worker('first');await fresh.lifecycle('install');await fresh.lifecycle('activate');
 assert.deepEqual(fresh.events,['claim']);
});

test('quota/readback failures still prevent activation and reload',async()=>{
 for(const options of [{storageFails:true},{readbackFails:true}]){
  const p=await page(options);
  p.update.events.click();p.swEvents.controllerchange();
  assert.equal(p.waiting.messages.length,0);assert.equal(p.reloads,0);
  assert.ok(p.label.textContent.includes('.txt'));
 }
});

test('stale replies and replies from another worker do not accept or cancel the current request',async()=>{
 const p=await page();p.update.events.click();
 const firstRequest=p.waiting.messages.at(-1).requestId;
 p.reply('blocked');p.update.events.click();
 p.reply('blocked',firstRequest);
 assert.equal(p.update.disabled,true);
 p.reply('blocked',p.waiting.messages.at(-1).requestId,{});
 assert.equal(p.update.disabled,true);
 p.reply('failed');p.swEvents.controllerchange();
 assert.equal(p.update.disabled,false);assert.equal(p.reloads,0);
});

test('failed worker messaging permits a new explicit attempt without reloading',async()=>{
 const p=await page({postMessage:()=>{throw Error('worker gone');}});
 p.update.events.click();p.swEvents.controllerchange();
 assert.equal(p.reloads,0);assert.equal(p.update.disabled,false);
 assert.equal(p.label.textContent,'Не удалось начать обновление. Повторите попытку.');
});
