'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('slavApi',{
 platform:process.platform,
 floatingKeyboard:process.platform==='darwin',
 detachKeyboard:()=>ipcRenderer.invoke('keyboard:detach'),
 getFont:()=>ipcRenderer.invoke('font:get'),
 downloadFont:()=>ipcRenderer.invoke('font:download'),
 pickFont:()=>ipcRenderer.invoke('font:pick'),
 copy:text=>ipcRenderer.invoke('clip:write',text),
 openExternal:url=>ipcRenderer.invoke('open:external',url),
 onMenu:callback=>{ipcRenderer.on('menu',(_event,command,argument)=>callback(command,argument));}
});
