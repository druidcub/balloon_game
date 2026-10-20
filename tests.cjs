'use strict';
// Run with node tests.cjs. No packages or browser required.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const box={module:{exports:{}}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'engine.js'),'utf8'),box);
const {BalloonGame:SpeedBalloonGame,RecordStore,rewardForDistance,aerodynamics,nozzleFrame}=box.module.exports;
// Keep the existing physical-model checks at 1x; verify the production 2x clock below.
class BalloonGame extends SpeedBalloonGame {constructor(random){super(random,1);}}
const step=(g,seconds)=>{for(let i=0;i<Math.round(seconds*120);i++)g.update(1/120);};
const breath=new BalloonGame();assert.equal(breath.launch(),false);breath.press();step(breath,2.1);assert.equal(breath.breath,0);const volume=breath.volume;step(breath,1);assert.equal(breath.volume,volume);breath.release();step(breath,1);assert.equal(breath.breath,1);
let reverse=0,crossStart=0;const routes=[];
for(let seed=0;seed<1000;seed++){
  const g=new BalloonGame(()=>seed/1000);g.volume=1;g.launch();let turned=false,crossed=false,away=false;
  for(let n=0;n<120*60&&g.phase==='flying';n++){
    g.update(1/120);assert(Number.isFinite(g.x)&&Number.isFinite(g.y));assert(g.y>=.12);assert(g.distance>=Math.abs(g.x)-1e-8);
    if(g.phase==='flying'&&g.thrust>0){
      const dot=g.thrustX*g.exhaustX+g.thrustY*g.exhaustY;
      assert(Math.abs(dot+g.thrust)<1e-7,'Jet and thrust must be exactly opposite');
      assert(Math.abs(g.thrustX*g.exhaustY-g.thrustY*g.exhaustX)<1e-7,'No sideways force unrelated to nozzle');
      // Canvas rotates body by -heading and neck by -flutter; Y points down on screen.
      const drawnExhaustX=-Math.cos(-g.angle+g.flutter),drawnExhaustY=-Math.sin(-g.angle+g.flutter);
      assert(Math.abs(drawnExhaustX-g.exhaustX)<1e-8&&Math.abs(drawnExhaustY-g.exhaustY)<1e-8,'Drawn nozzle must match physics');
    }
    if(g.vx<-.4)turned=true;if(g.x>1)away=true;if(away&&g.x<0)crossed=true;
  }
  assert.equal(g.phase,'done');assert.equal(g.y,.12);assert.equal(g.vx,0);assert.equal(g.vy,0);
  const landed=[g.x,g.y,g.vx,g.vy,g.time,g.distance,g.peak,g.pathLength];step(g,3);assert.deepEqual([g.x,g.y,g.vx,g.vy,g.time,g.distance,g.peak,g.pathLength],landed,'Landed balloon must stay still');
  assert(g.pathLength>=g.distance);reverse+=turned;crossStart+=crossed;routes.push(g.result());
}
assert(reverse>300,'Many flights must reverse horizontally');assert(crossStart>100,'Flights must be able to cross back over their start');
for(const volume of [.08,.2,.41,.82,1]){const g=new BalloonGame(()=>.173);g.volume=volume;assert(g.launch());step(g,60);assert.equal(g.phase,'done');}
const run=()=>{const g=new BalloonGame(()=>.001);g.volume=1;g.launch();step(g,30);return g.result();};const a=run(),b=run();assert.equal(a.distance,b.distance);assert.equal(a.landingX,b.landingX);
let saved=null;const mem={getItem:()=>saved,setItem:(_,v)=>{saved=v;}};const store=new RecordStore(mem);for(const r of routes.slice(0,25))store.add(r);assert.equal(store.data.flights.length,20);const loaded=new RecordStore(mem);assert.equal(loaded.data.flights.length,20);assert.equal(loaded.data.flights[0].landingX,store.data.flights[0].landingX);assert.equal(loaded.data.bestDistance,store.data.bestDistance);
saved=JSON.stringify({version:1,bestDistance:203.8,bestHeight:51.2,flights:[{distance:203.8,height:51.2,time:14.6,date:new Date().toISOString()}]});const legacy=new RecordStore(mem);assert.equal(legacy.data.bestDistance,203.8);legacy.add(routes[0]);assert.equal(legacy.data.flights.length,2);
const denied=new RecordStore({getItem(){throw Error();},setItem(){throw Error();}});denied.add(routes[0]);assert.equal(denied.available,false);assert.equal(denied.data.flights.length,1);
console.log(`PASS: breathing, ${routes.length} flight seeds, ${reverse} reversals, ${crossStart} return crossings, immediate landing, stationary after landing, low volume, deterministic seeds, storage reload, legacy records, denied storage.`);
const safe=new BalloonGame(()=>0);safe.volume=.05;safe.press();step(safe,2);assert.equal(safe.phase,'ready');assert.equal(safe.burstChance,0);
const popped=new BalloonGame(()=>0);popped.volume=.51;popped.press();step(popped,.02);assert.equal(popped.phase,'burst');assert.equal(popped.launch(),false);const popResult=popped.result();assert.equal(popResult.distance,0);assert.equal(popResult.height,0);assert.equal(popResult.outcome,'burst');assert(popResult.volume>=51);
const high=new BalloonGame(()=>.999999);high.volume=1.4;const risk=high.burstChance;high.press();step(high,2.1);assert.equal(high.volume,1.5);assert(high.burstChance>risk);assert.equal(high.phase,'ready');const exposure=high.riskExposure;high.release();step(high,3);assert.equal(high.riskExposure,exposure);assert.equal(high.phase,'ready');high.press();step(high,1);assert(high.riskExposure>exposure);
const riskProbe=new BalloonGame();let lastRisk=-1;for(const size of [.4,.5,.500001,.6,.75,1,1.000001,1.2,1.5]){riskProbe.volume=size;assert(riskProbe.burstChance>=lastRisk);lastRisk=riskProbe.burstChance;}
for(const [distance,id]of [[0,'polite'],[4.9,'polite'],[5,'applause'],[14.9,'applause'],[15,'wow'],[29.9,'wow'],[30,'encore'],[80,'encore']])assert.equal(rewardForDistance(distance).id,id);
const burstStore=new RecordStore(mem);const previousBest=burstStore.data.bestDistance;burstStore.add(popResult);const burstReload=new RecordStore(mem);assert.equal(burstReload.data.flights[0].outcome,'burst');assert.equal(burstReload.data.flights[0].distance,0);assert.equal(burstReload.data.bestDistance,previousBest);
console.log('PASS: safe inflation, increasing burst probability, 150% cap, forced burst scores zero, no risk during inhale, no exposure reset exploit, burst storage, reward thresholds.');
for(const angle of [-Math.PI,-Math.PI/2,0,Math.PI/2,Math.PI,7])for(const flex of [-.11,0,.11]){const f=nozzleFrame(angle,flex);assert(Math.abs(f.thrustX+f.exhaustX)<1e-12);assert(Math.abs(f.thrustY+f.exhaustY)<1e-12);}
const controlled=(volume)=>{const g=new BalloonGame(()=>.2);g.volume=volume;g.launch();g.heading=.7;g.y=50;g.flutter=.08;g.flutterTarget=.08;g.offset=.04;g.offsetTarget=.04;g.kickTimer=10;g.pulse=1;return g;};
const small=controlled(.25),large=controlled(1.25);small.update(1/120);large.update(1/120);
assert(aerodynamics(1.25).pressure>aerodynamics(.25).pressure);assert(aerodynamics(1.25).flow>aerodynamics(.25).flow);assert(aerodynamics(1.25).area>aerodynamics(.25).area);assert(aerodynamics(1.25).drag>aerodynamics(.25).drag);
assert(large.thrust>small.thrust);assert(Math.hypot(large.vx,large.vy)>Math.hypot(small.vx,small.vy));assert(Math.abs(large.angularAcceleration)>Math.abs(small.angularAcceleration),'Greater pressure must produce more jet-induced angular acceleration for same eccentricity');
const leverRadius=aerodynamics(1.25).radius,armX=-leverRadius*Math.cos(large.heading)-large.offset*leverRadius*Math.sin(large.heading),armY=-leverRadius*Math.sin(large.heading)+large.offset*leverRadius*Math.cos(large.heading);assert(Math.abs(large.torque-(armX*large.thrustY-armY*large.thrustX))<1e-8,'Jet torque must equal attachment lever cross reaction force');
const slow=controlled(1),fast=controlled(1);slow.vx=slow.wind+2;fast.vx=fast.wind+4;slow.update(1/120);fast.update(1/120);assert(Math.abs(fast.dragX/slow.dragX-4)<1e-10,'Drag scales with speed squared');
const empty=controlled(1);empty.fuel=0;empty.omega=2;empty.update(1/120);assert.equal(empty.thrust,0);assert.equal(empty.torque,0);assert(empty.omega<2,'Rotation damps when air is gone');
const braking=controlled(1);braking.heading=Math.PI;braking.flutter=0;braking.flutterTarget=0;braking.offset=0;braking.offsetTarget=0;braking.vx=5;braking.update(1/120);assert(braking.thrustX<0);assert(braking.vx>0&&braking.vx<5,'Reverse thrust brakes existing momentum without instant velocity teleportation');
console.log('PASS: nozzle/render/thrust alignment, pressure-flow coupling, size-dependent area and drag, squared-speed drag, stronger full-balloon torque and acceleration, no unpowered random torque, continuous momentum.');

