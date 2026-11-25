// Pure transactional templates. No provider calls or customer data at build time.
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=c=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(c)/100);
export function emailTemplate(kind,order,items=[],shipments=[]){
 if(!order?.id)throw Error('Order ID required');
 const ref=String(order.id);
 let subject,title,intro,rows=[];
 if(kind==='order_confirmation'){
  if(!['paid','partially_refunded'].includes(order.payment_status))throw Error('Unverified payment');
  subject='Your PANTHERA order';title='Order confirmed';intro='Thank you for your order. We will be in touch when your sculpture is dispatched.';
  rows=[['Order reference',ref],...items.map(i=>[i.name_snapshot+' × '+i.quantity,money(Number(i.unit_price_cents)*i.quantity)]),['Delivery',order.shipping_method==='air'?'Priority air':'Standard sea'],['Delivery charge',money(order.shipping_cents)],['Tax',money(order.tax_cents)],['Total paid',money(order.total_cents)]];
 }else if(kind==='dispatch'){
  if(!shipments.length||!['shipped','delivered'].includes(order.fulfillment_status))throw Error('No confirmed dispatch');
  subject='Your PANTHERA order has been dispatched';title='On its way';intro='Your sculpture has been dispatched. Use the carrier and tracking reference below to follow its journey.';
  rows=[['Order reference',ref],...shipments.flatMap(s=>[['Carrier',s.carrier],['Tracking reference',s.tracking_number]])];
 }else if(kind==='refund'){
  if(!['partially_refunded','refunded'].includes(order.payment_status)||!(Number(order.refunded_cents)>0))throw Error('No verified refund');
  subject='Your PANTHERA refund';title='Refund confirmed';intro='A refund has been processed for your order. Your payment provider may take additional time to display it.';
  rows=[['Order reference',ref],['Total refunded to date',money(order.refunded_cents)]];
 }else if(kind==='internal_new_order'){
  if(order.payment_status!=='paid')throw Error('Unverified payment');
  subject='PANTHERA | New paid order';title='New paid order';intro='A paid order is awaiting fulfilment. Open the private admin dashboard for delivery details.';
  rows=[['Order reference',ref],['Destination',order.country_code],['Total paid',money(order.total_cents)]];
 }else throw Error('Unknown template');
 const text=['PANTHERA',title,intro,'',...rows.map(([a,b])=>a+': '+b),'','PANTHERA'].join('\n');
 const html='<!doctype html><html lang="en"><body style="margin:0;background:#f2eee6;color:#201d1b;font:15px/1.6 Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:36px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px"><tr><td style="font:26px Georgia,serif;letter-spacing:3px;padding:0 0 32px">PANTHERA</td></tr><tr><td><h1 style="font:normal 32px Georgia,serif;margin:0 0 20px">'+esc(title)+'</h1><p style="margin:0 0 24px">'+esc(intro)+'</p></td></tr><tr><td><table width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #c9c3b9">'+rows.map(([a,b])=>'<tr><td style="padding:10px 8px 10px 0;border-bottom:1px solid #c9c3b9">'+esc(a)+'</td><td align="right" style="padding:10px 0;border-bottom:1px solid #c9c3b9;overflow-wrap:anywhere">'+esc(b)+'</td></tr>').join('')+'</table></td></tr><tr><td style="padding-top:28px;font:20px Georgia,serif;letter-spacing:2px">PANTHERA</td></tr></table></td></tr></table></body></html>';
 return {subject,text,html};
}
