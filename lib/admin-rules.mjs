const int=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const bool=x=>typeof x==='boolean';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const safeText=(s,max)=>typeof s==='string'&&s.trim().length>0&&s.length<=max&&!/[\u0000-\u001f\u007f]/.test(s);
export function validateAction(x){
 if(!x||typeof x!=='object'||Array.isArray(x))return null;
 switch(x.action){
 case 'product':
  if(!int(x.price,1,100000000)||!int(x.stock,0,1000000)||!bool(x.available))return null;
  return {action:'product',price:x.price,stock:x.stock,available:x.available};
 case 'shipping':
  if(typeof x.country!=='string'||!/^[A-Z]{2}$/.test(x.country)||!['sea','air'].includes(x.method)||!int(x.cents,0,100000000)||!int(x.min,1,365)||!int(x.max,x.min,365)||!bool(x.enabled))return null;
  return {action:'shipping',country:x.country,method:x.method,cents:x.cents,min:x.min,max:x.max,enabled:x.enabled};
 case 'process': case 'deliver':
  return typeof x.id==='string'&&uuid.test(x.id)?{action:x.action,id:x.id}:null;
 case 'ship':
  return typeof x.id==='string'&&uuid.test(x.id)&&safeText(x.carrier,80)&&safeText(x.tracking,160)?{action:'ship',id:x.id,carrier:x.carrier.trim(),tracking:x.tracking.trim()}:null;
 case 'pause':
  return {action:'pause'};
 default:return null;
 }
}
export function transition(payment,fulfillment,action){
 if(!['paid','partially_refunded'].includes(payment))return null;
 if(action==='process'&&fulfillment==='unfulfilled')return 'processing';
 if(action==='ship'&&fulfillment==='processing')return 'shipped';
 if(action==='deliver'&&fulfillment==='shipped')return 'delivered';
 return null;
}
