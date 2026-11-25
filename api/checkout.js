import {db,json,input,quoteFrom,liveAllowed,report,transaction,stripeClient,uuid,SKU} from '../lib/server.mjs';
import {issueTrackingToken,trackingReady} from '../lib/tracking-token.mjs';
export async function POST(req){
 if(!trackingReady(process.env.ORDER_TRACKING_KEY))return json({error:'CHECKOUT_DISABLED'},503);
 if(!liveAllowed())return json({error:'CHECKOUT_DISABLED'},503);
 let x;try{x=await input(req);if(!uuid.test(x.request_id))throw Error()}catch{return json({error:'INVALID_REQUEST'},400)}
 const origin=process.env.STORE_ORIGIN;
 if(!origin||!/^https:\/\/[a-z0-9.-]+$/i.test(origin)||req.headers.get('origin')!==origin)return json({error:'INVALID_ORIGIN'},403);
 try{
 const order=await transaction(async c=>{
   // Per-request lock prevents double reservation during concurrent retries.
   await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[x.request_id]);
   const existing=(await c.query('SELECT o.*,r.expires_at,i.quantity,i.unit_price_cents FROM commerce.orders o JOIN commerce.reservations r ON r.order_id=o.id JOIN commerce.order_items i ON i.order_id=o.id WHERE o.id=$1',[x.request_id])).rows[0];
   if(existing){
    if(existing.country_code!==x.country||existing.shipping_method!==x.method||existing.quantity!==x.quantity||existing.payment_status!=='pending'||new Date(existing.expires_at).getTime()<Date.now()+31*60000)return {error:'REQUEST_EXPIRED_OR_CHANGED'};
    return existing;
   }
   const q=await quoteFrom(c,x,true);
   if(!q.ok)return {error:q.code};
   const expiry=new Date(Math.floor(Date.now()/1000)*1000+7200000);
   await c.query('UPDATE commerce.inventory SET reserved=reserved+$1 WHERE sku=$2',[q.quantity,SKU]);
   const o=(await c.query('INSERT INTO commerce.orders(id,currency,country_code,shipping_method,subtotal_cents,shipping_cents,total_cents) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',[x.request_id,q.currency,q.country,q.method,q.subtotal_cents,q.shipping_cents,q.pre_tax_total_cents])).rows[0];
   const unit=q.subtotal_cents/q.quantity;
   await c.query('INSERT INTO commerce.order_items(order_id,sku,name_snapshot,quantity,unit_price_cents) VALUES($1,$2,$3,$4,$5)',[o.id,SKU,'The Panther',q.quantity,unit]);
   await c.query('INSERT INTO commerce.reservations(order_id,sku,quantity,expires_at) VALUES($1,$2,$3,$4)',[o.id,SKU,q.quantity,expiry]);
   return {...o,quantity:q.quantity,unit_price_cents:unit,expires_at:expiry};
 });
 if(order.error)return json({error:order.error},409);
 const stripe=stripeClient();
 let session;
 if(order.checkout_session_id)session=await stripe.checkout.sessions.retrieve(order.checkout_session_id);
 else{
 session=await stripe.checkout.sessions.create({
 mode:'payment',integration_identifier:'panthera_checkout_kvrmztpa',
 client_reference_id:order.id,metadata:{panthera_order_id:order.id},
 payment_intent_data:{metadata:{panthera_order_id:order.id}},
 line_items:[{quantity:order.quantity,price_data:{currency:'usd',unit_amount:order.unit_price_cents,product_data:{name:'The Panther'}}}],
 shipping_address_collection:{allowed_countries:[order.country_code]},
 shipping_options:[{shipping_rate_data:{type:'fixed_amount',display_name:order.shipping_method==='sea'?'Standard delivery':'Priority air',fixed_amount:{amount:Number(order.shipping_cents),currency:'usd'}}}],
 adaptive_pricing:{enabled:false},
 expires_at:Math.floor(new Date(order.expires_at).getTime()/1000),
 success_url:origin+'/success.html',cancel_url:origin+'/'
 },{idempotencyKey:'panthera-checkout-'+order.id});
 const saved=await db().query('UPDATE commerce.orders SET checkout_session_id=$1 WHERE id=$2 AND (checkout_session_id IS NULL OR checkout_session_id=$1)',[session.id,order.id]);
 if(saved.rowCount!==1)throw Error('Session association failed');
 }
 if(session.status!=='open'||!session.url||session.livemode!==true)return json({error:'SESSION_NOT_OPEN'},409);
 return json({url:session.url,trackingToken:issueTrackingToken(order.id,process.env.ORDER_TRACKING_KEY)});
 }catch(e){report(e,'checkout');return json({error:'CHECKOUT_TEMPORARILY_UNAVAILABLE'},503)}
}
