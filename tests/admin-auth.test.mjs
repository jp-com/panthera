import {test} from 'node:test';
import assert from 'node:assert/strict';
import {authorize} from '../lib/admin-auth.mjs';
const token='a'.repeat(64);
test('admin fails closed without valid secret',()=>{for(const value of [undefined,'password','', 'a'.repeat(63)])assert.equal(authorize('Bearer '+token,value),false)});
test('admin requires exact bearer token',()=>{for(const h of [null,token,'Bearer '+ 'b'.repeat(64),'Bearer '+token+'x'])assert.equal(authorize(h,token),false)});
test('admin accepts exact configured token',()=>assert.equal(authorize('Bearer '+token,token),true));
