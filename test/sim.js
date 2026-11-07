const WebSocket=require('ws');const N=7;const cl=[];let code;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function mk(i){return new Promise(res=>{const w=new WebSocket('ws://localhost:3123');const c={w,s:null,i};w.on('message',d=>{const m=JSON.parse(d);if(m.t==='state')c.s=m.s;if(m.t==='joined')code=m.code;if(m.t==='error')console.log('ERR',i,m.m)});w.on('open',()=>res(c));cl.push(c)})}
(async()=>{for(let i=0;i<N;i++){const c=await mk(i);c.w.send(JSON.stringify({t:i?'join':'create',code,name:'P'+i,token:'t'+i}));await sleep(80)}
const S=()=>cl[0].s;cl[0].w.send(JSON.stringify({t:'settings',settings:{mordred:true}}));await sleep(50);cl[0].w.send(JSON.stringify({t:'start'}));await sleep(100);
for(const c of cl)console.log(c.s.myRole.name,c.s.myRole.sees.map(x=>x.tag).join(','));
let guard=0;while(S().phase!=='end'&&guard++<400){const s=S();const by=id=>cl.find(c=>c.s.me===id);
 if(s.phase==='propose'){by(s.leader).w.send(JSON.stringify({t:'propose',team:s.players.slice(0,s.teamSizes[s.quest]).map(p=>p.id)}))}
 else if(s.phase==='vote'){for(const c of cl)c.w.send(JSON.stringify({t:'vote',approve:Math.random()<.6}))}
 else if(s.phase==='quest'){for(const id of s.team)by(id).w.send(JSON.stringify({t:'quest',success:false}))}
 else if(s.phase==='assassin'){const a=by(s.assassin);const t=a.s.players.find(p=>!a.s.myRole.sees.some(x=>x.id===p.id)&&p.id!==a.s.me);a.w.send(JSON.stringify({t:'assassinate',id:t.id}))}
 await sleep(60)}
console.log(S().phase,S().winner,S().reason,JSON.stringify(S().results));process.exit(0)})();
