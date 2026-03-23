"use client";
import { useState, useEffect, useCallback, useRef, Fragment } from "react";

var LEAGUES = [
  { id: "soccer_epl", name: "Premier League", country: "ENG", sport: "football" },
  { id: "soccer_spain_la_liga", name: "La Liga", country: "ESP", sport: "football" },
  { id: "soccer_germany_bundesliga", name: "Bundesliga", country: "GER", sport: "football" },
  { id: "soccer_italy_serie_a", name: "Serie A", country: "ITA", sport: "football" },
  { id: "soccer_france_ligue_one", name: "Ligue 1", country: "FRA", sport: "football" },
  { id: "soccer_uefa_champs_league", name: "Champions League", country: "UCL", sport: "football" },
  { id: "soccer_sweden_allsvenskan", name: "Allsvenskan", country: "SWE", sport: "football" },
  { id: "soccer_sweden_superettan", name: "Superettan", country: "SWE", sport: "football" },
  { id: "icehockey_nhl", name: "NHL", country: "USA", sport: "hockey" },
  { id: "icehockey_sweden_hockey_league", name: "SHL", country: "SWE", sport: "hockey" },
];

var PROFILES = [
  [1.35,1.75,4.2,5.5,4.5,7.0],[1.55,2.0,3.4,4.2,3.5,5.5],[1.75,2.2,3.2,3.8,3.0,4.5],
  [2.0,2.6,3.1,3.6,2.6,3.8],[2.4,3.2,3.0,3.5,2.1,2.8],[3.0,4.5,3.2,3.8,1.7,2.2],
];

var DEMO_TEAMS = {
  soccer_epl:[["Arsenal","Chelsea"],["Man City","Liverpool"],["Tottenham","Man Utd"],["Newcastle","Aston Villa"],["Brighton","West Ham"],["Everton","Wolves"]],
  soccer_spain_la_liga:[["Real Madrid","Barcelona"],["Atletico Madrid","Sevilla"],["Valencia","Villarreal"],["Athletic Bilbao","Real Sociedad"],["Betis","Osasuna"]],
  soccer_germany_bundesliga:[["Bayern Munich","Dortmund"],["Leipzig","Leverkusen"],["Wolfsburg","Frankfurt"],["Stuttgart","Freiburg"],["Hoffenheim","Mainz"]],
  soccer_italy_serie_a:[["Juventus","Inter Milan"],["AC Milan","Napoli"],["Roma","Lazio"],["Atalanta","Fiorentina"],["Torino","Bologna"]],
  soccer_france_ligue_one:[["PSG","Marseille"],["Lyon","Monaco"],["Lens","Lille"],["Nice","Rennes"],["Montpellier","Nantes"]],
  soccer_uefa_champs_league:[["Real Madrid","Man City"],["Bayern Munich","PSG"],["Barcelona","Inter Milan"],["Arsenal","Atletico Madrid"],["Dortmund","Liverpool"]],
  soccer_sweden_allsvenskan:[["Malmoe FF","IFK Goeteborg"],["Djurgarden","AIK"],["Hammarby","IFK Norrkoping"],["BK Haecken","Elfsborg"],["Sirius","Kalmar FF"]],
  soccer_sweden_superettan:[["GAIS","Oergryte"],["Oester","Degerfors"],["Landskrona","Oestersund"],["AFC Eskilstuna","Vaernamo"],["Trelleborg","Joenkoeping"]],
  icehockey_nhl:[["Toronto Maple Leafs","Boston Bruins"],["Tampa Bay Lightning","Florida Panthers"],["Colorado Avalanche","Vegas Golden Knights"],["NY Rangers","NJ Devils"],["Edmonton Oilers","Calgary Flames"]],
  icehockey_sweden_hockey_league:[["Froelunda","Djurgarden"],["Luleaa","Skellefteaa"],["Roegle","Malmoe Redhawks"],["Brynaes","HV71"],["Vaexjoe Lakers","Oerebro"]],
};

function removeVig(home, draw, away) {
  var h = home > 1 ? 1/home : 0, d = draw && draw > 1 ? 1/draw : 0, a = away > 1 ? 1/away : 0;
  var t = h+d+a; if(!t) return {home:33.3,draw:33.3,away:33.3};
  return {home:(h/t)*100,draw:(d/t)*100,away:(a/t)*100};
}
function calcEV(tp,odds){if(!odds||odds<=1||!tp)return 0;return((tp/100)*odds-1)*100;}
function rnd(a,b){return a+Math.random()*(b-a);}
function matchTime(d){var h=Math.floor((d-Date.now())/3600000);if(h<0)return"LIVE";if(h<1)return"Under 1h";if(h<24)return"Om "+h+"h";return d.toLocaleDateString("sv-SE",{weekday:"short",day:"numeric",month:"short"});}
function timeAgo(d){var s=Math.floor((Date.now()-d)/1000);return s<60?s+"s sedan":Math.floor(s/60)+"m sedan";}
function playBeep(ctx){if(!ctx)return;try{var o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.frequency.value=880;o.type="sine";g.gain.setValueAtTime(0,ctx.currentTime);g.gain.linearRampToValueAtTime(0.25,ctx.currentTime+0.01);g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.35);o.start(ctx.currentTime);o.stop(ctx.currentTime+0.35);}catch(e){}}

function sendPushNotification(title, body) {
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try { new Notification(title, { body: body, icon: "/favicon.ico", badge: "/favicon.ico", vibrate: [200,100,200] }); } catch(e) {}
  }
}

