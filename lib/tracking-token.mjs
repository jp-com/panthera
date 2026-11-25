import {createHmac,timingSafeEqual} from 'node:crypto';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KEY=/^[a-f0-9]{64}$/i;
const LIFETIME=180*24*60*60;
export function trackingReady(key){return typeof key==='string'&&KEY.test(key)}
function signature(data,key){return createHmac('sha256',Buffer.from(key,'hex')).update('panthera:order-status:v1:'+data).digest()}
export function issueTrackingToken(id,key,now=Math.floor(Date.now()/1000)){
 if(typeof id!=='string'||!UUID.test(id)||!trackingReady(key)||!Number.isSafeInteger(now)||now<0)throw Error('Invalid tracking configuration');
 const data=id.toLowerCase()+'.'+(now+LIFETIME);
 return data+'.'+signature(data,key).toString('base64url');
}
export function verifyTrackingToken(token,key,now=Math.floor(Date.now()/1000)){
 if(!trackingReady(key)||typeof token!=='string'||token.length>110||!Number.isSafeInteger(now))return null;
 const parts=token.split('.');
 if(parts.length!==3||!UUID.test(parts[0])||!/^\d{1,12}$/.test(parts[1])||! /^[A-Za-z0-9_-]{43}$/.test(parts[2]))return null;
 const exp=Number(parts[1]);
 if(!Number.isSafeInteger(exp)||exp<=now||exp>now+LIFETIME)return null;
 const received=Buffer.from(parts[2],'base64url'),expected=signature(parts[0]+'.'+parts[1],key);
 if(received.length!==expected.length||received.toString('base64url')!==parts[2]||!timingSafeEqual(received,expected))return null;
 return parts[0];
}
