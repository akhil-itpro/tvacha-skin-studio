import test from 'node:test';
import assert from 'node:assert/strict';
import { faceCrop, pixelHints } from './photo-quality.ts';

test('face framing retains an off-centre subject with forehead/chin context inside the original image',()=>{
  for(const box of [
    {originX:.03,originY:.2,width:.25,height:.3},
    {originX:.7,originY:.05,width:.25,height:.3},
    {originX:.35,originY:.6,width:.25,height:.3},
  ]){
    const w=1600,h=1200,crop=faceCrop(w,h,box);
    assert.ok(crop.x>=0&&crop.y>=0&&crop.x+crop.width<=w&&crop.y+crop.height<=h);
    assert.ok(crop.x<=box.originX*w&&crop.x+crop.width>=(box.originX+box.width)*w-1);
    assert.ok(crop.y<=box.originY*h&&crop.y+crop.height>=(box.originY+box.height)*h-1);
    assert.ok(crop.width*crop.height<w*h);
  }
});
test('missing, tiny and invalid face detections preserve the complete photo',()=>{
  const full={x:0,y:0,width:160,height:120};
  for(const box of [undefined,{originX:.1,originY:.1,width:.01,height:.01},{originX:NaN,originY:0,width:.2,height:.2},{originX:-.4,originY:0,width:.2,height:.2}])assert.deepEqual(faceCrop(160,120,box),full);
});
test('pixel hints handle low light, soft detail and tiny frames without changing any pixels',()=>{
  const pixels=new Uint8ClampedArray(16*16*4).fill(20),original=pixels.slice();
  assert.deepEqual(pixelHints(pixels,16,16),{light:false,sharp:false});assert.deepEqual(pixels,original);
  assert.deepEqual(pixelHints(new Uint8ClampedArray(4),1,1),{light:false,sharp:false});
  for(let i=0;i<pixels.length;i++)pixels[i]=120;
  assert.deepEqual(pixelHints(pixels,16,16),{light:true,sharp:false});
});
