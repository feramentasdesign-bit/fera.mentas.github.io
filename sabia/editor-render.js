"use strict";
/* ===== Motor de reprodução, desenho e exportação ===== */
const cv=$("#cv"),ctx=cv.getContext("2d");
let T=0,playing=false,exporting=false,busy=false,cancelled=false,rec=null,chunks=[],mime="",ac=null,master=null,dest=null,lastNow=0,cropEditing=false;
const STAB={},PV=1280;
/* ---- geometria ---- */
const dimsOf=(p,m)=>p.rot%180!==0?[m.h,m.w]:[m.w,m.h];
const coverScale=(deg,W,H)=>{const t=Math.abs(deg)*Math.PI/180;return Math.cos(t)+Math.max(W/H,H/W)*Math.sin(t)};
const cssFilter=p=>p.bri===100&&p.con===100&&p.sat===100&&!p.bw?"none":`brightness(${p.bri/100}) contrast(${p.con/100}) saturate(${p.sat/100})${p.bw?" grayscale(1)":""}`;
function baseAR(){if(P.ar)return P.ar;const c=vlist()[0];if(!c)return 16/9;const[pw,ph]=dimsOf(c.props,P.media[c.media]);return pw/ph}
function baseDims(){
  const a=baseAR(),c=vlist()[0];let L=1920;
  if(!P.ar&&c){const[pw,ph]=dimsOf(c.props,P.media[c.media]);L=Math.min(1920,Math.max(pw,ph))}
  return a>=1?[L,Math.round(L/a)]:[Math.round(L*a),L];
}
function canvasSize(){
  const[bw,bh]=baseDims();let k;
  if(busy){const mh=+($("#hmax")?$("#hmax").value:0);k=mh&&bh>mh?mh/bh:1}else k=Math.min(1,PV/Math.max(bw,bh));
  let w=Math.round(bw*k),h=Math.round(bh*k);w+=w%2;h+=h%2;if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h}
}
/* ---- transformação livre: o quadro inteiro (R) se ajusta ao projeto; o recorte é uma máscara (M) sobre ele ---- */
function clipRects(c,W,H){
  const p=c.props,m=P.media[c.media],[pw,ph]=dimsOf(p,m),s0=p.fill?Math.max(W/pw,H/ph):Math.min(W/pw,H/ph);
  const Dw=pw*s0*p.fx,Dh=ph*s0*p.fy,cx=W/2+p.ox*W,cy=H/2+p.oy*H,cr=p.crop||{x:0,y:0,w:1,h:1};
  const R={x:cx-Dw/2,y:cy-Dh/2,w:Dw,h:Dh};
  return{R,M:{x:R.x+cr.x*Dw,y:R.y+cr.y*Dh,w:cr.w*Dw,h:cr.h*Dh},pw,ph,cx,cy,Dw,Dh};
}
function paintClip(g,el,c,W,H,o){
  o=o||{};const p=c.props,m=P.media[c.media],q=clipRects(c,W,H),M=q.M,f=cssFilter(p);
  g.save();
  if(p.blur){const s=Math.max(W/q.pw,H/q.ph)*1.2;g.setTransform(1,0,0,1,0,0);g.translate(W/2,H/2);g.scale(s*(p.flip?-1:1),s);g.rotate(p.rot*Math.PI/180);
    g.filter=`blur(${Math.round(H*.03)}px)`+(f!=="none"?" "+f:"");g.drawImage(el,-m.w/2,-m.h/2);g.filter="none";g.setTransform(1,0,0,1,0,0);g.fillStyle="rgba(0,0,0,.3)";g.fillRect(0,0,W,H)}
  if(!o.cropEdit){g.beginPath();g.rect(M.x,M.y,M.w,M.h);g.clip()}
  g.setTransform(1,0,0,1,q.cx,q.cy);g.scale(q.Dw/q.pw,q.Dh/q.ph);g.rotate(p.tilt*Math.PI/180);
  const S=coverScale(p.tilt,q.pw,q.ph)*(o.zoom||1);g.scale(S,S);g.scale(p.flip?-1:1,1);g.rotate(p.rot*Math.PI/180);if(o.shift)g.translate(o.shift.x,o.shift.y);
  g.filter=f;g.drawImage(el,-m.w/2,-m.h/2);g.filter="none";g.restore();
  if(o.cropEdit){g.save();g.fillStyle="rgba(1,30,62,.55)";g.beginPath();g.rect(0,0,W,H);g.rect(M.x,M.y,M.w,M.h);g.fill("evenodd");g.restore()}
  return q;
}
function fadeOf(c,t){const lt=t-c.start,d=cdur(c),p=c.props;let f=1;if(p.fi>0)f=Math.min(f,lt/p.fi);if(p.fo>0)f=Math.min(f,(d-lt)/p.fo);return Math.max(0,Math.min(1,f))}
/* ---- elementos de mídia e áudio ---- */
function audioCtx(){if(ac)return ac;const C=window.AudioContext||window.webkitAudioContext;ac=new C();master=ac.createGain();master.connect(ac.destination);return ac}
function rtEls(mid){
  const r=RT[mid];
  if(!r.vel){r.vel=document.createElement("video");r.vel.muted=true;r.vel.playsInline=true;r.vel.preload="auto";r.vel.className="vh";r.vel.src=r.url;document.body.appendChild(r.vel);
    r.ael=document.createElement("audio");r.ael.preload="auto";r.ael.src=r.url}
  if(ac&&!r.g){const s=ac.createMediaElementSource(r.ael);r.hp=ac.createBiquadFilter();r.hp.type="highpass";r.hp.frequency.value=5;r.g=ac.createGain();s.connect(r.hp);r.hp.connect(r.g);r.g.connect(master)}
  return r;
}
function activeV(){
  if(cropEditing){const s=P.sel.length===1&&clipOf(P.sel[0]);if(s&&s.track==="V1")return s}
  const v=vlist(),hit=v.find(c=>T>=c.start&&T<cend(c)-1e-6);
  return hit||(v.length&&T>=cend(v[v.length-1])-1e-6?v[v.length-1]:undefined);
}
function syncEl(el,mt,sp,play){
  el.playbackRate=sp;if(!el.seeking&&Math.abs(el.currentTime-mt)>(play?.3:.04))el.currentTime=mt;
  if(play){if(el.paused)el.play().catch(()=>{})}else if(!el.paused)el.pause();
}
function syncMedia(){
  const used=new Set(),av=activeV();
  if(av){const r=rtEls(av.media),mt=Math.max(av.in,Math.min(av.out-.02,av.in+(T-av.start)*av.props.speed));syncEl(r.vel,mt,av.props.speed,playing&&!cropEditing);used.add(r.vel)}
  if(playing){for(const c of P.clips){
    if(T<c.start||T>=cend(c)-1e-6||!(c.track==="A1"||!c.props.mute))continue;
    const r=rtEls(c.media);if(used.has(r.ael))continue;
    syncEl(r.ael,c.in+(T-c.start)*c.props.speed,c.props.speed,true);
    if(r.g){const ng=exporting&&c.props.norm?(RT[c.media].ng||1):1;r.g.gain.setTargetAtTime(c.props.vol/100*fadeOf(c,T)*ng,ac.currentTime,.03);r.hp.frequency.value=c.props.hp?90:5}
    used.add(r.ael)}}
  for(const id in RT){const r=RT[id];if(!r.vel)continue;if(!used.has(r.vel)&&!r.vel.paused)r.vel.pause();if(!used.has(r.ael)&&!r.ael.paused)r.ael.pause()}
}
/* ---- quadro ---- */
let lastQ=null;
function draw(){
  canvasSize();const W=cv.width,H=cv.height,s1=sel1(),c=activeV(),cropV=cropEditing&&!busy&&!!s1&&s1.track==="V1"&&c===s1;
  let el=null;if(c){el=rtEls(c.media).vel;if(el.readyState<2&&!busy){placeSel(c,lastQ);return}}
  ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle=P.bg;ctx.fillRect(0,0,W,H);let q=null;
  if(c){const p=c.props,st=exporting&&p.stab?(STAB[c.id]||(STAB[c.id]=makeStab(el,p.stabAmt))):null;
    q=paintClip(ctx,el,c,W,H,{cropEdit:cropV,shift:st&&st.step(),zoom:st?1+2*(.02+.06*p.stabAmt/100):1});
    if(!cropV){const f=fadeOf(c,T);if(f<1){ctx.fillStyle=`rgba(0,0,0,${1-f})`;ctx.fillRect(0,0,W,H)}}}
  lastQ=q;placeSel(c,q);
}
let lastLoop=0;
function loop(now){
  const dt=Math.min(.1,(now-lastLoop)/1000);lastLoop=now;
  if(playing){T+=dt;const D=projDur();if(T>=D){T=D;playing=false;if(exporting)finishExport()}}
  syncMedia();draw();syncTimeUI();if(exporting&&projDur())setBar(T/projDur());
  requestAnimationFrame(loop);
}
const seek=t=>{T=Math.max(0,Math.min(projDur(),t))};
async function play(){if(!P.clips.length)return;audioCtx();await ac.resume();if(T>=projDur()-.05)T=0;cropEditing=false;if(typeof updCE==="function")updCE();playing=true}
const pause=()=>{playing=false};
/* ---- exportação em tempo real (MP4/WebM) ---- */
const pickMime=f=>window.MediaRecorder?(f==="webm"?["video/webm;codecs=vp9,opus","video/webm;codecs=vp8,opus","video/webm"]:["video/mp4;codecs=avc1.42E01E,mp4a.40.2","video/mp4","video/webm;codecs=vp9,opus","video/webm"]).find(m=>MediaRecorder.isTypeSupported(m)):null;
function saveBlob(blob,ext){const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=(P.name||"projeto")+"."+ext;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000);toast("Exportado.")}
async function exportVideo(f){
  mime=pickMime(f);if(!mime||!cv.captureStream){toast("Este navegador não consegue exportar vídeo. Use o Chrome ou o Edge no computador.");return}
  if(!P.clips.length){toast("Adicione ao menos um vídeo à linha do tempo.");return}
  pause();cropEditing=false;busy=exporting=true;cancelled=false;lockUI(true);showProg("Exportando… Mantenha esta aba visível até terminar.");
  audioCtx();await ac.resume();dest=ac.createMediaStreamDestination();master.disconnect();master.connect(dest);
  for(const k in STAB)delete STAB[k];
  T=0;await new Promise(r=>setTimeout(r,350));
  const stream=cv.captureStream(30);dest.stream.getAudioTracks().forEach(t=>stream.addTrack(t));
  const bps=Math.max(4e5,Math.round(cv.width*cv.height*30*(.04+.12*(+$("#qual").value)/100)));
  rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:bps});chunks=[];
  rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
  rec.onstop=()=>{master.disconnect();master.connect(ac.destination);dest=null;busy=exporting=false;lockUI(false);hideProg();if(cancelled)return;saveBlob(new Blob(chunks,{type:mime.split(";")[0]}),mime.includes("mp4")?"mp4":"webm")};
  rec.start(500);lastLoop=performance.now();playing=true;
}
function finishExport(){if(!exporting||!rec||rec.state==="inactive")return;setTimeout(()=>{if(rec.state!=="inactive")rec.stop()},200)}
function cancelExport(){cancelled=true;playing=false;if(rec&&rec.state!=="inactive")rec.stop();else{busy=exporting=false;lockUI(false);hideProg()}}
/* estabilização automática: estima o deslocamento entre quadros e compensa */
function makeStab(v,pct){
  const a=.8+.17*pct/100,M=.02+.06*pct/100,cw=320,ch=Math.max(40,Math.round(cw*v.videoHeight/v.videoWidth)),c=document.createElement("canvas");c.width=cw;c.height=ch;
  const g=c.getContext("2d",{willReadFrequently:true}),sc=v.videoWidth/cw,lim={x:M*v.videoWidth,y:M*v.videoHeight},R=6,m=R+3;let prev=null;const P0={x:0,y:0},Q={x:0,y:0};
  const gray=()=>{g.drawImage(v,0,0,cw,ch);const d=g.getImageData(0,0,cw,ch).data,o=new Uint8Array(cw*ch);for(let i=0,j=0;j<o.length;i+=4,j++)o[j]=(d[i]*77+d[i+1]*150+d[i+2]*29)>>8;return o};
  const sad=(A,B,dx,dy)=>{let s=0;for(let y=m;y<ch-m;y+=2){const ya=y*cw,yb=(y+dy)*cw+dx;for(let x=m;x<cw-m;x+=2)s+=Math.abs(A[ya+x]-B[yb+x])}return s};
  const sub=(f0,fm,fp)=>{const d=fm-2*f0+fp;return d>0?Math.max(-.5,Math.min(.5,(fm-fp)/(2*d))):0};
  return{reset(){prev=null},step(){
    const cur=gray();let mx=0,my=0;
    if(prev){let best=1e18,bx=0,by=0;for(let dy=-R;dy<=R;dy++)for(let dx=-R;dx<=R;dx++){const s=sad(prev,cur,dx,dy);if(s<best){best=s;bx=dx;by=dy}}
      mx=Math.abs(bx)<R?bx+sub(best,sad(prev,cur,bx-1,by),sad(prev,cur,bx+1,by)):bx;my=Math.abs(by)<R?by+sub(best,sad(prev,cur,bx,by-1),sad(prev,cur,bx,by+1)):by}
    prev=cur;P0.x+=mx*sc;P0.y+=my*sc;Q.x=a*Q.x+(1-a)*P0.x;Q.y=a*Q.y+(1-a)*P0.y;
    const sx=Math.max(-lim.x,Math.min(lim.x,Q.x-P0.x)),sy=Math.max(-lim.y,Math.min(lim.y,Q.y-P0.y));Q.x=P0.x+sx;Q.y=P0.y+sy;return{x:sx,y:sy}}};
}
