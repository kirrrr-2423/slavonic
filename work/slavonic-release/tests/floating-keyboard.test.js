'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const path=require('node:path');
const {createFloatingKeyboard}=require('../app/floating-keyboard');

function harness(options={}){
 const calls={spawn:[],hide:0,show:0},children=[];
 const manager=createFloatingKeyboard({
  resourcesPath:'/Example.app/Contents/Resources',platform:'darwin',
  exists:()=>true,showMain:()=>calls.show++,hideMain:()=>calls.hide++,
  spawnHelper:(...args)=>{
   calls.spawn.push(args);
   const child=new EventEmitter();
   child.stdout=new EventEmitter();
   child.killCount=0;
   child.kill=()=>{child.killCount++;return true;};
   child.event=value=>child.stdout.emit('data',Buffer.from(JSON.stringify({event:value})+'\n'));
   children.push(child);return child;
  },...options
 });
 return {manager,calls,children};
}

test('unsupported platform or missing helper never starts a process',async()=>{
 for(const options of [{platform:'win32'},{exists:()=>false}]){
  const h=harness(options);
  assert.equal(h.manager.available(),false);
  assert.equal((await h.manager.open()).ok,false);
  assert.equal(h.calls.spawn.length,0);
  assert.equal(h.calls.hide,0);
 }
});

test('repeated opening shares one startup and fixed non-shell executable',async()=>{
 const h=harness();
 const first=h.manager.open(),second=h.manager.open();
 assert.equal(first,second);
 assert.equal(h.calls.hide,0);
 assert.equal(h.calls.spawn.length,1);
 assert.deepEqual(h.calls.spawn[0],[
  path.normalize('/Example.app/Contents/Helpers/SlavonicFloatingKeyboard.app/Contents/MacOS/SlavonicFloatingKeyboard'),
  ['--events-stdio'],{stdio:['ignore','pipe','ignore'],shell:false}
 ]);
 h.children[0].stdout.emit('data',Buffer.from('{"event":"rea'));
 assert.equal(h.calls.hide,0);
 h.children[0].stdout.emit('data',Buffer.from('dy"}\n'));
 assert.deepEqual(await first,{ok:true});
 assert.equal(h.calls.hide,1);
 assert.deepEqual(await h.manager.open(),{ok:true});
 assert.equal(h.calls.spawn.length,1);
 assert.equal(h.calls.hide,2);
 h.manager.quit();
});

test('attach restores main once, ignores old process exit, and permits reopening',async()=>{
 const h=harness();
 const opened=h.manager.open();
 const first=h.children[0];first.event('ready');await opened;
 first.event('attach');
 assert.equal(first.killCount,1);
 assert.equal(h.calls.show,1);
 first.emit('exit',0);
 assert.equal(h.calls.show,1);
 const next=h.manager.open();
 assert.equal(h.calls.spawn.length,2);
 h.children[1].event('ready');
 assert.deepEqual(await next,{ok:true});
 h.manager.quit();
 assert.equal(h.children[1].killCount,1);
});

test('startup error restores main and next opening starts fresh',async()=>{
 const h=harness();
 const first=h.manager.open();
 h.children[0].emit('error',new Error('failed to execute'));
 assert.equal((await first).ok,false);
 assert.equal(h.calls.show,1);
 h.children[0].emit('exit',1);
 assert.equal(h.calls.show,1);
 const next=h.manager.open();
 h.children[1].event('ready');
 assert.equal((await next).ok,true);
 h.manager.quit();
});

test('synchronous spawn failure resolves and remains retryable',async()=>{
 let attempts=0;
 const h=harness({spawnHelper:()=>{attempts++;throw new Error('spawn failed');}});
 assert.equal((await h.manager.open()).ok,false);
 assert.equal((await h.manager.open()).ok,false);
 assert.equal(attempts,2);
 assert.equal(h.calls.hide,0);
});

test('startup timeout kills helper, restores main, and ignores late exit',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const h=harness();
 const opened=h.manager.open();
 t.mock.timers.tick(10000);
 assert.equal((await opened).ok,false);
 assert.equal(h.children[0].killCount,1);
 assert.equal(h.calls.show,1);
 h.children[0].event('ready');
 h.children[0].emit('exit',1);
 assert.equal(h.calls.hide,0);
 assert.equal(h.calls.show,1);
});

test('quit during startup kills helper and never restores main',async()=>{
 const h=harness();
 const opened=h.manager.open();
 h.manager.quit();
 assert.equal(h.children[0].killCount,1);
 h.children[0].event('ready');
 h.children[0].emit('exit',0);
 assert.equal((await opened).ok,false);
 assert.equal(h.calls.hide,0);
 assert.equal(h.calls.show,0);
});

test('oversized helper output after ready restores the hidden main window',async()=>{
 const h=harness();
 const opened=h.manager.open();
 h.children[0].event('ready');
 await opened;
 assert.equal(h.calls.hide,1);
 h.children[0].stdout.emit('data',Buffer.from('x'.repeat(8193)));
 assert.equal(h.children[0].killCount,1);
 assert.equal(h.calls.show,1);
});

test('late stdout from an exited helper cannot stop a replacement helper',async t=>{
 const h=harness();
 const first=h.manager.open();
 const old=h.children[0];old.event('ready');await first;
 old.emit('exit',1);
 const next=h.manager.open();
 const current=h.children[1];
 t.after(()=>{current.emit('exit',0);h.manager.quit();});
 old.stdout.emit('data',Buffer.from('x'.repeat(8193)));
 assert.equal(current.killCount,0);
 current.event('ready');
 assert.equal((await next).ok,true);
 h.manager.quit();
});
