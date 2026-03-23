"use client";
import { useState, useEffect, useCallback, useRef, Fragment } from "react";

var LEAGUES = [
  { id: "soccer_epl", name: "Premier League", country: "ENG", cat: "top" },
  { id: "soccer_spain_la_liga", name: "La Liga", country: "ESP", cat: "top" },
  { id: "soccer_germany_bundesliga", name: "Bundesliga", country: "GER", cat: "top" },
  { id: "soccer_italy_serie_a", name: "Serie A", country: "ITA", cat: "top" },
  { id: "soccer_france_ligue_one", name: "Ligue 1", country: "FRA", cat: "top" },
  { id: "soccer_uefa_champs_league", name: "Champions League", country: "UCL", cat: "uefa" },
  { id: "soccer_uefa_europa_league", name: "Europa League", country: "UEL", cat: "uefa" },
  { id: "soccer_uefa_europa_conference_league", name: "Conference League", country: "UECL", cat: "uefa" },
  { id: "soccer_sweden_allsvenskan", name: "Allsvenskan", country: "SWE", cat: "nordic" },
  { id: "soccer_denmark_superliga", name: "Superligaen", country: "DEN", cat: "nordic" },
  { id: "soccer_norway_eliteserien", name: "Eliteserien", country: "NOR", cat: "nordic" },
  { id: "soccer_netherlands_eredivisie", name: "Eredivisie", country: "NED", cat: "europe" },
  { id: "soccer_portugal_primeira_liga", name: "Primeira Liga", country: "POR", cat: "europe" },
  { id: "soccer_austria_bundesliga", name: "Bundesliga", country: "AUT", cat: "europe" },
  { id: "soccer_switzerland_superleague", name: "Super League", country: "SUI", cat: "europe" },
  { id: "soccer_spl", name: "Premiership", country: "SCO", cat: "europe" },
  { id: "soccer_efl_champ", name: "Championship", country: "ENG", cat: "europe" },
  { id: "soccer_brazil_campeonato", name: "Brasileirao", country: "BRA", cat: "other" },
  { id: "soccer_usa_mls", name: "MLS", country: "USA", cat: "other" },
  { id: "soccer_argentina_primera_division", name: "Primera Div.", country: "ARG", cat: "other" },
  { id: "soccer_mexico_ligamx", name: "Liga MX", country: "MEX", cat: "other" },
  { id: "soccer_fifa_world_cup", name: "VM 2026", country: "FIFA", cat: "intl" },
  { id: "soccer_fifa_world_cup_qualifiers_europe", name: "VM-kval", country: "UEFA", cat: "intl" },
  { id: "soccer_uefa_nations_league", name: "Nations League", country: "UEFA", cat: "intl" },
];

var CATS = [
  { id: "top", label: "TOPPLIGOR" },
  { id: "uefa", label: "UEFA" },
  { id: "nordic", label: "NORDEN" },
  { id: "europe", label: "EUROPA" },
  { id: "intl", label: "LANDSLAG" },
  { id: "other", label: "OEVRIGT" },
];

function removeVig(h,d,a){var hh=h>1?1/h:0,dd=d&&d>1?1/d:0,aa=a>1?1/a:0,t=hh+dd+aa;if(!t)return{home:33,draw:33,away:33};return{home:(hh/t)*100,draw:(dd/t)*100,away:(aa/t)*100};}
function calcEV(tp,o){if(!o||o<=1||!tp)return 0;return((tp/100)*o-1)*100;}
function rnd(a,b){return a+Math.random()*(b-a);}
function kellyFrac(tp,odds){var p=tp/100,q=1-p,b=odds-1;return Math.max(0,(b*p-q)/b);}
function kellyStake(bank,tp,odds){return Math.round(bank*kellyFrac(tp,odds)*0.25*100)/100;}
function poisson(lam,k){var e=Math.exp(-lam),p=Math.pow(lam,k),f=1;for(var i=1;i<=k;i++)f*=i;return e*p/f;}
function overProb(xg,g){var s=0;for(var k=0;k<=g;k++)s+=poisson(xg,k);return(1-s)*100;}
function matchTime(d){var h=Math.floor((d-Date.now())/3600000);if(h<0)return"LIVE";if(h<1)return"Snart";if(h<24)return h+"h";return d.toLocaleDateString("sv-SE",{weekday:"short",day:"numeric",month:"short"});}
function isLive(ct){var e=Math.floor((Date.now()-new Date(ct).getTime())/60000);return e>=0&&e<=105;}
function getMin(ct){var e=Math.floor((Date.now()-new Date(ct).getTime())/60000);if(e<0||e>105)return-1;if(e>45&&e<47)return 45;return e>47?e-2:e;}

function fetchAPI(sk,key){
  var url="https://api.the-odds-api.com/v4/sports/"+sk+"/odds/?apiKey="+key+"&regions=eu,uk&markets=h2h,totals&oddsFormat=decimal&bookmakers=pinnacle,bet365,unibet,betfair,williamhill,bwin,nordicbet,betsson,coolbet,unibet_se";
  return fetch(url).then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json();}).then(function(d){if(d.message)throw new Error(d.message);return d;});
}
function fetchSc(sk,key){return fetch("https://api.the-odds-api.com/v4/sports/"+sk+"/scores/?apiKey="+key+"&daysFrom=1").then(function(r){return r.ok?r.json():[];}).catch(function(){return[];});}

