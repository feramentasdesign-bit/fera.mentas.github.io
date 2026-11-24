"use strict";
/* ===== Interface: telas, mídia, linha do tempo, ajustes e atalhos ===== */
let pps=60,drag=null,scrubbing=false,snapOn=true;
const tlin=$("#tlin"),tls=$("#tls");
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fmtS=t=>Math.floor(t/60)+":"+String(Math.floor(t%60)).padStart(2,"0")+(Math.abs(t%1)>.01?".5":"");
const screen=n=>{$("#v1").hidden=n!==1;$("#v2").hidden=n!==2;(n===1?$("#t1h"):$("#t2h")).focus({preventScroll:true})};
const sel1=()=>P.sel.length===1?clipOf(P.sel[0]):null;
const vEnd=()=>vlist().reduce((m,c)=>Math.max(m,cend(c)),0);
/* ---- envio e biblioteca ---- */
async function addFiles(files,first){
  const ids=await importFiles([...files]);
  if(!ids.length){if(first)$("#dropS").textContent="Não consegui abrir esses arquivos. Tente MP4 (H.264) ou WebM.";return}
  edit(()=>{let t=vEnd();for(const id of ids){const m=P.media[id],c={id:uid(),track:"V1",media:id,start:t,in:0,out:m.dur,props:clone(DEF)};P.clips.push(c);t+=m.dur;P.sel=first?[]:[c.id]}});
  if(first){hist=[];redoS=[];screen(2);fitZoom();seek(0);rerender()}
}
const drop=$("#drop"),inp=$("#file");
drop.onclick=()=>inp.click();drop.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();inp.click()}};
inp.onchange=()=>{if(inp.files.length){$("#dropS").textContent="Carregando…";addFiles(inp.files,true)}};
["dragover","dragenter"].forEach(t=>drop.addEventListener(t,e=>{e.preventDefault();drop.classList.add("over")}));
["dragleave","drop"].forEach(t=>drop.addEventListener(t,e=>{e.preventDefault();drop.classList.remove("over")}));
drop.addEventListener("drop",e=>{if(e.dataTransfer.files.length)addFiles(e.dataTransfer.files,true)});
addEventListener("dragover",e=>e.preventDefault());
addEventListener("drop",e=>{if(e.target.closest&&e.target.closest("#tlin"))return;e.preventDefault();const fs=e.dataTransfer.files;if(fs&&fs.length)addFiles(fs,$("#v1").hidden===false)});
$("#imp").onclick=()=>$("#file2").click();$("#file2").onchange=e=>{if(e.target.files.length)addFiles(e.target.files,false);e.target.value=""};
$("#rlib").onclick=()=>{const on=$("#lib").hidden;$("#lib").hidden=!on;$("#main").classList.toggle("lib",on);$("#rlib").setAttribute("aria-pressed",on)};
function renderLib(){
  const l=$("#mlist");l.innerHTML="";
  for(const id in P.media){const m=P.media[id],r=RT[id]||{},d=document.createElement("div");d.className="mi";d.draggable=true;d.dataset.id=id;
    d.innerHTML=`<img alt="" src="${r.poster||""}"><span class="mn"><b>${esc(m.name)}</b><small>${fmt(m.dur)}</small></span><button class="ib add" aria-label="Adicionar à linha do tempo" title="Adicionar à linha do tempo">+</button>`;
    d.ondragstart=e=>e.dataTransfer.setData("text/plain",id);d.querySelector(".add").onclick=()=>opAddAt(id,null);l.appendChild(d)}
  $("#lempty").hidden=Object.keys(P.media).length>0;
}
/* ---- linha do tempo ---- */
function clipEl(c){
  const m=P.media[c.media],r=RT[c.media]||{},e=document.createElement("div"),sp=c.props.speed;
  e.className="clip"+(c.track==="A1"?" a":"");e.dataset.id=c.id;e.style.left=c.start*pps+"px";e.style.width=Math.max(8,cdur(c)*pps)+"px";
  if(c.track==="V1"&&r.strip){e.style.backgroundImage=`url(${r.strip})`;e.style.backgroundSize=`${m.dur*pps/sp}px 100%`;e.style.backgroundPosition=`${-c.in*pps/sp}px 0`}
  if(c.track==="A1")e.appendChild(Object.assign(document.createElement("canvas"),{className:"wf"}));
  e.insertAdjacentHTML("beforeend",`<span class="hl"></span><span class="hr"></span><span class="nm">${esc(m.name)}${sp!==1?" · "+sp+"x":""}${c.track==="V1"&&c.props.mute?" · mudo":""}</span>`);
  return e;
}
function renderTL(){
  const D=projDur(),W=Math.max(tls.clientWidth,D*pps+80);tlin.style.width=W+"px";
  const R=$("#ruler");R.innerHTML="";const stp=[.5,1,2,5,10,15,30,60,120,300,600].find(s=>s*pps>=70)||1200;
  for(let t=0;t*pps<W;t+=stp){const i=document.createElement("i"),b=document.createElement("b");i.style.left=b.style.left=t*pps+"px";b.textContent=fmtS(t);R.append(i,b)}
  for(const[sel,tr]of[["#lV1","V1"],["#lA1","A1"]]){const L=$(sel);L.innerHTML="";for(const c of P.clips.filter(c=>c.track===tr))L.appendChild(clipEl(c))}
  $("#tlempty").hidden=P.clips.length>0;uiPeaks();selClasses();
}
function uiPeaks(){
  $$(".clip.a").forEach(e=>{const c=clipOf(e.dataset.id),cn=e.querySelector("canvas");if(!c||!cn)return;const r=RT[c.media];if(!r||!r.peaks)return;
    const w=Math.max(1,Math.round(e.clientWidth)),h=Math.round(e.clientHeight)||36,m=P.media[c.media],N=r.peaks.length,g=cn.getContext("2d");cn.width=w;cn.height=h;g.fillStyle=getComputedStyle(document.body).getPropertyValue("--mut");
    for(let x=0;x<w;x++){const a=r.peaks[Math.min(N-1,Math.max(0,Math.floor((c.in+x/pps*c.props.speed)/m.dur*N)))]||0,bh=Math.max(1,Math.min(1,a*1.6)*h);g.fillRect(x,(h-bh)/2,1,bh)}});
}
const selClasses=()=>$$(".clip").forEach(e=>e.classList.toggle("sel",P.sel.includes(e.dataset.id)));
function setSel(ids){
  P.sel=ids;selClasses();if(ids.length!==1)cropEditing=false;
  const c=ids.length===1&&clipOf(ids[0]);if(c&&c.track==="V1"&&!playing&&(T<c.start||T>=cend(c)))seek(c.start+Math.min(.1,cdur(c)/2));
  syncInspector();
}
const xToT=e=>(e.clientX-tlin.getBoundingClientRect().left)/pps;
function snap(s,c){
  if(!snapOn)return s;const th=8/pps,cdn=cdur(c),cand=[0,T];let best=null,bd=th;
  for(const o of P.clips)if(o!==c)cand.push(o.start,cend(o));
  for(const x of cand){let d=Math.abs(s-x);if(d<bd){bd=d;best=x}d=Math.abs(s+cdn-x);if(d<bd){bd=d;best=x-cdn}}
  return best==null?s:best;
}
const insertIndex=(c,dx)=>{const ct=drag.s0+cdur(c)/2+dx/pps;return vlist().filter(o=>o!==c).filter(o=>o.start+cdur(o)/2<ct).length};
function showInd(idx,c){
  const o=vlist().filter(x=>x!==c);let ind=$("#ind");if(!ind){ind=document.createElement("div");ind.id="ind";ind.className="ind";$("#lV1").appendChild(ind)}
  ind.style.left=(idx<o.length?o[idx].start:(o.length?cend(o[o.length-1]):0))*pps-1+"px";
}
tlin.addEventListener("pointerdown",e=>{
  const cl=e.target.closest(".clip");
  if(!cl){if(!e.shiftKey&&!e.target.closest("#ruler"))setSel([]);scrubbing=true;tlin.setPointerCapture(e.pointerId);seek(xToT(e));return}
  const c=clipOf(cl.dataset.id);if(!c)return;
  if(e.shiftKey)setSel(P.sel.includes(c.id)?P.sel.filter(i=>i!==c.id):[...P.sel,c.id]);else if(!P.sel.includes(c.id))setSel([c.id]);
  drag={mode:e.target.classList.contains("hl")?"tl":e.target.classList.contains("hr")?"tr":"mv",id:c.id,x0:e.clientX,y0:e.clientY,moved:false,s0:c.start,i0:c.in,o0:c.out};tlin.setPointerCapture(e.pointerId);
});
tlin.addEventListener("pointermove",e=>{
  if(scrubbing){seek(xToT(e));return}
  if(!drag)return;const c=clipOf(drag.id);if(!c)return;const dx=e.clientX-drag.x0;
  if(!drag.moved){if(Math.abs(dx)<4&&Math.abs(e.clientY-drag.y0)<4)return;drag.moved=true;commit()}
  const sp=c.props.speed,m=P.media[c.media],el=tlin.querySelector(`.clip[data-id="${drag.id}"]`);
  if(drag.mode==="mv"){
    if(c.track==="V1"){el.style.transform=`translateX(${dx}px)`;el.style.zIndex=9;el.style.opacity=.85;drag.idx=insertIndex(c,dx);showInd(drag.idx,c)}
    else{drag.ns=snap(Math.max(0,drag.s0+dx/pps),c);el.style.left=drag.ns*pps+"px"}
  }else{
    const d=dx/pps;
    if(drag.mode==="tl"){const ni=Math.max(0,Math.min(drag.o0-.1*sp,drag.i0+d*sp));c.in=ni;if(c.track==="A1")c.start=drag.s0+(ni-drag.i0)/sp}
    else c.out=Math.max(drag.i0+.1*sp,Math.min(m.dur,drag.o0+d*sp));
    repack();renderTL();
  }
});
function endDrag(){
  scrubbing=false;if(!drag)return;const d=drag,c=clipOf(d.id);drag=null;const ind=$("#ind");if(ind)ind.remove();
  if(d.moved&&c&&d.mode==="mv"){
    if(c.track==="V1"){const o=vlist().filter(x=>x!==c).map(x=>x.id);o.splice(d.idx==null?o.length:d.idx,0,c.id);setV1Order(o)}
    else{const ns=d.ns==null?c.start:d.ns;if(P.clips.some(o=>o!==c&&o.track==="A1"&&ns<cend(o)-1e-4&&ns+cdur(c)>o.start+1e-4))toast("O áudio não pode sobrepor outro clipe da mesma trilha.");else c.start=ns}
  }
  changed();
}
tlin.addEventListener("pointerup",endDrag);tlin.addEventListener("pointercancel",endDrag);
tlin.addEventListener("dragover",e=>e.preventDefault());
tlin.addEventListener("drop",e=>{e.preventDefault();e.stopPropagation();const id=e.dataTransfer.getData("text/plain");if(P.media[id])opAddAt(id,Math.max(0,xToT(e)))});
function zoomBy(f,cx){const r=tls.getBoundingClientRect(),ax=cx==null?r.width/2:cx-r.left,a=(tls.scrollLeft+ax)/pps;pps=Math.max(8,Math.min(400,pps*f));renderTL();tls.scrollLeft=a*pps-ax;syncTimeUI()}
function fitZoom(){pps=Math.max(8,Math.min(200,(tls.clientWidth-100)/Math.max(8,projDur())));renderTL();tls.scrollLeft=0}
tls.addEventListener("wheel",e=>{if(e.ctrlKey||e.metaKey){e.preventDefault();zoomBy(e.deltaY<0?1.15:1/1.15,e.clientX)}},{passive:false});
$("#zi").onclick=()=>zoomBy(1.25);$("#zo").onclick=()=>zoomBy(.8);$("#zf").onclick=fitZoom;
$("#snap").onclick=()=>{snapOn=!snapOn;$("#snap").setAttribute("aria-pressed",snapOn)};
$("#split").onclick=()=>opSplit(T);$("#del").onclick=opDel;$("#dup").onclick=opDup;$("#sep").onclick=opSep;
function syncTimeUI(){
  $("#ph").style.left=T*pps+"px";$("#cur").textContent=fmt(T);$("#tot").textContent=fmt(projDur());$("#play").textContent=playing?"Pausar":"Reproduzir";
  $("#undo").disabled=!hist.length||busy;$("#redo").disabled=!redoS.length||busy;
  if(playing){const x=T*pps;if(x>tls.scrollLeft+tls.clientWidth-40||x<tls.scrollLeft)tls.scrollLeft=Math.max(0,x-60)}
}
/* ---- ajustes do clipe selecionado ---- */
const SL=["tilt","bri","con","sat","vol","fi","fo","stabAmt"],CK=["bw","norm","hp","stab","blur","fill","mute"];
const radio=(n,v)=>{const r=document.querySelector(`input[name=${n}][value="${v}"]`);if(r)r.checked=true};
const val=n=>{const e=document.querySelector(`input[name=${n}]:checked`);return e&&e.value};
function syncInspector(){
  const cs=P.sel.map(clipOf).filter(Boolean),has=cs.length>0,kind=!has?"none":cs.every(c=>c.track==="A1")?"audio":"video";
  $("#panProject").hidden=has;$("#panClip").hidden=!has;$$(".vonly").forEach(e=>e.hidden=kind==="audio");
  $("#sep").disabled=!cs.some(c=>c.track==="V1");
  if(!has){$("#pbg").value=P.bg;radio("par",P.ar?String(P.ar):"auto");return}
  const c=cs[0],p=c.props,m=P.media[c.media];
  $("#ctitle").textContent=cs.length>1?cs.length+" clipes selecionados":m.name;$("#cinfo").textContent=(c.track==="A1"?"Áudio":"Vídeo")+" · "+fmt(cdur(c));
  SL.forEach(i=>$("#"+i).value=p[i]);CK.forEach(i=>$("#"+i).checked=!!p[i]);
  radio("sp",String(p.speed));radio("ar",p.ar?String(p.ar):"free");$("#flip").setAttribute("aria-pressed",!!p.flip);$$(".ctl").forEach(r=>r.draw());updCE();
}
SL.forEach(i=>$("#"+i).addEventListener("input",()=>setProp(i,+$("#"+i).value)));
CK.forEach(i=>$("#"+i).addEventListener("change",()=>setProp(i,$("#"+i).checked)));
$$("input[name=sp]").forEach(r=>r.onchange=()=>setProp("speed",+val("sp")));
$$(".ctl").forEach(r=>{const i=r.querySelector("input"),o=r.querySelector("output"),suf={vol:"%",bri:"%",con:"%",sat:"%",stabAmt:"%",tilt:"°",fi:" s",fo:" s"}[i.id]||"";
  r.dataset.def=i.getAttribute("value");r.draw=()=>o.textContent=i.value+suf;i.addEventListener("input",r.draw);r.draw();
  r.querySelector("button").onclick=()=>{i.value=r.dataset.def;i.dispatchEvent(new Event("input"))}});
