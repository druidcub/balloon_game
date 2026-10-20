(function(root){
  'use strict';
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  // Normalized game units: size follows volume^(1/3), drag area follows size^2.
  // Pressure is a monotone gameplay approximation, not a latex constitutive law.
  function aerodynamics(volume){const v=clamp(volume,0,1.5),radius=.18+.82*Math.cbrt(v),area=radius*radius,mass=1+.18*v,pressure=Math.pow(v,.8);return {radius,area,mass,pressure,flow:Math.sqrt(pressure),jetSpeed:Math.sqrt(pressure),inertia:.12+.25*mass*area,drag:.018+.065*area};}
  function nozzleFrame(heading,flex=0){const a=heading+flex;return {exhaustX:-Math.cos(a),exhaustY:-Math.sin(a),thrustX:Math.cos(a),thrustY:Math.sin(a)};}
  class BalloonGame {
    constructor(random=Math.random,flightSpeed=2){this.random=random;this.flightSpeed=flightSpeed;this.reset();}
    reset(){this.phase='ready';this.breath=1;this.volume=0;this.held=false;this.exhausted=false;this.time=0;this.x=0;this.y=1.65;this.vx=0;this.vy=0;this.distance=0;this.farthestX=0;this.peak=0;this.fuel=0;this.angle=0;this.heading=0;this.omega=0;this.torque=0;this.flutter=0;this.flutterTarget=0;this.offset=0;this.offsetTarget=0;this.pulse=1;this.thrust=0;this.thrustX=0;this.thrustY=0;this.exhaustX=-1;this.exhaustY=0;this.angularAcceleration=0;this.dragX=0;this.dragY=0;this.kickTimer=0;this.pathLength=0;this.wind=.18;this.trail=[];this.trailTimer=0;this.startVolume=0;this.riskExposure=0;this.riskLimit=null;this.burstTime=0;this.totalRotation=0;this.turnReversals=0;this.horizontalReversals=0;this.turnSign=0;this.travelSign=0;}
    press(){if(this.phase!=='ready'||this.held)return;this.held=true;this.exhausted=this.breath<.15;}
    release(){this.held=false;this.exhausted=false;}
    get blowing(){return this.phase==='ready'&&this.held&&!this.exhausted&&this.breath>0;}
    get burstRate(){return this.volume<=.5?0:-Math.log(.45)*Math.pow(clamp((this.volume-.5)/.5,0,2),2);}
    get burstChance(){return 1-Math.exp(-this.burstRate);}
    burst(){this.startVolume=this.volume;this.phase='burst';this.release();this.fuel=0;this.distance=0;this.peak=0;this.time=0;this.x=0;this.y=0;this.vx=0;this.vy=0;this.pathLength=0;}
    // Seeded turbulence changes at physical time intervals, never once per rendered frame.
    noise(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
    launch(){if(this.phase!=='ready'||this.volume<.08)return false;this.phase='flying';this.release();this.startVolume=this.volume;this.fuel=this.volume;this.seed=(this.random()*4294967296)>>>0;this.heading=.6+this.noise()*.4;this.omega=0;this.vx=0;this.vy=0;this.angle=-this.heading;this.peak=this.y;this.trail=[{x:0,y:this.y}];return true;}
    update(dt){
      if(this.phase==='ready'){
        if(this.blowing){this.breath=clamp(this.breath-dt/2,0,1);this.volume=clamp(this.volume+dt*.205,0,1.5);if(this.breath===0)this.exhausted=true;
          if(this.burstRate>0){if(this.riskLimit===null)this.riskLimit=-Math.log(Math.max(1e-12,1-clamp(this.random(),0,1)));this.riskExposure+=this.burstRate*dt;if(this.riskExposure>=this.riskLimit)this.burst();}}
        else if(!this.held)this.breath=clamp(this.breath+dt/.95,0,1);
        return;
      }
      if(this.phase==='burst'){this.burstTime+=dt;return;}
      if(this.phase!=='flying')return;
      // Speed up motion and deflation together; retain small, stable physics steps.
      let remaining=dt*this.flightSpeed;
      while(remaining>1e-10&&this.phase==='flying'){const step=Math.min(remaining,1/120);this.advanceFlight(step);remaining-=step;}
    }
    advanceFlight(dt){
      this.time+=dt/this.flightSpeed;
      const powered=this.fuel>0;
      this.kickTimer-=dt;
      if(this.kickTimer<=0){this.kickTimer=.09+this.noise()*.26;this.flutterTarget=(this.noise()-.5)*.24;this.offsetTarget=(this.noise()-.5)*.12;this.pulse=.8+this.noise()*.4;
        // Brief neck buckling produces stronger jet-driven turns on some events.
        if(this.noise()<.32){this.flutterTarget*=1.8;this.offsetTarget*=1.8;}}
      const p=aerodynamics(this.fuel),response=1-Math.exp(-dt/.055);
      this.flutter+=(this.flutterTarget-this.flutter)*response;this.offset+=(this.offsetTarget-this.offset)*response;
      const flow=powered?p.flow*this.pulse:0;
      this.thrust=38*flow*p.jetSpeed;
      // A small eccentricity/neck deflection creates torque proportional to jet force.
      // There is no independent random spin once the balloon has stopped expelling air.
      // In body coordinates, r = (-radius, offset*radius), F points at flutter.
      // Torque is the 2D cross product r x F, including its physical rotation sign.
      this.torque=powered?-this.thrust*p.radius*(Math.sin(this.flutter)+this.offset*Math.cos(this.flutter)):0;
      this.angularAcceleration=this.torque/p.inertia-(.4+.34*p.area)*this.omega-.11*p.area*this.omega*Math.abs(this.omega);
      this.omega=clamp(this.omega+this.angularAcceleration*dt,-5,5);this.heading+=this.omega*dt;this.angle=-this.heading;
      this.totalRotation+=Math.abs(this.omega*dt);const turnSign=Math.abs(this.omega)>.65?Math.sign(this.omega):0;if(turnSign&&this.turnSign&&turnSign!==this.turnSign)this.turnReversals++;if(turnSign)this.turnSign=turnSign;
      // Renderer and physics share this exact nozzle direction. Momentum remains continuous.
      const nozzle=nozzleFrame(this.heading,this.flutter);this.exhaustX=nozzle.exhaustX;this.exhaustY=nozzle.exhaustY;
      this.thrustX=this.thrust*nozzle.thrustX;this.thrustY=this.thrust*nozzle.thrustY;
      const rx=this.vx-this.wind,ry=this.vy,speed=Math.hypot(rx,ry);
      this.dragX=-p.drag*speed*rx;this.dragY=-p.drag*speed*ry;
      this.vx+=(this.thrustX+this.dragX)/p.mass*dt;this.vy+=((this.thrustY+this.dragY)/p.mass-5.8)*dt;
      if(powered)this.fuel=Math.max(0,this.fuel-dt*.24*flow);
      const travelSign=Math.abs(this.vx)>.6?Math.sign(this.vx):0;if(travelSign&&this.travelSign&&travelSign!==this.travelSign)this.horizontalReversals++;if(travelSign)this.travelSign=travelSign;
      const oldX=this.x,oldY=this.y,nextX=oldX+this.vx*dt,nextY=oldY+this.vy*dt;
      // First contact ends the flight. Interpolate contact so no path penetrates the floor.
      if(nextY<=.12){const fraction=clamp((oldY-.12)/(oldY-nextY),0,1);this.x=oldX+(nextX-oldX)*fraction;this.y=.12;this.phase='done';this.vx=0;this.vy=0;this.fuel=0;this.thrust=0;this.thrustX=0;this.thrustY=0;}
      else{this.x=nextX;this.y=nextY;}
      this.pathLength+=Math.hypot(this.x-oldX,this.y-oldY);if(Math.abs(this.x)>this.distance)this.farthestX=this.x;this.distance=Math.max(this.distance,Math.abs(this.x));this.peak=Math.max(this.peak,this.y);
      this.trailTimer+=dt;if(this.trailTimer>.035||this.phase==='done'){this.trail.push({x:this.x,y:this.y});if(this.trail.length>1300)this.trail.shift();this.trailTimer=0;}
    }
    result(){return {farthestX:Math.round(this.farthestX*10)/10,distance:Math.round(this.distance*10)/10,height:Math.round(this.peak*10)/10,time:Math.round(this.time*10)/10,volume:Math.round(this.startVolume*100),landingX:Math.round(this.x*10)/10,pathLength:Math.round(this.pathLength*10)/10,totalRotation:this.totalRotation,turnReversals:this.turnReversals,horizontalReversals:this.horizontalReversals,outcome:this.phase==='burst'?'burst':this.x<0?'wrong-way':'landed',model:'jet-chaotic-v6',date:new Date().toISOString()};}
  }
  const COMMENT_POOLS={
    wrongWay:[
      '很有衝勁，可惜目的地在另一邊。',
      '導航說往右，它聽成了自由發揮。',
      '這口氣很努力，方向卻請假了。',
      '不是飛不遠，是離成功越來越遠。',
      '觀眾都看右邊，你讓大家白等了。',
      '前途一片光明，氣球選擇反方向。'
    ],
    burst:[
      '本次航程：從期待到意外。',
      '別的氣球準備出發，這顆直接宣布散會。',
      '距離是零，現場氣氛不是。',
      '氣球的飛行計畫，最後變成了一聲巨響。',
      '你負責吹，它負責把場面吹大。',
      '出師未捷球先破，觀眾倒是先笑了。'
    ],
    comeback:[
      '離家出走繞了一圈，發現還是這裡最熟。',
      '氣球親自示範：出去走走，不一定要有進度。',
      '導航重新規劃路線，目的地仍然是你。',
      '跑了一大圈，只為確認起點真的存在。',
      '這趟旅行主打往返，回程甚至不用加錢。',
      '走的時候很有志氣，回來的時候很有默契。'
    ],
    chaos:[
      '導航喊了三次重新規劃，最後決定辭職。',
      '氣球沒有迷路，它只是每個方向都想試用。',
      '這條航線，連畫它的虛線都暈了。',
      '方向盤交給氣球後，它拿去轉呼拉圈了。',
      '評審正在研究，這到底是飛行還是即興舞蹈。',
      '空中路考結束，考官還在找安全帶。'
    ],
    farHigh:[
      '氣球今天想把地圖和天空一起解鎖。',
      '這口氣的野心，地面和天空都看到了。',
      '飛得又高又遠，觀眾的脖子和望遠鏡都加班了。',
      '本來只想吹顆氣球，結果吹出一份航空履歷。',
      '地面快看不到，天空倒是混得挺熟。',
      '距離和高度一起交卷，這口氣有備而來。'
    ],
    far:[
      '再遠一點，就要開始算漫遊費了。',
      '這口氣吹得有點遠，想收回來可能要搭車。',
      '氣球走得很乾脆，完全沒問晚餐幾點。',
      '送出去的是氣球，回來的可能是明信片。',
      '它把放飛，理解成了搬家。',
      '本次最努力的配角：一直追著跑的鏡頭。'
    ],
    high:[
      '飛到這個高度，雲都想問它有沒有預約。',
      '你的肺活量，成功讓觀眾抬不起下巴。',
      '氣球順路去樓上，看看天空還有沒有空位。',
      '地面觀眾已經改用仰慕的角度看它。',
      '它對遠方還在考慮，對樓上倒是很有興趣。',
      '這個高度，適合把煩惱先晾在上面。'
    ],
    lowCruise:[
      '飛行高度很親民，路過的草都認得它。',
      '氣球沿途巡田，順便完成今天的里程。',
      '天空太空曠，它選擇跟地面保持聯絡。',
      '低空掠過，連地板都感受到這口氣的野心。',
      '它把飛行，飛出了逛街的熟門熟路。',
      '這顆氣球對高度很節制，對里程很積極。'
    ],
    short:[
      '剛出發就下班，效率很有自己的想法。',
      '氣球替地板確認了今天的引力還在。',
      '觀眾剛準備追，氣球已經說到站了。',
      '這趟旅行很精緻，行李都不用帶。',
      '起飛、落地、休息，流程一個也沒少。',
      '它對遠方很嚮往，但今天先在附近看看。'
    ],
    middle:[
      '里程有了，氣球也有自己的小小江湖了。',
      '這口氣很認真，沿途還順便欣賞了風景。',
      '氣球出門闖蕩，至少留下了一條像樣的虛線。',
      '吹出去一口氣，換回一段值得指給朋友看的距離。',
      '這趟有走到心裡，順便也走出了發射區。',
      '旅程長度剛剛好，觀眾的零食還沒吃完。'
    ],
    general:[
      '航線有點隨性，落地倒是很果斷。',
      '今天的天空，收下了這口小小的野心。',
      '氣球完成了自由行，行程表留給你補。',
      '吹的時候很努力，飛的時候很隨緣。',
      '這趟沒有行李，只有一肚子空氣和想法。',
      '氣球先去探路了，下次記得請它帶張地圖。'
    ]
  };
  function commentCategories(result){
    if(result.outcome==='burst')return ['burst'];
    if(isWrongWay(result))return ['wrongWay'];
    const categories=[],distance=Number.isFinite(result.distance)?Math.max(0,result.distance):0,height=Number.isFinite(result.height)?Math.max(0,result.height):0;
    if(distance>=5&&Number.isFinite(result.landingX)&&Math.abs(result.landingX)<=Math.min(3,distance*.2))categories.push('comeback');
    if(result.totalRotation>=Math.PI*2||result.turnReversals>=2||result.horizontalReversals>=2)categories.push('chaos');
    if(distance>=30&&height>=18)categories.push('farHigh');
    else if(distance>=30)categories.push('far');
    else if(height>=18)categories.push('high');
    if(distance>=15&&height<4)categories.push('lowCruise');
    if(!categories.length)categories.push(distance<5?'short':distance>=15?'middle':'general');
    return categories;
  }
  class Commentator {
    constructor(random=Math.random){this.random=random;this.lastId=null;}
    choose(result){
      const choices=commentCategories(result).flatMap(category=>COMMENT_POOLS[category].map((text,index)=>({id:category+'-'+index,category,text}))).filter(choice=>choice.id!==this.lastId);
      const roll=this.random(),index=Math.floor(clamp(Number.isFinite(roll)?roll:0,0,.999999999)*choices.length),choice=choices[index];
      this.lastId=choice.id;return choice;
    }
  }
  class RecordStore {
    constructor(storage){
      this.storage=storage;this.key='balloon-day.records.v1';this.available=true;this.data=this.empty();
      try{
        const raw=JSON.parse(storage.getItem(this.key)||'null');
        if(raw&&raw.version===1&&Array.isArray(raw.flights)){
          const valid=n=>Number.isFinite(n)&&n>=0;
          this.data.flights=raw.flights.filter(f=>f&&valid(f.distance)&&valid(f.height)&&valid(f.time)&&Number.isFinite(Date.parse(f.date))).slice(0,20);
          this.data.totalFlights=Math.max(Number.isSafeInteger(raw.totalFlights)?raw.totalFlights:0,this.data.flights.length,...this.data.flights.map(f=>Number.isSafeInteger(f.sequence)?f.sequence:0));
          const sequences=this.data.flights.map(f=>f.sequence);
          if(sequences.some(n=>!Number.isSafeInteger(n)||n<1)||new Set(sequences).size!==sequences.length)this.data.flights=this.data.flights.map((f,i)=>({...f,sequence:this.data.totalFlights-i}));
          const maxima=recordMaxima(this.data.flights);
          this.data.bestDistance=Math.max(raw.scoringVersion===2&&valid(raw.bestDistance)?raw.bestDistance:0,maxima.distance);
          this.data.bestHeight=Math.max(raw.scoringVersion===2&&valid(raw.bestHeight)?raw.bestHeight:0,maxima.height);
          const cached=raw.bestFlight;
          this.data.bestFlight=cached&&isSuccessfulFlight(cached)&&cached.distance===this.data.bestDistance?cached:this.data.flights.find(f=>isSuccessfulFlight(f)&&f.distance===this.data.bestDistance)||null;
        }
      }catch(error){this.available=false;}
    }
    empty(){return {version:1,scoringVersion:2,bestDistance:0,bestHeight:0,bestFlight:null,totalFlights:0,flights:[]};}
    add(flight){
      const entry={...flight,sequence:++this.data.totalFlights},success=isSuccessfulFlight(entry),isBest=success&&entry.distance>this.data.bestDistance;
      if(success){this.data.bestDistance=Math.max(this.data.bestDistance,entry.distance);this.data.bestHeight=Math.max(this.data.bestHeight,entry.height);if(isBest)this.data.bestFlight={...entry};}
      this.data.flights.unshift(entry);this.data.flights=this.data.flights.slice(0,20);this.save();return isBest;
    }
    save(){try{this.storage.setItem(this.key,JSON.stringify(this.data));this.available=true;}catch(error){this.available=false;}}
    clear(){this.data=this.empty();this.save();}
  }
  function normalizePlayerNames(names=[]){
    const result=[0,1].map(i=>Array.from(String(names[i]||'').trim()).slice(0,12).join('')||'P'+(i+1));
    if(result[0]===result[1])result[1]=Array.from(result[1]).slice(0,10).join('')+' 2';return result;
  }
  class DuelMatch {
    constructor(names){this.names=normalizePlayerNames(names);this.players=this.names.map(name=>({name,attempts:[],best:0}));this.current=0;this.waitingForNext=false;}
    get complete(){return this.players.every(player=>player.attempts.length===5);}
    get winners(){if(!this.complete)return [];const best=Math.max(...this.players.map(player=>player.best));return this.players.flatMap((player,i)=>player.best===best?[i]:[]);}
    submit(result){
      if(this.complete||this.waitingForNext)return false;
      const player=this.players[this.current],score=isSuccessfulFlight(result)&&Number.isFinite(result.distance)?Math.max(0,result.distance):0;
      player.attempts.push({...result,score});player.best=Math.max(player.best,score);this.waitingForNext=true;return true;
    }
    nextTurn(){if(!this.waitingForNext||this.complete)return false;this.current=1-this.current;this.waitingForNext=false;return true;}
  }
  function groundMarkers(data){
    const position=flight=>flight.outcome==='burst'?0:Number.isFinite(flight.farthestX)?flight.farthestX:(flight.landingX<0?-1:1)*flight.distance;
    const markers=data.flights.slice(0,20).map((flight,i)=>({position:position(flight),label:'第'+(flight.sequence||data.flights.length-i)+'次',sequence:flight.sequence||data.flights.length-i,failed:!isSuccessfulFlight(flight),playerId:flight.playerId||null}));
    if(data.bestDistance>0)markers.push({position:data.bestFlight?position(data.bestFlight):data.bestDistance,label:'BEST '+data.bestDistance.toFixed(1)+'m',best:true,failed:false});
    return markers;
  }
  function isWrongWay(result){return result.outcome==='wrong-way'||Number.isFinite(result.landingX)&&result.landingX<0;}
  function isSuccessfulFlight(result){return result.outcome!=='burst'&&!isWrongWay(result);}
  function recordMaxima(flights){return flights.filter(isSuccessfulFlight).reduce((best,f)=>({distance:Math.max(best.distance,f.distance),height:Math.max(best.height,f.height)}),{distance:0,height:0});}
  function rewardForResult(result){return result.outcome==='burst'?{id:'burst',label:'砰！觀眾笑翻了。'}:isWrongWay(result)?{id:'disappointed',label:'方向錯了，再試一次。'}:rewardForDistance(result.distance);}
  function rewardForDistance(distance){return distance>=30?{id:'encore',label:'全場安可！'}:distance>=15?{id:'wow',label:'哇！漂亮！'}:distance>=5?{id:'applause',label:'熱烈鼓掌！'}:{id:'polite',label:'掌聲鼓勵！'};}
  const api={BalloonGame,RecordStore,DuelMatch,normalizePlayerNames,groundMarkers,rewardForDistance,rewardForResult,isWrongWay,isSuccessfulFlight,recordMaxima,aerodynamics,nozzleFrame,Commentator,commentCategories,COMMENT_POOLS};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.BalloonEngine=api;
})(typeof window!=='undefined'?window:globalThis);
