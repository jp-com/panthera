import {db,json,input,quoteFrom,liveAllowed,report} from '../lib/server.mjs';
export async function POST(req){
 let x;try{x=await input(req)}catch{return json({error:'INVALID_REQUEST'},400)}
 if(!liveAllowed())return json({ok:false,code:'CHECKOUT_DISABLED'},503);
 const c=await db().connect().catch(()=>null);
 if(!c)return json({error:'SERVICE_UNAVAILABLE'},503);
 try{const q=await quoteFrom(c,x);return json(q,q.ok?200:409)}
 catch(e){report(e,'quote');return json({error:'SERVICE_UNAVAILABLE'},503)}
 finally{c.release()}
}
