import {db} from './server.mjs';
// Shared database budget across instances. Not a substitute for perimeter WAF.
const LIMITS={checkout:30,quote:240,tracking:120};
export async function withinBudget(scope){
 const limit=LIMITS[scope];if(!limit)throw Error('Unknown request scope');
 const {rows}=await db().query("INSERT INTO commerce.request_limits(scope,window_start,hits) VALUES($1,date_trunc('minute',now()),1) ON CONFLICT(scope,window_start) DO UPDATE SET hits=commerce.request_limits.hits+1 WHERE commerce.request_limits.hits<$2 RETURNING hits",[scope,limit]);
 return rows.length===1;
}