const boundaryRisk=new BalloonGame();boundaryRisk.volume=.5;assert.equal(boundaryRisk.burstChance,0);boundaryRisk.volume=.500001;assert(boundaryRisk.burstChance>0);boundaryRisk.volume=1;assert(Math.abs(boundaryRisk.burstChance-.55)<1e-12);for(const size of [1.000001,1.01,1.2,1.5]){boundaryRisk.volume=size;assert(boundaryRisk.burstChance>.5,`Above 100% must exceed 50%/second: ${size}`);}console.log("PASS: 50% safe boundary, risk immediately above 50%, 100% = 55%/second, over 100% always over 50%/second.");
const turnStats=new Map();
const meanRange=volume=>{let total=0,changes=0;for(let seed=0;seed<200;seed++){const g=new BalloonGame(()=>seed/200);g.volume=volume;g.launch();let lastSign=0;for(let tick=0;tick<7200&&g.phase==='flying';tick++){g.update(1/120);const sign=Math.abs(g.omega)>.4?Math.sign(g.omega):0;if(sign&&lastSign&&sign!==lastSign)changes++;if(sign)lastSign=sign;}assert.equal(g.phase,'done');total+=g.distance;}turnStats.set(volume,changes/200);return total/200;};
const lowRange=meanRange(.2),mediumRange=meanRange(.4),fullRange=meanRange(1);
assert(lowRange>6,'20% fill should make a useful flight instead of immediately dropping');assert(mediumRange>20,'One full breath should provide an interesting flight without entering burst risk');assert(fullRange>mediumRange,'Extra air must still offer a distance advantage on average');
console.log(`PASS: low-fill balance across 200 seeds: 20%=${lowRange.toFixed(1)}m, 40%=${mediumRange.toFixed(1)}m, 100%=${fullRange.toFixed(1)}m.`);

