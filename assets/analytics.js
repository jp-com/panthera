import {marketingEvent,marketingAllowed} from './analytics-rules.mjs';
const KEY='panthera-marketing-consent-v1';
let config=null,consent='unknown',loaded=false,viewed=false;
try{const saved=localStorage.getItem(KEY);if(['accepted','declined'].includes(saved))consent=saved}catch{}
function permitted(){return marketingAllowed(config,consent)&&navigator.globalPrivacyControl!==true}
function init(){
 if(!permitted()||loaded)return;
 loaded=true;
 if(!window.fbq){
  const fbq=function(){fbq.callMethod?fbq.callMethod.apply(fbq,arguments):fbq.queue.push(arguments)};
  window.fbq=fbq;window._fbq=fbq;fbq.push=fbq;fbq.loaded=true;fbq.version='2.0';fbq.queue=[];
 }
 window.fbq('set','autoConfig',false,config.metaPixelId);
 window.fbq('consent','grant');
 window.fbq('init',config.metaPixelId);
 const script=document.createElement('script');script.async=true;script.src='https://connect.facebook.net/en_US/fbevents.js';document.head.append(script);
}
function track(name,cents,quantity){
 if(!permitted())return;
 init();
 const payload=marketingEvent(name,cents,quantity);
 if(payload===null)return;
 window.fbq('trackSingle',config.metaPixelId,name,payload);
}
function view(){
 if(viewed||!permitted())return;
 const cents=window.pantheraProductCents;
 if(!Number.isSafeInteger(cents)||cents<=0)return;
 viewed=true;track('PageView');track('ViewContent',cents,1);
}
window.pantheraAnalytics={track,view};
function choose(next){
 consent=next;try{localStorage.setItem(KEY,next)}catch{}
 if(next==='declined'){if(loaded)window.fbq('consent','revoke')}
 else if(permitted()){if(loaded)window.fbq('consent','grant');view()}
 panel.hidden=true;
}
const panel=document.createElement('section');panel.hidden=true;panel.setAttribute('aria-label','Advertising privacy preferences');panel.style.cssText='position:fixed;bottom:16px;right:16px;z-index:1000;max-width:min(390px,calc(100vw - 32px));padding:20px;background:#f2eee6;color:#201d1b;border:1px solid #c9c3b9;font:14px/1.5 Arial,sans-serif;box-shadow:0 4px 20px #0002';
const heading=document.createElement('strong');heading.textContent='Privacy preferences';const copy=document.createElement('p');copy.textContent='Allow optional advertising cookies to help us measure our advertising. You can decline and continue shopping.';
const controls=document.createElement('div');controls.style.cssText='display:flex;flex-wrap:wrap;gap:8px';
for(const [label,value] of [['Decline','declined'],['Allow advertising','accepted']]){const b=document.createElement('button');b.type='button';b.textContent=label;b.style.cssText='padding:10px 12px;border:1px solid #201d1b;background:'+(value==='accepted'?'#201d1b;color:white':'transparent;color:#201d1b')+';font:inherit;cursor:pointer';b.onclick=()=>choose(value);controls.append(b)}
panel.append(heading,copy,controls);document.body.append(panel);
const preference=document.getElementById('privacyPreferences');
if(preference)preference.onclick=()=>{panel.hidden=false};
fetch('/api/analytics-config',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(c=>{
 config=c;if(navigator.globalPrivacyControl===true){choose('declined');if(preference)preference.hidden=true;return}
 if(c?.marketingEnabled===true){if(preference)preference.hidden=false;if(consent==='unknown')panel.hidden=false;else if(consent==='accepted')view()}
}).catch(()=>{});
