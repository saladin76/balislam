/**
 * Studio V2 isolated visual QA. No production state is changed.
 * Requires: Node >=22, a running Vite preview on 127.0.0.1:4322 and Chrome.
 */
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';

const url = process.env.STUDIO_V2_QA_URL || 'http://127.0.0.1:4322/scene-review-qa.html';
const target = new URL(url);
if (target.protocol !== 'http:' || !['localhost','127.0.0.1'].includes(target.hostname)) {
  throw Error('Only a local, HTTP QA URL is permitted.');
}
const output = resolve(process.env.STUDIO_V2_QA_OUTPUT || 'app/qa-artifacts');
const chrome = [process.env.CHROME_BIN, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/chromium'].find(p => p && existsSync(p));
if (!chrome) throw Error('Chrome not found. Set CHROME_BIN to its executable.');
if (typeof WebSocket !== 'function') throw Error('Node >=22 is required.');
const probe = await fetch(url, {signal: AbortSignal.timeout(4000)}).catch(e => { throw Error('Start Vite on port 4322 first: ' + e.message); });
if (!probe.ok) throw Error('QA page returned HTTP ' + probe.status);
await mkdir(output,{recursive:true});
const profile = await mkdtemp(join(tmpdir(),'studio-v2-viewport-'));
const pause = ms => new Promise(done => setTimeout(done,ms));
let child;
let socket;
try {
  child = spawn(chrome, [
    ...(process.platform === 'linux' && process.getuid?.() === 0 ? ['--no-sandbox'] : []),
    '--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',
    '--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'
  ],{stdio:['ignore','ignore','pipe']});
  const wsUrl = await new Promise((ok,bad)=>{
    let buffer='';
    const timeout=setTimeout(()=>bad(Error('Chrome DevTools startup timed out: '+buffer.slice(-500))),12000);
    child.on('error',bad);
    child.stderr.on('data',chunk=>{
      buffer+=String(chunk);
      const found=buffer.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if(found){clearTimeout(timeout);ok(found[1]);}
      if(buffer.length>10000) buffer=buffer.slice(-5000);
    });
    child.on('exit',code=>{clearTimeout(timeout);bad(Error('Chrome quit: '+code+' '+buffer.slice(-500)));});
  });
  socket = new WebSocket(wsUrl);
  await new Promise((ok,bad)=>{
    socket.addEventListener('open',ok,{once:true});
    socket.addEventListener('error',bad,{once:true});
  });
  let seq=0;
  const pending=new Map();
  socket.addEventListener('message',event=>{
    let message;
    try{message=JSON.parse(event.data);}catch{return;}
    const p=pending.get(message.id);
    if(!p)return;
    pending.delete(message.id);
    clearTimeout(p.timeout);
    if(message.error)p.bad(Error(message.error.message));else p.ok(message.result||{});
  });
  const send=(method,params={},sessionId)=>new Promise((ok,bad)=>{
    const id=++seq;
    const timeout=setTimeout(()=>{pending.delete(id);bad(Error('CDP timeout: '+method));},15000);
    pending.set(id,{ok,bad,timeout});
    socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));
  });
  const evaluate=async(expression,sessionId)=>{
    const answer=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},sessionId);
    if(answer.exceptionDetails)throw Error('Page runtime error: '+answer.exceptionDetails.text);
    return answer.result?.value;
  };
  const {targetId}=await send('Target.createTarget',{url:'about:blank'});
  const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
  await send('Page.enable',{},sessionId);
  await send('Runtime.enable',{},sessionId);

  const measurement = String.raw`(() => {
    const box = selector => {
      const element=document.querySelector(selector);
      if(!element)return null;
      const r=element.getBoundingClientRect();
      return {left:r.left,right:r.right,width:r.width,height:r.height};
    };
    const selectors=['.v2-header','.v2-layout','.v2-main','.v2-scene-heading',
      '.v2-video-shell','.v2-player-controls','.v2-notes','.v2-inspector'];
    const elements=Object.fromEntries(selectors.map(key=>[key,box(key)]));
    const viewport=window.innerWidth;
    const outside=Object.entries(elements).filter(([,r])=>r && (r.left < -2 || r.right > viewport+2))
      .map(([name,r])=>({name,left:Math.round(r.left),right:Math.round(r.right)}));
    const video=document.querySelector('video');
    return {
      location:location.href,viewport,screenWidth:screen.width,
      documentWidth:document.documentElement.scrollWidth,
      reviewWidth:document.querySelector('.v2-review')?.scrollWidth ?? null,
      outside,elements,
      video:video?{readyState:video.readyState,networkState:video.networkState,
        duration:Number.isFinite(video.duration)?video.duration:null}:null
    };
  })()`;
  const results=[];
  for(const device of [
    {name:'desktop',width:1600,height:1000,mobile:false},
    {name:'mobile',width:390,height:844,mobile:true}
  ]) {
    await send('Emulation.setDeviceMetricsOverride',{
      width:device.width,height:device.height,deviceScaleFactor:1,mobile:device.mobile,
      screenWidth:device.width,screenHeight:device.height
    },sessionId);
    await send('Emulation.setTouchEmulationEnabled',{enabled:device.mobile,maxTouchPoints:1},sessionId);
    await send('Page.navigate',{url},sessionId);
    const ready=await evaluate(`new Promise(resolve=>{
      let count=0;
      const timer=setInterval(()=>{
        if(document.querySelector('.v2-video-shell') && document.readyState==='complete'){
          clearInterval(timer);resolve(true);
        }else if(++count>=100){clearInterval(timer);resolve(false);}
      },100);
    })`,sessionId);
    if(!ready) {
      const observed=await evaluate('({href:location.href,title:document.title})',sessionId);
      throw Error('React QA page did not render: '+JSON.stringify(observed));
    }
    await evaluate('document.fonts.ready.then(() => true)',sessionId);
    await pause(700);
    const metrics=await evaluate(measurement,sessionId);
    const image=await send('Page.captureScreenshot',{
      format:'png',captureBeyondViewport:false,fromSurface:true
    },sessionId);
    await writeFile(join(output,device.name+'-emulated.png'),Buffer.from(image.data,'base64'));
    const problems=[];
    if(metrics.viewport!==device.width)problems.push('Incorrect layout viewport: '+metrics.viewport);
    if(metrics.documentWidth>metrics.viewport+2)problems.push('Horizontal document overflow');
    if(metrics.reviewWidth>metrics.viewport+2)problems.push('Review container overflows');
    if(metrics.outside.length)problems.push('Panels clipped: '+metrics.outside.map(x=>x.name).join(','));
    results.push({device:device.name,expectedWidth:device.width,passed:problems.length===0,problems,metrics});
    console.log(device.name+' '+(problems.length?'FAIL':'PASS')+
      ' viewport='+metrics.viewport+' document='+metrics.documentWidth+
      ' outside='+(metrics.outside.map(x=>x.name).join(',')||'none'));
  }
  await writeFile(join(output,'viewport-metrics.json'),JSON.stringify({url,results},null,2));
  console.log('QA evidence:',output);
  if(results.some(r=>!r.passed)) process.exitCode=1;
} finally {
  socket?.close();
  if(child && child.exitCode===null){
    child.kill('SIGTERM');
    await Promise.race([new Promise(ok=>child.once('exit',ok)),pause(1400)]);
    if(child.exitCode===null)child.kill('SIGKILL');
  }
  await rm(profile,{recursive:true,force:true,maxRetries:2,retryDelay:200});
}