assert(turnStats.get(.4)>.4,"Partial balloons must show varied turning, not only a single arc");assert(turnStats.get(1)>1.2,"Full balloons should show repeated direction changes across seeds");assert(new Set(routes.map(r=>[r.distance,r.height,r.landingX].join(":"))).size>950,"Different seeds should produce distinct trajectories");console.log(`PASS: irregular flight, turning reversals per run: 40%=${turnStats.get(.4).toFixed(2)}, 100%=${turnStats.get(1).toFixed(2)}, diverse seeded trajectories.`);
const {Commentator,commentCategories,COMMENT_POOLS}=box.module.exports;
const normal={distance:10,height:5,landingX:10,outcome:'landed',totalRotation:0,turnReversals:0,horizontalReversals:0};
const categoryCases=[
  [{...normal,distance:0,outcome:'burst'},'burst'],
  [{...normal,landingX:-12,outcome:'wrong-way'},'wrongWay'],
  [{...normal,distance:12,landingX:1},'comeback'],
  [{...normal,totalRotation:Math.PI*2},'chaos'],
  [{...normal,turnReversals:2},'chaos'],
  [{...normal,horizontalReversals:2},'chaos'],
  [{...normal,distance:35,height:22,landingX:35},'farHigh'],
  [{...normal,distance:35,landingX:35},'far'],
  [{...normal,height:22},'high'],
  [{...normal,distance:20,height:3,landingX:20},'lowCruise'],
  [{...normal,distance:3,landingX:3},'short'],
  [{...normal,distance:20,landingX:20},'middle'],
  [normal,'general']
];
for(const [result,category]of categoryCases)assert(commentCategories(result).includes(category),category);
assert.equal(commentCategories({...normal,distance:50,height:50,totalRotation:99,outcome:'burst'}).join(','),'burst','Burst cannot receive flight-achievement jokes');
assert.equal(commentCategories(normal).includes('chaos'),false);assert.equal(commentCategories({distance:10,height:5}).join(','),'general','Legacy results without rotation data must still work');
const allComments=Object.values(COMMENT_POOLS).flat();assert.equal(allComments.length,66);assert.equal(new Set(allComments).size,66);
const allIds=new Set();for(const category of Object.keys(COMMENT_POOLS))for(let i=0;i<6;i++){const c=new Commentator(()=>i/6).choose(categoryCases.find(([,label])=>label===category)[0]);assert.equal(c.category,category);allIds.add(c.id);}assert.equal(allIds.size,66);
const storyteller=new Commentator(()=>0);let previous=null;const before=JSON.stringify(normal);for(let i=0;i<30;i++){const c=storyteller.choose(normal);assert.notEqual(c.id,previous,'Consecutive results must avoid repeating the exact joke');previous=c.id;}assert.equal(JSON.stringify(normal),before);
for(const roll of [0,1,NaN,Infinity])assert(new Commentator(()=>roll).choose(normal).text);
assert(routes.some(r=>r.totalRotation>0));assert(routes.every(r=>Number.isInteger(r.turnReversals)&&Number.isInteger(r.horizontalReversals)));
const resetStats=new BalloonGame(()=>.3);resetStats.volume=1;resetStats.launch();step(resetStats,1);assert(resetStats.totalRotation>0);resetStats.reset();assert.equal(resetStats.totalRotation,0);assert.equal(resetStats.turnReversals,0);assert.equal(resetStats.horizontalReversals,0);
console.log('PASS: 66 unique contextual comments, distance/height/control categories, burst exclusivity, all variants reachable, no adjacent repeat, legacy results, measured flight statistics and reset.');

