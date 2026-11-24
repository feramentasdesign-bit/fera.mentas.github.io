"use strict";
/* ===== Núcleo do editor: modelo do projeto, histórico e operações ===== */
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const uid=()=>Math.random().toString(36).slice(2,9);
const fmt=s=>{s=Math.max(0,s);return Math.floor(s/60)+":"+(s%60).toFixed(1).padStart(4,"0")};
const clone=o=>JSON.parse(JSON.stringify(o));
let tt0=0;const toast=m=>{const t=$("#toast");t.textContent=m;t.hidden=false;clearTimeout(tt0);tt0=setTimeout(()=>t.hidden=true,4000)};
const DEF={speed:1,vol:100,mute:false,norm:false,hp:false,fi:0,fo:0,rot:0,flip:false,crop:null,ar:0,blur:false,fill:false,fx:1,fy:1,ox:0,oy:0,tilt:0,bri:100,con:100,sat:100,bw:false,stab:false,stabAmt:50};
const newProject=()=>({name:"Projeto sem título",ar:0,bg:"#000000",media:{},clips:[],sel:[]});
let P=newProject();const RT={};            /* P é salvo; RT guarda arquivos e elementos de vídeo (não é salvo) */
let hist=[],redoS=[],lastKey="",lastT=0,onChange=()=>{};
const clipOf=id=>P.clips.find(c=>c.id===id);
const cdur=c=>(c.out-c.in)/c.props.speed,cend=c=>c.start+cdur(c);
const vlist=()=>P.clips.filter(c=>c.track==="V1").sort((a,b)=>a.start-b.start);
const projDur=()=>P.clips.reduce((m,c)=>Math.max(m,cend(c)),0);
function repack(){let t=0;for(const c of vlist()){c.start=t;t+=cdur(c)}}
function changed(){repack();onChange()}
function commit(key){const n=performance.now();if(key&&key===lastKey&&n-lastT<900){lastT=n;return}hist.push(JSON.stringify(P));if(hist.length>100)hist.shift();redoS=[];lastKey=key||"";lastT=n}
function edit(fn,key){commit(key);fn();changed()}
function restore(s){P=JSON.parse(s);P.sel=P.sel.filter(id=>clipOf(id));lastKey="";changed()}
function undo(){if(!hist.length)return toast("Nada para desfazer.");redoS.push(JSON.stringify(P));restore(hist.pop())}
function redo(){if(!redoS.length)return toast("Nada para refazer.");hist.push(JSON.stringify(P));restore(redoS.pop())}
/* ---- mídia ---- */
function addMedia(f){return new Promise((res,rej)=>{
  const url=URL.createObjectURL(f),v=document.createElement("video");v.preload="metadata";v.muted=true;
  v.onloadedmetadata=()=>{if(!isFinite(v.duration)||!v.videoWidth){rej();return}
    const id=uid();P.media[id]={name:f.name,size:f.size,lastModified:f.lastModified,dur:v.duration,w:v.videoWidth,h:v.videoHeight};RT[id]={file:f,url};res(id);makeStrip(id);makePeaks(id)};
  v.onerror=()=>rej();v.src=url})}
async function importFiles(files){const ids=[];for(const f of files){if(!f.type.startsWith("video/"))continue;try{ids.push(await addMedia(f))}catch(e){toast("Não consegui abrir "+f.name+" (formato não suportado pelo navegador).")}}return ids}
let stripQ=Promise.resolve();
const makeStrip=id=>{stripQ=stripQ.then(()=>doStrip(id));return stripQ};
async function doStrip(id){
  const r=RT[id],m=P.media[id];
  try{const t=document.createElement("video");t.muted=true;t.preload="auto";t.src=r.url;await new Promise((a,b)=>{t.onloadeddata=a;t.onerror=b});
    const W=1200,H=56,n=Math.max(8,Math.round(W/(H*m.w/m.h))),tw=W/n,c=document.createElement("canvas");c.width=W;c.height=H;const g=c.getContext("2d");
    for(let i=0;i<n;i++){await new Promise(a=>{t.onseeked=a;t.currentTime=Math.min(m.dur-.05,(i+.5)/n*m.dur)});g.drawImage(t,i*tw,0,tw,H);
      if(i===0){const pc=document.createElement("canvas");pc.width=96;pc.height=Math.round(96*m.h/m.w);pc.getContext("2d").drawImage(t,0,0,pc.width,pc.height);r.poster=pc.toDataURL("image/jpeg",.7)}}
    r.strip=c.toDataURL("image/jpeg",.7);t.removeAttribute("src");t.load();onChange()}catch(e){}}
