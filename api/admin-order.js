import {authorize} from '../lib/admin-auth.mjs';
import {db,json,report,uuid} from '../lib/server.mjs';
export async function GET(req){
 if(!authorize(req.headers.get('authorization'),process.env.ADMIN_ACCESS_TOKEN))return json({error:'UNAUTHORIZED'},401);
 const id=new URL(req.url).searchParams.get('id');
 if(!id||!uuid.test(id))return json({error:'INVALID_REQUEST'},400);
 try{
 const [o,i,s]=await Promise.all([
 db().query('SELECT id,customer_email,shipping_address,payment_status,fulfillment_status FROM commerce.orders WHERE id=$1',[id]),
 db().query('SELECT quantity,name_snapshot,unit_price_cents FROM commerce.order_items WHERE order_id=$1',[id]),
 db().query('SELECT carrier,tracking_number,shipped_at,delivered_at FROM commerce.shipments WHERE order_id=$1',[id])
 ]);
 if(!o.rowCount)return json({error:'ORDER_NOT_FOUND'},404);
 return json({order:o.rows[0],items:i.rows,shipments:s.rows});
 }catch(e){report(e,'admin-order');return json({error:'SERVICE_UNAVAILABLE'},503)}
}
