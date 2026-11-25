import {test} from 'node:test';import assert from 'node:assert/strict';import {issueTrackingToken,verifyTrackingToken,trackingReady} from '../lib/tracking-token.mjs';
const id='a'.repeat(8)+'-aaaa-4aaa-aaaa-'+'a'.repeat(12),key='a'.repeat(64),now=1800000000;
test('valid tracking capability',()=>{assert.equal(verifyTrackingToken(issueTrackingToken(id,key,now),key,now),id)});
test('token expiry',()=>assert.equal(verifyTrackingToken(issueTrackingToken(id,key,now),key,now+180*86400),null));
test('tampering and wrong secret rejected',()=>{const token=issueTrackingToken(id,key,now);assert.equal(verifyTrackingToken(token.replace(/^a/,'b'),key,now),null);assert.equal(verifyTrackingToken(token,'b'.repeat(64),now),null);assert.equal(verifyTrackingToken(id,key,now),null)});
test('missing weak configuration fails closed',()=>{assert.equal(trackingReady('password'),false);assert.throws(()=>issueTrackingToken(id,'password',now));assert.equal(verifyTrackingToken(issueTrackingToken(id,key,now),undefined,now),null)});
