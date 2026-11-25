import {json,stripeClient,uuid,report} from '../lib/server.mjs';
import {settleSession} from '../lib/settle-session.mjs';
import {syncRefund} from '../lib/refund-sync.mjs';
const checkoutEvents=new Set(['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed','checkout.session.expired']);
const refundEvents=new Set(['refund.created','refund.updated','refund.failed','charge.refunded']);
export async function POST(req){
 if(process.env.VERCEL_ENV!=='production'||!process.env.STRIPE_WEBHOOK_SECRET)return json({error:'NOT_CONFIGURED'},503);
 let stripe,event;
 try{
  stripe=stripeClient();
  event=stripe.webhooks.constructEvent(await req.text(),req.headers.get('stripe-signature')||'',process.env.STRIPE_WEBHOOK_SECRET);
 }catch{return json({error:'INVALID_SIGNATURE'},400)}
 if(!event.livemode)return json({received:true});
 try{
  if(refundEvents.has(event.type)){await syncRefund(stripe,event);return json({received:true})}
  if(!checkoutEvents.has(event.type))return json({received:true});
  const id=event.data.object.metadata?.panthera_order_id;
  if(!id||!uuid.test(id))return json({received:true});
  const session=await stripe.checkout.sessions.retrieve(event.data.object.id);
  if(session.metadata?.panthera_order_id!==id)throw Error('Session mismatch');
  await settleSession(stripe,session,event);
  return json({received:true});
 }catch(e){report(e,'stripe-webhook');return json({error:'PROCESSING_FAILED'},500)}
}