function requestNotificationPermission() {
  if (typeof Notification !== "undefined" && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function getMatchMinute(commenceTime) {
  var elapsed = Math.floor((Date.now() - new Date(commenceTime).getTime()) / 60000);
  if (elapsed < 0) return -1;
  if (elapsed > 105) return -1;
  if (elapsed > 45 && elapsed < 47) return 45;
  if (elapsed > 47) return elapsed - 2;
  return elapsed;
}

function isMatchLive(commenceTime) {
  var elapsed = Math.floor((Date.now() - new Date(commenceTime).getTime()) / 60000);
  return elapsed >= 0 && elapsed <= 105;
}

/* ─── LIVE API FETCH ─── */
function fetchOddsAPI(sportKey, apiKey, markets) {
  markets = markets || "h2h,totals";
  var url = "https://api.the-odds-api.com/v4/sports/" + sportKey + "/odds/?apiKey=" + apiKey + "&regions=eu,uk&markets=" + markets + "&oddsFormat=decimal&bookmakers=pinnacle,bet365,unibet,betfair,williamhill,bwin,nordicbet,betsson,coolbet,unibet_se";
  return fetch(url).then(function(r) {
    if (!r.ok) throw new Error("HTTP " + r.status);
    var rem = r.headers.get("x-requests-remaining");
    var used = r.headers.get("x-requests-used");
    return r.json().then(function(data) {
      if (data.message) throw new Error(data.message);
      return { data: data, remaining: rem, used: used };
    });
  });
}

function fetchScoresAPI(sportKey, apiKey) {
  var url = "https://api.the-odds-api.com/v4/sports/" + sportKey + "/scores/?apiKey=" + apiKey + "&daysFrom=1";
  return fetch(url).then(function(r) {
    if (!r.ok) throw new Error("Scores HTTP " + r.status);
    return r.json();
  }).catch(function() { return []; });
}

function transformLiveMatch(event, leagueId, prev, scoreData) {
  var isSoccer = leagueId.startsWith("soccer");
  var home = event.home_team, away = event.away_team;
  var bookmakerOdds = [], totalsOdds = [];
  var bms = event.bookmakers || [];
  for (var bi = 0; bi < bms.length; bi++) {
    var bm = bms[bi];
    var mkts = bm.markets || [];
    for (var mi = 0; mi < mkts.length; mi++) {
      var mkt = mkts[mi];
      if (mkt.key === "h2h") {
        var ho=null,ao=null,dr=null;
        for(var oi=0;oi<mkt.outcomes.length;oi++){
          if(mkt.outcomes[oi].name===home)ho=mkt.outcomes[oi];
          if(mkt.outcomes[oi].name===away)ao=mkt.outcomes[oi];
          if(mkt.outcomes[oi].name==="Draw")dr=mkt.outcomes[oi];
        }
        if(ho&&ao) bookmakerOdds.push({name:bm.key,isPinny:bm.key==="pinnacle",home:+ho.price.toFixed(2),draw:isSoccer&&dr?+dr.price.toFixed(2):null,away:+ao.price.toFixed(2)});
      }
      if (mkt.key === "totals") {
        var over=null, under=null;
        for(var ti=0;ti<mkt.outcomes.length;ti++){
          if(mkt.outcomes[ti].name==="Over") over=mkt.outcomes[ti];
          if(mkt.outcomes[ti].name==="Under") under=mkt.outcomes[ti];
        }
        if(over&&under) totalsOdds.push({name:bm.key,isPinny:bm.key==="pinnacle",over:+over.price.toFixed(2),under:+under.price.toFixed(2),point:over.point||2.5});
      }
    }
  }
  if(!bookmakerOdds.length) return null;
  var pinny = bookmakerOdds.find(function(b){return b.isPinny;}) || bookmakerOdds[0];
  var trueProbs = removeVig(pinny.home,pinny.draw,pinny.away);
  var valueBets = [];
  bookmakerOdds.forEach(function(bm2){
    if(bm2.isPinny) return;
    var evH=calcEV(trueProbs.home,bm2.home),evD=bm2.draw?calcEV(trueProbs.draw,bm2.draw):0,evA=calcEV(trueProbs.away,bm2.away);
    if(evH>1.5) valueBets.push({bm:bm2.name,side:"home",team:home,ev:evH,odds:bm2.home,market:"1X2"});
    if(evD>1.5) valueBets.push({bm:bm2.name,side:"draw",team:"Oavgjort",ev:evD,odds:bm2.draw,market:"1X2"});
    if(evA>1.5) valueBets.push({bm:bm2.name,side:"away",team:away,ev:evA,odds:bm2.away,market:"1X2"});
  });
  var pinnyTotals = totalsOdds.find(function(b){return b.isPinny;}) || totalsOdds[0];
  var ouTrueProbs = null;
  if (pinnyTotals) {
    var oProb = 1/pinnyTotals.over, uProb = 1/pinnyTotals.under;
    var oTotal = oProb + uProb;
    ouTrueProbs = { over: (oProb/oTotal)*100, under: (uProb/oTotal)*100, point: pinnyTotals.point };
    totalsOdds.forEach(function(t2){
      if(t2.isPinny) return;
      var evO = calcEV(ouTrueProbs.over, t2.over);
      var evU = calcEV(ouTrueProbs.under, t2.under);
      if(evO>1.5) valueBets.push({bm:t2.name,side:"over",team:"Oe"+t2.point,ev:evO,odds:t2.over,market:"O/U"});
      if(evU>1.5) valueBets.push({bm:t2.name,side:"under",team:"U"+t2.point,ev:evU,odds:t2.under,market:"O/U"});
    });
  }
  valueBets.sort(function(a,b){return b.ev-a.ev;});
  var xG = prev ? prev.expectedGoals : rnd(0.9,2.7);
  var htxG = prev ? prev.h1ExpGoals : xG*rnd(0.36,0.48);
  var openH = prev ? prev.openingHome : pinny.home;
  var openD = prev ? prev.openingDraw : pinny.draw;
  var openA = prev ? prev.openingAway : pinny.away;
  var live = isMatchLive(event.commence_time);
  var minute = getMatchMinute(event.commence_time);
  var score = null;
  if (scoreData) {
    var sd = scoreData.find(function(s){return s.id===event.id;});
    if(sd && sd.scores) {
      var hs=null,as2=null;
      for(var si=0;si<sd.scores.length;si++){
        if(sd.scores[si].name===home) hs=parseInt(sd.scores[si].score)||0;
        if(sd.scores[si].name===away) as2=parseInt(sd.scores[si].score)||0;
      }
      if(hs!==null&&as2!==null) score={home:hs,away:as2,total:hs+as2};
    }
  }
  return {
    id:event.id,home:home,away:away,matchDate:new Date(event.commence_time),
    bookmakerOdds:bookmakerOdds,totalsOdds:totalsOdds,ouTrueProbs:ouTrueProbs,
    openingHome:openH,openingDraw:openD,openingAway:openA,
    currentBestHome:Math.max.apply(null,bookmakerOdds.map(function(b){return b.home;})),
    currentBestDraw:isSoccer?Math.max.apply(null,bookmakerOdds.filter(function(b){return b.draw;}).map(function(b){return b.draw;})):null,
    currentBestAway:Math.max.apply(null,bookmakerOdds.map(function(b){return b.away;})),
    bestOver:totalsOdds.length?Math.max.apply(null,totalsOdds.map(function(b){return b.over;})):null,
    bestUnder:totalsOdds.length?Math.max.apply(null,totalsOdds.map(function(b){return b.under;})):null,
    trueProbs:trueProbs,pinnyOdds:{home:pinny.home,draw:pinny.draw,away:pinny.away},
    valueBets:valueBets,topEV:valueBets.length?valueBets[0].ev:0,
    expectedGoals:+xG.toFixed(2),h1ExpGoals:+htxG.toFixed(2),
    overUnder25:ouTrueProbs?+ouTrueProbs.over.toFixed(1):+(50+(xG-2.5)*22).toFixed(1),
    overUnder35:+(28+(xG-2.0)*18).toFixed(1),h1Over15:+(38+(htxG-1.2)*28).toFixed(1),
    sharpMovement:prev&&(pinny.home-prev.pinnyOdds.home)<-0.05?"home":(prev&&(pinny.away-prev.pinnyOdds.away)<-0.05?"away":null),
    lineMovement:{home:+(pinny.home-openH).toFixed(2),away:+(pinny.away-openA).toFixed(2),draw:openD?+(pinny.draw-openD).toFixed(2):null},
    isLive:live,minute:minute,score:score,_isLive:true,
  };
}

function generateDemoMatches(leagueId, prevMatches) {
  prevMatches = prevMatches || [];
  var teams = DEMO_TEAMS[leagueId] || DEMO_TEAMS["soccer_epl"];
  var isSoccer = leagueId.startsWith("soccer");
  return teams.map(function(pair,i){
    var home=pair[0],away=pair[1];
    var prev=prevMatches.find(function(m){return m.home===home&&m.away===away;});
    var prof=PROFILES[i%PROFILES.length];
    var baseH=prev?prev._baseH:rnd(prof[0],prof[1]);
    var baseD=isSoccer?(prev?prev._baseD:rnd(prof[2],prof[3])):null;
    var baseA=prev?prev._baseA:rnd(prof[4],prof[5]);
    var drift=function(){return(Math.random()-0.48)*0.07;};
    var newH=Math.max(1.08,baseH+(prev?drift():0));
    var newD=baseD?Math.max(2.0,baseD+(prev?drift():0)):null;
    var newA=Math.max(1.08,baseA+(prev?drift():0));
    var BMS=["pinnacle","bet365","unibet","betfair","williamhill","bwin","nordicbet","betsson","coolbet","1xbet"];
    var bookmakerOdds=BMS.map(function(bm){var v=0.93+Math.random()*0.09;var sp=bm!=="pinnacle"?1.02+Math.random()*0.04:1;return{name:bm,isPinny:bm==="pinnacle",home:+((newH*v*sp)).toFixed(2),draw:newD?+((newD*(0.93+Math.random()*0.09)*sp)).toFixed(2):null,away:+((newA*(0.93+Math.random()*0.09)*sp)).toFixed(2)};});
    var pinny=bookmakerOdds[0];var trueProbs=removeVig(pinny.home,pinny.draw,pinny.away);
    var valueBets=[];
    bookmakerOdds.slice(1).forEach(function(bm2){var evH=calcEV(trueProbs.home,bm2.home),evD=bm2.draw?calcEV(trueProbs.draw,bm2.draw):0,evA=calcEV(trueProbs.away,bm2.away);if(evH>1.5)valueBets.push({bm:bm2.name,side:"home",team:home,ev:evH,odds:bm2.home,market:"1X2"});if(evD>1.5)valueBets.push({bm:bm2.name,side:"draw",team:"Oavgjort",ev:evD,odds:bm2.draw,market:"1X2"});if(evA>1.5)valueBets.push({bm:bm2.name,side:"away",team:away,ev:evA,odds:bm2.away,market:"1X2"});});
    valueBets.sort(function(a2,b2){return b2.ev-a2.ev;});
    var xG=rnd(0.9,2.7),htxG=xG*rnd(0.36,0.48);
    var openH=prev?prev.openingHome:+newH.toFixed(2);var openD=prev?prev.openingDraw:(newD?+newD.toFixed(2):null);var openA=prev?prev.openingAway:+newA.toFixed(2);
    var fakeLive = i < 2;
    var fakeMin = fakeLive ? Math.floor(rnd(25,75)) : -1;
    var fakeScore = fakeLive ? {home:Math.floor(rnd(0,2)),away:Math.floor(rnd(0,2)),total:0} : null;
    if(fakeScore) fakeScore.total = fakeScore.home + fakeScore.away;
    return {
      id:"demo-"+leagueId+"-"+i,home:home,away:away,matchDate:new Date(Date.now()+(fakeLive?-fakeMin*60000:Math.floor(rnd(1,72))*3600000)),
      _baseH:baseH,_baseD:baseD,_baseA:baseA,bookmakerOdds:bookmakerOdds,totalsOdds:[],ouTrueProbs:null,
      openingHome:openH,openingDraw:openD,openingAway:openA,
      currentBestHome:Math.max.apply(null,bookmakerOdds.map(function(b){return b.home;})),
      currentBestDraw:newD?Math.max.apply(null,bookmakerOdds.filter(function(b){return b.draw;}).map(function(b){return b.draw;})):null,
      currentBestAway:Math.max.apply(null,bookmakerOdds.map(function(b){return b.away;})),
      bestOver:null,bestUnder:null,
      trueProbs:trueProbs,pinnyOdds:{home:pinny.home,draw:pinny.draw,away:pinny.away},
      valueBets:valueBets,topEV:valueBets.length?valueBets[0].ev:0,
      expectedGoals:+xG.toFixed(2),h1ExpGoals:+htxG.toFixed(2),
      overUnder25:+(50+(xG-2.5)*22).toFixed(1),overUnder35:+(28+(xG-2.0)*18).toFixed(1),h1Over15:+(38+(htxG-1.2)*28).toFixed(1),
      sharpMovement:Math.random()>0.72?(Math.random()>0.5?"home":"away"):null,
      lineMovement:{home:+(newH-openH).toFixed(2),away:+(newA-openA).toFixed(2),draw:newD?+(newD-(openD||newD)).toFixed(2):null},
      isLive:fakeLive,minute:fakeMin,score:fakeScore,_isLive:false,
    };
  });
}

var C={bg:"#05080d",panel:"#080d14",panel2:"#0a1019",border:"#0e1a28",borderLight:"#142236",accent:"#3b82f6",accentGlow:"rgba(59,130,246,0.12)",green:"#10b981",greenDim:"rgba(16,185,129,0.12)",red:"#ef4444",redDim:"rgba(239,68,68,0.1)",yellow:"#f59e0b",yellowDim:"rgba(245,158,11,0.1)",pink:"#ec4899",text:"#e2e8f0",textSoft:"#94a3b8",muted:"#475569",dim:"#1e293b",gold:"#fbbf24",goldGlow:"rgba(251,191,36,0.08)",live:"#ef4444"};

function Tip(props){var st=useState(false),show=st[0],setShow=st[1];var tip={hemma:"Basta odds hemmaseger",x:"Basta odds oavgjort",borta:"Basta odds bortaseger",xg:"Expected Goals",o25:"Sannolikhet 3+ maal",rorelse:"Pinnacle lineroerelser",ev:"Expected Value %",sharp:"Professionella spelare",ou:"Over/Under odds"}[props.id];if(!tip)return props.children;return(<div style={{position:"relative",display:"inline-flex",alignItems:"center",gap:4}}>{props.children}<span onClick={function(e){e.stopPropagation();setShow(!show);}} style={{width:14,height:14,borderRadius:"50%",background:show?"rgba(59,130,246,0.25)":"rgba(59,130,246,0.08)",border:"1px solid "+(show?"rgba(59,130,246,0.5)":"rgba(59,130,246,0.2)"),color:"#60a5fa",fontSize:8,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,fontWeight:600}}>{"?"}</span>{show&&(<div onClick={function(e){e.stopPropagation();}} style={{position:"absolute",top:"130%",left:-8,zIndex:999,background:"#0c1a2e",border:"1px solid rgba(59,130,246,0.2)",padding:"10px 12px",width:220,borderRadius:8,boxShadow:"0 12px 40px rgba(0,0,0,0.7)"}}><div style={{fontSize:10,color:"#93c5fd",fontWeight:600,marginBottom:4}}>{tip}</div><button onClick={function(){setShow(false);}} style={{marginTop:6,background:"rgba(59,130,246,0.1)",border:"1px solid rgba(59,130,246,0.2)",color:"#60a5fa",fontSize:9,cursor:"pointer",padding:"2px 8px",borderRadius:4}}>{"OK"}</button></div>)}</div>);}

function Toggle(props){return(<div onClick={function(){props.onChange(!props.on);}} style={{width:38,height:20,borderRadius:10,background:props.on?"rgba(16,185,129,0.15)":"rgba(255,255,255,0.03)",border:"1px solid "+(props.on?"rgba(16,185,129,0.4)":C.dim),cursor:"pointer",position:"relative",transition:"all 0.25s",flexShrink:0}}><div style={{position:"absolute",top:2,left:props.on?19:2,width:14,height:14,borderRadius:"50%",background:props.on?C.green:"#334155",transition:"left 0.25s",boxShadow:props.on?"0 0 8px "+C.green:"none"}}/></div>);}

function SLabel(props){return <div style={{fontSize:9,color:C.muted,letterSpacing:"0.12em",marginBottom:10,textTransform:"uppercase",fontWeight:600}}>{props.children}</div>;}
function SettRow(props){return <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,gap:12}}><span style={{fontSize:11,color:C.textSoft}}>{props.label}</span>{props.children}</div>;}
function SettSection(props){return <div style={{marginBottom:24}}><div style={{fontSize:9,color:C.muted,letterSpacing:"0.12em",marginBottom:12,paddingBottom:8,borderBottom:"1px solid "+C.border,fontWeight:600}}>{props.title}</div>{props.children}</div>;}
function OddsCell(props){var val=props.val,prob=props.prob,color=props.color;if(!val)return <div style={{textAlign:"center",color:C.dim,fontSize:10}}>{"--"}</div>;var pColor=C.muted;if(prob>50)pColor=C.green;else if(prob<25)pColor=C.red;return(<div style={{textAlign:"center"}}><div style={{fontSize:12,color:color,fontWeight:600}}>{val}</div>{prob!=null&&<div style={{fontSize:9,color:pColor,fontWeight:500}}>{prob.toFixed(0)+"%"}</div>}</div>);}
function Mov(props){var val=props.val,label=props.label;var color=C.dim;if(val>0.04)color=C.green;else if(val<-0.04)color=C.red;return <div style={{fontSize:9,color:color}}>{label+": "+(val>0?"+":"")+val}</div>;}