function parse(ev,lid,prev,sc){
  var home=ev.home_team,away=ev.away_team,h2h=[],tots=[];
  (ev.bookmakers||[]).forEach(function(bm){(bm.markets||[]).forEach(function(mk){
    if(mk.key==="h2h"){var ho=mk.outcomes.find(function(o){return o.name===home;}),ao=mk.outcomes.find(function(o){return o.name===away;}),dr=mk.outcomes.find(function(o){return o.name==="Draw";});if(ho&&ao)h2h.push({n:bm.key,pin:bm.key==="pinnacle",h:+ho.price.toFixed(2),d:dr?+dr.price.toFixed(2):null,a:+ao.price.toFixed(2)});}
    if(mk.key==="totals"){var ov=mk.outcomes.find(function(o){return o.name==="Over";}),un=mk.outcomes.find(function(o){return o.name==="Under";});if(ov&&un)tots.push({n:bm.key,pin:bm.key==="pinnacle",o:+ov.price.toFixed(2),u:+un.price.toFixed(2),pt:ov.point||2.5});}
  });});
  if(!h2h.length)return null;
  var pin=h2h.find(function(b){return b.pin;})||h2h[0],tp=removeVig(pin.h,pin.d,pin.a),vb=[];
  h2h.forEach(function(b){if(b.pin)return;[[b.h,tp.home,"home",home],[b.a,tp.away,"away",away],[b.d,tp.draw,"draw","Oavgjort"]].forEach(function(c){if(!c[0])return;var e=calcEV(c[1],c[0]);if(e>1.5)vb.push({bm:b.n,side:c[2],team:c[3],ev:Math.round(e*10)/10,odds:c[0],tp:Math.round(c[1]*10)/10,mkt:"1X2",kelly:kellyFrac(c[1],c[0])});});});
  var pinT=tots.find(function(b){return b.pin;})||tots[0],ouTP=null;
  if(pinT){var op=1/pinT.o,up=1/pinT.u,ot=op+up;ouTP={o:(op/ot)*100,u:(up/ot)*100,pt:pinT.pt};tots.forEach(function(t){if(t.pin)return;var e=calcEV(ouTP.o,t.o);if(e>1.5)vb.push({bm:t.n,side:"over",team:"Oe"+t.pt,ev:Math.round(e*10)/10,odds:t.o,tp:Math.round(ouTP.o*10)/10,mkt:"O/U",kelly:kellyFrac(ouTP.o,t.o)});});}
  vb.sort(function(a,b){return b.ev-a.ev;});
  var xg=prev?prev.xg:+rnd(0.9,2.7).toFixed(2),lv=isLive(ev.commence_time),mn=getMin(ev.commence_time),score=null;
  if(sc){var sd=sc.find(function(s){return s.id===ev.id;});if(sd&&sd.scores){var hs=sd.scores.find(function(s){return s.name===home;}),as2=sd.scores.find(function(s){return s.name===away;});if(hs&&as2)score={h:parseInt(hs.score)||0,a:parseInt(as2.score)||0};}}
  var openH=prev?prev.openH:pin.h,openA=prev?prev.openA:pin.a;
  return{id:ev.id,home:home,away:away,date:new Date(ev.commence_time),h2h:h2h,tots:tots,ouTP:ouTP,
    bestH:Math.max.apply(null,h2h.map(function(b){return b.h;})),bestD:h2h[0].d!=null?Math.max.apply(null,h2h.filter(function(b){return b.d!=null;}).map(function(b){return b.d;})):null,bestA:Math.max.apply(null,h2h.map(function(b){return b.a;})),
    bestO:tots.length?Math.max.apply(null,tots.map(function(b){return b.o;})):null,
    tp:tp,pin:{h:pin.h,d:pin.d,a:pin.a},vb:vb,topEV:vb.length?vb[0].ev:0,
    xg:xg,ou25:ouTP?+ouTP.o.toFixed(1):+(50+(xg-2.5)*22).toFixed(1),o15:+overProb(xg,1).toFixed(1),o35:+overProb(xg,3).toFixed(1),
    sharp:prev&&(pin.h-(prev.pin?prev.pin.h:pin.h))<-0.05?"home":(prev&&(pin.a-(prev.pin?prev.pin.a:pin.a))<-0.05?"away":null),
    mv:{h:+(pin.h-openH).toFixed(2),a:+(pin.a-openA).toFixed(2)},openH:openH,openA:openA,
    live:lv,min:mn,sc:score,_api:true};
}

