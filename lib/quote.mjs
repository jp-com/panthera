// Server-only domain rules. Database rows must come from trusted backend reads,
// not request JSON. This module does not create orders or charge customers.
export function quote({product,inventory,rates,settings,quantity,country,method}) {
  const deny = (code) => ({ok:false,code});
  if (settings?.checkout_enabled !== true) return deny("CHECKOUT_DISABLED");
  if (!Number.isSafeInteger(quantity)||quantity<1||quantity>10) return deny("INVALID_QUANTITY");
  if (typeof country!=="string"||!/^[A-Z]{2}$/.test(country)||!["sea","air"].includes(method)) return deny("INVALID_DESTINATION");
  if (product?.available_for_sale!==true||product.currency!=="USD"||!Number.isSafeInteger(product.unit_price_cents)||product.unit_price_cents<=0) return deny("UNAVAILABLE");
  if (!Number.isSafeInteger(inventory?.on_hand)||!Number.isSafeInteger(inventory?.reserved)||inventory.reserved<0||inventory.reserved>inventory.on_hand||inventory.on_hand-inventory.reserved<quantity) return deny("OUT_OF_STOCK");
  const rate=rates.find(r=>r.country_code===country&&r.method===method&&r.enabled===true&&r.currency===product.currency);
  if (!rate||!Number.isSafeInteger(rate.per_unit_cents)||rate.per_unit_cents<0||!Number.isSafeInteger(rate.min_business_days)||!Number.isSafeInteger(rate.max_business_days)||rate.min_business_days<1||rate.max_business_days<rate.min_business_days) return deny("SHIPPING_UNAVAILABLE");
  const subtotal=quantity*product.unit_price_cents, shipping=quantity*rate.per_unit_cents;
  if (!Number.isSafeInteger(subtotal+shipping)) return deny("INVALID_TOTAL");
  return {ok:true,currency:product.currency,sku:product.sku,quantity,subtotal_cents:subtotal,shipping_cents:shipping,pre_tax_total_cents:subtotal+shipping,country,method,min_business_days:rate.min_business_days,max_business_days:rate.max_business_days};
}
