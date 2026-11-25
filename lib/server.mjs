import pg from 'pg';
import Stripe from 'stripe';
import { quote } from './quote.mjs';
const { Pool }=pg;
let pool, stripe;
export const SKU='PANTHER-BLACK-80';
export function db(){
 if(!pool){
  if(!process.env.DATABASE_URL)throw Error('Database not configured');
  const url=new URL(process.env.DATABASE_URL);
  if(url.protocol!=='postgresql:'&&url.protocol!=='postgres:')throw Error('Invalid database URL');
  url.searchParams.set('sslmode','verify-full');
  pool=new Pool({connectionString:url.href,max:3,connectionTimeoutMillis:8000,statement_timeout:10000});
 }
 return pool;
}
export function stripeClient(){
 if(!stripe){
  const key=process.env.STRIPE_RESTRICTED_KEY;
  if(!key||!/^rk_live_/.test(key))throw Error('Live restricted key not configured');
  stripe=new Stripe(key,{apiVersion:'2026-11-18.endive',timeout:15000,maxNetworkRetries:1});
 }
 return stripe;
}
export function liveAllowed(){
 return process.env.VERCEL_ENV==='production'&&process.env.LIVE_CHECKOUT_ENABLED==='true'&&process.env.TAX_POLICY_APPROVED==='true'&&Boolean(process.env.STRIPE_WEBHOOK_SECRET)&&/^rk_live_/.test(process.env.STRIPE_RESTRICTED_KEY||'');
}
export function json(body,status=200){
 return Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
export const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function input(req){
 if(!req.headers.get('content-type')?.startsWith('application/json'))throw Error('Invalid content type');
 const raw=await req.text();
 if(raw.length>2048)throw Error('Body too large');
 const x=JSON.parse(raw);
 if(!x||typeof x!=='object'||Array.isArray(x)||!Number.isSafeInteger(x.quantity)||x.quantity<1||x.quantity>10||typeof x.country!=='string'||!/^[A-Z]{2}$/.test(x.country)||!['sea','air'].includes(x.method))throw Error('Invalid request');
 return x;
}
export async function transaction(fn){
 const c=await db().connect();
 try{await c.query('BEGIN');const out=await fn(c);await c.query('COMMIT');return out}
 catch(e){await c.query('ROLLBACK').catch(()=>{});throw e}
 finally{c.release()}
}
export async function quoteFrom(c,x,lock=false){
 const p=await c.query('SELECT * FROM commerce.products WHERE sku=$1'+(lock?' FOR SHARE':''),[SKU]);
 const i=await c.query('SELECT * FROM commerce.inventory WHERE sku=$1'+(lock?' FOR UPDATE':''),[SKU]);
 const s=await c.query('SELECT * FROM commerce.store_settings WHERE singleton=true'+(lock?' FOR SHARE':''));
 const r=await c.query('SELECT * FROM commerce.shipping_rates WHERE country_code=$1 AND method=$2'+(lock?' FOR SHARE':''),[x.country,x.method]);
 return quote({product:p.rows[0],inventory:i.rows[0],settings:s.rows[0],rates:r.rows,quantity:x.quantity,country:x.country,method:x.method});
}
export function report(e,where){console.error(where,typeof e.code==='string'&&/^[A-Z0-9_]{1,40}$/.test(e.code)?e.code:'failure')}
