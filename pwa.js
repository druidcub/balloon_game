/* Install and update controls are progressive enhancements; file:// play still works. */
(() => {
  'use strict';
  const installButton=document.getElementById('install-game'),updateButton=document.getElementById('update-game');
  let installPrompt=null,registration=null,reloadForUpdate=false;
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;installButton.hidden=false;});
  window.addEventListener('appinstalled',()=>{installPrompt=null;installButton.hidden=true;});
  installButton.addEventListener('click',async()=>{
    if(!installPrompt)return;const prompt=installPrompt;installPrompt=null;installButton.hidden=true;
    try{await prompt.prompt();await prompt.userChoice;}catch(error){console.info('安裝提示目前無法使用。');}
  });
  if(!('serviceWorker' in navigator)||!['http:','https:'].includes(location.protocol))return;
  updateButton.addEventListener('click',()=>{if(registration?.waiting){reloadForUpdate=true;registration.waiting.postMessage({type:'SKIP_WAITING'});}});
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloadForUpdate)location.reload();});
  window.addEventListener('load',async()=>{
    try{
      registration=await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});
      const showUpdate=()=>{if(registration.waiting&&navigator.serviceWorker.controller)updateButton.hidden=false;};
      showUpdate();registration.addEventListener('updatefound',()=>{const worker=registration.installing;if(worker)worker.addEventListener('statechange',()=>{if(worker.state==='installed')showUpdate();});});
    }catch(error){console.info('離線快取尚未啟用；目前仍可在線遊玩。');}
  });
})();