async function makePeaks(id){
  const r=RT[id];if(r.file.size>1.5e8)return;
  try{const C=window.AudioContext||window.webkitAudioContext,c=new C(),b=await c.decodeAudioData(await r.file.arrayBuffer());c.close();
    const N=3000,d=b.getChannelData(0),step=Math.max(1,Math.floor(d.length/N)),pk=new Float32Array(N);let sum=0,peak=0,n=0;
    for(let x=0;x<N;x++){let m=0;for(let i=x*step,e=Math.min(d.length,i+step);i<e;i+=Math.max(1,step>>5)){const a=Math.abs(d[i]);if(a>m)m=a;sum+=a*a;n++}pk[x]=m;if(m>peak)peak=m}
    const rms=Math.sqrt(sum/Math.max(1,n))||1e-6;r.ng=Math.max(.25,Math.min(4,.126/rms,.98/Math.max(peak,1e-6)));r.peaks=pk;onChange()}catch(e){}}
/* ---- operações de edição ---- */
function opAddAt(mid,time){const m=P.media[mid];edit(()=>{const c={id:uid(),track:"V1",media:mid,start:time==null?projDur()+1e3:time,in:0,out:m.dur,props:clone(DEF)};P.clips.push(c);P.sel=[c.id]})}
function opSplit(T){
  const under=c=>T>c.start+.05&&T<cend(c)-.05;let hit=P.sel.map(clipOf).filter(c=>c&&under(c));if(!hit.length)hit=P.clips.filter(under);
  if(!hit.length)return toast("Posicione o cursor dentro de um clipe, longe das bordas.");
  edit(()=>{const ns=[];for(const c of hit){const m=c.in+(T-c.start)*c.props.speed,d={...c,id:uid(),start:T,in:m,props:clone(c.props)};d.props.fi=0;c.props.fo=0;c.out=m;P.clips.push(d);ns.push(d.id)}P.sel=ns})}
function opDel(){if(!P.sel.length)return;edit(()=>{P.clips=P.clips.filter(c=>!P.sel.includes(c.id));P.sel=[]})}
function opDup(){
  const cs=P.sel.map(clipOf).filter(Boolean);if(!cs.length)return;
  edit(()=>{const ns=[];for(const c of cs){const d={...c,id:uid(),props:clone(c.props)};d.start=c.track==="V1"?c.start+1e-4:cend(c);P.clips.push(d);ns.push(d.id)}P.sel=ns})}
function opSep(){
  const cs=P.sel.map(clipOf).filter(c=>c&&c.track==="V1"&&!c.props.mute);if(!cs.length)return toast("Selecione um clipe de vídeo que tenha áudio.");
  edit(()=>{const ns=[];for(const c of cs){const p=c.props,a={id:uid(),track:"A1",media:c.media,start:c.start,in:c.in,out:c.out,props:{...clone(DEF),speed:p.speed,vol:p.vol,fi:p.fi,fo:p.fo,hp:p.hp,norm:p.norm}};P.clips.push(a);p.mute=true;ns.push(a.id)}P.sel=ns})}
function setV1Order(ids){let t=0;for(const id of ids){const c=clipOf(id);c.start=t;t+=cdur(c)}}
function setProp(k,v){const cs=P.sel.map(clipOf).filter(Boolean);if(!cs.length)return;edit(()=>cs.forEach(c=>c.props[k]=v),"p:"+k+cs.map(c=>c.id).join())}
