import {json} from '../lib/server.mjs';
export async function GET(){
 const id=process.env.META_PIXEL_ID||'';
 const enabled=process.env.VERCEL_ENV==='production'&&process.env.MARKETING_TRACKING_ENABLED==='true'&&/^\d{8,24}$/.test(id);
 return json({marketingEnabled:enabled,metaPixelId:enabled?id:null});
}
