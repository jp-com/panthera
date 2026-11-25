import {db,json,report} from '../lib/server.mjs';
import {verifyTrackingToken,trackingReady} from '../lib/tracking-token.mjs';
import {boundedText,jsonContent} from '../lib/security.mjs';
import {withinBudget} from '../lib/rate-limit.mjs';
export async function POST(req){
 const key=process.env.ORDER_TRACKING_KEY;
 if(!trackingReady(key))return json({error:'TRACKING_UNAVAILABLE'},503);
 if(!jsonContent(req))return json({error:'INVALID_REQUEST'},400);
 let id;
 try{const raw=await boundedText(req,512);id=verifyTrackingToken(JSON.parse(raw)?.token,key)}catch{return json({error:'INVALID_REQUEST'},400)}
 if(!id)return json({error:'ORDER_NOT_AVAILABLE'},404);
 try{
 if(!await withinBudget('tracking'))return json({error:'RATE_LIMITED'},429);
 const [order,items,shipments]=await Promise.all([
 db().query('SELECT payment_status,fulfillment_status,shipping_method,created_at,currency,total_cents,refunded_cents FROM commerce.orders WHERE id=$1',[id]),
 db().query('SELECT name_snapshot,quantity FROM commerce.order_items WHERE order_id=$1',[id]),
 db().query('SELECT carrier,tracking_number,shipped_at,delivered_at FROM commerce.shipments WHERE order_id=$1 ORDER BY shipped_at',[id])
 ]);
 if(!order.rowCount)return json({error:'ORDER_NOT_AVAILABLE'},404);
 const o=order.rows[0];
 return json({order:{...o,reference:id},items:items.rows,shipments:['paid','partially_refunded','refunded'].includes(o.payment_status)?shipments.rows:[]});
 }catch(e){report(e,'order-status');return json({error:'TRACKING_UNAVAILABLE'},503)}
}