const vsel=()=>P.sel.map(clipOf).filter(c=>c&&c.track==="V1");
/* ---- recorte (máscara) ---- */
const updCE=()=>{
  const c=sel1(),ok=!!(c&&c.track==="V1");if(!ok)cropEditing=false;
  $("#ce").textContent=cropEditing?"Concluir recorte":"Editar recorte";$("#arRow").hidden=!cropEditing;$("#cclr").hidden=!(ok&&c.props.crop);
};
function startCrop(on){
  const c=sel1();if(!c||c.track!=="V1")return;cropEditing=!!on;
  if(on){if(T<c.start||T>=cend(c))seek(c.start+.01);if(!c.props.crop)edit(()=>{c.props.crop={x:.1,y:.1,w:.8,h:.8};c.props.ar=0});document.querySelector("details.sec.img").open=true}
  updCE();
}
function setCropAspect(){
  const cs=vsel();if(!cs.length)return;const k=val("ar");
  edit(()=>{for(const c of cs){const p=c.props,[pw,ph]=dimsOf(p,P.media[c.media]);
    if(k==="free")p.ar=0;
    else{const a=k==="orig"?pw/ph:+k;p.ar=a;const w=Math.min(pw,ph*a),h=w/a;p.crop=k==="orig"?null:{x:(pw-w)/2/pw,y:(ph-h)/2/ph,w:w/pw,h:h/ph}}}});
  updCE();
}
$$("input[name=ar]").forEach(r=>r.onchange=setCropAspect);
$("#ce").onclick=()=>startCrop(!cropEditing);
$("#cclr").onclick=()=>{const cs=vsel();if(!cs.length)return;edit(()=>cs.forEach(c=>{c.props.crop=null;c.props.ar=0}));cropEditing=false;updCE()};
$("#rfit").onclick=()=>{const cs=vsel();if(!cs.length)return;edit(()=>cs.forEach(c=>{Object.assign(c.props,{fx:1,fy:1,ox:0,oy:0})}))};
$("#rot").onclick=()=>{const cs=vsel();if(!cs.length)return;edit(()=>cs.forEach(c=>{c.props.rot=(c.props.rot+90)%360;c.props.crop=null;c.props.ar=0}));cropEditing=false;updCE()};
$("#flip").onclick=()=>{const cs=vsel();if(!cs.length)return;edit(()=>cs.forEach(c=>{c.props.flip=!c.props.flip;if(c.props.crop)c.props.crop.x=1-c.props.crop.x-c.props.crop.w}))};
/* ---- alças de transformação livre, guias inteligentes e alças de recorte ---- */
const cw=$(".cw"),selbox=$("#selbox"),guides=$("#guides");let xf=null;
function placeSel(c,q){
  const s=sel1();if(!c||!q||!s||c.id!==s.id||s.track!=="V1"||busy){selbox.hidden=true;return}
  const W=cv.width,H=cv.height,M=q.M;selbox.hidden=false;
  Object.assign(selbox.style,{left:M.x/W*100+"%",top:M.y/H*100+"%",width:M.w/W*100+"%",height:M.h/H*100+"%"});selbox.classList.toggle("cropm",cropEditing);
  selbox.querySelectorAll("i").forEach(i=>i.style.display=cropEditing&&c.props.ar&&i.dataset.h.length===1?"none":"");
}
const toCv=e=>{const r=cv.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*cv.width,y:(e.clientY-r.top)/r.height*cv.height}};
const thr=()=>8*cv.width/cv.getBoundingClientRect().width;
function cands(excl,axis){
  const W=cv.width,H=cv.height,L=axis==="x"?W:H,a=[0,L*.05,L/2,L*.95,L];
  for(const o of vlist()){if(o.id===excl)continue;const M=clipRects(o,W,H).M;if(axis==="x")a.push(M.x,M.x+M.w/2,M.x+M.w);else a.push(M.y,M.y+M.h/2,M.y+M.h)}
  return a;
}
function bestSnap(vals,cs,th){let b=null;for(const v of vals)for(const c of cs){const d=c-v;if(Math.abs(d)<th&&(!b||Math.abs(d)<Math.abs(b.d)))b={d,line:c}}return b}
function showGuides(gx,gy){
  guides.innerHTML="";const W=cv.width,H=cv.height;
  for(const x of gx){const e=document.createElement("i");e.className="gx";e.style.left=x/W*100+"%";guides.appendChild(e)}
  for(const y of gy){const e=document.createElement("i");e.className="gy";e.style.top=y/H*100+"%";guides.appendChild(e)}
}
function xfStart(e){
  if(!(e.button===0||e.button===undefined))return;
  let c=sel1();
  if(!c||c.track!=="V1"||!e.target.closest("#selbox")){const a=activeV();if(!a||a.track!=="V1")return;if(!c||c.id!==a.id)setSel([a.id]);c=a}
  const h=e.target.dataset&&e.target.dataset.h||"";
  xf={id:c.id,h,crop:cropEditing,p0:toCv(e),q0:clipRects(c,cv.width,cv.height),pr0:clone(c.props),first:true};
  cw.setPointerCapture(e.pointerId);e.preventDefault();
}
function xfMove(e){
  if(!xf)return;const c=clipOf(xf.id);if(!c)return;if(xf.first){commit();xf.first=false}
  const W=cv.width,H=cv.height,p=toCv(e),dx=p.x-xf.p0.x,dy=p.y-xf.p0.y,q0=xf.q0,M0=q0.M,pr0=xf.pr0,pr=c.props,th=thr(),gx=[],gy=[],h=xf.h;
  if(xf.crop){
    const R=q0.R,cr0=pr0.crop||{x:0,y:0,w:1,h:1},du=dx/R.w,dv=dy/R.h,pw=q0.pw,ph=q0.ph,ar=pr.ar;
    if(!h){pr.crop={...cr0,x:Math.min(1-cr0.w,Math.max(0,cr0.x+du)),y:Math.min(1-cr0.h,Math.max(0,cr0.y+dv))}}
    else{let l=cr0.x,r=cr0.x+cr0.w,t=cr0.y,b=cr0.y+cr0.h;
      if(h.includes("w"))l=Math.max(0,Math.min(r-.03,l+du));if(h.includes("e"))r=Math.min(1,Math.max(l+.03,r+du));
      if(h.includes("n"))t=Math.max(0,Math.min(b-.03,t+dv));if(h.includes("s"))b=Math.min(1,Math.max(t+.03,b+dv));
      if(ar&&h.length===2){let w=r-l,hh=b-t;if(w*pw/(ar*ph)>hh)w=hh*ph*ar/pw;else hh=w*pw/(ar*ph);
        if(h.includes("w"))l=r-w;else r=l+w;if(h.includes("n"))t=b-hh;else b=t+hh;
        if(l<0){const k=(r-0)/(r-l);l=0;t=h.includes("n")?b-(b-t)*k:t;b=h.includes("n")?b:t+(b-t)*k}
        if(r>1){const k=(1-l)/(r-l);r=1;b=h.includes("n")?b:t+(b-t)*k;t=h.includes("n")?b-(b-t)*k:t}}
      pr.crop={x:l,y:t,w:r-l,h:b-t}}
  }else if(!h){
    let ddx=dx,ddy=dy;
    if(snapOn){const sx=bestSnap([M0.x+dx,M0.x+dx+M0.w/2,M0.x+dx+M0.w],cands(c.id,"x"),th),sy=bestSnap([M0.y+dy,M0.y+dy+M0.h/2,M0.y+dy+M0.h],cands(c.id,"y"),th);
      if(sx){ddx+=sx.d;gx.push(sx.line)}if(sy){ddy+=sy.d;gy.push(sy.line)}}
    pr.ox=pr0.ox+ddx/W;pr.oy=pr0.oy+ddy/H;
  }else{
    const alt=e.altKey,mcx=M0.x+M0.w/2,mcy=M0.y+M0.h/2;
    const ax=alt?mcx:h.includes("w")?M0.x+M0.w:h.includes("e")?M0.x:mcx,ay=alt?mcy:h.includes("n")?M0.y+M0.h:h.includes("s")?M0.y:mcy;
    const hx=h.includes("e")?M0.x+M0.w:h.includes("w")?M0.x:mcx,hy=h.includes("s")?M0.y+M0.h:h.includes("n")?M0.y:mcy;
    let kx=1,ky=1;
    if(h.length===2){
      const ux=hx-ax,uy=hy-ay,k=Math.max(.05,((hx+dx-ax)*ux+(hy+dy-ay)*uy)/(ux*ux+uy*uy));kx=ky=k;
      if(snapOn){const sx=bestSnap([ax+ux*k],cands(c.id,"x"),th),sy=bestSnap([ay+uy*k],cands(c.id,"y"),th);
        if(sx&&(!sy||Math.abs(sx.d)<=Math.abs(sy.d))){kx=ky=Math.max(.05,(sx.line-ax)/ux);gx.push(sx.line)}else if(sy){kx=ky=Math.max(.05,(sy.line-ay)/uy);gy.push(sy.line)}}
    }else if(h==="e"||h==="w"){
      kx=Math.max(.05,(hx+dx-ax)/(hx-ax));
      if(snapOn){const s=bestSnap([ax+(hx-ax)*kx],cands(c.id,"x"),th);if(s){kx=Math.max(.05,(s.line-ax)/(hx-ax));gx.push(s.line)}}
    }else{
      ky=Math.max(.05,(hy+dy-ay)/(hy-ay));
      if(snapOn){const s=bestSnap([ay+(hy-ay)*ky],cands(c.id,"y"),th);if(s){ky=Math.max(.05,(s.line-ay)/(hy-ay));gy.push(s.line)}}
    }
    pr.fx=Math.min(20,pr0.fx*kx);pr.fy=Math.min(20,pr0.fy*ky);
    pr.ox=(ax+(q0.cx-ax)*kx-W/2)/W;pr.oy=(ay+(q0.cy-ay)*ky-H/2)/H;
  }
  showGuides(gx,gy);
}
function xfEnd(){if(!xf)return;xf=null;showGuides([],[]);changed()}
cw.addEventListener("pointerdown",xfStart);cw.addEventListener("pointermove",xfMove);cw.addEventListener("pointerup",xfEnd);cw.addEventListener("pointercancel",xfEnd);
cw.addEventListener("dblclick",e=>{const a=activeV(),s=sel1();if(!a||a.track!=="V1")return;if(!s||s.id!==a.id)setSel([a.id]);startCrop(!cropEditing)});
/* projeto */
$$("input[name=par]").forEach(r=>r.onchange=()=>edit(()=>{P.ar=val("par")==="auto"?0:+val("par")},"par"));
$("#pbg").addEventListener("input",()=>edit(()=>{P.bg=$("#pbg").value},"pbg"));
$("#pname").addEventListener("change",()=>edit(()=>{P.name=$("#pname").value||"Projeto sem título"},"name"));
/* ---- exportar, bloquear e reiniciar ---- */
const lockUI=on=>$$(".tlp button,.insp button,.insp input,#undo,#redo,#reset,#exp,#rlib,#imp").forEach(e=>e.disabled=on);
const showProg=m=>{$("#prog").hidden=false;$("#msg").textContent=m;setBar(.03)};
const setBar=p=>{p=Math.max(3,Math.min(100,p*100));$("#bar i").style.width=p+"%";$("#bar").setAttribute("aria-valuenow",Math.round(p))};
const hideProg=()=>$("#prog").hidden=true;
function updNote(){const f=$("#fmt").value;$("#fmtNote").textContent=f==="mp4"&&pickMime("mp4")&&!pickMime("mp4").includes("mp4")?"Este navegador grava WebM no lugar de MP4":""}
$("#fmt").onchange=updNote;updNote();
$("#exp").onclick=()=>{if(!P.clips.length)return toast("Adicione ao menos um vídeo à linha do tempo.");$("#xdlg").showModal()};
$("#xno").onclick=()=>$("#xdlg").close();$("#xgo").onclick=()=>{$("#xdlg").close();exportVideo($("#fmt").value)};
$("#cancel").onclick=cancelExport;
document.addEventListener("visibilitychange",()=>{if(exporting&&document.hidden)$("#msg").textContent="A exportação pausa quando a aba fica em segundo plano. Volte para esta aba."});
function doReset(){
  pause();for(const id in RT){const r=RT[id];if(r.vel){r.vel.remove();r.ael.remove()}URL.revokeObjectURL(r.url);delete RT[id]}
  P=newProject();hist=[];redoS=[];T=0;cropEditing=false;$("#pname").value=P.name;$("#dropS").textContent="MP4, MOV ou WebM. Você pode escolher vários arquivos.";inp.value="";screen(1);
}
$("#reset").onclick=()=>P.clips.length?$("#dlg").showModal():doReset();
$("#dok").onclick=()=>{$("#dlg").close();doReset()};$("#dno").onclick=()=>$("#dlg").close();
$("#undo").onclick=undo;$("#redo").onclick=redo;$("#play").onclick=()=>playing?pause():play();
/* ---- atalhos ---- */
addEventListener("keydown",e=>{
  if($("#v2").hidden||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)&&!/radio|range|checkbox/.test(e.target.type))return;
  const k=e.key.toLowerCase(),mod=e.ctrlKey||e.metaKey;
  if(mod&&k==="z"){e.preventDefault();e.shiftKey?redo():undo()}
  else if(mod&&k==="d"){e.preventDefault();opDup()}
  else if(k===" "&&e.target.tagName!=="BUTTON"){e.preventDefault();playing?pause():play()}
  else if(k==="s"&&!mod)opSplit(T);
  else if(k==="delete"||k==="backspace"){e.preventDefault();opDel()}
  else if(k==="arrowleft"){e.preventDefault();seek(T-(e.shiftKey?5:1/30))}
  else if(k==="arrowright"){e.preventDefault();seek(T+(e.shiftKey?5:1/30))}
  else if(k==="home")seek(0);else if(k==="end")seek(projDur());
  else if(k==="escape"){cropEditing=false;setSel([])}
});
function rerender(){renderTL();renderLib();syncInspector();syncTimeUI()}
onChange=rerender;
requestAnimationFrame(loop);
