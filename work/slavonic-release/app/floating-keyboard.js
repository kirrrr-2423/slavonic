'use strict';
// The renderer can only open this fixed, bundled helper; it cannot send OS input.
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');

function createFloatingKeyboard({resourcesPath,platform=process.platform,showMain,hideMain,spawnHelper=spawn,exists=fs.existsSync}){
 const executable=path.join(resourcesPath,'..','Helpers','SlavonicFloatingKeyboard.app','Contents','MacOS','SlavonicFloatingKeyboard');
 let child=null,pending=null,quitting=false;
 const available=()=>platform==='darwin'&&exists(executable);
 function stop(){const process=child;child=null;if(process)process.kill();}
 function attach(){stop();if(!quitting)showMain();}
 function open(){
  if(!available())return Promise.resolve({ok:false,message:'Плавающая клавиатура доступна в новой сборке приложения для macOS.'});
  if(pending)return pending;
  if(child){hideMain();return Promise.resolve({ok:true});}
  const result=new Promise(resolve=>{
   let settled=false,buffer='',timer;
   const finish=result=>{if(settled)return;settled=true;clearTimeout(timer);resolve(result);};
   let process;
   try{process=spawnHelper(executable,['--events-stdio'],{stdio:['ignore','pipe','ignore'],shell:false});}
   catch{finish({ok:false,message:'Не удалось открыть плавающую клавиатуру.'});return;}
   child=process;
   const failed=()=>{
    if(child===process){child=null;if(!quitting)showMain();}
    finish({ok:false,message:'Плавающая клавиатура завершилась. Откройте её ещё раз.'});
   };
   process.once('error',failed);
   process.once('exit',failed);
   process.stdout.on('data',chunk=>{
    if(child!==process)return;
    buffer+=chunk.toString('utf8');
    if(buffer.length>8192){failed();process.kill();return;}
    let newline;
    while((newline=buffer.indexOf('\n'))!==-1){
     const line=buffer.slice(0,newline);buffer=buffer.slice(newline+1);
     let event;try{event=JSON.parse(line).event;}catch{continue;}
     if(child!==process)continue;
     if(event==='ready'){hideMain();finish({ok:true});}
     else if(event==='attach'||event==='closed'){attach();finish({ok:true});}
    }
   });
   timer=setTimeout(()=>{stop();if(!quitting)showMain();finish({ok:false,message:'Клавиатура не ответила. Попробуйте открыть её ещё раз.'});},10000);
  });
  pending=result.finally(()=>{pending=null;});
  return pending;
 }
 return {available,open,attach,quit(){quitting=true;stop();}};
}
module.exports={createFloatingKeyboard};
