import {authorize} from '../lib/admin-auth.mjs';
import {validateAction,transition} from '../lib/admin-rules.mjs';
import {json,transaction,report,SKU} from '../lib/server.mjs';
function error(code){const e=new Error(code);e.code=code;throw e}
export async function POST(req){
 if(!authorize(req.headers.get('authorization'),process.env.ADMIN_ACCESS_TOKEN))return json({error:'UNAUTHORIZED'},401);
 if(process.env.ADMIN_WRITE_ENABLED!=='true')return json({error:'ADMIN_WRITES_DISABLED'},403);
 if(!process.env.ADMIN_ORIGIN||req.headers.get('origin')!==process.env.ADMIN_ORIGIN)return json({error:'INVALID_ORIGIN'},403);
 if(!req.headers.get('content-type')?.startsWith('application/json'))return json({error:'INVALID_REQUEST'},400);
 let a;try{const raw=await req.text();if(raw.length>4096)throw Error();a=validateAction(JSON.parse(raw));if(!a)throw Error()}catch{return json({error:'INVALID_REQUEST'},400)}
 try{
 await transaction(async c=>{
 let before,after,target;
 if(a.action==='product'){
  const p=(await c.query('SELECT * FROM commerce.products WHERE sku=$1 FOR UPDATE',[SKU])).rows[0];
  const i=(await c.query('SELECT * FROM commerce.inventory WHERE sku=$1 FOR UPDATE',[SKU])).rows[0];
  if(!p||!i)error('PRODUCT_NOT_FOUND');
  if(a.stock<i.reserved)error('STOCK_BELOW_RESERVED');
  before={price:p.unit_price_cents,stock:i.on_hand,available:p.available_for_sale};
  await c.query('UPDATE commerce.products SET unit_price_cents=$1,available_for_sale=$2,updated_at=now() WHERE sku=$3',[a.price,a.available,SKU]);
  await c.query('UPDATE commerce.inventory SET on_hand=$1 WHERE sku=$2',[a.stock,SKU]);
  after={price:a.price,stock:a.stock,available:a.available};target=SKU;
 }else if(a.action==='shipping'){
  // Serialize upserts even when the shipping row does not yet exist.
  target=a.country+':'+a.method;
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['shipping:'+target]);
  before=(await c.query('SELECT * FROM commerce.shipping_rates WHERE country_code=$1 AND method=$2 FOR UPDATE',[a.country,a.method])).rows[0]??null;
  after=(await c.query("INSERT INTO commerce.shipping_rates(country_code,method,currency,per_unit_cents,min_business_days,max_business_days,enabled) VALUES($1,$2,'USD',$3,$4,$5,$6) ON CONFLICT(country_code,method) DO UPDATE SET per_unit_cents=EXCLUDED.per_unit_cents,min_business_days=EXCLUDED.min_business_days,max_business_days=EXCLUDED.max_business_days,enabled=EXCLUDED.enabled RETURNING *",[a.country,a.method,a.cents,a.min,a.max,a.enabled])).rows[0];
 }else if(a.action==='pause'){
  target='checkout';
  before=(await c.query('SELECT checkout_enabled FROM commerce.store_settings WHERE singleton=true FOR UPDATE')).rows[0];
  if(!before)error('STORE_NOT_FOUND');
  after=(await c.query('UPDATE commerce.store_settings SET checkout_enabled=false WHERE singleton=true RETURNING checkout_enabled')).rows[0];
 }else{
  target=a.id;
  const o=(await c.query('SELECT id,payment_status,fulfillment_status FROM commerce.orders WHERE id=$1 FOR UPDATE',[a.id])).rows[0];
  if(!o)error('ORDER_NOT_FOUND');
  const next=transition(o.payment_status,o.fulfillment_status,a.action);
  if(!next)error('INVALID_ORDER_TRANSITION');
  before={fulfillment:o.fulfillment_status};
  if(a.action==='ship'){
   await c.query('INSERT INTO commerce.shipments(order_id,carrier,tracking_number) VALUES($1,$2,$3)',[a.id,a.carrier,a.tracking]);
   await c.query("INSERT INTO commerce.notification_outbox(order_id,kind,dedupe_key) VALUES($1,'dispatch',$2) ON CONFLICT DO NOTHING",[a.id,a.id+':dispatch']);
  }
  if(a.action==='deliver'){
   const r=await c.query('UPDATE commerce.shipments SET delivered_at=now() WHERE order_id=$1 AND delivered_at IS NULL',[a.id]);
   if(!r.rowCount)error('SHIPMENT_NOT_FOUND');
  }
  await c.query('UPDATE commerce.orders SET fulfillment_status=$1 WHERE id=$2',[next,a.id]);
  after={fulfillment:next,...(a.action==='ship'?{carrier:a.carrier,tracking:a.tracking}:{})};
 }
 await c.query('INSERT INTO commerce.admin_audit(actor,action,target,before_value,after_value) VALUES($1,$2,$3,$4,$5)',['single-operator',a.action,target,JSON.stringify(before),JSON.stringify(after)]);
 });
 return json({ok:true});
 }catch(e){report(e,'admin-manage');const allowed=['PRODUCT_NOT_FOUND','STOCK_BELOW_RESERVED','STORE_NOT_FOUND','ORDER_NOT_FOUND','INVALID_ORDER_TRANSITION','SHIPMENT_NOT_FOUND'];return json({error:allowed.includes(e.code)?e.code:e.code==='23505'?'DUPLICATE_TRACKING':'SERVICE_UNAVAILABLE'},allowed.includes(e.code)||e.code==='23505'?409:503)}
}
