import { mkdirSync, copyFileSync } from 'node:fs';
mkdirSync('public',{recursive:true});
copyFileSync('index.html','public/index.html');
copyFileSync('success.html','public/success.html');

copyFileSync('admin.html','public/admin.html');

mkdirSync('public/assets',{recursive:true});
copyFileSync('assets/analytics.js','public/assets/analytics.js');
copyFileSync('lib/analytics-rules.mjs','public/assets/analytics-rules.mjs');

copyFileSync('track.html','public/track.html');
