/* prep-slime-art.mjs — prepare a country slime character image for the game.
   Takes a single (right-facing) image — typically on a WHITE background, as
   delivered by the artist — and produces game-ready sprites:

     assets/slimes/{code}-right.webp   (cleaned, cropped, 512px wide)
     assets/slimes/{code}-left.webp    (mirrored, unless --left is given)

   Cleaning: background removal via flood fill from the borders — only
   near-white, low-saturation pixels CONNECTED TO THE EDGE are made
   transparent, with alpha derived from darkness so the soft baked ground
   shadow survives. White highlights/eyes inside the character are untouched.

   Usage:  node prep-slime-art.mjs <code> <right.png> [--left <left.png>]
   Example: node prep-slime-art.mjs bel ~/uploads/belgium.png
   Needs Playwright's Chromium (already a devDependency). */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const [code, rightSrc] = [process.argv[2], process.argv[3]];
const leftIx = process.argv.indexOf('--left');
const leftSrc = leftIx > 0 ? process.argv[leftIx+1] : null;
if (!code || !rightSrc){ console.error('usage: node prep-slime-art.mjs <code> <right.png> [--left <left.png>]'); process.exit(1); }

const outDir = path.join(import.meta.dirname, 'assets', 'slimes');
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const pg = await browser.newPage();

async function prep(srcPath, mirror){
  const b64 = fs.readFileSync(srcPath).toString('base64');
  const ext = /\.webp$/i.test(srcPath) ? 'webp' : 'png';
  return await pg.evaluate(async ({ b64, ext, mirror })=>{
    const img = new Image();
    await new Promise((res,rej)=>{ img.onload=res; img.onerror=rej; img.src=`data:image/${ext};base64,${b64}`; });
    const W=img.naturalWidth, H=img.naturalHeight;
    const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
    const cx=cv.getContext('2d', { willReadFrequently:true });
    cx.drawImage(img,0,0);
    const id=cx.getImageData(0,0,W,H), d=id.data;

    // flood fill from the borders over light, unsaturated pixels (the white bg + soft shadow)
    const isBg=(i)=>{ const r=d[i],g=d[i+1],b=d[i+2],a=d[i+3];
      if (a<10) return true;                                  // already transparent
      const mx=Math.max(r,g,b), mn=Math.min(r,g,b);
      return mn>=185 && (mx-mn)<30; };                        // light & near-grey
    const seen=new Uint8Array(W*H); const q=[];
    for (let x=0;x<W;x++){ q.push(x, (H-1)*W+x); }
    for (let y=0;y<H;y++){ q.push(y*W, y*W+W-1); }
    while (q.length){
      const p=q.pop(); if (seen[p]) continue; seen[p]=1;
      const i=p*4; if (!isBg(i)) continue;
      // soft alpha from darkness: pure white -> 0, the grey shadow keeps a soft presence
      const lum=(d[i]+d[i+1]+d[i+2])/3;
      const alpha=Math.max(0, Math.min(255, Math.round((255-lum)*1.35)));
      d[i+3]=Math.min(d[i+3], alpha);
      if (lum>140){ d[i]=d[i+1]=d[i+2]=60; }                  // neutralise kept shadow to dark grey
      const x=p%W, y=(p-x)/W;
      if (x>0) q.push(p-1); if (x<W-1) q.push(p+1);
      if (y>0) q.push(p-W); if (y<H-1) q.push(p+W);
    }
    cx.putImageData(id,0,0);

    // crop to content (alpha > 8) with a small margin
    let x0=W,y0=H,x1=0,y1=0;
    for (let y=0;y<H;y++) for (let x=0;x<W;x++){ if (d[(y*W+x)*4+3]>8){ if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; } }
    const M=8; x0=Math.max(0,x0-M); y0=Math.max(0,y0-M); x1=Math.min(W-1,x1+M); y1=Math.min(H-1,y1+M);
    const cw=x1-x0+1, ch=y1-y0+1;

    // scale to 512 wide, mirror if asked
    const ow=512, oh=Math.round(ch*(ow/cw));
    const out=document.createElement('canvas'); out.width=ow; out.height=oh;
    const ox=out.getContext('2d');
    ox.imageSmoothingQuality='high';
    if (mirror){ ox.translate(ow,0); ox.scale(-1,1); }
    ox.drawImage(cv, x0,y0,cw,ch, 0,0,ow,oh);
    return out.toDataURL('image/webp', 0.92);
  }, { b64, ext, mirror });
}

async function save(dataUrl, file){
  const buf=Buffer.from(dataUrl.split(',')[1], 'base64');
  fs.writeFileSync(file, buf);
  console.log(`${file}  ${(buf.length/1024).toFixed(0)} KB`);
}

await pg.goto('about:blank');
await save(await prep(rightSrc, false), path.join(outDir, `${code}-right.webp`));
await save(leftSrc ? await prep(leftSrc, false) : await prep(rightSrc, true), path.join(outDir, `${code}-left.webp`));
await browser.close();
console.log('done — add to the team in game.js:  art:{ right:\'assets/slimes/'+code+'-right.webp\', left:\'assets/slimes/'+code+'-left.webp\' }');
