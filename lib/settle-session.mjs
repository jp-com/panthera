import {transaction,uuid} from './server.mjs';
export async function settleSession(stripe,session,event=null){
 const id=session.metadata?.panthera_order_id;
 if(!id||!uuid.test(id)||!session.livemode||session.client_reference_id!==id)throw Error('Session mismatch');
 let releaseStatus=null;
 if(session.payment_status==='unpaid'&&(session.status==='expired'||event?.type==='checkout.session.async_payment_failed')){
  // An uncertain or processing payment must never release stock.
  if(!session.payment_intent&&session.status==='expired')releaseStatus='expired';
  else if(typeof session.payment_intent==='string'){
   const pi=await stripe.paymentIntents.retrieve(session.payment_intent);
   if(pi.livemode&&pi.metadata?.panthera_order_id===id&&pi.amount_received===0&&pi.status==='canceled')releaseStatus=session.status==='expired'?'expired':'failed';
   else if(pi.livemode&&pi.metadata?.panthera_order_id===id&&pi.amount_received===0&&pi.status==='requires_payment_method'&&session.status==='complete'&&event?.type==='checkout.session.async_payment_failed')releaseStatus='failed';
  }
 }
 await transaction(async c=>{
  if(event){const claimed=await c.query('INSERT INTO commerce.webhook_events(event_id,event_type) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING event_id',[event.id,event.type]);if(!claimed.rowCount)return;}
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
  }else if(releaseStatus!==null){
   const r=(await c.query('SELECT * FROM commerce.reservations WHERE order_id=$1 FOR UPDATE',[id])).rows[0];
   if(r?.state!=='held')throw Error('Reservation mismatch');
   const result=await c.query('UPDATE commerce.inventory SET reserved=reserved-$1 WHERE sku=$2 AND reserved >= $1',[r.quantity,r.sku]);
   if(result.rowCount!==1)throw Error('Inventory mismatch');
   await c.query("UPDATE commerce.reservations SET state='released' WHERE order_id=$1",[id]);
   await c.query("UPDATE commerce.orders SET checkout_session_id=$1,payment_status=$2 WHERE id=$3",[session.id,releaseStatus,id]);
  }
 });
 return session.payment_status==='paid'?'payment_checked':releaseStatus||'held_for_review';
}
