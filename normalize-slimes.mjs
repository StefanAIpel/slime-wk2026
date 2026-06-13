/* normalize-slimes.mjs — make every country slime render at the SAME size.
   For each source (any framing): measure the opaque bounding box, then re-render
   into a fixed 512×512 canvas with the character width scaled to a constant and
   the baseline aligned to the bottom — so all sprites share one layout and the
   game can draw them identically. Outputs {code}-right.webp + mirrored {code}-left.webp.
   Run: node normalize-slimes.mjs */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const A = '/tmp/slmA/transparent_png_1024';
const B = '/tmp/slmB/slime_assets_1024/transparent_png';
const SRC = {
  NED: '/tmp/slimepack/netherlands_virgil_slime_idle_right_1024x512.png',
  BEL: '/tmp/belpack/belgium_debruyne_red_slime_game_character/belgium_debruyne_red_slime_idle_right_512x256.png',
  ALG: `${A}/alg_algerije_slime_1024x1024_transparent.png`,
  ARG: `${A}/arg_argentinie_messi_slime_1024x1024_transparent.png`,
  BRA: `${A}/bra_brazilie_neymar_slime_1024x1024_transparent.png`,
  CAN: `${A}/can_canada_slime_1024x1024_transparent.png`,
  COL: `${A}/col_colombia_slime_1024x1024_transparent.png`,
  GER: `${B}/02_germany_slime_transparent_1024.png`,
  FRA: `${B}/03_france_slime_transparent_1024.png`,
  ENG: `${B}/04_england_slime_transparent_1024.png`,
  EGY: `${B}/05_egypt_slime_transparent_1024.png`,
  CRO: `${B}/06_croatia_slime_transparent_1024.png`,
  JPN: `${B}/07_japan_slime_transparent_1024.png`,
};

const CW = 512, CH = 512, TARGET_W = 430, BASE_Y = 500, THRESH = 40;
const outDir = path.join(import.meta.dirname, 'assets', 'slimes');
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const pg = await browser.newPage();
await pg.goto('about:blank');

async function process(srcPath){
  const b64 = fs.readFileSync(srcPath).toString('base64');
  const ext = /\.webp$/i.test(srcPath) ? 'webp' : 'png';
  return await pg.evaluate(async ({ b64, ext, CW, CH, TARGET_W, BASE_Y, THRESH })=>{
    const img = new Image();
    await new Promise((res,rej)=>{ img.onload=res; img.onerror=rej; img.src=`data:image/${ext};base64,${b64}`; });
    const W=img.naturalWidth, H=img.naturalHeight;
    const t=document.createElement('canvas'); t.width=W; t.height=H;
    const tc=t.getContext('2d',{willReadFrequently:true}); tc.drawImage(img,0,0);
    const d=tc.getImageData(0,0,W,H).data;
    // opaque bounding box
    let x0=W,y0=H,x1=-1,y1=-1;
    for (let y=0;y<H;y++) for (let x=0;x<W;x++){ if (d[(y*W+x)*4+3]>THRESH){ if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; } }
    const bw=x1-x0+1, bh=y1-y0+1, bcx=(x0+x1)/2, bbot=y1;
    const scale=TARGET_W/bw;
    // render normalised, right-facing
    const out=document.createElement('canvas'); out.width=CW; out.height=CH;
    const oc=out.getContext('2d'); oc.imageSmoothingQuality='high';
    const dx=CW/2 - bcx*scale, dy=BASE_Y - bbot*scale;
    oc.drawImage(t, 0,0,W,H, dx,dy, W*scale, H*scale);
    // mirrored, left-facing
    const lf=document.createElement('canvas'); lf.width=CW; lf.height=CH;
    const lc=lf.getContext('2d'); lc.imageSmoothingQuality='high';
    lc.translate(CW,0); lc.scale(-1,1); lc.drawImage(out,0,0);
    return { right: out.toDataURL('image/webp',0.9), left: lf.toDataURL('image/webp',0.9),
             info:{ srcW:W, srcH:H, bw, bh, aspect:+(bh/bw).toFixed(2), scale:+scale.toFixed(3) } };
  }, { b64, ext, CW, CH, TARGET_W, BASE_Y, THRESH });
}

const save=(url,f)=>{ const buf=Buffer.from(url.split(',')[1],'base64'); fs.writeFileSync(f,buf); return buf.length; };
for (const [code, src] of Object.entries(SRC)){
  if (!fs.existsSync(src)){ console.log(`${code}  MISSING ${src}`); continue; }
  const r = await process(src);
  const kbR = (save(r.right, path.join(outDir, `${code.toLowerCase()}-right.webp`))/1024).toFixed(0);
  const kbL = (save(r.left,  path.join(outDir, `${code.toLowerCase()}-left.webp`))/1024).toFixed(0);
  console.log(`${code}  src ${r.info.srcW}x${r.info.srcH}  bbox ${r.info.bw}x${r.info.bh} (a${r.info.aspect})  scale ${r.info.scale}  -> ${kbR}/${kbL} KB`);
}
await browser.close();
console.log('done');
