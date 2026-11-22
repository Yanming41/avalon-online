// Visual fixture for the real item components; no game records or personal browser.
const http=require('http'),fs=require('fs'),path=require('path'),{spawn}=require('child_process'),W=require('ws'),assert=require('assert/strict');
const out=path.resolve(process.argv[2]||'../avalon-preview/items-ui');fs.mkdirSync(out,{recursive:true});
const root=path.resolve(__dirname,'../public'),port=3158,debug=9358;
const srv=http.createServer((q,r)=>{const p=path.join(root,q.url.split('?')[0]==='/'?'index.html':q.url.split('?')[0]);if(!p.startsWith(root+path.sep)){r.writeHead(403);return r.end();}fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);return r.end();}r.setHeader('Content-Type',p.endsWith('.js')?'application/javascript':p.endsWith('.css')?'text/css':p.endsWith('.webp')?'image/webp':'text/html');r.end(b);});});srv.on('upgrade',(_,s)=>s.destroy());
let browser,sock;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{await new Promise(r=>srv.listen(port,'127.0.0.1',r));browser=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',['--headless=new','--disable-gpu','--remote-debugging-port='+debug,'--user-data-dir='+path.join(out,'profile-'+Date.now()),'--no-first-run','about:blank'],{windowsHide:true,stdio:'ignore'});
let tabs;for(let i=0;i<50;i++){try{tabs=await(await fetch(`http://127.0.0.1:${debug}/json`,{signal:AbortSignal.timeout(500)})).json();break;}catch{await sleep(200);}}if(!tabs)throw Error('Browser debug endpoint unavailable');
sock=new W(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>sock.on('open',r));let seq=0;const jobs=new Map();sock.on('message',d=>{const m=JSON.parse(d);if(jobs.has(m.id)){jobs.get(m.id)(m);jobs.delete(m.id);}});const cmd=(method,params={})=>new Promise(r=>{jobs.set(++seq,r);sock.send(JSON.stringify({id:seq,method,params}));});
const ev=async expression=>{const m=await cmd('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(m.error||m.result.exceptionDetails)throw Error(JSON.stringify(m));return m.result.result.value;};
await cmd('Page.enable');await cmd('Runtime.enable');await cmd('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await cmd('Page.navigate',{url:`http://127.0.0.1:${port}/`});await sleep(1200);
await ev(`ws.onclose=null;ws.close();clearTimeout(reconT);stopHb();` );
const fixture=`S={phase:'quest',me:'a',hostId:'b',leader:'b',players:[{id:'a',name:'甲'},{id:'b',name:'乙'}],settings:{},team:['a'],teamSizes:[2],quest:0,questDone:[],myCards:['S','F','M']}; $('#app').innerHTML='<h2>任务出牌</h2><p>测试界面 · 仅展示组件布局</p>'+actionBar();`;
await ev(fixture.replace("myCards:", "myRole:{role:'good_sorcerer'},myCards:"));await sleep(800);
assert(await ev(`Array.from(document.querySelectorAll('.quest-choice img')).every(i=>i.complete&&i.naturalWidth>0)`));assert(await ev(`Array.from(document.querySelectorAll('.quest-choice')).every(i=>{const r=i.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight})`));
async function shot(name){const m=await cmd('Page.captureScreenshot');fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(m.result.data,'base64'));}
await shot('quest-mobile');
await ev(`S.phase='trapper';S.plot={hands:{a:[{type:'ambush'}]},pending:[]};$('#app').innerHTML=gameItems();`);await sleep(500);await shot('items-mobile');
await ev(`document.body.classList.add('tv');S.phase='plot_deal';S.plot.pending=[{type:'charge'}];$('#app').innerHTML=gameItems(true);`);await cmd('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});await sleep(400);await shot('items-screen');
await ev(`$('#app').innerHTML=loyaltyReveal({card:'switch'});`);await sleep(1000);assert(await ev(`getComputedStyle(document.querySelector('.loyalty-flip')).transform!=='none'`));await shot('loyalty');
console.log('PASS: mobile images decoded, all card buttons on screen, public display and loyalty flip rendered. Screenshots:',out);await cmd('Browser.close');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{sock?.terminate();browser?.kill();srv.close();});