const {isWrongWay,isSuccessfulFlight,recordMaxima,rewardForResult}=box.module.exports;
const date=new Date().toISOString(),fixture=(distance,height,landingX)=>({distance,height,landingX,time:4,date,outcome:'landed'});
const successes=[fixture(10,5,8),fixture(25,3,20),fixture(15,12,10)],wrong=fixture(999,999,-300);
assert.equal(isWrongWay(wrong),true);assert.equal(isSuccessfulFlight(wrong),false);assert.equal(rewardForResult(wrong).id,'disappointed');
assert.equal(commentCategories({...wrong,totalRotation:99}).join(','),'wrongWay','Left landing cannot get success jokes');
const maxima=recordMaxima([...successes,wrong,popResult]);assert.equal(maxima.distance,25);assert.equal(maxima.height,12,'Independent height max may come from another run');assert.equal(recordMaxima([]).distance,0);
let newSaved=JSON.stringify({version:1,bestDistance:1049,bestHeight:1019,flights:[...successes,wrong]});const testMemory={getItem:()=>newSaved,setItem:(_,v)=>newSaved=v};
const maxStore=new RecordStore(testMemory);assert.equal(maxStore.data.bestDistance,25,'Recompute old cached totals and exclude left landings');assert.equal(maxStore.data.bestHeight,12);assert.equal(maxStore.add(wrong),false);assert.equal(maxStore.data.bestDistance,25);assert.equal(maxStore.data.bestHeight,12);
assert.equal(maxStore.add(fixture(30,4,25)),true);assert.equal(maxStore.data.bestDistance,30);assert.equal(maxStore.data.bestHeight,12);maxStore.add(fixture(20,18,15));assert.equal(maxStore.data.bestHeight,18);assert.equal(maxStore.data.bestDistance,30);
for(let i=0;i<25;i++)maxStore.add(fixture(2,2,1));const maxReload=new RecordStore(testMemory);assert.equal(maxReload.data.bestDistance,30,'Lifetime best survives history truncation after migration');assert.equal(recordMaxima(maxReload.data.flights).distance,2,'History summary is the max of its retained rows');
const leftGame=new BalloonGame();leftGame.phase='done';leftGame.x=-.001;assert.equal(leftGame.result().outcome,'wrong-way','Judge direction before display rounding');leftGame.x=.001;assert.equal(leftGame.result().outcome,'landed');leftGame.phase='burst';leftGame.x=-2;assert.equal(leftGame.result().outcome,'burst');
assert.equal(isSuccessfulFlight({distance:3,height:2}),true,'Keep legacy rows without landing information');
console.log('PASS: left-landing failure, exclusive disappointed reward/comments, independent MAX statistics, stale-cache migration, failure exclusion and retained lifetime maxima.');

