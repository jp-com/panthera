import {json,transaction,stripeClient,uuid,report} from '../lib/server.mjs';
const accepted=new Set(['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed','checkout.session.expired']);
export async function POST(req){
 if(process.env.VERCEL_ENV!=='production'||!process.env.STRIPE_WEBHOOK_SECRET)return json({error:'NOT_CONFIGURED'},503);
 let stripe,event;
 try{
  stripe=stripeClient();
  event=stripe.webhooks.constructEvent(await req.text(),req.headers.get('stripe-signature')||'',process.env.STRIPE_WEBHOOK_SECRET);
 }catch{return json({error:'INVALID_SIGNATURE'},400)}
 if(!event.livemode||!accepted.has(event.type))return json({received:true});
 const id=event.data.object.metadata?.panthera_order_id;
 if(!id||!uuid.test(id))return json({received:true});
 try{
 const session=await stripe.checkout.sessions.retrieve(event.data.object.id);
 if(!session.livemode||session.metadata?.panthera_order_id!==id||session.client_reference_id!==id)throw Error('Session mismatch');
 await transaction(async c=>{
  const claimed=await c.query('INSERT INTO commerce.webhook_events(event_id,event_type) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING event_id',[event.id,event.type]);
  if(!claimed.rowCount)return;
  const o=(await c.query('SELECT * FROM commerce.orders WHERE id=$1 FOR UPDATE',[id])).rows[0];
  if(!o||o.checkout_session_id&&o.checkout_session_id!==session.id)throw Error('Unknown order');
  if(o.payment_status!=='pending')return;
  if(session.payment_status==='paid'){
   const details=session.collected_information?.shipping_details||session.shipping_details;
   if(session.currency!=='usd'||session.amount_total!==Number(o.total_cents)||details?.address?.country!==o.country_code||typeof session.payment_intent!=='string'||!session.customer_details?.email)throw Error('Payment mismatch');
   const reservation=(await c.query('SELECT * FROM commerce.reservations WHERE order_id=$1 FOR UPDATE',[id])).rows[0];
   if(reservation?.state!=='held')throw Error('Reservation mismatch');
   const updated=await c.query('UPDATE commerce.inventory SET on_hand=on_hand-$1,reserved=reserved-$1 WHERE sku=$2 AND reserved >= $1 AND on_hand >= $1',[reservation.quantity,reservation.sku]);
   if(updated.rowCount!==1)throw Error('Inventory mismatch');
   await c.query("UPDATE commerce.reservations SET state='consumed' WHERE order_id=$1",[id]);
   await c.query("UPDATE commerce.orders SET checkout_session_id=$1,payment_intent_id=$2,payment_status='paid',paid_at=now(),customer_email=$3,shipping_address=$4 WHERE id=$5",[session.id,session.payment_intent,session.customer_details.email,JSON.stringify(details),id]);
   await c.query("INSERT INTO commerce.notification_outbox(order_id,kind,dedupe_key) VALUES($1,'order_confirmation',$2) ON CONFLICT DO NOTHING",[id,id+':confirmation']);
  }else if(session.status==='expired'||event.type==='checkout.session.async_payment_failed'){
   const r=(await c.query('SELECT * FROM commerce.reservations WHERE order_id=$1 FOR UPDATE',[id])).rows[0];
   if(r?.state!=='held')throw Error('Reservation mismatch');
   const result=await c.query('UPDATE commerce.inventory SET reserved=reserved-$1 WHERE sku=$2 AND reserved >= $1',[r.quantity,r.sku]);
   if(result.rowCount!==1)throw Error('Inventory mismatch');
   await c.query("UPDATE commerce.reservations SET state='released' WHERE order_id=$1",[id]);
   await c.query("UPDATE commerce.orders SET checkout_session_id=$1,payment_status=$2 WHERE id=$3",[session.id,session.status==='expired'?'expired':'failed',id]);
  }
 });
 return json({received:true});
 }catch(e){report(e,'stripe-webhook');return json({error:'PROCESSING_FAILED'},500)}
}
