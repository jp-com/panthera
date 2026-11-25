// Request limits are enforced while reading the stream, not after buffering it.
export async function boundedText(req,max){
 const len=req.headers.get('content-length');
 if(len!==null&&(!/^\d+$/.test(len)||Number(len)>max))throw Error('Invalid body length');
 if(!req.body)return '';
 const reader=req.body.getReader(),chunks=[];let count=0;
 try{
  while(true){const {done,value}=await reader.read();if(done)break;count+=value.byteLength;if(count>max){await reader.cancel();throw Error('Body too large')}chunks.push(value)}
  const all=new Uint8Array(count);let offset=0;for(const chunk of chunks){all.set(chunk,offset);offset+=chunk.byteLength}
  return new TextDecoder('utf-8',{fatal:true}).decode(all);
 }finally{reader.releaseLock()}
}
export function exactOrigin(req,configured){
 if(typeof configured!=='string')return false;
 try{const u=new URL(configured);return u.protocol==='https:'&&u.origin===configured&&req.headers.get('origin')===configured}catch{return false}
}
export function jsonContent(req){return /^application\/json(?:\s*;|$)/i.test(req.headers.get('content-type')||'')}
export function safeTotal(expected,actual){return Number.isSafeInteger(expected)&&expected>0&&expected===Number(actual)}
