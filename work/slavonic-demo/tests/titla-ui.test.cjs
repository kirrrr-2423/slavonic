const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = path.resolve(__dirname, '../../..', 'outputs/slavonic-demo');
function boot(text) {
  const elements = new Map(), messages = [], values = new Map([['cs-demo-tc-dir', 'expand'], ['cs-demo-tc-text', text]]);
  const element = id => {
    if (!elements.has(id)) elements.set(id, {value:'',checked:false,dataset:{},events:{},setAttribute(){},classList:{toggle(){}},addEventListener(name,fn){this.events[name]=fn;},focus(){},setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end;}});
    return elements.get(id);
  };
  const ctx = {window:{},setTimeout:()=>1,clearTimeout(){},Event:class{},
    $:selector=>element(selector), $$:()=>[], DICT:()=>null, toast:message=>messages.push(message),
    esc:s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
    store:{get:(key,fallback)=>values.get(key)??fallback,set:(key,value)=>values.set(key,value)}
  };
  ctx.window.KB={attachLayout(){},insertInto(input,value){input.value=input.value.slice(0,input.selectionStart)+value+input.value.slice(input.selectionEnd);input.events.input();}};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(source,'titla.js'),'utf8'),ctx);
  const app=fs.readFileSync(path.join(source,'app.js'),'utf8');
  vm.runInContext(app.slice(app.indexOf('  const TC_SAMPLE'),app.indexOf('  function numTableHTML')),ctx);
  ctx.bindTitlaConv();
  const choose=index=>element('#tcInfo').events.click({target:{closest:()=>({dataset:{tcExpand:String(index)}})}});
  return {element,choose,messages,values,ctx};
}
test('converter discloses ambiguous numeric readings and preserves source/output by default',()=>{
  const page=boot('с҃н сн҃а ҂а҃');
  assert.equal(page.element('#tcIn').value,'с҃н сн҃а ҂а҃');
  assert.equal(page.element('#tcOut').innerHTML,'с҃н сн҃а ҂а҃');
  const info=page.element('#tcInfo').innerHTML;
  assert.match(info,/Числовые записи сохранены: 3/);
  assert.match(info,/число 250/);
  assert.match(info,/число 251/);
  assert.equal((info.match(/data-tc-expand=/g)||[]).length,2);
});
test('explicit word choice resolves only the selected occurrence and saves the edit',()=>{
  const page=boot('с҃н сн҃а ҂а҃');
  page.choose(0);
  assert.equal(page.element('#tcIn').value,'сы́н сн҃а ҂а҃');
  assert.equal(page.values.get('cs-demo-tc-text'),'сы́н сн҃а ҂а҃');
  assert.match(page.element('#tcInfo').innerHTML,/число 251/);
  assert.doesNotMatch(page.element('#tcInfo').innerHTML,/число 250/);
});
test('a stale word choice cannot replace a changed source range',()=>{
  const page=boot('с҃н');
  page.element('#tcIn').value='а с҃н';
  page.choose(0);
  assert.equal(page.element('#tcIn').value,'а с҃н');
  assert.equal(page.messages.length,1);
  assert.match(page.messages[0],/Текст изменился/);
});