for(const volume of [.2,.4,1])for(const seed of [.009,.173,.5]){
  const normalSpeed=new BalloonGame(()=>seed),doubleSpeed=new SpeedBalloonGame(()=>seed);normalSpeed.volume=doubleSpeed.volume=volume;normalSpeed.launch();doubleSpeed.launch();assert.equal(doubleSpeed.flightSpeed,2);
  let ticks=0;while(doubleSpeed.phase==='flying'&&ticks<7200){doubleSpeed.update(1/120);normalSpeed.update(1/120);if(normalSpeed.phase==='flying')normalSpeed.update(1/120);ticks++;
    for(const key of ['x','y','fuel','heading','distance','peak'])assert(Math.abs(normalSpeed[key]-doubleSpeed[key])<1e-9,`2x ${key} must match two original physics steps`);
  }
  assert.equal(doubleSpeed.phase,'done');assert(Math.abs(doubleSpeed.time*2-normalSpeed.time)<1e-9,'Recorded flight time is real elapsed time, not accelerated simulation time');assert.equal(doubleSpeed.result().distance,normalSpeed.result().distance);
}
const fastBreath=new SpeedBalloonGame();fastBreath.press();step(fastBreath,2);assert(fastBreath.breath<1e-12);assert(Math.abs(fastBreath.volume-.41)<1e-9,'Blowing speed remains unchanged');fastBreath.release();step(fastBreath,.95);assert.equal(fastBreath.breath,1);
console.log('PASS: 2x flight and deflation, identical trajectories at half elapsed time, stable substeps, unchanged blowing and inhaling.');

