import { mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { Script } from 'node:vm';
mkdirSync('public/assets',{recursive:true});
for(const name of ['index','admin','track','success']){
 let n=0;const html=readFileSync(name+'.html','utf8').replace(/<script>([\s\S]*?)<\/script>/g,(_,code)=>{
  const path='/assets/'+name+'-app-'+(++n)+'.js';
  new Script(code,{filename:path});
  writeFileSync('public'+path,code);
  return '<script src="'+path+'"></script>';
 });
 if(/<script\s*>/i.test(html)||/<[^>]+\son[a-z]+\s*=/i.test(html))throw Error('Inline script or event handler found: '+name);
 writeFileSync('public/'+name+'.html',html);
}
copyFileSync('assets/analytics.js','public/assets/analytics.js');
copyFileSync('lib/analytics-rules.mjs','public/assets/analytics-rules.mjs');
