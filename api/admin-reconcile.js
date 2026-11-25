import {authorize} from '../lib/admin-auth.mjs';
import {db,json,report,stripeClient,uuid} from '../lib/server.mjs';
import {settleSession} from '../lib/settle-session.mjs';
function authorized(req){return authorize(req.headers.get('authorization'),process.env.ADMIN_ACCESS_TOKEN)}
export async function GET(req){
 if(!authorized(req))return json({error:'UNAUTHORIZED'},401);
 try{
 const result=await db().query("SELECT o.id,o.created_at,r.expires_at,(o.checkout_session_id IS NOT NULL) AS has_session,r.quantity FROM commerce.orders o JOIN commerce.reservations r ON r.order_id=o.id WHERE o.payment_status='pending' AND r.state='held' AND r.expires_at<=now() ORDER BY r.expires_at LIMIT 100");
 const mismatch=await db().query("SELECT i.sku,i.reserved,COALESCE(sum(r.quantity) FILTER(WHERE r.state='held'),0)::int AS expected_reserved FROM commerce.inventory i LEFT JOIN commerce.reservations r USING(sku) GROUP BY i.sku,i.reserved HAVING i.reserved<>COALESCE(sum(r.quantity) FILTER(WHERE r.state='held'),0)");
 return json({expiredHolds:result.rows,inventoryMismatches:mismatch.rows});
 }catch(e){report(e,'reconciliation-report');return json({error:'SERVICE_UNAVAILABLE'},503)}
}
export async function POST(req){
 if(!authorized(req))return json({error:'UNAUTHORIZED'},401);
 if(process.env.VERCEL_ENV!=='production'||process.env.ADMIN_WRITE_ENABLED!=='true'||!process.env.ADMIN_ORIGIN||req.headers.get('origin')!==process.env.ADMIN_ORIGIN)return json({error:'RECONCILIATION_DISABLED'},403);
 if(!req.headers.get('content-type')?.startsWith('application/json'))return json({error:'INVALID_REQUEST'},400);
 let id;try{const raw=await req.text();if(raw.length>512)throw Error();id=JSON.parse(raw).id;if(typeof id!=='string'||!uuid.test(id))throw Error()}catch{return json({error:'INVALID_REQUEST'},400)}
 try{
 const result=await db().query("SELECT o.checkout_session_id FROM commerce.orders o JOIN commerce.reservations r ON r.order_id=o.id WHERE o.id=$1 AND o.payment_status='pending' AND r.state='held' AND r.expires_at<=now()",[id]);
 if(!result.rowCount)return json({error:'NO_EXPIRED_HOLD'},409);
 const sessionId=result.rows[0].checkout_session_id;
 if(!sessionId)return json({result:'manual_review_required',reason:'No linked Stripe session; stock stays reserved'});
 const stripe=stripeClient(),session=await stripe.checkout.sessions.retrieve(sessionId);
 if(session.metadata?.panthera_order_id!==id)throw Error('Session mismatch');
 const outcome=await settleSession(stripe,session);
 return json({result:outcome});
 }catch(e){report(e,'reconciliation');return json({error:'RECONCILIATION_FAILED'},503)}
}