function demoMatch(home,away,prof,i,prev){
  var bH=prev?prev._bH:rnd(prof[0],prof[1]),bD=prev?prev._bD:rnd(prof[2],prof[3]),bA=prev?prev._bA:rnd(prof[4],prof[5]);
  var dr=function(){return(Math.random()-0.48)*0.07;};
  var nH=Math.max(1.08,bH+(prev?dr():0)),nD=Math.max(2.0,bD+(prev?dr():0)),nA=Math.max(1.08,bA+(prev?dr():0));
  var BM=["pinnacle","bet365","unibet","betfair","williamhill","bwin","nordicbet","betsson","coolbet","1xbet"];
  var h2h=BM.map(function(b){var v=0.93+Math.random()*0.09,s=b!=="pinnacle"?1.02+Math.random()*0.04:1;return{n:b,pin:b==="pinnacle",h:+(nH*v*s).toFixed(2),d:+(nD*(0.93+Math.random()*0.09)*s).toFixed(2),a:+(nA*v*s).toFixed(2)};});
  var pin=h2h[0],tp=removeVig(pin.h,pin.d,pin.a),vb=[];
  h2h.slice(1).forEach(function(b){[[b.h,tp.home,"home",home],[b.a,tp.away,"away",away],[b.d,tp.draw,"draw","Oavgjort"]].forEach(function(c){if(!c[0])return;var e=calcEV(c[1],c[0]);if(e>1.5)vb.push({bm:b.n,side:c[2],team:c[3],ev:Math.round(e*10)/10,odds:c[0],tp:Math.round(c[1]*10)/10,mkt:"1X2",kelly:kellyFrac(c[1],c[0])});});});
  vb.sort(function(a,b){return b.ev-a.ev;});var xg=+rnd(0.9,2.7).toFixed(2);
  var fk=i<2,fm=fk?Math.floor(rnd(25,75)):-1,fs=fk?{h:Math.floor(rnd(0,2)),a:Math.floor(rnd(0,2))}:null;
  return{id:"d-"+i,home:home,away:away,date:new Date(Date.now()+(fk?-fm*60000:Math.floor(rnd(1,72))*3600000)),
    h2h:h2h,tots:[],ouTP:null,bestH:Math.max.apply(null,h2h.map(function(b){return b.h;})),bestD:Math.max.apply(null,h2h.filter(function(b){return b.d!=null;}).map(function(b){return b.d;})),bestA:Math.max.apply(null,h2h.map(function(b){return b.a;})),bestO:null,
    tp:tp,pin:{h:pin.h,d:pin.d,a:pin.a},vb:vb,topEV:vb.length?vb[0].ev:0,
    xg:xg,ou25:+(50+(xg-2.5)*22).toFixed(1),o15:+overProb(xg,1).toFixed(1),o35:+overProb(xg,3).toFixed(1),
    sharp:Math.random()>0.72?(Math.random()>0.5?"home":"away"):null,
    mv:{h:0,a:0},openH:+nH.toFixed(2),openA:+nA.toFixed(2),live:fk,min:fm,sc:fs,_bH:bH,_bD:bD,_bA:bA,_api:false};
}

var DEMO=[["Arsenal","Chelsea"],["Man City","Liverpool"],["Tottenham","Man Utd"],["Newcastle","Aston Villa"],["Brighton","West Ham"],["Everton","Wolves"]];
var PROFS=[[1.35,1.75,4.2,5.5,4.5,7.0],[1.55,2.0,3.4,4.2,3.5,5.5],[1.75,2.2,3.2,3.8,3.0,4.5],[2.0,2.6,3.1,3.6,2.6,3.8],[2.4,3.2,3.0,3.5,2.1,2.8],[3.0,4.5,3.2,3.8,1.7,2.2]];

var C={bg:"#04060a",p1:"#070b12",p2:"#0a0f18",bd:"#0d1520",bl:"#12202f",ac:"#3b82f6",ag:"rgba(59,130,246,0.1)",gn:"#10b981",gd:"rgba(16,185,129,0.1)",rd:"#ef4444",yl:"#f59e0b",yd:"rgba(245,158,11,0.08)",pk:"#ec4899",tx:"#e2e8f0",ts:"#94a3b8",mt:"#475569",dm:"#1e293b"};

function merge(a,b){var r={};for(var k in a)r[k]=a[k];for(var k2 in b)r[k2]=b[k2];return r;}