const {DuelMatch,normalizePlayerNames,groundMarkers}=box.module.exports;
const duel=new DuelMatch(['小風','阿球']),rounds=[12,5,3,8,4,9,6,11,7,10];
for(let n=0;n<10;n++){
  assert.equal(duel.current,n%2,'Players strictly alternate');
  const result=n===2?{...fixture(999,99,-8),outcome:'wrong-way'}:n===4?popResult:fixture(rounds[n],3,rounds[n]);
  assert.equal(duel.submit(result),true);assert.equal(duel.submit(result),false,'One result per turn, including burst');
  assert.equal(duel.players[n%2].attempts.length,Math.floor(n/2)+1);
  if(n<9){assert.equal(duel.complete,false);assert.equal(duel.nextTurn(),true);assert.equal(duel.nextTurn(),false);}else assert.equal(duel.nextTurn(),false);
}
assert.equal(duel.complete,true);assert.equal(duel.players[0].best,12);assert.equal(duel.players[1].best,11);assert.equal(duel.winners.join(','),'0','Compare each player max, not sum');assert.equal(duel.players[0].attempts[1].score,0);assert.equal(duel.players[0].attempts[2].score,0);assert.equal(duel.submit(normal),false,'No eleventh shot');
const tie=new DuelMatch();for(let n=0;n<10;n++){tie.submit(fixture(5,3,5));tie.nextTurn();}assert.equal(tie.winners.join(','),'0,1');
assert.equal(normalizePlayerNames(['  ','']).join(','),'P1,P2');assert.notEqual(...normalizePlayerNames(['同名','同名']));assert(Array.from(normalizePlayerNames(['😀'.repeat(20),'B'])[0]).length<=12);
let numberedRaw=null;const numberedMemory={getItem:()=>numberedRaw,setItem:(_,value)=>numberedRaw=value},numbered=new RecordStore(numberedMemory);
numbered.add({...fixture(80,20,30),farthestX:80,playerId:1,playerName:'小風'});for(let n=0;n<25;n++)numbered.add({...fixture(n+1,3,n+1),farthestX:n+1,playerId:2,playerName:'阿球'});
const numberedReload=new RecordStore(numberedMemory),flags=groundMarkers(numberedReload.data);assert.equal(numberedReload.data.totalFlights,26);assert.equal(numberedReload.data.flights[0].sequence,26);assert.equal(numberedReload.data.flights.at(-1).sequence,7);assert.equal(flags.filter(flag=>!flag.best).length,20);assert.equal(flags.find(flag=>flag.best).position,80,'Best marker survives beyond last 20 flights');assert.equal(numberedReload.data.bestFlight.playerName,'小風');
numberedReload.add({...fixture(10,4,-8),farthestX:-10,outcome:'wrong-way'});assert.equal(numberedReload.data.flights[0].sequence,27);assert(groundMarkers(numberedReload.data).some(flag=>flag.position===-10&&flag.failed));numberedReload.add(popResult);assert(groundMarkers(numberedReload.data).some(flag=>flag.position===0&&flag.failed));
const oldNumbering=new RecordStore({getItem:()=>JSON.stringify({version:1,scoringVersion:2,bestDistance:25,bestHeight:12,flights:successes}),setItem(){}});assert.equal(oldNumbering.data.flights.map(f=>f.sequence).join(','),'3,2,1');assert.equal(groundMarkers(oldNumbering.data).find(flag=>flag.best).position,25);oldNumbering.clear();assert.equal(oldNumbering.data.totalFlights,0);assert.equal(groundMarkers(oldNumbering.data).length,0);
for(const result of routes){assert(Math.abs(Math.abs(result.farthestX)-result.distance)<.11,'Signed farthest position must match recorded maximum');}
console.log('PASS: alternating 5-shot duel, max scoring, zero-score failures, duplicate protection, ties, bounded player names, numbered 20-flight flags, lifetime BEST snapshot and legacy migration.');
