import {db,json,liveAllowed,report,SKU} from '../lib/server.mjs';
export async function GET(){
 try{
 const result=await db().query('SELECT p.sku,p.name,p.currency,p.unit_price_cents,p.target_height_cm,p.finish,(p.available_for_sale AND i.on_hand>i.reserved AND s.checkout_enabled) AS available FROM commerce.products p JOIN commerce.inventory i USING(sku) CROSS JOIN commerce.store_settings s WHERE p.sku=$1 AND s.singleton=true',[SKU]);
 if(!result.rows[0])return json({error:'PRODUCT_UNAVAILABLE'},404);
 return json({...result.rows[0],available:liveAllowed()&&result.rows[0].available});
 }catch(e){report(e,'product');return json({error:'SERVICE_UNAVAILABLE'},503)}
}