export default function App(){
  var s1=useState(LEAGUES[0]),league=s1[0],setLeague=s1[1];
  var s2=useState({}),all=s2[0],setAll=s2[1];
  var s3=useState(false),loading=s3[0],setLoading=s3[1];
  var s4=useState(null),err=s4[0],setErr=s4[1];
  var s5=useState(null),sel=s5[0],setSel=s5[1];
  var s6=useState("odds"),tab=s6[0],setTab=s6[1];
  var s7=useState("matches"),pg=s7[0],setPg=s7[1];
  var s8=useState(false),autoOn=s8[0],setAutoOn=s8[1];
  var s9=useState(function(){try{return localStorage.getItem("odds_key")||"";}catch(e){return"";}}),savedKey=s9[0],setSavedKey=s9[1];
  var s10=useState(""),keyInput=s10[0],setKeyInput=s10[1];
  var s11=useState({}),ai=s11[0],setAi=s11[1];
  var s12=useState(null),aiL=s12[0],setAiL=s12[1];
  var s13=useState(null),upd=s13[0],setUpd=s13[1];
  var s14=useState(function(){try{var v=localStorage.getItem("odds_cfg");return v?JSON.parse(v):{ev:4,minO:1.8,maxO:8,poll:60,bank:1000};}catch(e){return{ev:4,minO:1.8,maxO:8,poll:60,bank:1000};}}),cfg=s14[0],setCfgRaw=s14[1];
  var setCfg=function(v){setCfgRaw(v);try{localStorage.setItem("odds_cfg",JSON.stringify(v));}catch(e){}};
  var s15=useState({val:false,lv:false}),flt=s15[0],setFlt=s15[1];
  var s16=useState(false),sidebar=s16[0],setSidebar=s16[1];
  var prev=useRef({});var poll=useRef(null);

  useEffect(function(){return function(){if(poll.current)clearInterval(poll.current);};},[]); 

  var load=useCallback(function(lid,quiet){
    if(!quiet)setLoading(true);setErr(null);
    var pr=prev.current[lid]||[];
    if(savedKey){
      Promise.all([fetchAPI(lid,savedKey),fetchSc(lid,savedKey)]).then(function(r){
        var fresh=r[0].map(function(ev){return parse(ev,lid,pr.find(function(m){return m.id===ev.id;}),r[1]);}).filter(Boolean);
        if(!fresh.length)fresh=DEMO.map(function(t,i){return demoMatch(t[0],t[1],PROFS[i%PROFS.length],i,pr.find(function(m){return m.home===t[0];}));});
        prev.current[lid]=fresh;setAll(function(p){var n={};for(var k in p)n[k]=p[k];n[lid]=fresh;return n;});setUpd(new Date());if(!quiet)setLoading(false);
      }).catch(function(e){setErr(e.message);
        var fresh=DEMO.map(function(t,i){return demoMatch(t[0],t[1],PROFS[i%PROFS.length],i,pr.find(function(m){return m.home===t[0];}));});
        prev.current[lid]=fresh;setAll(function(p){var n={};for(var k in p)n[k]=p[k];n[lid]=fresh;return n;});setUpd(new Date());if(!quiet)setLoading(false);
      });
    } else {
      var fresh=DEMO.map(function(t,i){return demoMatch(t[0],t[1],PROFS[i%PROFS.length],i,pr.find(function(m){return m.home===t[0];}));});
      prev.current[lid]=fresh;setAll(function(p){var n={};for(var k in p)n[k]=p[k];n[lid]=fresh;return n;});setUpd(new Date());if(!quiet)setLoading(false);
    }
  },[savedKey]);

  useEffect(function(){load(league.id);},[league.id,savedKey]);
  useEffect(function(){if(poll.current)clearInterval(poll.current);if(autoOn)poll.current=setInterval(function(){LEAGUES.forEach(function(l){load(l.id,true);});},cfg.poll*1000);return function(){if(poll.current)clearInterval(poll.current);};},[autoOn,cfg.poll,load]);

  var doAI=function(m){setAiL(m.id);
    var pr="Du aer en expert pa value betting. Match: "+m.home+" vs "+m.away+". Pinnacle: H "+m.pin.h+" ("+m.tp.home.toFixed(1)+"%) X "+(m.pin.d||"-")+" B "+m.pin.a+" ("+m.tp.away.toFixed(1)+"%). xG: "+m.xg+". Oe2.5: "+m.ou25+"%. Basta EV: "+(m.vb.length?m.vb[0].team+" @"+m.vb[0].odds+" +"+m.vb[0].ev+"% hos "+m.vb[0].bm:"Inga")+"."+(m.live?" LIVE "+(m.min>0?m.min+"'":"")+" "+(m.sc?m.sc.h+"-"+m.sc.a:""):"")+" Svara pa svenska: 1) VERDICT (spela/avvakta, 1 mening) 2) EV-ANALYS (2 meningar) 3) MAALPROGNOS (1 mening) 4) RISK (1 mening) 5) KELLY insats. Max 120 ord.";
    fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:800,messages:[{role:"user",content:pr}]})}).then(function(r){return r.json();}).then(function(d){var t=(d.content||[]).map(function(c){return c.text||"";}).join("\n")||"Ej tillgaenglig";setAi(function(p){var n={};for(var k in p)n[k]=p[k];n[m.id]=t;return n;});}).catch(function(){setAi(function(p){var n={};for(var k in p)n[k]=p[k];n[m.id]="Kunde inte haemta analys.";return n;});}).finally(function(){setAiL(null);});
  };

  var matches=(all[league.id]||[]).filter(function(m){if(flt.val&&m.topEV<cfg.ev)return false;if(flt.lv&&!m.live)return false;return true;});
  var liveN=(all[league.id]||[]).filter(function(m){return m.live;}).length;

  var saveKey=function(){var k=keyInput.trim();if(!k)return;setSavedKey(k);try{localStorage.setItem("odds_key",k);}catch(e){}setKeyInput("");};

  return(
    <div style={{fontFamily:"-apple-system,BlinkMacSystemFont,'SF Pro Text',sans-serif",background:C.bg,minHeight:"100vh",color:C.tx,display:"flex",flexDirection:"column",maxWidth:480,margin:"0 auto",position:"relative"}}>
      <style>{["*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}","body{background:#04060a;}","::-webkit-scrollbar{display:none;}",".r:active{opacity:.7;transform:scale(.98);} .r{transition:all .12s;}","@keyframes blink{0%,100%{opacity:1}50%{opacity:.15}}","@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(245,158,11,.5)}60%{box-shadow:0 0 0 5px rgba(245,158,11,0)}}","@keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}",".blink{animation:blink 1.4s infinite;} .sharp{animation:pulse 2s infinite;} .slideUp{animation:slideUp .2s ease;}","input,button{font-family:inherit;outline:none;}"].join("\n")}</style>

      {/* HEADER */}
      <div style={{background:C.p1,borderBottom:"1px solid "+C.bd,padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div onClick={function(){setSidebar(!sidebar);}} style={{width:32,height:32,borderRadius:8,background:"rgba(255,255,255,.04)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:14}}>{"="}</div>
          <span style={{fontWeight:700,fontSize:15,letterSpacing:".08em",color:C.ac}}>{"ODDS"}</span>
          <span style={{fontSize:8,padding:"2px 6px",borderRadius:4,background:savedKey?C.gd:C.yd,color:savedKey?C.gn:C.yl,fontWeight:600}}>{savedKey?"LIVE":"DEMO"}</span>
          {liveN>0&&<span style={{fontSize:8,padding:"2px 6px",borderRadius:4,background:"rgba(239,68,68,.1)",color:C.rd,fontWeight:600}} className="blink">{liveN+" LIVE"}</span>}
        </div>
        <div style={{display:"flex",gap:6}}>
          <button onClick={function(){load(league.id);}} className="r" style={{background:"rgba(255,255,255,.04)",border:"none",color:C.ts,padding:"6px 10px",borderRadius:6,fontSize:12}}>{loading?"...":"Uppdatera"}</button>
          <button onClick={function(){setAutoOn(!autoOn);}} className="r" style={{background:autoOn?C.gd:"rgba(255,255,255,.04)",border:autoOn?"1px solid rgba(16,185,129,.3)":"1px solid transparent",color:autoOn?C.gn:C.ts,padding:"6px 10px",borderRadius:6,fontSize:12,fontWeight:autoOn?600:400}}>{autoOn?"AUTO ON":"AUTO"}</button>
        </div>
      </div>

      {/* SIDEBAR */}
      {sidebar&&<div style={{position:"fixed",inset:0,zIndex:200,display:"flex"}}>
        <div style={{width:280,background:C.p1,borderRight:"1px solid "+C.bd,overflowY:"auto",padding:"16px 0",WebkitOverflowScrolling:"touch"}}>
          <div style={{padding:"0 16px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontWeight:700,fontSize:14}}>{"Ligor"}</span><button onClick={function(){setSidebar(false);}} style={{background:"none",border:"none",color:C.ts,fontSize:18}}>{"x"}</button></div>
          {CATS.map(function(cat){var ls=LEAGUES.filter(function(l){return l.cat===cat.id;});if(!ls.length)return null;return <div key={cat.id}><div style={{padding:"12px 16px 6px",fontSize:10,color:C.mt,letterSpacing:".12em",fontWeight:600}}>{cat.label}</div>{ls.map(function(l){var vc=(all[l.id]||[]).filter(function(m){return m.topEV>=cfg.ev;}).length;var act=league.id===l.id;return <button key={l.id} onClick={function(){setLeague(l);setSel(null);setSidebar(false);}} className="r" style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",padding:"10px 16px",background:act?"rgba(59,130,246,.06)":"transparent",border:"none",borderLeft:"2px solid "+(act?C.ac:"transparent"),color:act?"#93c5fd":C.ts,fontSize:13,textAlign:"left"}}><span>{l.country+" "+l.name}</span>{vc>0&&<span style={{fontSize:8,background:C.yd,color:C.yl,padding:"1px 5px",borderRadius:3,fontWeight:600}}>{vc}</span>}</button>;})}
          </div>;})}
        </div>
        <div onClick={function(){setSidebar(false);}} style={{flex:1,background:"rgba(0,0,0,.6)"}}/>
      </div>}

      {err&&<div style={{background:"rgba(239,68,68,.08)",padding:"8px 16px",fontSize:11,color:C.rd}}>{err}</div>}

      {/* NAV */}
      <div style={{display:"flex",borderBottom:"1px solid "+C.bd,background:C.p1,position:"sticky",top:56,zIndex:90}}>
        {[["matches","Matcher"],["settings","Inst."]].map(function(t){return <button key={t[0]} onClick={function(){setPg(t[0]);}} className="r" style={{flex:1,padding:"10px",background:"none",border:"none",borderBottom:pg===t[0]?"2px solid "+C.ac:"2px solid transparent",color:pg===t[0]?"#93c5fd":C.mt,fontSize:12,fontWeight:pg===t[0]?600:400}}>{t[1]}</button>;})}
      </div>

      {pg==="matches"&&<div style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch",paddingBottom:40}}>
        <div style={{padding:"10px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",background:C.p2,borderBottom:"1px solid "+C.bd}}>
          <div><span style={{fontSize:14,fontWeight:600}}>{league.country+" "+league.name}</span><span style={{fontSize:11,color:C.mt,marginLeft:8}}>{matches.length}</span></div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={function(){setFlt(merge(flt,{lv:!flt.lv}));}} className="r" style={{fontSize:11,padding:"4px 8px",borderRadius:4,background:flt.lv?"rgba(239,68,68,.1)":"rgba(255,255,255,.03)",border:"none",color:flt.lv?C.rd:C.mt}}>{"LIVE"}</button>
            <button onClick={function(){setFlt(merge(flt,{val:!flt.val}));}} className="r" style={{fontSize:11,padding:"4px 8px",borderRadius:4,background:flt.val?C.yd:"rgba(255,255,255,.03)",border:"none",color:flt.val?C.yl:C.mt}}>{"VALUE"}</button>
          </div>
        </div>

        {loading&&!matches.length?<div style={{padding:40,textAlign:"center",color:C.mt,fontSize:12}} className="blink">{"Laddar..."}</div>
        :matches.length===0?<div style={{padding:40,textAlign:"center",color:C.mt,fontSize:12}}>{"Inga matcher (off-season?)"}</div>
        :matches.map(function(m){var act=sel&&sel.id===m.id;return <div key={m.id}>
          <div onClick={function(){setSel(act?null:m);setTab("odds");}} className="r" style={{padding:"12px 16px",borderBottom:"1px solid "+C.bd,background:act?"rgba(59,130,246,.04)":m.live?"rgba(239,68,68,.02)":"transparent"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",flex:1}}>
                <span style={{fontSize:14,fontWeight:500}}>{m.home}</span>
                <span style={{fontSize:11,color:C.dm}}>{"v"}</span>
                <span style={{fontSize:14,fontWeight:500}}>{m.away}</span>
                {m.live&&m.sc&&<span style={{fontSize:10,padding:"2px 6px",borderRadius:4,background:"rgba(239,68,68,.1)",color:C.rd,fontWeight:600}}>{m.sc.h+"-"+m.sc.a+(m.min>0?" "+m.min+"'":"")}</span>}
                {m.sharp&&<span className="sharp" style={{fontSize:9,padding:"1px 5px",borderRadius:3,background:C.yd,color:C.yl,fontWeight:600}}>{"SHARP"}</span>}
              </div>
              {m.topEV>=cfg.ev?<span style={{fontSize:14,fontWeight:700,color:C.yl}}>{"+"+ m.topEV+"%"}</span>:m.topEV>0?<span style={{fontSize:12,color:C.gn}}>{"+"+ m.topEV+"%"}</span>:null}
            </div>
            <div style={{display:"flex",gap:4}}>
              {[{v:m.bestH,p:m.tp.home,c:"#60a5fa",l:"1"},{v:m.bestD,p:m.tp.draw,c:C.ts,l:"X"},{v:m.bestA,p:m.tp.away,c:C.pk,l:"2"},{v:m.xg,p:null,c:m.xg>2.5?C.gn:C.ts,l:"xG"},{v:m.ou25+"%",p:null,c:m.ou25>55?C.gn:m.ou25<38?C.rd:C.ts,l:"Oe2.5"}].map(function(cell,ci){
                return <div key={ci} style={{flex:1,background:"rgba(255,255,255,.03)",borderRadius:4,padding:"6px 2px",textAlign:"center"}}>
                  <div style={{fontSize:12,fontWeight:600,color:cell.c}}>{cell.v||"--"}</div>
                  <div style={{fontSize:9,color:cell.p!=null?(cell.p>50?C.gn:cell.p<25?C.rd:C.mt):C.mt}}>{cell.p!=null?cell.p.toFixed(0)+"%":cell.l}</div>
                </div>;
              })}
            </div>
            <div style={{fontSize:10,color:C.dm,marginTop:4}}>{m.live?(m.min>0?m.min+"'":"LIVE"):matchTime(m.date)}</div>
          </div>

          {act&&<div className="slideUp" style={{background:C.p2,borderBottom:"1px solid "+C.bd}}>
            <div style={{display:"flex",borderBottom:"1px solid "+C.bd}}>
              {["odds","value","analys","stats"].map(function(t){return <button key={t} onClick={function(){setTab(t);}} className="r" style={{flex:1,padding:"10px 0",background:"none",border:"none",borderBottom:tab===t?"2px solid "+C.ac:"2px solid transparent",color:tab===t?"#93c5fd":C.mt,fontSize:11,textTransform:"uppercase",fontWeight:tab===t?600:400}}>{t}</button>;})}
            </div>
            <div style={{padding:14}}>
              {tab==="odds"&&<div>
                {m.h2h.map(function(b){var bH=Math.max.apply(null,m.h2h.map(function(x){return x.h;})),bA=Math.max.apply(null,m.h2h.map(function(x){return x.a;})),bD=m.h2h[0].d!=null?Math.max.apply(null,m.h2h.filter(function(x){return x.d!=null;}).map(function(x){return x.d;})):null;
                  return <div key={b.n} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid "+C.bd,fontSize:12}}>
                    <span style={{color:b.pin?C.yl:C.ts,flex:1}}>{(b.pin?"* ":"")+b.n}</span>
                    <span style={{width:50,textAlign:"center",color:b.h===bH?C.gn:C.ts,fontWeight:b.h===bH?700:400}}>{b.h}</span>
                    <span style={{width:50,textAlign:"center",color:b.d!=null&&b.d===bD?C.gn:C.dm}}>{b.d!=null?b.d:"-"}</span>
                    <span style={{width:50,textAlign:"center",color:b.a===bA?C.gn:C.ts,fontWeight:b.a===bA?700:400}}>{b.a}</span>
                  </div>;})}
                {m.tots&&m.tots.length>0&&<div style={{marginTop:12}}><div style={{fontSize:10,color:C.mt,fontWeight:600,marginBottom:6}}>{"OVER/UNDER"}</div>
                  {m.tots.map(function(t){return <div key={t.n} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid "+C.bd,fontSize:12}}><span style={{color:t.pin?C.yl:C.ts,flex:1}}>{(t.pin?"* ":"")+t.n+" ("+t.pt+")"}</span><span style={{width:60,textAlign:"center",color:C.gn}}>{t.o}</span><span style={{width:60,textAlign:"center",color:C.rd}}>{t.u}</span></div>;})}</div>}
                {m.sharp&&<div style={{marginTop:12,padding:"10px 12px",background:"rgba(245,158,11,.05)",borderRadius:6,fontSize:12,color:C.yl}}>{"Sharp money: "+(m.sharp==="home"?m.home:m.away)}</div>}
              </div>}

              {tab==="value"&&<div>
                <div style={{background:C.ag,borderRadius:6,padding:"10px 12px",marginBottom:12,fontSize:11,color:C.ts,lineHeight:1.7}}>
                  <span style={{color:C.ac,fontWeight:600}}>{"Spelteori"}</span><br/>{"EV = (True Prob x Odds) - 1. Positivt EV = vinst laangsiktigt."}<br/>{"Kelly = optimal insats baserat paa edge. Vi anvaender 1/4 Kelly."}<br/>{"Bankroll: "+cfg.bank+" kr"}
                </div>
                <div style={{display:"flex",gap:6,marginBottom:12}}>
                  {[{l:"H",v:m.tp.home,c:"#60a5fa"},{l:"X",v:m.tp.draw,c:C.ts},{l:"B",v:m.tp.away,c:C.pk}].map(function(p){return <div key={p.l} style={{flex:1,background:"rgba(255,255,255,.03)",borderRadius:6,padding:"10px 8px",textAlign:"center"}}><div style={{fontSize:9,color:C.mt}}>{p.l}</div><div style={{fontSize:20,fontWeight:700,color:p.c}}>{p.v.toFixed(0)+"%"}</div></div>;})}
                </div>
                {m.ouTP&&<div style={{display:"flex",gap:6,marginBottom:12}}>
                  <div style={{flex:1,background:"rgba(255,255,255,.03)",borderRadius:6,padding:"10px 8px",textAlign:"center"}}><div style={{fontSize:9,color:C.mt}}>{"Oe"+m.ouTP.pt}</div><div style={{fontSize:20,fontWeight:700,color:C.gn}}>{m.ouTP.o.toFixed(0)+"%"}</div></div>
                  <div style={{flex:1,background:"rgba(255,255,255,.03)",borderRadius:6,padding:"10px 8px",textAlign:"center"}}><div style={{fontSize:9,color:C.mt}}>{"U"+m.ouTP.pt}</div><div style={{fontSize:20,fontWeight:700,color:C.rd}}>{m.ouTP.u.toFixed(0)+"%"}</div></div>
                </div>}
                {m.vb.length===0?<div style={{padding:20,textAlign:"center",color:C.dm,fontSize:12}}>{"Inget vaerde"}</div>
                :m.vb.slice(0,8).map(function(v,i){var ks=kellyStake(cfg.bank,v.tp,v.odds);return <div key={i} style={{background:v.ev>=cfg.ev?C.yd:"rgba(255,255,255,.02)",border:"1px solid "+(v.ev>=cfg.ev?"rgba(245,158,11,.2)":C.bd),borderRadius:6,padding:12,marginBottom:6}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontSize:13,fontWeight:v.ev>=cfg.ev?700:500,color:v.ev>=cfg.ev?C.yl:C.tx}}>{v.team}</div><div style={{fontSize:11,color:C.ts,marginTop:2}}>{"@ "+v.odds+" hos "+v.bm+" ("+v.mkt+")"}</div></div><div style={{textAlign:"right"}}><div style={{fontSize:18,fontWeight:700,color:v.ev>=cfg.ev?C.yl:C.gn}}>{"+"+ v.ev+"%"}</div></div></div>
                  <div style={{display:"flex",gap:8,marginTop:8,fontSize:10,color:C.ts}}><span>{"True: "+v.tp+"%"}</span><span>{"Kelly: "+(v.kelly*100).toFixed(1)+"%"}</span><span style={{color:C.gn,fontWeight:600}}>{"Insats: "+ks+" kr"}</span></div>
                </div>;})}
              </div>}

              {tab==="analys"&&<div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <span style={{fontSize:10,color:C.mt,fontWeight:600}}>{"AI-ANALYS"}</span>
                  <button onClick={function(){doAI(m);}} disabled={aiL===m.id} className="r" style={{background:C.ag,border:"1px solid rgba(59,130,246,.2)",color:"#60a5fa",padding:"8px 16px",fontSize:12,borderRadius:6,fontWeight:600}}>{aiL===m.id?"Analyserar...":ai[m.id]?"Uppdatera":"Analysera"}</button>
                </div>
                {ai[m.id]?<div style={{fontSize:13,color:"#b0c8e0",lineHeight:1.8,whiteSpace:"pre-wrap",background:"rgba(255,255,255,.02)",border:"1px solid "+C.bd,padding:14,borderRadius:8}}>{ai[m.id]}</div>
                :<div style={{padding:"32px 16px",textAlign:"center",color:C.mt,fontSize:12,background:"rgba(255,255,255,.02)",borderRadius:8}}>{"AI-bedoemning av value, maal och risk"}</div>}
              </div>}

              {tab==="stats"&&<div>
                {[{l:"Oe1.5",v:m.o15},{l:"Oe2.5",v:m.ou25},{l:"Oe3.5",v:m.o35},{l:"BTTS",v:Math.min(78,m.ou25-4)}].map(function(s){return <div key={s.l} style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:12,color:C.ts}}>{s.l}</span><span style={{fontSize:13,fontWeight:700,color:s.v>55?C.gn:s.v<38?C.rd:C.ts}}>{s.v.toFixed(1)+"%"}</span></div><div style={{height:4,background:C.bd,borderRadius:2}}><div style={{height:"100%",width:Math.min(s.v,100)+"%",background:s.v>55?C.gn:s.v<38?C.rd:C.ac,borderRadius:2,transition:"width .4s"}}/></div></div>;})}
                <div style={{display:"flex",gap:6,marginTop:14}}>
                  {[{l:"Total xG",v:m.xg,c:C.yl},{l:"Poisson Oe2.5",v:overProb(m.xg,2).toFixed(1)+"%",c:C.gn}].map(function(s){return <div key={s.l} style={{flex:1,background:"rgba(255,255,255,.03)",borderRadius:6,padding:10,textAlign:"center"}}><div style={{fontSize:9,color:C.mt}}>{s.l}</div><div style={{fontSize:18,fontWeight:700,color:s.c}}>{s.v}</div></div>;})}
                </div>
                <div style={{marginTop:14,padding:"10px 12px",background:"rgba(255,255,255,.02)",borderRadius:6,fontSize:11,color:C.ts,lineHeight:1.7}}><span style={{fontWeight:600,color:C.ac}}>{"Poisson-modell"}</span>{": Beraeknar maalsannolikheter statistiskt baserat paa xG, oberoende av bookmakers."}</div>
              </div>}
            </div>
          </div>}
        </div>;})}
      </div>}

      {pg==="settings"&&<div style={{flex:1,overflowY:"auto",padding:16,paddingBottom:60}}>
        <div style={{fontSize:15,fontWeight:700,marginBottom:16}}>{"Instaellningar"}</div>

        <div style={{fontSize:10,color:C.mt,fontWeight:600,letterSpacing:".1em",marginBottom:8,paddingBottom:6,borderBottom:"1px solid "+C.bd}}>{"API-NYCKEL"}</div>
        <div style={{display:"flex",gap:8,marginBottom:6}}>
          <input value={keyInput} onChange={function(e){setKeyInput(e.target.value);}} placeholder={savedKey?"Nyckel sparad - skriv ny foer att byta":"Klistra in API-nyckel"} style={{flex:1,background:C.bg,border:"1px solid "+(savedKey?"rgba(16,185,129,.3)":C.bl),color:"#93c5fd",padding:"10px 12px",fontSize:13,borderRadius:6,outline:"none",fontFamily:"inherit"}}/>
          <button onClick={saveKey} className="r" style={{background:C.gd,border:"1px solid rgba(16,185,129,.3)",color:C.gn,padding:"10px 16px",borderRadius:6,fontSize:13,fontWeight:700}}>{"Spara"}</button>
        </div>
        {savedKey&&<div style={{fontSize:11,color:C.gn,marginBottom:16}}>{"Nyckel aktiv och sparad"}</div>}

        <div style={{fontSize:10,color:C.mt,fontWeight:600,letterSpacing:".1em",marginBottom:8,marginTop:16,paddingBottom:6,borderBottom:"1px solid "+C.bd}}>{"VALUE BOT"}</div>
        {[["Min EV (%)",cfg.ev,"ev",1,20,0.5],["Min odds",cfg.minO,"minO",1.1,5,0.1],["Max odds",cfg.maxO,"maxO",2,20,0.5],["Bankroll (kr)",cfg.bank,"bank",100,100000,100]].map(function(r){return <div key={r[2]} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><span style={{fontSize:13,color:C.ts}}>{r[0]}</span><input type="number" value={r[1]} min={r[3]} max={r[4]} step={r[5]} onChange={function(e){var o={};o[r[2]]=+e.target.value;setCfg(merge(cfg,o));}} style={{width:80,background:C.bg,border:"1px solid "+C.bl,color:"#93c5fd",padding:"8px 10px",fontSize:13,borderRadius:6,textAlign:"right"}}/></div>;})}

        <div style={{fontSize:10,color:C.mt,fontWeight:600,letterSpacing:".1em",marginBottom:8,marginTop:16,paddingBottom:6,borderBottom:"1px solid "+C.bd}}>{"AUTO-UPPDATERING"}</div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><span style={{fontSize:13,color:C.ts}}>{"Intervall (sek)"}</span><input type="number" value={cfg.poll} min={30} max={600} onChange={function(e){setCfg(merge(cfg,{poll:+e.target.value}));}} style={{width:80,background:C.bg,border:"1px solid "+C.bl,color:"#93c5fd",padding:"8px 10px",fontSize:13,borderRadius:6,textAlign:"right"}}/></div>
      </div>}

      {upd&&<div style={{position:"fixed",bottom:0,left:0,right:0,maxWidth:480,margin:"0 auto",background:C.p1,borderTop:"1px solid "+C.bd,padding:"6px 16px",fontSize:9,color:C.dm,textAlign:"center",zIndex:50}}>{"Uppdaterad: "+upd.toLocaleTimeString("sv-SE")}</div>}
    </div>
  );
}
