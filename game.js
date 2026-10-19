/* Balloon Day — dependency-free browser client. Physics and storage live in engine.js. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const {BalloonGame,RecordStore}=window.BalloonEngine;
  const game=new BalloonGame();
  const commentator=new window.BalloonEngine.Commentator();
  let storage;try{storage=window.localStorage;}catch(e){storage={getItem(){throw e;},setItem(){throw e;}};}
  const records=new RecordStore(storage);
  const canvas=$('scene'),ctx=canvas.getContext('2d');
  let w=0,h=0,dpr=1,clock=0,last=0,accumulator=0,scale=48,camX=0,camY=0,ended=false,muted=false,burstFX=false;
  let keyHeld=false,pointerHeld=false,resizeObserver,savedResult=null,savedBest=false;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sound=new window.BalloonAudio.Sound();
  function notice(text){$('notice').textContent=text;$('notice').hidden=false;}
  function refreshBest(){$('best').textContent=records.data.bestDistance?`${records.data.bestDistance.toFixed(1)} m`:'—';}
  if(!records.available)notice('目前無法讀寫瀏覽器紀錄；仍可遊玩，本次紀錄暫存於記憶體。');
  function syncHold(){if(keyHeld||pointerHeld){sound.init();game.press();}else game.release();}
  function releaseAll(){keyHeld=false;pointerHeld=false;game.release();}
  function launch(){sound.init();releaseAll();if(game.launch()){sound.launch();$('hint').hidden=true;$('flight-label').hidden=false;$('announcement').textContent='氣球出發了！';}else if(game.phase==='ready'){$('hint').textContent='先按住吹氣，至少吹到 8% 再放飛。';}}
  function reset(){releaseAll();sound.reset();game.reset();ended=false;burstFX=false;savedResult=null;savedBest=false;scale=48;camX=0;camY=0;previousHint='';$('result').hidden=true;$('hint').hidden=false;$('hint').innerHTML='先吹氣，再讓氣球自由發揮！<span>↓</span>';$('flight-label').hidden=true;$('announcement').textContent='新氣球準備好了。';}
  function finish(){ended=true;const result=savedResult||game.result(),best=savedResult?savedBest:records.add(result);refreshBest();if(!records.available)notice('紀錄無法寫入瀏覽器；關閉頁面後本次紀錄將不會保留。');
    const burst=result.outcome==='burst',wrongWay=!burst&&window.BalloonEngine.isWrongWay(result),reward=window.BalloonEngine.rewardForResult(result);
    $('result').classList.toggle('burst-result',burst);
    $('result-badge').textContent=burst?'POP! · 爆掉了，0 m':wrongWay?'WRONG WAY · 飛錯方向了':best?'NEW PERSONAL BEST · 新紀錄':'FLIGHT COMPLETE · 平安著陸';
    const comment=commentator.choose(result);$('result-title').textContent=comment.text;
    $('result-comment').textContent=reward.label; $('landing-note').textContent=burst?'爆裂紀錄已保存 · 不影響原有最佳成績':`落點：${!wrongWay&&Math.abs(result.landingX)<.1?'起點':(wrongWay?'起點左側 ':'起點右側 ')+Math.abs(result.landingX).toFixed(1)+' m'}${wrongWay?' · 本次失敗，不列入最佳成績':''}`;
    $('result-distance').textContent=`${result.distance.toFixed(1)} m`;$('result-height').textContent=`${result.height.toFixed(1)} m`;$('result-time').textContent=`${result.time.toFixed(1)} s`;
    $('result').hidden=false;$('flight-label').hidden=true;$('announcement').textContent=burst?'氣球爆裂，本次零公尺。':wrongWay?'落在起點左側，本次失敗，不更新最佳成績。':`飛行結束，最遠 ${result.distance} 公尺，最高 ${result.height} 公尺。`;sound.finish(reward.id);$('again').focus({preventScroll:true});
  }
  $('blow').addEventListener('pointerdown',e=>{if(e.button!==0||game.phase!=='ready')return;e.preventDefault();pointerHeld=true;$('blow').setPointerCapture(e.pointerId);syncHold();});
  ['pointerup','pointercancel','lostpointercapture'].forEach(name=>$('blow').addEventListener(name,()=>{pointerHeld=false;syncHold();}));
  $('blow').addEventListener('contextmenu',e=>e.preventDefault());
  window.addEventListener('keydown',e=>{if($('history').open||e.ctrlKey||e.metaKey||e.altKey)return;if(e.code==='Space'){e.preventDefault();if(!e.repeat){keyHeld=true;syncHold();}}else if(e.code==='KeyX'&&!e.repeat){e.preventDefault();launch();}else if(e.code==='KeyR'&&!e.repeat){e.preventDefault();reset();}});
  window.addEventListener('keyup',e=>{if(e.code==='Space'){e.preventDefault();keyHeld=false;syncHold();}});
  window.addEventListener('blur',releaseAll);document.addEventListener('visibilitychange',()=>{releaseAll();last=0;if(document.hidden)sound.reset();sound.update(game,clock,document.hidden||$('history').open);});
  $('launch').addEventListener('click',launch);$('again').addEventListener('click',()=>{reset();$('blow').focus({preventScroll:true});});
  $('sound').addEventListener('click',()=>{sound.init();muted=!muted;sound.mute(muted);$('sound').setAttribute('aria-pressed',String(!muted));$('sound').innerHTML=muted?'♪ <span>音效關</span>':'♪ <span>音效開</span>';});
  function renderHistory(){const data=records.data,maxima=window.BalloonEngine.recordMaxima(data.flights);$('record-best').replaceChildren();for(const [title,value] of [['最遠距離',maxima.distance],['最高高度',maxima.height]]){const div=document.createElement('div');div.textContent=title;const strong=document.createElement('strong');strong.textContent=`${value.toFixed(1)} m`;div.append(strong);$('record-best').append(div);}
    $('history-body').replaceChildren();data.flights.forEach(f=>{const tr=document.createElement('tr');[new Date(f.date).toLocaleString('zh-TW',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}),f.outcome==='burst'?'💥 0.0 m':`${f.distance.toFixed(1)} m`,`${f.height.toFixed(1)} m`,`${f.time.toFixed(1)} s`,f.outcome==='burst'?'未出發':Number.isFinite(f.landingX)?`${window.BalloonEngine.isWrongWay(f)?'←':'→'} ${Math.abs(f.landingX).toFixed(1)} m${window.BalloonEngine.isWrongWay(f)?' · 失敗':''}`:'舊版 —'].forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.append(td);});$('history-body').append(tr);});$('empty-history').hidden=data.flights.length>0;$('clear-records').disabled=!data.flights.length&&!data.bestDistance;}
  $('records').addEventListener('click',()=>{releaseAll();sound.reset();renderHistory();$('clear-confirm').hidden=true;$('history').showModal();});
  $('close-history').addEventListener('click',()=>$('history').close());$('history').addEventListener('click',e=>{if(e.target===$('history')){const r=$('history').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('history').close();}});
  $('clear-records').addEventListener('click',()=>{$('clear-confirm').hidden=false;});$('cancel-clear').addEventListener('click',()=>{$('clear-confirm').hidden=true;});$('confirm-clear').addEventListener('click',()=>{records.clear();refreshBest();renderHistory();$('clear-confirm').hidden=true;if(!records.available)notice('無法儲存清除結果；請檢查瀏覽器的網站儲存權限。');});
  document.querySelectorAll('[data-preview]').forEach(button=>button.addEventListener('click',()=>{sound.preview(button.dataset.preview,Number($('sample-volume').value)/100);$('audio-status').textContent=muted?'目前已靜音，請先開啟音效':'試聽：'+button.textContent+(button.dataset.preview==='balloon'?' · '+$('sample-volume').value+'% 氣量':'');}));
  $('sample-volume').addEventListener('input',()=>{$('sample-volume-value').textContent=$('sample-volume').value+'%';});
  function resize(){const r=canvas.getBoundingClientRect();w=r.width;h=r.height;dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);}
  resizeObserver=new ResizeObserver(resize);resizeObserver.observe(canvas);refreshBest();
  const path=(points,fill,stroke,width=1)=>{ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}};
  function ellipse(x,y,rx,ry,color){ctx.beginPath();ctx.ellipse(x,y,Math.max(.01,rx),Math.max(.01,ry),0,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}
  function line(x1,y1,x2,y2,color,width=1){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.stroke();}
  function cloud(x,y,s){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle='#f7ffec';ctx.beginPath();ctx.moveTo(-55,12);ctx.bezierCurveTo(-80,-5,-48,-22,-30,-15);ctx.bezierCurveTo(-30,-48,25,-51,32,-18);ctx.bezierCurveTo(57,-25,81,0,60,12);ctx.closePath();ctx.fill();ctx.restore();}
  function tree(x,y,s,type=0){ctx.save();ctx.translate(x,y);ctx.scale(s,s);line(0,0,0,-92,'#294e59',4);if(type){path([[-34,-37],[0,-132],[35,-37]],'#41bda1');path([[-27,-65],[0,-145],[28,-65]],'#63d6b2');line(0,-17,0,-100,'#247b76',1);}else{ellipse(0,-101,38,48,'#4cc6a2');ellipse(-24,-81,26,34,'#4cc6a2');ellipse(24,-84,28,35,'#4cc6a2');line(0,-36,0,-114,'#25877c',1.5);line(0,-62,-18,-83,'#25877c',1.5);line(0,-80,18,-102,'#25877c',1.5);}ctx.restore();}
  function character(x,ground,s){
    ctx.save();ctx.translate(x,ground);ctx.scale(s,s);
    const blowing=game.blowing,inhaling=game.phase==='ready'&&!game.held&&game.breath<.995;
    const chest=inhaling?Math.sin(game.breath*Math.PI)*1.1:blowing?.4:0;
    ellipse(-2,2,25,4,'#27435722');
    // Trousers, bent knees and sneakers, with a consistent illustration outline.
    line(-8,-34,-10,-17,'#34466e',10);line(-10,-17,-13,-4,'#29385e',9);
    line(5,-34,8,-18,'#34466e',10);line(8,-18,11,-4,'#29385e',9);
    ctx.fillStyle='#19273e';ctx.beginPath();ctx.roundRect(-24,-6,19,7,3);ctx.roundRect(7,-6,20,7,3);ctx.fill();
    line(-23,0,-6,0,'#d6e7d0',1.8);line(9,0,25,0,'#d6e7d0',1.8);
    const shirt=ctx.createLinearGradient(-16,-65,16,-29);shirt.addColorStop(0,'#e1fb78');shirt.addColorStop(1,'#b0d947');
    ctx.fillStyle=shirt;ctx.beginPath();ctx.moveTo(-14,-66);ctx.quadraticCurveTo(0,-72,13,-65);ctx.lineTo(17+chest,-34);ctx.quadraticCurveTo(0,-28,-18,-34);ctx.lineTo(-19,-56);ctx.closePath();ctx.fill();
    line(-16,-35,15,-35,'#91b63e',1.2);line(12,-57,14,-39,'#a5c845',1.2);
    // Relaxed far arm and the near hand gently pinching the balloon neck.
    line(-13,-59,-22,-42,'#d6ee66',10);line(-22,-42,-15,-28,'#e6b298',6.5);ellipse(-14,-26,3.2,4,'#edbea2');
    line(11,-60,21,-53,'#bfdc54',10);line(21,-53,25,-72,'#efc4a7',6.5);
    ctx.fillStyle='#efc4a7';ctx.beginPath();ctx.moveTo(22,-73);ctx.quadraticCurveTo(22,-80,27,-81);ctx.quadraticCurveTo(30,-81,29,-78);ctx.lineTo(26,-76);ctx.quadraticCurveTo(30,-76,29,-73);ctx.lineTo(26,-70);ctx.closePath();ctx.fill();
    line(25,-76,28,-78,'#ce987d',.8);
    // Neck and collar sit below the jaw rather than overlapping the mouth.
    ctx.fillStyle='#e5b196';ctx.beginPath();ctx.moveTo(-4,-77);ctx.lineTo(7,-74);ctx.lineTo(8,-67);ctx.quadraticCurveTo(2,-63,-5,-68);ctx.closePath();ctx.fill();
    line(-6,-67,1,-65,'#f4f6ca',2);line(1,-65,9,-68,'#f4f6ca',2);
    // A single side-profile silhouette: forehead -> bridge -> nose -> lips -> chin.
    const skin=ctx.createLinearGradient(-13,-100,20,-75);skin.addColorStop(0,'#f5d0b4');skin.addColorStop(1,'#efb99b');ctx.fillStyle=skin;
    ctx.beginPath();ctx.moveTo(-12,-86);ctx.bezierCurveTo(-15,-100,-8,-107,2,-107);ctx.bezierCurveTo(10,-107,15,-101,15,-95);
    ctx.bezierCurveTo(15,-91,17,-88,20,-85);ctx.quadraticCurveTo(22,-83,19,-82);ctx.lineTo(17,-82);
      if(blowing){ctx.bezierCurveTo(17,-80.5,20,-80.5,23,-79);ctx.quadraticCurveTo(25,-78,23,-76.8);ctx.bezierCurveTo(20,-75,18,-75.5,17,-74);ctx.quadraticCurveTo(17,-72,15,-71);}
      else{ctx.bezierCurveTo(17,-80,17.5,-79,18.5,-78);ctx.quadraticCurveTo(19.5,-77,18,-76);ctx.bezierCurveTo(17,-75,18,-72,15,-71);}
    ctx.bezierCurveTo(9,-68,2,-69,-2,-73);ctx.lineTo(-5,-77);ctx.bezierCurveTo(-11,-77,-14,-80,-12,-86);ctx.closePath();ctx.fill();ctx.strokeStyle='#c58d7455';ctx.lineWidth=.75;ctx.stroke();
    // Hair, ear and facial features use separate, restrained shapes.
    ctx.fillStyle='#24334f';ctx.beginPath();ctx.moveTo(-13,-84);ctx.bezierCurveTo(-19,-94,-12,-106,-3,-109);ctx.bezierCurveTo(6,-112,16,-106,16,-98);ctx.quadraticCurveTo(9,-98,5,-103);ctx.quadraticCurveTo(0,-97,-9,-96);ctx.lineTo(-10,-84);ctx.closePath();ctx.fill();
    ctx.beginPath();ctx.moveTo(-11,-101);ctx.quadraticCurveTo(-3,-108,6,-105);ctx.strokeStyle='#41516b';ctx.lineWidth=1.4;ctx.stroke();
    ellipse(-9,-84,3.2,4.4,'#ebba9f');ctx.beginPath();ctx.moveTo(-10,-85);ctx.quadraticCurveTo(-6,-87,-8,-81);ctx.strokeStyle='#c99179';ctx.lineWidth=.8;ctx.stroke();
    ctx.beginPath();ctx.moveTo(6,-95);ctx.quadraticCurveTo(9,-96,12,-94);ctx.strokeStyle='#40506a';ctx.lineWidth=1.1;ctx.stroke();
      if(blowing){ctx.beginPath();ctx.moveTo(7,-91);ctx.quadraticCurveTo(9,-90,11,-91);ctx.strokeStyle='#273b52';ctx.lineWidth=1.1;ctx.stroke();}else{ellipse(9,-91,2.1,1.8,'#fff5e8');ellipse(10,-91,1,1.4,'#273b52');ctx.beginPath();ctx.moveTo(7,-92);ctx.quadraticCurveTo(9,-93,11,-92);ctx.strokeStyle='#40506a';ctx.lineWidth=.7;ctx.stroke();}
    ellipse(blowing?11:9,-81,blowing?4.5:3.4,2.9,'#e9a28944');
    ctx.beginPath();ctx.moveTo(16,-87);ctx.quadraticCurveTo(17,-84,19,-83.5);ctx.strokeStyle='#d0967d';ctx.lineWidth=.7;ctx.stroke();ellipse(18,-82.7,.75,.4,'#a96e5b');
    // Pursed lips are below the nose, touching the balloon opening without a round snout.
      if(blowing){ctx.fillStyle='#d99889';ctx.beginPath();ctx.moveTo(18,-79.5);ctx.quadraticCurveTo(22,-80,24,-78.3);ctx.quadraticCurveTo(25,-77.3,22,-76.4);ctx.quadraticCurveTo(19,-76,18,-77);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(19,-78);ctx.quadraticCurveTo(22,-77.7,24,-78);ctx.strokeStyle='#925952';ctx.lineWidth=.9;ctx.stroke();}
      else{ctx.beginPath();ctx.moveTo(16.5,-78);ctx.quadraticCurveTo(17.5,-77.3,18.7,-77.5);ctx.strokeStyle='#9d6158';ctx.lineWidth=.8;ctx.stroke();}
    if(blowing){for(let i=0;i<2;i++){const d=(clock*36+i*7)%15;line(22+d,-78+(i-.5)*3,26+d,-78+(i-.5)*3,'#68999866',1);}}
    if(inhaling){ctx.strokeStyle='#51858b88';ctx.lineWidth=1;for(let i=0;i<2;i++){const dy=i*5;ctx.beginPath();ctx.moveTo(39,-95+dy);ctx.quadraticCurveTo(30,-95+dy,24,-85+dy*.2);ctx.stroke();}}
    ctx.restore();
  }
  function balloon(x,y,r,angle,flying){ctx.save();ctx.translate(x,y);ctx.rotate(angle);const wobble=reduced?0:Math.sin(clock*(flying?32:9))*(flying?.12:game.volume>.5?.018+(game.volume-.5)*.045:.025);if(flying&&game.phase==='done')ctx.scale(1.5,.24);
    ctx.scale(1+wobble,flying?1+wobble:1-wobble);ellipse(0,1,r*.98,r*.91,'#d3376d');
    const grad=ctx.createRadialGradient(-r*.3,-r*.35,r*.05,0,0,r*1.1);grad.addColorStop(0,'#ffadca');grad.addColorStop(.7,'#ff6b9b');grad.addColorStop(1,'#ea3b7e');ellipse(0,-r*.07,r,r*.94,grad);ctx.strokeStyle='#54213e';ctx.lineWidth=1.7;ctx.beginPath();ctx.ellipse(0,-r*.07,r,r*.94,0,0,Math.PI*2);ctx.stroke();
    ellipse(-r*.3,-r*.39,r*.14,r*.25,'#ffe6efbb');
    ctx.save();ctx.translate(-r,flying?-game.offset*r:0);ctx.rotate(flying?-game.flutter:0);
    path([[1,-3],[-8,-6],[-8,5],[1,3]],'#c53065');
    if(!flying){ctx.beginPath();ctx.moveTo(-6,4);ctx.bezierCurveTo(-18,14,-4,28,-18,38);ctx.strokeStyle='#b88c6b';ctx.lineWidth=1;ctx.stroke();}
    if(flying&&game.fuel>0){const flow=window.BalloonEngine.aerodynamics(game.fuel).flow;const plume=12+flow*28;ctx.strokeStyle='#fffbe4';ctx.lineWidth=1.6;for(let i=0;i<3;i++){const spread=(i-1)*2;ctx.beginPath();ctx.moveTo(-9,spread);ctx.lineTo(-9-plume,spread*1.8+Math.sin(clock*29+i)*.8);ctx.stroke();}}
    ctx.restore();
    ctx.restore();
  }
  function draw(){
    ctx.clearRect(0,0,w,h);const launchX=w*(w<600?.34:.29),base=h-76,ground=base+camY,unit=scale;
    const sky=ctx.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#87dbed');sky.addColorStop(1,'#c1f3e1');ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
    // Light graph paper, graphic sun and a layered, scrolling playground.
    ctx.strokeStyle='#235d7610';ctx.lineWidth=1;for(let x=-(camX*.2%32);x<w;x+=32)line(x,0,x,h,'#235d7610');for(let y=camY*.1%32;y<h;y+=32)line(0,y,w,y,'#235d7610');
    const sunX=w*.78-camX*.025,sunY=143+camY*.08;ellipse(sunX,sunY,29,29,'#f9f089');for(let i=0;i<12;i++){const a=i*Math.PI/6;line(sunX+Math.cos(a)*37,sunY+Math.sin(a)*37,sunX+Math.cos(a)*44,sunY+Math.sin(a)*44,'#e9cb55',2);}
    for(let i=-1;i<5;i++){const x=((i*290+clock*(reduced?0:2)-camX*.07)%(w+380)+w+380)%(w+380)-110;cloud(x,165+(Math.abs(i)%2)*75+camY*.1,.4+(Math.abs(i)%2)*.2);}
    ctx.fillStyle='#86d3b6';ctx.beginPath();ctx.moveTo(0,h);ctx.lineTo(0,base-32+camY*.2);for(let x=0;x<=w+20;x+=20)ctx.lineTo(x,base-37+camY*.2+Math.sin((x+camX*.2)/130)*19);ctx.lineTo(w,h);ctx.fill();
    // Blocky town silhouettes make camera reversals easy to read.
    for(let i=Math.floor(camX*.25/110)-2;i<Math.floor(camX*.25/110)+w/110+4;i++){const x=i*110-camX*.25,roof=base-55-(Math.abs(i)%4)*19+camY*.35;ctx.fillStyle=i%2?'#62b8ac':'#70c7b3';ctx.fillRect(x,roof,75,h-roof);for(let j=0;j<3;j++)for(let k=0;k<2;k++)ctx.fillStyle='#bef1d680',ctx.fillRect(x+13+j*19,roof+15+k*22,8,11);}
    const spacing=210;for(let i=Math.floor(camX*.55/spacing)-2;i<Math.floor(camX*.55/spacing)+w/spacing+3;i++)tree(i*spacing-camX*.55+70,base+8+camY*.6,.5+(Math.abs(i)%2)*.16,i%2);
    if(ground<h+20){ctx.fillStyle='#c7e984';ctx.fillRect(0,ground,w,h-ground);line(0,ground,w,ground,'#225960',3);ctx.fillStyle='#a5ce6f';ctx.fillRect(0,ground+9,w,4);ctx.fillStyle='#2f4662';ctx.fillRect(0,ground+28,w,h-ground);for(let i=-1;i<w/55+2;i++)line(i*55-(camX%55),ground+46,i*55+24-(camX%55),ground+46,'#d4e5a5',2);}
    // Signed ground ruler, with a persistent launch flag at zero.
    const min=Math.floor((camX-launchX)/unit/5)*5,max=Math.ceil((camX+w-launchX)/unit/5)*5;
    if(ground<h+20)for(let m=min;m<=max;m+=5){const x=launchX+m*unit-camX;line(x,ground,x,ground-10,'#3c6b66',1);ctx.fillStyle='#193a4b';ctx.font='bold 9px Consolas';ctx.textAlign='center';if(m!==0)ctx.fillText((m>0?'+':'')+m+'m',x,ground+21);}
    const origin=launchX-camX;if(origin>-40&&origin<w+50&&ground<h+150){line(origin,ground,origin,ground-31,'#233a57',2);path([[origin,ground-31],[origin+23,ground-31],[origin+17,ground-21],[origin,ground-21]],'#ff6b9b','#233a57',1);ctx.font='bold 9px Consolas';ctx.textAlign='center';ctx.fillStyle='#233a57';ctx.fillText('START / 0m',origin,ground+21);}
    const playerX=origin-36*unit/48;if(playerX>-100&&playerX<w+100)character(playerX,ground,unit/48);
    if(game.phase==='burst'){
      const t=game.burstTime,x=launchX+45,y=ground-1.65*unit;
      for(let i=0;i<14;i++){const a=i*Math.PI*2/14,d=12+t*(65+i%3*22);const px=x+Math.cos(a)*d,py=y+Math.sin(a)*d+t*t*50;ctx.save();ctx.globalAlpha=Math.max(0,1-t/1.2);path([[px,py],[px+7*Math.cos(a+.7),py+7*Math.sin(a+.7)],[px+10*Math.cos(a-.7),py+10*Math.sin(a-.7)]],i%2?'#ff6b9b':'#ffe776');ctx.restore();}
      ctx.fillStyle='#64213e';ctx.font='900 32px Consolas';ctx.textAlign='center';ctx.fillText('POP!',x,y-10);
    }else if(game.phase==='ready'){
      const radius=8+37*Math.cbrt(game.volume),x=launchX+radius-5,y=ground-game.y*unit;ellipse(x,ground+2,radius*.8,4,'#1e547622');balloon(x,y,radius,-.04+Math.sin(clock*2)*.018,false);
      if(game.volume>.01){ctx.font='bold 10px Consolas';ctx.textAlign='center';ctx.fillStyle='#582139';ctx.fillText(Math.round(game.volume*100)+'%',x+1,y+4);}
    }else{
      const sx=x=>launchX+x*unit-camX,sy=y=>ground-y*unit;
      ctx.save();ctx.setLineDash([3,5]);ctx.strokeStyle='#253c76b0';ctx.lineWidth=2;ctx.beginPath();game.trail.forEach((p,i)=>i?ctx.lineTo(sx(p.x),sy(p.y)):ctx.moveTo(sx(p.x),sy(p.y)));ctx.stroke();ctx.restore();
      const bx=sx(game.x),by=sy(game.y),r=game.phase==='done'?11:Math.max(7,(8+37*Math.cbrt(game.fuel))*unit/48);if(ground<h)ellipse(bx,ground+1,r*.8,3,'#29466c33');balloon(bx,by,r,game.phase==='done'?0:game.angle,true);
      ctx.font='9px Consolas';ctx.textAlign='right';for(let m=5;m<=200;m+=5){const y=sy(m);if(y<165||y>h-43)continue;line(w-12,y,w-20,y,'#2d6f7f',1);ctx.fillStyle='#255b70';ctx.fillText(m+'m',w-25,y+3);}
    }
  }
  let previousHint='';
  function ui(){const breath=Math.round(game.breath*100),volume=Math.round(game.volume*100);$('breath-value').textContent=`${breath}%`;$('breath-fill').style.width=`${breath}%`;$('breath-fill').parentElement.setAttribute('aria-valuenow',String(breath));$('volume-value').textContent=`${volume}%`;$('volume-fill').style.width=`${Math.min(volume,100)}%`;document.querySelector('.volume-meter').classList.toggle('overfilled',volume>100);const danger=game.volume>.5;$('risk-note').classList.toggle('danger',danger);$('risk-note').textContent=game.phase==='burst'?'💥 爆裂！本次 0 m':danger?'⚠ 持續吹氣：約 '+(game.burstChance<.01?'低於 1':Math.round(game.burstChance*100))+'% / 秒爆裂風險':'安全區 · 超過 50% 開始有爆裂風險';$('volume-fill').parentElement.setAttribute('aria-valuenow',String(volume));
    $('breath-label').textContent=game.blowing?'呼—— 正在吹氣':game.phase==='burst'?'💥 氣球爆掉了':game.phase!=='ready'?'這一口氣，去旅行了':game.exhausted?'沒氣了，放開吸氣':game.volume>1?'超量充氣，小心爆裂！':game.breath<.99&&!game.held?'吸—— 補充空氣中':'肺活量';
    $('blow').classList.toggle('active',game.blowing);$('blow').disabled=game.phase!=='ready';$('launch').disabled=game.phase!=='ready'||game.volume<.08;$('position-label').textContent=Math.abs(game.x)<.1?'離起點':game.x<0?'← 起點左側':'起點右側 →';$('distance').innerHTML=`${Math.abs(game.x).toFixed(1)}<small>m</small>`;$('height').innerHTML=`${Math.max(0,(game.phase==='ready'||game.phase==='burst')?0:game.y).toFixed(1)}<small>m</small>`;
    if(game.phase==='ready'&&game.volume>0){const hint=game.exhausted?'一口氣用完了，放開鍵吸氣。':game.blowing?'呼—— 氣球正在長大。':game.volume>.5?'危險！再吹可能爆掉，按 X 放飛！':game.breath<.99?'吸—— 補一口，再吹更大。':'想再吹大一點，還是現在就出發？';if(hint!==previousHint){$('hint').textContent=hint;previousHint=hint;}}
  }
  let uiTime=0;
  function frame(stamp){requestAnimationFrame(frame);const dt=last?Math.min((stamp-last)/1000,.05):0;last=stamp;
    const paused=document.hidden||$('history').open;if(!paused){clock+=dt;accumulator+=dt;while(accumulator>=1/120){game.update(1/120);accumulator-=1/120;}if(game.phase==='burst'&&!burstFX){burstFX=true;savedResult=game.result();savedBest=records.add(savedResult);refreshBest();releaseAll();sound.burst();$('hint').hidden=true;$('announcement').textContent='氣球爆裂！本次零公尺。';}if((game.phase==='done'||game.phase==='burst'&&game.burstTime>.75)&&!ended)finish();}
    const cameraDt=dt*game.flightSpeed,targetScale=(game.phase==='ready'||game.phase==='burst')?48:Math.max(19,48-game.distance*1.1);scale+=(targetScale-scale)*Math.min(1,cameraDt*2);const targetX=(game.phase==='ready'||game.phase==='burst')?0:(game.x>=0?Math.max(0,game.x*scale+w*(w<600?.34:.29)-w*.60):Math.min(0,game.x*scale+w*(w<600?.34:.29)-w*.30)),targetY=(game.phase==='ready'||game.phase==='burst')?0:Math.max(0,game.y*scale-h*.52);camX+=(targetX-camX)*Math.min(1,cameraDt*4);camY+=(targetY-camY)*Math.min(1,cameraDt*4);
    uiTime+=dt;if(uiTime>.04){ui();sound.update(game,clock,document.hidden||$('history').open);uiTime=0;}draw();
  }
  ui();requestAnimationFrame(frame);
})();
