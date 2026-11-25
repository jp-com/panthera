import {createHash,timingSafeEqual} from 'node:crypto';
// A single-operator, read-only access token. Never use a human-memorable password.
export function authorize(header,secret){
 if(typeof secret!=='string'||!/^[a-f0-9]{64}$/i.test(secret)||typeof header!=='string'||!/^Bearer [a-f0-9]{64}$/i.test(header))return false;
 const hash=s=>createHash('sha256').update(s).digest();
 return timingSafeEqual(hash(header.slice(7)),hash(secret));
}
