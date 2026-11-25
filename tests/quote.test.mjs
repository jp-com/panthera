import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quote } from '../lib/quote.mjs';

const base = {
  product: {sku:'PANTHER-BLACK-80',currency:'USD',unit_price_cents:74500,available_for_sale:true},
  inventory:{on_hand:5,reserved:1},
  rates:[{country_code:'US',method:'sea',currency:'USD',per_unit_cents:0,min_business_days:20,max_business_days:40,enabled:true},{country_code:'US',method:'air',currency:'USD',per_unit_cents:20000,min_business_days:5,max_business_days:10,enabled:true}],
  settings:{checkout_enabled:true},quantity:2,country:'US',method:'sea'
};
// All values here are synthetic test fixtures, not approved shipping rates.
test('checkout disabled by default',()=>assert.equal(quote({...base,settings:{}}).code,'CHECKOUT_DISABLED'));
test('reject invalid quantity',()=>{for(const quantity of [0,-1,1.5,'2',11])assert.equal(quote({...base,quantity}).code,'INVALID_QUANTITY')});
test('unapproved product unavailable',()=>assert.equal(quote({...base,product:{...base.product,available_for_sale:false}}).code,'UNAVAILABLE'));
test('cannot sell reserved stock',()=>assert.equal(quote({...base,quantity:5}).code,'OUT_OF_STOCK'));
test('unsupported destination fails closed',()=>assert.equal(quote({...base,country:'GB'}).code,'SHIPPING_UNAVAILABLE'));
test('disabled rates unavailable',()=>assert.equal(quote({...base,rates:base.rates.map(r=>({...r,enabled:false}))}).code,'SHIPPING_UNAVAILABLE'));
test('included sea shipping',()=>assert.equal(quote(base).pre_tax_total_cents,149000));
test('air shipping calculated per unit',()=>assert.equal(quote({...base,method:'air'}).pre_tax_total_cents,189000));
test('client totals ignored',()=>assert.equal(quote({...base,subtotal_cents:1,shipping_cents:-100}).pre_tax_total_cents,149000));
test('invalid shipping method rejected',()=>assert.equal(quote({...base,method:'express'}).code,'INVALID_DESTINATION'));