var inputBase={background:C.bg,border:"1px solid "+C.borderLight,color:"#93c5fd",padding:"6px 10px",fontSize:11,borderRadius:4,outline:"none",fontFamily:"inherit"};
function inp(extra){var r={};for(var k in inputBase)r[k]=inputBase[k];if(extra)for(var k2 in extra)r[k2]=extra[k2];return r;}
function merge(a,b){var r={};for(var k in a)r[k]=a[k];for(var k2 in b)r[k2]=b[k2];return r;}

function LiveBadge(props){
  var m = props.match;
  if(!m.isLive) return null;
  var scoreText = m.score ? m.score.home+"-"+m.score.away : "";
  var minText = m.minute > 0 ? m.minute+"'" : "";
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:9,background:"rgba(239,68,68,0.12)",border:"1px solid rgba(239,68,68,0.3)",color:C.live,padding:"1px 6px",borderRadius:3,fontWeight:600}}>
      <span style={{width:5,height:5,borderRadius:"50%",background:C.live}} className="blink" />
      {scoreText && <span>{scoreText}</span>}
      {minText && <span style={{color:"rgba(239,68,68,0.7)"}}>{minText}</span>}
    </span>
  );
}

export default function App(){
  var stL=useState(LEAGUES[0]),activeLeague=stL[0],setActiveLeague=stL[1];
  var stM=useState({}),allMatches=stM[0],setAllMatches=stM[1];
  var stLd=useState(false),loading=stLd[0],setLoading=stLd[1];
  var stErr=useState(null),apiError=stErr[0],setApiError=stErr[1];
  var stQ=useState(null),quotaInfo=stQ[0],setQuotaInfo=stQ[1];
  var stSel=useState(null),selectedMatch=stSel[0],setSelectedMatch=stSel[1];
  var stDT=useState("odds"),detailTab=stDT[0],setDetailTab=stDT[1];
  var stMT=useState("matches"),mainTab=stMT[0],setMainTab=stMT[1];
  var stAl=useState([]),alerts=stAl[0],setAlerts=stAl[1];
  var stLv=useState(false),liveMode=stLv[0],setLiveMode=stLv[1];
  var stK=useState(""),apiKey=stK[0],setApiKey=stK[1];
  var stSK=useState(""),savedApiKey=stSK[0],setSavedApiKey=stSK[1];
  var stAI=useState({}),aiAnalysis=stAI[0],setAiAnalysis=stAI[1];
  var stAIL=useState(null),loadingAI=stAIL[0],setLoadingAI=stAIL[1];
  var stUp=useState(null),lastUpdate=stUp[0],setLastUpdate=stUp[1];
  var stSet=useState({
    evThreshold:4,pollInterval:60,soundOn:true,notifyHome:true,notifyDraw:true,notifyAway:true,
    minOdds:1.5,maxOdds:8.0,pushNotify:true,
    notifyOU:true,minOddsOU:1.80,ouThreshold:55,
    inplayTrigger:true,inplayMinute:55,inplayScoreMax:0,inplayO15MinOdds:1.60,
  }),settings=stSet[0],setSettings=stSet[1];
  var stF=useState({minXG:0,minHTXG:0,valueOnly:false,liveOnly:false}),filter=stF[0],setFilter=stF[1];
  var stScores=useState({}),liveScores=stScores[0],setLiveScores=stScores[1];

  var audioRef=useRef(null);var pollRef=useRef(null);var prevRef=useRef({});

  useEffect(function(){
    audioRef.current=new(window.AudioContext||window.webkitAudioContext)();
    requestNotificationPermission();
    return function(){if(pollRef.current)clearInterval(pollRef.current);};
  },[]);

  var isLive=!!savedApiKey;
  var getMatches=function(id){return allMatches[id]||[];};

  var loadLeague=useCallback(function(leagueId,silent){
    if(!silent)setLoading(true);
    setApiError(null);
    var prev=prevRef.current[leagueId]||[];

    var processMatches=function(fresh){
      var newAlerts=[];
      fresh.forEach(function(match){
        var prevMatch=prev.find(function(m){return m.id===match.id;});

        /* ─── Standard EV alerts ─── */
        match.valueBets.forEach(function(vb){
          if(vb.ev<settings.evThreshold) return;
          if(vb.market==="1X2" && (vb.odds<settings.minOdds||vb.odds>settings.maxOdds)) return;
          if(vb.market==="O/U" && !settings.notifyOU) return;
          if(vb.market==="O/U" && vb.odds<settings.minOddsOU) return;
          var ok=(vb.side==="home"&&settings.notifyHome)||(vb.side==="draw"&&settings.notifyDraw)||(vb.side==="away"&&settings.notifyAway)||(vb.side==="over"&&settings.notifyOU)||(vb.side==="under"&&settings.notifyOU);
          if(!ok) return;
          var prevVB=prevMatch?(prevMatch.valueBets||[]).find(function(p){return p.bm===vb.bm&&p.side===vb.side;}):null;
          if(!prevVB||Math.abs(prevVB.ev-vb.ev)>1.2){
            var alertObj={id:match.id+"-"+vb.bm+"-"+vb.side+"-"+Date.now(),timestamp:new Date(),league:(LEAGUES.find(function(l){return l.id===leagueId;})||{}).name||leagueId,home:match.home,away:match.away,bm:vb.bm,side:vb.side,team:vb.team,ev:vb.ev,odds:vb.odds,market:vb.market||"1X2",type:"value"};
            newAlerts.push(alertObj);
          }
        });

        /* ─── In-play 0-0 trigger for O1.5 ─── */
        if(settings.inplayTrigger && match.isLive && match.score && match.minute>=settings.inplayMinute && match.score.total<=settings.inplayScoreMax){
          var wasTriggered=prevMatch&&prevMatch._inplayTriggered;
          if(!wasTriggered){
            match._inplayTriggered=true;
            var alertObj2={id:match.id+"-inplay-"+Date.now(),timestamp:new Date(),league:(LEAGUES.find(function(l){return l.id===leagueId;})||{}).name||leagueId,home:match.home,away:match.away,bm:"SYSTEM",side:"inplay",team:"Oe1.5 IN-PLAY",ev:0,odds:0,market:"IN-PLAY",type:"inplay",minute:match.minute,score:match.score.home+"-"+match.score.away,reason:match.score.home+"-"+match.score.away+" efter "+match.minute+"' - Oe1.5 trigger"};
            newAlerts.push(alertObj2);
          } else { match._inplayTriggered=true; }
        }

        /* ─── O/U threshold alert ─── */
        if(settings.notifyOU && match.overUnder25>=settings.ouThreshold && match.bestOver && match.bestOver>=settings.minOddsOU){
          var wasTrig2=prevMatch&&prevMatch._ouTriggered;
          if(!wasTrig2){
            match._ouTriggered=true;
            newAlerts.push({id:match.id+"-ou-"+Date.now(),timestamp:new Date(),league:(LEAGUES.find(function(l){return l.id===leagueId;})||{}).name||leagueId,home:match.home,away:match.away,bm:"Oe2.5",side:"over",team:"Oe2.5 @ "+(match.bestOver||"?"),ev:0,odds:match.bestOver||0,market:"O/U",type:"ou",reason:"Oe2.5 sannolikhet "+match.overUnder25+"% (troeskel "+settings.ouThreshold+"%)"});
          } else { match._ouTriggered=true; }
        }
      });

      if(newAlerts.length>0){
        if(settings.soundOn) playBeep(audioRef.current);
        if(settings.pushNotify){
          newAlerts.forEach(function(a){
            var title = a.type==="inplay" ? "IN-PLAY: "+a.home+" vs "+a.away : a.type==="ou" ? "Oe/U: "+a.home+" vs "+a.away : "VALUE: "+a.team+" +"+a.ev.toFixed(1)+"%";
            var body = a.type==="inplay" ? a.reason : a.type==="ou" ? a.reason : a.team+" @ "+a.odds+" hos "+a.bm;
            sendPushNotification(title, body);
          });
        }
        setAlerts(function(p){return newAlerts.concat(p).slice(0,200);});
      }
      prevRef.current[leagueId]=fresh;
      setAllMatches(function(p){var n={};for(var k in p)n[k]=p[k];n[leagueId]=fresh;return n;});
      setLastUpdate(new Date());
      if(!silent)setLoading(false);
    };

    if(savedApiKey){
      Promise.all([
        fetchOddsAPI(leagueId,savedApiKey,"h2h,totals"),
        fetchScoresAPI(leagueId,savedApiKey)
      ]).then(function(results){
        var oddsResult=results[0],scoresData=results[1];
        if(oddsResult.remaining) setQuotaInfo({remaining:oddsResult.remaining,used:oddsResult.used});
        var fresh=oddsResult.data.map(function(ev){return transformLiveMatch(ev,leagueId,prev.find(function(m){return m.id===ev.id;}),scoresData);}).filter(Boolean);
        if(!fresh.length) fresh=generateDemoMatches(leagueId,prev);
        processMatches(fresh);
      }).catch(function(err){
        setApiError(err.message);
        processMatches(generateDemoMatches(leagueId,prev));
      });
    } else {
      processMatches(generateDemoMatches(leagueId,prev));
    }
  },[savedApiKey,settings]);

  useEffect(function(){loadLeague(activeLeague.id);},[activeLeague.id,savedApiKey]);
  useEffect(function(){
    if(pollRef.current)clearInterval(pollRef.current);
    if(liveMode){pollRef.current=setInterval(function(){LEAGUES.forEach(function(l){loadLeague(l.id,true);});},settings.pollInterval*1000);}
    return function(){if(pollRef.current)clearInterval(pollRef.current);};
  },[liveMode,settings.pollInterval,loadLeague]);

  var fetchAI=function(match){
    setLoadingAI(match.id);
    var prompt="Du aer en expert odds-analytiker. Match: "+match.home+" vs "+match.away+". ODDS Pinnacle: H "+match.pinnyOdds.home+" = "+match.trueProbs.home.toFixed(1)+"%, B "+match.pinnyOdds.away+" = "+match.trueProbs.away.toFixed(1)+"%. xG: "+match.expectedGoals+"."+(match.isLive?" LIVE "+match.minute+"' Score: "+(match.score?match.score.home+"-"+match.score.away:"?"):"")+" Ge kortfattad analys pa svenska: REKOMMENDATION, SANNOLIKHET, SHARP, MAALANALYS, RISK. Max 180 ord.";
    fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:prompt}]})}).then(function(r){return r.json();}).then(function(data){var txt=(data.content||[]).map(function(c){return c.text||"";}).join("\n")||"Ej tillgaenglig";setAiAnalysis(function(p){var n={};for(var k in p)n[k]=p[k];n[match.id]=txt;return n;});}).catch(function(){setAiAnalysis(function(p){var n={};for(var k in p)n[k]=p[k];n[match.id]="Kunde inte haemta analys.";return n;});}).finally(function(){setLoadingAI(null);});
  };

  var currentMatches=getMatches(activeLeague.id);
  var filtered=currentMatches.filter(function(m){
    if(filter.valueOnly&&m.topEV<settings.evThreshold)return false;
    if(filter.liveOnly&&!m.isLive)return false;
    if(m.expectedGoals<filter.minXG)return false;
    return true;
  });
  var liveCount=currentMatches.filter(function(m){return m.isLive;}).length;
  var unread=alerts.length;

  return(
    <div style={{fontFamily:"'JetBrains Mono','SF Mono',monospace",background:C.bg,minHeight:"100vh",color:C.text,display:"flex",flexDirection:"column"}}>
      <style>{["@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap');","*{box-sizing:border-box;margin:0;padding:0;}","::-webkit-scrollbar{width:4px;}","::-webkit-scrollbar-thumb{background:#1a2a40;border-radius:4px;}",".mrow{transition:background 0.15s;}",".mrow:hover{background:rgba(59,130,246,0.06)!important;cursor:pointer;}",".hbtn{transition:all 0.15s;}",".hbtn:hover{opacity:0.8;}","@keyframes blink{0%,100%{opacity:1}50%{opacity:0.15}}","@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(245,158,11,0.5)}60%{box-shadow:0 0 0 6px rgba(245,158,11,0)}}","@keyframes slidein{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:none}}","@keyframes alertin{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}","@keyframes spin{to{transform:rotate(360deg)}}",".blink{animation:blink 1.4s infinite;}",".sharp{animation:pulse 2.2s infinite;}",".slidein{animation:slidein 0.2s ease;}",".alertin{animation:alertin 0.25s ease;}",".spin{animation:spin 0.9s linear infinite;display:inline-block;}","input{outline:none;font-family:inherit;}","button{cursor:pointer;font-family:inherit;}"].join("\n")}</style>

      {/* TOP BAR */}
      <div style={{background:C.panel,borderBottom:"1px solid "+C.border,padding:"0 16px",display:"flex",alignItems:"stretch",height:48,flexShrink:0,position:"sticky",top:0,zIndex:200,boxShadow:"0 4px 24px rgba(0,0,0,0.4)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginRight:24}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:liveMode?C.green:"#1a2a3a",boxShadow:liveMode?"0 0 12px "+C.green:"none"}} className={liveMode?"blink":""}/>
          <span style={{color:C.accent,fontWeight:700,fontSize:14,letterSpacing:"0.2em"}}>{"ODDSTRACKER"}</span>
          <span style={{fontSize:8,padding:"2px 8px",borderRadius:3,background:isLive?C.greenDim:C.yellowDim,border:"1px solid "+(isLive?"rgba(16,185,129,0.3)":"rgba(245,158,11,0.3)"),color:isLive?C.green:C.yellow,fontWeight:600}}>{isLive?"LIVE":"DEMO"}</span>
          {liveCount>0&&<span style={{fontSize:8,padding:"2px 8px",borderRadius:3,background:"rgba(239,68,68,0.12)",border:"1px solid rgba(239,68,68,0.3)",color:C.live,fontWeight:600}}>{liveCount+" LIVE"}</span>}
        </div>
        {[["matches","MATCHER"],["alerts","ALERTS"+(unread>0?" ("+unread+")":"")],["settings","INST."]].map(function(item){return <button key={item[0]} onClick={function(){setMainTab(item[0]);}} className="hbtn" style={{padding:"0 14px",background:"transparent",border:"none",borderBottom:mainTab===item[0]?"2px solid "+C.accent:"2px solid transparent",color:item[0]==="alerts"&&unread>0?C.yellow:mainTab===item[0]?"#93c5fd":C.muted,fontSize:10,letterSpacing:"0.1em",fontWeight:mainTab===item[0]?600:400}}>{item[1]}</button>;})}
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:10}}>
          {quotaInfo&&<span style={{fontSize:9,color:C.dim}}>{"API: "+quotaInfo.remaining}</span>}
          {lastUpdate&&<span style={{fontSize:9,color:C.dim}}>{lastUpdate.toLocaleTimeString("sv-SE",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}</span>}
          <button onClick={function(){loadLeague(activeLeague.id);}} className="hbtn" style={{background:"transparent",border:"1px solid "+C.border,color:C.muted,padding:"5px 12px",fontSize:10,borderRadius:4}}>{loading?"...":"REFRESH"}</button>
          <button onClick={function(){setLiveMode(!liveMode);}} className="hbtn" style={{background:liveMode?C.greenDim:"transparent",border:"1px solid "+(liveMode?"rgba(16,185,129,0.4)":C.border),color:liveMode?C.green:C.muted,padding:"5px 14px",fontSize:10,borderRadius:4,fontWeight:liveMode?600:400}}>{liveMode?"LIVE ON":"LIVE OFF"}</button>
        </div>
      </div>

      {apiError&&<div style={{background:C.redDim,borderBottom:"1px solid rgba(239,68,68,0.2)",padding:"8px 16px",fontSize:10,color:C.red,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span>{"API: "+apiError+" - visar demo"}</span><button onClick={function(){setApiError(null);}} style={{background:"transparent",border:"none",color:C.red,fontSize:14}}>{"x"}</button></div>}

      <div style={{flex:1,display:"flex",overflow:"hidden"}}>
        {/* SIDEBAR */}
        {mainTab==="matches"&&(<div style={{width:190,background:C.panel,borderRight:"1px solid "+C.border,overflowY:"auto",flexShrink:0,paddingTop:8}}>
          {["football","hockey"].map(function(sport){return(<div key={sport}><div style={{padding:"10px 14px 6px",fontSize:9,color:C.muted,letterSpacing:"0.12em",fontWeight:600}}>{sport==="football"?"FOTBOLL":"HOCKEY"}</div>
            {LEAGUES.filter(function(l){return l.sport===sport;}).map(function(l){
              var vc=getMatches(l.id).filter(function(m){return m.topEV>=settings.evThreshold;}).length;
              var lc=getMatches(l.id).filter(function(m){return m.isLive;}).length;
              var isAct=activeLeague.id===l.id;
              return <button key={l.id} onClick={function(){setActiveLeague(l);setSelectedMatch(null);}} className="hbtn" style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",padding:"8px 14px",background:isAct?"rgba(59,130,246,0.08)":"transparent",border:"none",borderLeft:"2px solid "+(isAct?C.accent:"transparent"),color:isAct?"#93c5fd":C.textSoft,fontSize:10,textAlign:"left"}}>
                <span>{l.country+" "+l.name}</span>
                <span style={{display:"flex",gap:4}}>
                  {lc>0&&<span style={{fontSize:7,background:"rgba(239,68,68,0.12)",border:"1px solid rgba(239,68,68,0.3)",color:C.live,padding:"1px 5px",borderRadius:3,fontWeight:600}}>{lc}</span>}
                  {vc>0&&<span style={{fontSize:7,background:C.yellowDim,border:"1px solid rgba(245,158,11,0.3)",color:C.yellow,padding:"1px 5px",borderRadius:3,fontWeight:600}}>{vc}</span>}
                </span>
              </button>;
            })}</div>);
          })}
        </div>)}

        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          {/* MATCHES */}
          {mainTab==="matches"&&(<div style={{flex:1,display:"flex",overflow:"hidden"}}>
            <div style={{flex:selectedMatch?"0 0 54%":1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
              <div style={{background:C.panel2,borderBottom:"1px solid "+C.border,padding:"8px 14px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",flexShrink:0}}>
                <span style={{fontSize:12,color:C.text,fontWeight:600}}>{activeLeague.country+" "+activeLeague.name}</span>
                <span style={{fontSize:9,color:C.muted}}>{filtered.length+" matcher"}</span>
                {!isLive&&<span style={{fontSize:9,color:C.yellow}}>{"DEMO"}</span>}
                <div style={{marginLeft:"auto",display:"flex",gap:10,alignItems:"center"}}>
                  <label style={{fontSize:9,color:C.muted,display:"flex",alignItems:"center",gap:4,cursor:"pointer"}}><input type="checkbox" checked={filter.liveOnly} onChange={function(e){setFilter(merge(filter,{liveOnly:e.target.checked}));}} /><span style={{color:C.live}}>{"LIVE"}</span></label>
                  <label style={{fontSize:9,color:C.muted,display:"flex",alignItems:"center",gap:4,cursor:"pointer"}}><input type="checkbox" checked={filter.valueOnly} onChange={function(e){setFilter(merge(filter,{valueOnly:e.target.checked}));}} /><span>{"VALUE"}</span></label>
                </div>
              </div>

              <div style={{display:"grid",gridTemplateColumns:"1fr 70px 56px 70px 70px 60px 68px 74px",padding:"6px 14px",fontSize:9,color:C.muted,letterSpacing:"0.08em",borderBottom:"1px solid "+C.border,background:C.panel,flexShrink:0,fontWeight:600}}>
                <span>{"MATCH"}</span>
                <Tip id="hemma"><span style={{textAlign:"center",display:"block"}}>{"HEMMA"}</span></Tip>
                <Tip id="x"><span style={{textAlign:"center",display:"block"}}>{"X"}</span></Tip>
                <Tip id="borta"><span style={{textAlign:"center",display:"block"}}>{"BORTA"}</span></Tip>
                <Tip id="xg"><span style={{textAlign:"center",display:"block"}}>{"xG"}</span></Tip>
                <Tip id="o25"><span style={{textAlign:"center",display:"block"}}>{"Oe2.5"}</span></Tip>
                <Tip id="rorelse"><span style={{textAlign:"center",display:"block"}}>{"MOVE"}</span></Tip>
                <Tip id="ev"><span style={{textAlign:"center",display:"block"}}>{"TOP EV"}</span></Tip>
              </div>

              <div style={{flex:1,overflowY:"auto"}}>
                {loading&&!filtered.length?(<div style={{padding:48,textAlign:"center",color:C.muted,fontSize:11}}><span className="blink">{"Loading..."}</span></div>
                ):filtered.length===0?(<div style={{padding:48,textAlign:"center",color:C.muted,fontSize:11}}>{"Inga matcher"}</div>
                ):filtered.map(function(m){
                  var active=selectedMatch&&selectedMatch.id===m.id;
                  return(
                    <div key={m.id} className="mrow" onClick={function(){setSelectedMatch(active?null:m);}} style={{display:"grid",gridTemplateColumns:"1fr 70px 56px 70px 70px 60px 68px 74px",padding:"10px 14px",borderBottom:"1px solid "+C.border,background:active?"rgba(59,130,246,0.06)":m.isLive?"rgba(239,68,68,0.03)":"transparent"}}>
                      <div>
                        <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
                          <span style={{fontSize:11,color:C.text,fontWeight:500}}>{m.home}</span>
                          <span style={{fontSize:9,color:C.dim}}>{"vs"}</span>
                          <span style={{fontSize:11,color:C.text,fontWeight:500}}>{m.away}</span>
                          <LiveBadge match={m} />
                          {m.sharpMovement&&<span className="sharp" style={{fontSize:8,background:C.yellowDim,border:"1px solid rgba(245,158,11,0.3)",color:C.yellow,padding:"1px 6px",borderRadius:3,fontWeight:600}}>{"SHARP"}</span>}
                        </div>
                        <div style={{fontSize:9,color:C.dim,marginTop:3}}>{m.isLive?(m.minute>0?m.minute+"'":"LIVE"):matchTime(m.matchDate)}</div>
                      </div>
                      <OddsCell val={m.currentBestHome} prob={m.trueProbs.home} color="#60a5fa"/>
                      <OddsCell val={m.currentBestDraw} prob={m.trueProbs.draw} color="#94a3b8"/>
                      <OddsCell val={m.currentBestAway} prob={m.trueProbs.away} color={C.pink}/>
                      <div style={{textAlign:"center"}}><div style={{fontSize:12,color:m.expectedGoals>2.5?C.green:"#94a3b8",fontWeight:500}}>{m.expectedGoals}</div><div style={{fontSize:9,color:C.dim}}>{"("+m.h1ExpGoals+")"}</div></div>
                      <div style={{textAlign:"center",fontSize:12,color:m.overUnder25>55?C.green:m.overUnder25<38?C.red:"#94a3b8",fontWeight:(m.overUnder25>55||m.overUnder25<38)?700:400}}>{m.overUnder25+"%"}</div>
                      <div style={{textAlign:"center"}}><Mov val={m.lineMovement.home} label="H"/><Mov val={m.lineMovement.away} label="B"/></div>
                      <div style={{textAlign:"center"}}>{m.topEV>=settings.evThreshold?<span style={{fontSize:12,fontWeight:700,color:C.yellow,textShadow:"0 0 12px rgba(245,158,11,0.4)"}}>{"+"+ m.topEV.toFixed(1)+"%"}</span>:m.topEV>0?<span style={{fontSize:11,color:C.green}}>{"+"+ m.topEV.toFixed(1)+"%"}</span>:<span style={{fontSize:10,color:C.dim}}>{"--"}</span>}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* DETAIL */}
            {selectedMatch&&(<div className="slidein" style={{flex:"0 0 46%",borderLeft:"1px solid "+C.border,background:"#080e18",display:"flex",flexDirection:"column",overflow:"hidden"}}>
              <div style={{padding:"12px 16px",borderBottom:"1px solid "+C.border,display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexShrink:0,background:C.panel}}>
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:13,fontWeight:700,color:C.text}}>{selectedMatch.home+" - "+selectedMatch.away}</span>
                    <LiveBadge match={selectedMatch}/>
                  </div>
                  <div style={{fontSize:9,color:C.muted,marginTop:3}}>{activeLeague.name}</div>
                </div>
                <button onClick={function(){setSelectedMatch(null);}} style={{background:"rgba(255,255,255,0.05)",border:"none",color:C.muted,fontSize:14,width:26,height:26,borderRadius:6}}>{"x"}</button>
              </div>
              <div style={{display:"flex",borderBottom:"1px solid "+C.border,background:C.panel,flexShrink:0}}>
                {["odds","value","analys","stats"].map(function(t){return <button key={t} onClick={function(){setDetailTab(t);}} className="hbtn" style={{flex:1,padding:"8px 0",background:"transparent",border:"none",borderBottom:detailTab===t?"2px solid "+C.accent:"2px solid transparent",color:detailTab===t?"#93c5fd":C.muted,fontSize:9,letterSpacing:"0.1em",textTransform:"uppercase",fontWeight:detailTab===t?600:400}}>{t}</button>;})}
              </div>
              <div style={{flex:1,overflowY:"auto",padding:14}}>
                {detailTab==="odds"&&(<div>
                  <SLabel>{"BOOKMAKER ODDS (* = Pinnacle)"}</SLabel>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 56px 56px 56px",gap:1,marginBottom:14}}>
                    {["","1","X","2"].map(function(h,i){return <div key={i} style={{padding:"4px 6px",fontSize:9,color:C.muted,fontWeight:600}}>{h}</div>;})}
                    {selectedMatch.bookmakerOdds.map(function(bm){
                      var allH=selectedMatch.bookmakerOdds.map(function(b){return b.home;}),allA=selectedMatch.bookmakerOdds.map(function(b){return b.away;}),allD=selectedMatch.bookmakerOdds.filter(function(b){return b.draw;}).map(function(b){return b.draw;});
                      var bH=Math.max.apply(null,allH),bA=Math.max.apply(null,allA),bD=allD.length?Math.max.apply(null,allD):null;
                      return(<Fragment key={bm.name}>
                        <div style={{padding:"6px 8px",background:"rgba(255,255,255,0.02)",color:bm.isPinny?C.yellow:C.textSoft,fontSize:10,textTransform:"capitalize"}}>{(bm.isPinny?"* ":"")+bm.name}</div>
                        <div style={{textAlign:"center",padding:"6px 4px",background:"rgba(255,255,255,0.02)",color:bm.home===bH?C.green:"#94a3b8",fontWeight:bm.home===bH?700:400,fontSize:11}}>{bm.home}</div>
                        <div style={{textAlign:"center",padding:"6px 4px",background:"rgba(255,255,255,0.02)",color:bm.draw&&bm.draw===bD?C.green:C.dim,fontSize:11}}>{bm.draw||"--"}</div>
                        <div style={{textAlign:"center",padding:"6px 4px",background:"rgba(255,255,255,0.02)",color:bm.away===bA?C.green:"#94a3b8",fontWeight:bm.away===bA?700:400,fontSize:11}}>{bm.away}</div>
                      </Fragment>);
                    })}
                  </div>
                  {selectedMatch.totalsOdds&&selectedMatch.totalsOdds.length>0&&(<div>
                    <SLabel>{"OVER/UNDER ODDS"}</SLabel>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 70px 70px",gap:1,marginBottom:14}}>
                      <div style={{padding:"4px 6px",fontSize:9,color:C.muted,fontWeight:600}}>{""}</div>
                      <div style={{padding:"4px 6px",fontSize:9,color:C.muted,fontWeight:600,textAlign:"center"}}>{"OVER"}</div>
                      <div style={{padding:"4px 6px",fontSize:9,color:C.muted,fontWeight:600,textAlign:"center"}}>{"UNDER"}</div>
                      {selectedMatch.totalsOdds.map(function(t){
                        return(<Fragment key={t.name}>
                          <div style={{padding:"6px 8px",background:"rgba(255,255,255,0.02)",color:t.isPinny?C.yellow:C.textSoft,fontSize:10,textTransform:"capitalize"}}>{(t.isPinny?"* ":"")+t.name+" ("+t.point+")"}</div>
                          <div style={{textAlign:"center",padding:"6px 4px",background:"rgba(255,255,255,0.02)",color:C.green,fontSize:11}}>{t.over}</div>
                          <div style={{textAlign:"center",padding:"6px 4px",background:"rgba(255,255,255,0.02)",color:C.red,fontSize:11}}>{t.under}</div>
                        </Fragment>);
                      })}
                    </div>
                  </div>)}
                  <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid "+C.border,padding:"12px 14px",borderRadius:6}}>
                    <div style={{fontSize:9,color:C.muted,marginBottom:6,fontWeight:600}}>{"SHARP MONEY"}</div>
                    {selectedMatch.sharpMovement?(<div><div style={{fontSize:12,color:C.yellow,fontWeight:700}}>{"Detected: "+(selectedMatch.sharpMovement==="home"?selectedMatch.home:selectedMatch.away)}</div></div>):<div style={{fontSize:11,color:C.dim}}>{"No sharp movements"}</div>}
                  </div>
                </div>)}

                {detailTab==="value"&&(<div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
                    {[{label:"TRUE PROB H",val:selectedMatch.trueProbs.home.toFixed(1)+"%",color:"#60a5fa"},{label:"TRUE PROB X",val:selectedMatch.trueProbs.draw?selectedMatch.trueProbs.draw.toFixed(1)+"%":"N/A",color:"#94a3b8"},{label:"TRUE PROB B",val:selectedMatch.trueProbs.away.toFixed(1)+"%",color:C.pink}].map(function(s){return(<div key={s.label} style={{background:"rgba(255,255,255,0.02)",border:"1px solid "+C.border,padding:12,textAlign:"center",borderRadius:6}}><div style={{fontSize:8,color:C.muted,marginBottom:6,fontWeight:600}}>{s.label}</div><div style={{fontSize:22,fontWeight:700,color:s.color}}>{s.val}</div></div>);})}
                  </div>
                  {selectedMatch.ouTrueProbs&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
                    <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid "+C.border,padding:12,textAlign:"center",borderRadius:6}}><div style={{fontSize:8,color:C.muted,marginBottom:6,fontWeight:600}}>{"Oe"+selectedMatch.ouTrueProbs.point+" TRUE PROB"}</div><div style={{fontSize:22,fontWeight:700,color:C.green}}>{selectedMatch.ouTrueProbs.over.toFixed(1)+"%"}</div></div>
                    <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid "+C.border,padding:12,textAlign:"center",borderRadius:6}}><div style={{fontSize:8,color:C.muted,marginBottom:6,fontWeight:600}}>{"U"+selectedMatch.ouTrueProbs.point+" TRUE PROB"}</div><div style={{fontSize:22,fontWeight:700,color:C.red}}>{selectedMatch.ouTrueProbs.under.toFixed(1)+"%"}</div></div>
                  </div>}
                  <SLabel>{"VALUE BETS (1X2 + O/U)"}</SLabel>
                  {selectedMatch.valueBets.length===0?(<div style={{padding:28,textAlign:"center",color:C.dim,fontSize:11}}>{"No value bets"}</div>):selectedMatch.valueBets.map(function(vb,i){return(<div key={i} style={{background:vb.ev>=settings.evThreshold?C.goldGlow:"rgba(255,255,255,0.02)",border:"1px solid "+(vb.ev>=settings.evThreshold?"rgba(245,158,11,0.25)":C.border),padding:"12px 14px",marginBottom:6,borderRadius:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontSize:12,color:vb.ev>=settings.evThreshold?C.yellow:C.text,fontWeight:vb.ev>=settings.evThreshold?700:500}}>{vb.team}</div><div style={{fontSize:10,color:C.textSoft,marginTop:3}}>{"@ "+vb.odds+" hos "+vb.bm}</div><div style={{fontSize:8,color:C.muted,marginTop:2}}>{vb.market}</div></div><div style={{textAlign:"right"}}><div style={{fontSize:18,fontWeight:700,color:vb.ev>=settings.evThreshold?C.yellow:C.green}}>{"+"+ vb.ev.toFixed(1)+"%"}</div><div style={{fontSize:8,color:C.dim}}>{"EV"}</div></div></div>);})}
                </div>)}

                {detailTab==="analys"&&(<div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><SLabel>{"AI-ANALYS"}</SLabel><button onClick={function(){fetchAI(selectedMatch);}} disabled={loadingAI===selectedMatch.id} className="hbtn" style={{background:"rgba(59,130,246,0.12)",border:"1px solid rgba(59,130,246,0.3)",color:"#60a5fa",padding:"6px 14px",fontSize:10,borderRadius:4,fontWeight:600}}>{loadingAI===selectedMatch.id?"ANALYSERAR...":aiAnalysis[selectedMatch.id]?"UPPDATERA":"ANALYSERA"}</button></div>
                  {aiAnalysis[selectedMatch.id]?(<div style={{fontSize:11,color:"#b0c8e0",lineHeight:1.85,whiteSpace:"pre-wrap",background:"rgba(255,255,255,0.02)",border:"1px solid "+C.border,padding:14,borderRadius:6}}>{aiAnalysis[selectedMatch.id]}</div>):(<div style={{padding:"36px 20px",textAlign:"center",color:C.muted,fontSize:11,background:"rgba(255,255,255,0.02)",border:"1px solid "+C.border,borderRadius:6}}>{"Klicka ANALYSERA"}</div>)}
                </div>)}

                {detailTab==="stats"&&(<div>
                  <SLabel>{"GOAL PROBABILITIES"}</SLabel>
                  <div style={{marginBottom:16}}>{[{l:"Over 1.5 (90m)",v:Math.min(94,selectedMatch.overUnder25+17)},{l:"Over 2.5 (90m)",v:selectedMatch.overUnder25},{l:"Over 3.5 (90m)",v:selectedMatch.overUnder35},{l:"Over 1.5 (HT)",v:selectedMatch.h1Over15},{l:"BTTS",v:Math.min(78,selectedMatch.overUnder25-4)}].map(function(s){return(<div key={s.l} style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:10,color:C.textSoft}}>{s.l}</span><span style={{fontSize:11,fontWeight:700,color:s.v>55?C.green:s.v<38?C.red:"#94a3b8"}}>{s.v.toFixed(1)+"%"}</span></div><div style={{height:3,background:C.border,borderRadius:2}}><div style={{height:"100%",width:Math.min(s.v,100)+"%",background:s.v>55?C.green:s.v<38?C.red:C.accent,borderRadius:2,transition:"width 0.5s"}}/></div></div>);})}</div>
                  <SLabel>{"EXPECTED GOALS"}</SLabel>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>{[{l:"Total xG",v:selectedMatch.expectedGoals,color:C.yellow},{l:"HT xG",v:selectedMatch.h1ExpGoals,color:C.accent}].map(function(s){return(<div key={s.l} style={{background:"rgba(255,255,255,0.02)",border:"1px solid "+C.border,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",borderRadius:6}}><span style={{fontSize:10,color:C.muted}}>{s.l}</span><span style={{fontSize:16,fontWeight:700,color:s.color}}>{s.v}</span></div>);})}</div>
                </div>)}
              </div>
            </div>)}
          </div>)}

          {/* ALERTS */}
          {mainTab==="alerts"&&(<div style={{flex:1,overflowY:"auto",padding:18}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div><div style={{fontSize:14,fontWeight:700,color:C.text}}>{"Alert Log"}</div><div style={{fontSize:10,color:C.muted,marginTop:3}}>{"EV >= "+settings.evThreshold+"% | Odds "+settings.minOdds+"-"+settings.maxOdds+" | O/U >= "+settings.minOddsOU}</div></div>
              <button onClick={function(){setAlerts([]);}} className="hbtn" style={{background:"transparent",border:"1px solid "+C.border,color:C.muted,padding:"6px 14px",fontSize:10,borderRadius:4}}>{"CLEAR"}</button>
            </div>
            {alerts.length===0?(<div style={{padding:"60px 20px",textAlign:"center",color:C.muted}}><div style={{fontSize:13,marginBottom:8}}>{"Inga alerts"}</div><div style={{fontSize:10}}>{"Tryck LIVE ON"}</div></div>
            ):alerts.map(function(a){
              var bgColor = a.type==="inplay"?"rgba(239,68,68,0.06)":a.type==="ou"?"rgba(16,185,129,0.06)":a.ev>=settings.evThreshold*1.5?C.goldGlow:"rgba(255,255,255,0.02)";
              var borderColor = a.type==="inplay"?"rgba(239,68,68,0.3)":a.type==="ou"?"rgba(16,185,129,0.3)":a.ev>=settings.evThreshold*1.5?"rgba(245,158,11,0.3)":C.border;
              return(<div key={a.id} className="alertin" style={{background:bgColor,border:"1px solid "+borderColor,padding:"14px 16px",marginBottom:8,borderRadius:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                    <span style={{fontSize:12,color:C.text,fontWeight:600}}>{a.home+" vs "+a.away}</span>
                    <span style={{fontSize:8,padding:"1px 6px",borderRadius:3,background:a.type==="inplay"?"rgba(239,68,68,0.12)":a.type==="ou"?"rgba(16,185,129,0.12)":"rgba(245,158,11,0.12)",color:a.type==="inplay"?C.live:a.type==="ou"?C.green:C.yellow,fontWeight:600}}>{a.type==="inplay"?"IN-PLAY":a.market}</span>
                  </div>
                  <div style={{fontSize:10,color:C.textSoft}}>{a.type==="inplay"?a.reason:a.type==="ou"?a.reason:<span><span style={{color:C.green,fontWeight:700}}>{a.team}</span>{" @ "+a.odds+" hos "+a.bm}</span>}</div>
                  <div style={{fontSize:9,color:C.dim,marginTop:4}}>{a.league+" | "+timeAgo(a.timestamp)}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  {a.type==="value"&&<div style={{fontSize:24,fontWeight:700,color:a.ev>=settings.evThreshold*1.5?C.yellow:C.green}}>{"+"+ a.ev.toFixed(1)+"%"}</div>}
                  {a.type==="inplay"&&<div style={{fontSize:18,fontWeight:700,color:C.live}}>{"Oe1.5"}</div>}
                  {a.type==="ou"&&<div style={{fontSize:18,fontWeight:700,color:C.green}}>{"Oe2.5"}</div>}
                  <div style={{fontSize:9,color:C.dim}}>{a.type==="value"?"EV":a.type==="inplay"?"TRIGGER":"TRIGGER"}</div>
                </div>
              </div>);
            })}
          </div>)}

          {/* SETTINGS */}
          {mainTab==="settings"&&(<div style={{flex:1,overflowY:"auto",padding:24,maxWidth:600}}>
            <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:6}}>{"Instaellningar"}</div>
            <div style={{fontSize:10,color:C.muted,marginBottom:24}}>{"Live-data, value bot, in-play triggers, notifikationer"}</div>

            <SettSection title="THE ODDS API">
              <div style={{background:C.accentGlow,border:"1px solid rgba(59,130,246,0.15)",padding:"14px 16px",marginBottom:16,fontSize:11,color:C.textSoft,lineHeight:2,borderRadius:6}}>
                <span style={{color:C.accent,fontWeight:700}}>{"Saa haer:"}</span>
                <br/>{"1. the-odds-api.com -> Get Access -> Free (500 req/maan)"}
                <br/>{"2. Klistra in API-nyckel -> SPARA"}
                <br/>{"3. Tryck LIVE ON"}
              </div>
              <SettRow label="API-nyckel">
                <div style={{display:"flex",gap:8,flex:1,maxWidth:380}}>
                  <input value={apiKey} onChange={function(e){setApiKey(e.target.value);}} placeholder={savedApiKey?"**********":"Klistra in..."} style={inp({flex:1,borderColor:savedApiKey?"rgba(16,185,129,0.4)":C.borderLight})}/>
                  <button onClick={function(){setSavedApiKey(apiKey.trim());}} className="hbtn" style={{background:C.greenDim,border:"1px solid rgba(16,185,129,0.4)",color:C.green,padding:"6px 16px",fontSize:10,fontWeight:700,whiteSpace:"nowrap",borderRadius:4}}>{"SPARA"}</button>
                </div>
              </SettRow>
              {savedApiKey&&<div style={{fontSize:10,color:C.green,marginBottom:12,marginTop:-4}}>{"API-nyckel aktiv"}</div>}
              {quotaInfo&&<div style={{fontSize:10,color:C.muted,marginBottom:12}}>{"Requests: "+quotaInfo.used+" anvaenda | "+quotaInfo.remaining+" kvar"}</div>}
              <SettRow label="Poll-intervall (sek)"><input type="number" value={settings.pollInterval} min={30} max={600} onChange={function(e){setSettings(merge(settings,{pollInterval:+e.target.value}));}} style={inp({width:80})}/></SettRow>
            </SettSection>

            <SettSection title="VALUE BOT - 1X2">
              <SettRow label="Min EV-troeskel (%)"><input type="number" value={settings.evThreshold} min={1} max={20} step={0.5} onChange={function(e){setSettings(merge(settings,{evThreshold:+e.target.value}));}} style={inp({width:80,color:C.yellow})}/></SettRow>
              <SettRow label="Min odds 1X2"><input type="number" value={settings.minOdds} min={1.1} max={5} step={0.1} onChange={function(e){setSettings(merge(settings,{minOdds:+e.target.value}));}} style={inp({width:80})}/></SettRow>
              <SettRow label="Max odds 1X2"><input type="number" value={settings.maxOdds} min={2} max={20} step={0.5} onChange={function(e){setSettings(merge(settings,{maxOdds:+e.target.value}));}} style={inp({width:80})}/></SettRow>
            </SettSection>

            <SettSection title="VALUE BOT - OVER/UNDER">
              <SettRow label="Notifiera Oe/U"><Toggle on={settings.notifyOU} onChange={function(v){setSettings(merge(settings,{notifyOU:v}));}}/></SettRow>
              <SettRow label="Min odds Oe/U"><input type="number" value={settings.minOddsOU} min={1.1} max={5} step={0.05} onChange={function(e){setSettings(merge(settings,{minOddsOU:+e.target.value}));}} style={inp({width:80})}/></SettRow>
              <SettRow label="Oe2.5 sannolikhet trigger (%)"><input type="number" value={settings.ouThreshold} min={30} max={80} step={5} onChange={function(e){setSettings(merge(settings,{ouThreshold:+e.target.value}));}} style={inp({width:80,color:C.green})}/></SettRow>
            </SettSection>

            <SettSection title="IN-PLAY TRIGGERS">
              <div style={{background:"rgba(239,68,68,0.05)",border:"1px solid rgba(239,68,68,0.15)",padding:"12px 14px",marginBottom:14,fontSize:11,color:C.textSoft,lineHeight:1.8,borderRadius:6}}>
                <span style={{color:C.live,fontWeight:600}}>{"Hur det fungerar:"}</span>
                <br/>{"Naer en match staar 0-0 (eller under din troeskel) efter X minuter triggas en alert foer Oever 1.5. Perfekt foer att hitta matcher daer lagen MAASTE goera maal."}
              </div>
              <SettRow label="Aktivera in-play trigger"><Toggle on={settings.inplayTrigger} onChange={function(v){setSettings(merge(settings,{inplayTrigger:v}));}}/></SettRow>
              <SettRow label="Trigga efter minut"><input type="number" value={settings.inplayMinute} min={20} max={80} step={5} onChange={function(e){setSettings(merge(settings,{inplayMinute:+e.target.value}));}} style={inp({width:80,color:C.live})}/></SettRow>
              <SettRow label="Max total maal (0=0-0)"><input type="number" value={settings.inplayScoreMax} min={0} max={3} step={1} onChange={function(e){setSettings(merge(settings,{inplayScoreMax:+e.target.value}));}} style={inp({width:80})}/></SettRow>
            </SettSection>

            <SettSection title="NOTIFIKATIONER">
              <SettRow label="Ljud vid alert"><Toggle on={settings.soundOn} onChange={function(v){setSettings(merge(settings,{soundOn:v}));}}/></SettRow>
              <SettRow label="Push-notis (telefon/desktop)"><Toggle on={settings.pushNotify} onChange={function(v){setSettings(merge(settings,{pushNotify:v}));if(v)requestNotificationPermission();}}/></SettRow>
              <SettRow label="1X2: hemma"><Toggle on={settings.notifyHome} onChange={function(v){setSettings(merge(settings,{notifyHome:v}));}}/></SettRow>
              <SettRow label="1X2: oavgjort"><Toggle on={settings.notifyDraw} onChange={function(v){setSettings(merge(settings,{notifyDraw:v}));}}/></SettRow>
              <SettRow label="1X2: borta"><Toggle on={settings.notifyAway} onChange={function(v){setSettings(merge(settings,{notifyAway:v}));}}/></SettRow>
            </SettSection>
          </div>)}
        </div>
      </div>
    </div>
  );
}
