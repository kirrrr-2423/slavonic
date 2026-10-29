/* Перенос прежнего текста и настроек в новые ключи, без удаления оригиналов. */
(() => {
 try{
  for(const key of Object.keys(localStorage)){
   if(/^cs-(?!demo-|studio-)/.test(key)){
    const next='cs-demo-'+key.slice(3);
    if(localStorage.getItem(next)===null)localStorage.setItem(next,localStorage.getItem(key));
   }
  }
 }catch{}
})();
