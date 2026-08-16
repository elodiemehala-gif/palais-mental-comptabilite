let deferredInstallPrompt=null;

function isStandalone(){
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone===true;
}

function ensureInstallButton(){
  if(isStandalone() || !deferredInstallPrompt || document.getElementById('pm-install-app'))return;
  const button=document.createElement('button');
  button.id='pm-install-app';
  button.type='button';
  button.textContent='📱 Installer l’application';
  button.setAttribute('aria-label','Installer Palais mental sur ce téléphone');
  Object.assign(button.style,{
    position:'fixed',right:'14px',bottom:'18px',zIndex:'180',
    border:'1px solid rgba(255,255,255,.18)',borderRadius:'999px',
    background:'#f6b94f',color:'#241238',fontWeight:'900',
    padding:'12px 16px',boxShadow:'0 12px 34px rgba(0,0,0,.35)',
    fontSize:'14px',cursor:'pointer'
  });
  button.addEventListener('click',async()=>{
    if(!deferredInstallPrompt)return;
    deferredInstallPrompt.prompt();
    try{await deferredInstallPrompt.userChoice;}catch{}
    deferredInstallPrompt=null;
    button.remove();
  });
  document.body.appendChild(button);
}

window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();
  deferredInstallPrompt=event;
  ensureInstallButton();
});

window.addEventListener('appinstalled',()=>{
  deferredInstallPrompt=null;
  document.getElementById('pm-install-app')?.remove();
});

window.addEventListener('DOMContentLoaded',()=>{
  if(isStandalone())document.documentElement.classList.add('pwa-standalone');
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('./sw.js').catch(err=>console.warn('Service worker',err));
  }
});
