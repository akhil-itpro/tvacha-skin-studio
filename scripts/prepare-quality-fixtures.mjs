// Public MediaPipe regression portrait; never uses a visitor's photo or app records.
import fs from 'node:fs/promises';
import sharp from 'sharp';
const source='https://storage.googleapis.com/mediapipe-assets/portrait.jpg';
const response=await fetch(source,{signal:AbortSignal.timeout(15000)});
if(!response.ok)throw new Error('Public fixture unavailable: '+response.status);
const bytes=Buffer.from(await response.arrayBuffer());
const {width,height}=await sharp(bytes).metadata();
const region={left:Math.round(width*.17),top:0,width:Math.round(width*.64),height:Math.round(height*.64)};
const clear=await sharp(bytes).extract(region).jpeg({quality:92}).toBuffer();
const degraded=await sharp(bytes).extract(region).resize({width:240}).blur(.8).modulate({brightness:.65}).jpeg({quality:35}).toBuffer();
await fs.mkdir(new URL('../outputs/photo-qa/',import.meta.url),{recursive:true});
for(const [name,value] of [['portrait-source.jpg',bytes],['portrait-clear.jpg',clear],['portrait-low-quality.jpg',degraded]])
  await fs.writeFile(new URL('../outputs/photo-qa/'+name,import.meta.url),value);
process.stdout.write(JSON.stringify({source,clearBytes:clear.length,degradedBytes:degraded.length})+'\n');
