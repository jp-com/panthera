const SKU='PANTHER-BLACK-80';
export function marketingEvent(name,cents,quantity=1){
 if(name==='PageView')return {};
 if(!['ViewContent','AddToCart','InitiateCheckout'].includes(name)||!Number.isSafeInteger(cents)||cents<=0||!Number.isSafeInteger(quantity)||quantity<1||quantity>10)return null;
 return {content_ids:[SKU],content_type:'product',contents:[{id:SKU,quantity}],currency:'USD',value:cents/100,num_items:quantity};
}
export function marketingAllowed(config,consent){
 return config?.marketingEnabled===true&&typeof config.metaPixelId==='string'&&/^\d{8,24}$/.test(config.metaPixelId)&&consent==='accepted';
}
