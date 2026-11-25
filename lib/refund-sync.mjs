import {refundSummary,refundedFulfillment} from './refund-rules.mjs';
import {transaction,uuid} from './server.mjs';
// Read-only Stripe operations. Never creates a refund or restores inventory.
export async function syncRefund(stripe,event){
 const piId=event.data.object.payment_intent;
 if(typeof piId!=='string'||!piId.startsWith('pi_'))return;
 const intent=await stripe.paymentIntents.retrieve(piId);
 const id=intent.metadata?.panthera_order_id;
 if(!id||!uuid.test(id))return; // Other merchant activity is out of scope.
 if(!intent.livemode||intent.currency!=='usd'||intent.status!=='succeeded')throw Error('Payment intent mismatch');
 await transaction(async c=>{
  const claim=await c.query('INSERT INTO commerce.webhook_events(event_id,event_type) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING event_id',[event.id,event.type]);
  if(!claim.rowCount)return;
  const o=(await c.query('SELECT * FROM commerce.orders WHERE id=$1 FOR UPDATE',[id])).rows[0];
  if(!o||o.payment_intent_id!==piId||!['paid','partially_refunded','refunded'].includes(o.payment_status)||intent.amount_received!==Number(o.total_cents))throw Error('Order payment not yet reconciled');
  // Fetch under the order lock so concurrent refund deliveries cannot apply stale snapshots.
  const refunds=[];let starting_after;
  for(let page=0;page<10;page++){
   const result=await stripe.refunds.list({payment_intent:piId,limit:100,...(starting_after?{starting_after}:{})});
   refunds.push(...result.data);
   if(!result.has_more){starting_after=null;break}
   starting_after=result.data.at(-1)?.id;
   if(!starting_after)throw Error('Refund pagination invalid');
  }
  if(starting_after)throw Error('Refund pagination limit exceeded');
  if(refunds.some(r=>r.payment_intent!==piId))throw Error('Refund payment mismatch');
  const next=refundSummary(refunds,Number(o.total_cents));
  const fulfillment=refundedFulfillment(next.status,o.fulfillment_status);
  await c.query('UPDATE commerce.orders SET refunded_cents=$1,payment_status=$2,fulfillment_status=$3 WHERE id=$4',[next.amount,next.status,fulfillment,id]);
  if(next.amount>Number(o.refunded_cents))await c.query("INSERT INTO commerce.notification_outbox(order_id,kind,dedupe_key) VALUES($1,'refund',$2) ON CONFLICT DO NOTHING",[id,id+':refund:'+next.amount]);
 });
}
