import {db,json,report} from '../lib/server.mjs';
export async function GET(){
 try{
  const {rows}=await db().query("SELECT country_code,method FROM commerce.shipping_rates WHERE enabled=true AND currency='USD' ORDER BY country_code,method");
  return json({destinations:rows});
 }catch(e){report(e,'shipping');return json({error:'SERVICE_UNAVAILABLE'},503)}
}
