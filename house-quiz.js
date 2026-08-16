const PM_FILES=['001-050','051-100','101-150','151-200','201-250','251-300'];
let pmQuizNotions=null;
let pmQuizValidated=false;
let pmQuizContext=null;

const pmNorm=s=>(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’']/g,' ').replace(/[^a-z0-9%€]+/g,' ').trim().replace(/\s+/g,' ');
const PM_STOP=new Set('a au aux avec ce ces cet cette dans de des du elle en et est il ils la le les leur leurs mais ne nos notre ou par pas pour que qui sa se ses son sur un une vos votre d être avoir comme entre plus moins selon afin ainsi notamment dont lors vers après avant tout tous toute toutes'.split(' '));
const pmStem=w=>w.replace(/(issements?|ements?|ations?|itions?|iques?|ique|euses?|eurs?|eure|ables?|ible|ives?|ifs?|aux|eaux|ées?|es|s)$/,'');
const pmWords=s=>pmNorm(s).split(' ').filter(w=>w.length>=4&&!PM_STOP.has(w)).map(pmStem).filter(w=>w.length>=3);

function pmTermCheck(input,term){
  const a=pmNorm(input), full=pmNorm(term), base=pmNorm(term.replace(/\s*\([^)]*\)/g,''));
  const acronyms=[...term.matchAll(/\(([^)]+)\)/g)].map(m=>pmNorm(m[1]));
  return !!a && (a===full || a===base || acronyms.includes(a));
}
function pmDefinitionCheck(input,reference){
  const answer=[...new Set(pmWords(input))], ref=[...new Set(pmWords(reference))];
  if(!answer.length||!ref.length)return{ok:false,score:0,missing:ref.slice(0,6)};
  const matched=ref.filter(r=>answer.some(a=>a===r || (a.length>=5&&r.length>=5&&(a.startsWith(r)||r.startsWith(a)))));
  const score=matched.length/ref.length;
  const minLen=pmNorm(input).split(' ').length;
  const threshold=ref.length<=5?.5:.42;
  return{ok:score>=threshold&&minLen>=4,score,missing:ref.filter(r=>!matched.includes(r)).slice(0,6)};
}
function pmLoadNotions(){
  if(pmQuizNotions)return Promise.resolve(pmQuizNotions);
  return Promise.all(PM_FILES.map(f=>fetch(`./data/notions-${f}.json?v=4`).then(r=>r.json()))).then(all=>{
    pmQuizNotions=new Map(all.flat().map(r=>[Number(r[0]),{id:Number(r[0]),term:r[1],definition:r[2],emoji:r[5],mnemonic:r[6],link:r[7]}]));
    return pmQuizNotions;
  });
}
function pmSetProgress(id,status){
  const all=JSON.parse(localStorage.getItem('pm-progress')||'{}');
  const old=all[id]||{status:'new',next:0,good:0,bad:0};
  if(status==='mastered')all[id]={...old,status:'mastered',good:(old.good||0)+1,next:Date.now()+604800000};
  else all[id]={...old,status};
  localStorage.setItem('pm-progress',JSON.stringify(all));
}
function pmSpeak(text){
  if(!('speechSynthesis' in window))return;
  speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(text);u.lang='fr-FR';u.rate=1;speechSynthesis.speak(u);
}
function pmCloseQuiz(reload=false){
  document.querySelector('.pm-quiz-backdrop')?.remove();
  if(reload&&pmQuizContext){
    sessionStorage.setItem('pm-restore-room',JSON.stringify(pmQuizContext));
    location.reload();
  }
}
function pmRestoreRoom(){
  const raw=sessionStorage.getItem('pm-restore-room');
  if(!raw)return;
  sessionStorage.removeItem('pm-restore-room');
  let ctx;try{ctx=JSON.parse(raw)}catch{return}
  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    const room=document.querySelector(`[data-room="${CSS.escape(ctx.room)}"]`);
    if(room){room.click();clearInterval(timer);return}
    const floor=document.querySelector(`[data-floor="${CSS.escape(ctx.floor)}"]`);
    if(floor)floor.click();
    if(tries>50)clearInterval(timer);
  },80);
}
function pmCorrectionHTML(n){return `<div class="pm-correction"><div class="pm-correction-title">Réponse de référence</div><h2>${pmEsc(n.term)}</h2><div class="pm-ref-definition">${pmEsc(n.definition)}</div><div class="pm-mnemo"><span>${pmEsc(n.emoji||'🧠')}</span><div><b>${pmEsc(n.mnemonic||'Association mnémotechnique')}</b><small>${pmEsc(n.link||'')}</small></div></div><button class="secondary pm-speak-answer">🔊 Lire le mot et la définition</button></div>`}
const pmEsc=s=>(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

function pmOpenQuiz(n,button){
  pmQuizValidated=false;
  const roomName=button.closest('.room-scene')?.querySelector('.room-name-plate')?.textContent?.trim()||'';
  const floorButton=document.querySelector('.floor-tabs .active');
  pmQuizContext={room:roomName,floor:(floorButton?.textContent||'').replace(/^[^A-Za-zÀ-ÿ]+/,'').trim()};
  const locus=button.querySelector('.furniture-label')?.textContent?.trim()||'Objet';
  const icon=button.querySelector('.furniture-icon')?.textContent||'📍';
  const already=(JSON.parse(localStorage.getItem('pm-progress')||'{}')[n.id]||{}).status==='mastered';
  const el=document.createElement('div');el.className='pm-quiz-backdrop';
  el.innerHTML=`<div class="pm-quiz-modal"><div class="pm-quiz-head"><div><span class="pill">#${n.id} · ${already?'🟢 déjà validée':'à valider'}</span><h2>${icon} ${pmEsc(locus)}</h2><p>Retrouve d’abord le <b>mot</b>, puis sa <b>définition</b>. La réponse reste cachée.</p></div><button class="icon-btn pm-close">✕</button></div><div class="pm-quiz-form"><label>1. Quel est le mot / la notion ?<input class="pm-term-input" autocomplete="off" autocapitalize="sentences" placeholder="Écris le mot associé à cet objet…"></label><label>2. Donne sa définition<textarea class="pm-definition-input" placeholder="Écris la définition avec tes mots…"></textarea></label><button class="primary pm-check">✓ Vérifier mes deux réponses</button><div class="pm-feedback" aria-live="polite"></div><button class="secondary pm-show-correction hidden">Voir la correction sans valider</button><div class="pm-answer-zone"></div></div></div>`;
  document.body.appendChild(el);
  el.querySelector('.pm-term-input').focus();
  el.querySelector('.pm-close').onclick=()=>pmCloseQuiz(pmQuizValidated);
  el.onclick=e=>{if(e.target===el)pmCloseQuiz(pmQuizValidated)};
  el.querySelector('.pm-check').onclick=()=>{
    const termInput=el.querySelector('.pm-term-input').value;
    const defInput=el.querySelector('.pm-definition-input').value;
    const termOk=pmTermCheck(termInput,n.term);
    const d=pmDefinitionCheck(defInput,n.definition);
    const feedback=el.querySelector('.pm-feedback');
    if(termOk&&d.ok){
      pmQuizValidated=true;pmSetProgress(n.id,'mastered');
      button.classList.remove('new','learning','fragile');button.classList.add('mastered','pm-just-validated');
      feedback.className='pm-feedback success';
      feedback.innerHTML=`<b>✅ Objet validé !</b><span>Mot correct · définition suffisamment complète (${Math.round(d.score*100)} % des éléments-clés retrouvés).</span>`;
      el.querySelector('.pm-answer-zone').innerHTML=pmCorrectionHTML(n);
      el.querySelector('.pm-show-correction').classList.add('hidden');
      el.querySelector('.pm-check').textContent='✓ Validé';el.querySelector('.pm-check').disabled=true;
      el.querySelector('.pm-speak-answer')?.addEventListener('click',()=>pmSpeak(`${n.term}. ${n.definition}`));
    }else{
      pmSetProgress(n.id,'fragile');
      feedback.className='pm-feedback retry';
      const termLine=termOk?'✅ Mot correct':'❌ Mot à revoir';
      const defLine=d.ok?`✅ Définition correcte (${Math.round(d.score*100)} %)`:`🟠 Définition à compléter (${Math.round(d.score*100)} % des éléments-clés)`;
      feedback.innerHTML=`<b>Pas encore validé</b><span>${termLine}</span><span>${defLine}</span>${!d.ok&&d.missing.length?`<small>Quelques idées importantes à retrouver : ${d.missing.map(pmEsc).join(', ')}.</small>`:''}`;
      el.querySelector('.pm-show-correction').classList.remove('hidden');
    }
  };
  el.querySelector('.pm-show-correction').onclick=()=>{
    el.querySelector('.pm-answer-zone').innerHTML=pmCorrectionHTML(n);
    el.querySelector('.pm-speak-answer')?.addEventListener('click',()=>pmSpeak(`${n.term}. ${n.definition}`));
  };
}

document.addEventListener('click',async e=>{
  const furniture=e.target.closest?.('.room-scene .furniture[data-n]');
  if(!furniture)return;
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
  try{
    const notions=await pmLoadNotions();
    const n=notions.get(Number(furniture.dataset.n));
    if(n)pmOpenQuiz(n,furniture);
  }catch(err){console.error(err);alert('Impossible de charger la notion pour le moment.');}
},true);

window.addEventListener('DOMContentLoaded',pmRestoreRoom);
setTimeout(pmRestoreRoom,250);
