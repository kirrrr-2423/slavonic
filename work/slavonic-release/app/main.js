'use strict';
const {app,BrowserWindow,ipcMain,Menu,clipboard,shell,dialog,session}=require('electron');
const path=require('node:path');
const fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const {createFloatingKeyboard}=require('./floating-keyboard');
const NAME='Церковнославянский язык';
const ID='ru.slavonic.reference';
const MAC=process.platform==='darwin';
const HOME=pathToFileURL(path.join(__dirname,'index.html')).href;
app.setName(NAME);
if(process.platform==='win32')app.setAppUserModelId(ID);
let mainWindow=null;
function showMain(){if(!mainWindow||mainWindow.isDestroyed())createWindow();else{if(mainWindow.isMinimized())mainWindow.restore();mainWindow.show();mainWindow.focus();}}
const floating=createFloatingKeyboard({resourcesPath:process.resourcesPath,showMain,hideMain:()=>{if(mainWindow&&!mainWindow.isDestroyed())mainWindow.hide();}});
const allowedExternal=url=>{try{const u=new URL(url);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password;}catch{return false;}};
const openExternal=url=>{if(allowedExternal(url))return shell.openExternal(url);return Promise.resolve();};
function trusted(event){if(!mainWindow||event.sender.id!==mainWindow.webContents.id||event.senderFrame!==mainWindow.webContents.mainFrame||event.senderFrame.url.split('#')[0]!==HOME)throw new Error('Unsupported sender');}
const font=()=>fs.readFileSync(path.join(__dirname,'fonts','Ponomar-Regular.otf'));
ipcMain.handle('font:get',event=>{trusted(event);return font();});
ipcMain.handle('font:download',event=>{trusted(event);return font();});
ipcMain.handle('font:pick',async event=>{
 trusted(event);const r=await dialog.showOpenDialog(mainWindow,{title:'Файл шрифта',properties:['openFile'],filters:[{name:'Шрифты',extensions:['ttf','otf','woff','woff2']}]});
 if(r.canceled||!r.filePaths[0])return null;
 const stat=fs.statSync(r.filePaths[0]);if(stat.size>20*1024*1024)throw new Error('Font file too large');
 return fs.readFileSync(r.filePaths[0]);
});
ipcMain.handle('clip:write',(event,text)=>{trusted(event);clipboard.writeText(String(text));return true;});
ipcMain.handle('open:external',(event,url)=>{trusted(event);return openExternal(url).then(()=>true);});
ipcMain.handle('keyboard:detach',event=>{trusted(event);return floating.open();});
async function detachKeyboard(){const result=await floating.open();if(!result.ok)dialog.showMessageBox(mainWindow,{type:'info',message:result.message,buttons:['OK']});}
const send=(command,argument)=>{if(mainWindow&&!mainWindow.isDestroyed())mainWindow.webContents.send('menu',command,argument);};
function about(){return dialog.showMessageBox(mainWindow,{type:'info',title:'О программе',message:NAME+' '+app.getVersion(),detail:'Клавиатура, проверка правописания, словарь и практика.\n22 учебные темы, 66 адаптированных заданий.\nПравила: А. А. Плетнёва, А. Г. Кравецкий; А. Е. Смирнова.\nPonomar — OFL; FreeSerif — GPL с исключением; SCI — MIT.\nШрифты и словари включены в приложение.',buttons:['OK']});}
function menus(){
 const sections=[['klaviatura','Клавиатура и правописание','CmdOrCtrl+K'],['slovar','Словарь','CmdOrCtrl+D'],['practice','Практика по учебникам',null],['library','Правила и обучение',null],['tools','Инструменты',null],['saved','Закладки',null],['azbuka','Азбука','CmdOrCtrl+1'],['znaki','Надстрочные знаки','CmdOrCtrl+2'],['titla','Титла','CmdOrCtrl+3'],['cifir','Цифирь','CmdOrCtrl+4'],['grammatika','Грамматика','CmdOrCtrl+5'],['istochniki','Источники',null]];
 const menu=[];
 if(MAC)menu.push({label:NAME,submenu:[{label:'О программе',click:about},{type:'separator'},{role:'hide',label:'Скрыть'},{role:'hideOthers',label:'Скрыть остальные'},{role:'unhide',label:'Показать все'},{type:'separator'},{role:'quit',label:'Завершить'}]});
 else menu.push({label:'Файл',submenu:[{role:'quit',label:'Выход'}]});
 menu.push({label:'Правка',submenu:[{role:'undo',label:'Отменить'},{role:'redo',label:'Повторить'},{type:'separator'},{role:'cut',label:'Вырезать'},{role:'copy',label:'Копировать'},{role:'paste',label:'Вставить'},{role:'selectAll',label:'Выделить всё'},{type:'separator'},{label:'Найти правило или слово',accelerator:'CmdOrCtrl+F',click:()=>send('search')}]});
 menu.push({label:'Разделы',submenu:sections.map(([id,label,accelerator])=>({label,...(accelerator?{accelerator}:{}),click:()=>send('nav',id)}))});
 menu.push({label:'Вид',submenu:[...(MAC?[{label:'Отделить клавиатуру',accelerator:'CmdOrCtrl+Shift+K',click:detachKeyboard},{type:'separator'}]:[]),{role:'resetZoom',label:'Обычный размер'},{role:'zoomIn',label:'Увеличить'},{role:'zoomOut',label:'Уменьшить'},{type:'separator'},{role:'togglefullscreen',label:'Во весь экран'}]});
 if(MAC)menu.push({label:'Окно',submenu:[{role:'minimize',label:'Свернуть'},{role:'zoom',label:'Изменить размер'},{type:'separator'},{role:'front',label:'Все окна — на передний план'}]});
 else menu.push({label:'Справка',submenu:[{label:'О программе',click:about}]});
 Menu.setApplicationMenu(Menu.buildFromTemplate(menu));
}
function createWindow(){
 mainWindow=new BrowserWindow({width:1380,height:900,minWidth:800,minHeight:600,title:NAME,backgroundColor:'#f5f3ed',show:false,icon:MAC?undefined:path.join(__dirname,'icon.png'),autoHideMenuBar:!MAC,webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true,spellcheck:false}});
 mainWindow.once('ready-to-show',()=>mainWindow.show());
 mainWindow.webContents.on('page-title-updated',event=>event.preventDefault());
 mainWindow.webContents.setWindowOpenHandler(({url})=>{openExternal(url);return {action:'deny'};});
 mainWindow.webContents.on('will-navigate',(event,url)=>{if(url.split('#')[0]!==HOME){event.preventDefault();openExternal(url);}});
 mainWindow.webContents.on('will-attach-webview',event=>event.preventDefault());
 mainWindow.on('closed',()=>{mainWindow=null;});
 mainWindow.loadFile(path.join(__dirname,'index.html'));
}
if(!app.requestSingleInstanceLock())app.quit();
else{
 app.on('second-instance',()=>floating.attach());
 app.on('before-quit',()=>floating.quit());
 app.whenReady().then(()=>{
  session.defaultSession.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  session.defaultSession.setPermissionCheckHandler(()=>false);
  menus();createWindow();
  app.on('activate',()=>floating.attach());
 });
 app.on('window-all-closed',()=>{if(!MAC)app.quit();});
}
