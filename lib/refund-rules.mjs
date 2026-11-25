// Calculate only settled refunds, never pending or failed refunds.
export function refundSummary(refunds,total){
 if(!Number.isSafeInteger(total)||total<=0||!Array.isArray(refunds))throw Error('Invalid refund input');
 let amount=0;const ids=new Set();
 for(const r of refunds){
  if(typeof r.id!=='string'||ids.has(r.id)||r.currency!=='usd'||!Number.isSafeInteger(r.amount)||r.amount<=0)throw Error('Invalid refund record');
  ids.add(r.id);
  if(r.status==='succeeded')amount+=r.amount;
 }
 if(!Number.isSafeInteger(amount)||amount>total)throw Error('Refund exceeds payment');
 return {amount,status:amount===0?'paid':amount===total?'refunded':'partially_refunded'};
}
export function refundedFulfillment(status,fulfillment){
 return status==='refunded'&&['unfulfilled','processing'].includes(fulfillment)?'cancelled':fulfillment;
}
export function reconciliationDecision(session){
 if(session?.livemode!==true)return 'review';
 if(session.payment_status==='paid')return 'paid';
 if(session.status==='expired'&&session.payment_status==='unpaid'&&!session.payment_intent)return 'expired';
 return 'hold';
}
