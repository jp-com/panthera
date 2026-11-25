import {authorize} from '../lib/admin-auth.mjs';
import {db,json,report,liveAllowed} from '../lib/server.mjs';
export async function GET(req){
 if(!authorize(req.headers.get('authorization'),process.env.ADMIN_ACCESS_TOKEN))return json({error:'UNAUTHORIZED'},401);
 try{
  const [stats,product,rates,orders]=await Promise.all([
   db().query("SELECT count(*) FILTER (WHERE payment_status IN ('paid','partially_refunded','refunded'))::int AS paid_orders,COALESCE(sum(total_cents-refunded_cents) FILTER (WHERE payment_status IN ('paid','partially_refunded','refunded')),0)::text AS net_collected_cents,count(*) FILTER (WHERE payment_status IN ('paid','partially_refunded') AND fulfillment_status='unfulfilled')::int AS awaiting_dispatch FROM commerce.orders"),
   db().query('SELECT p.sku,p.name,p.currency,p.unit_price_cents,p.available_for_sale,i.on_hand,i.reserved,s.checkout_enabled FROM commerce.products p JOIN commerce.inventory i USING(sku) CROSS JOIN commerce.store_settings s WHERE s.singleton=true'),
   db().query('SELECT country_code,method,currency,per_unit_cents,min_business_days,max_business_days,enabled FROM commerce.shipping_rates ORDER BY country_code,method'),
   db().query('SELECT id,created_at,country_code,shipping_method,total_cents,refunded_cents,payment_status,fulfillment_status FROM commerce.orders ORDER BY created_at DESC LIMIT 50')
  ]);
  return json({stats:stats.rows[0],products:product.rows,rates:rates.rows,orders:orders.rows,liveCheckout:liveAllowed()&&product.rows.some(p=>p.checkout_enabled&&p.available_for_sale&&p.on_hand>p.reserved)});
 }catch(e){report(e,'admin-summary');return json({error:'SERVICE_UNAVAILABLE'},503)}
}
