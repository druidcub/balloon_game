/* Local samples plus a continuously tuned rubber flutter layer. No remote requests. */
(() => {
  'use strict';
  class Sound {
    constructor(){this.muted=false;this.buffers={};this.effects=new Set();this.epoch=0;this.flight=null;this.previewFlight=0;this.previewInhale=0;this.inhale=null;this.inhaleCycleStarted=false;}
    init(){
      if(this.ctx){if(this.ctx.state==='suspended')this.ctx.resume().catch(()=>{});return;}
      try{
        const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
        this.ctx=new Audio();const c=this.ctx;this.master=c.createGain();this.master.gain.value=this.muted?0:.66;
        const limiter=c.createDynamicsCompressor();limiter.threshold.value=-12;limiter.knee.value=10;limiter.ratio.value=8;this.master.connect(limiter);limiter.connect(c.destination);
        const buffer=c.createBuffer(1,c.sampleRate*2,c.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
        this.noiseBuffer=buffer;this.noise=c.createBufferSource();this.noise.buffer=buffer;this.noise.loop=true;
        this.filter=c.createBiquadFilter();this.filter.type='bandpass';this.filter.Q.value=.8;this.air=c.createGain();this.air.gain.value=0;this.noise.connect(this.filter);this.filter.connect(this.air);this.air.connect(this.master);this.noise.start();
        this.rubber=c.createOscillator();this.rubber.type='sawtooth';this.rubber.frequency.value=120;
        this.rubberFilter=c.createBiquadFilter();this.rubberFilter.type='lowpass';this.rubberFilter.frequency.value=1200;this.rubberGain=c.createGain();this.rubberGain.gain.value=0;this.rubber.connect(this.rubberFilter);this.rubberFilter.connect(this.rubberGain);this.rubberGain.connect(this.master);this.rubber.start();
        this.mod=c.createOscillator();this.mod.frequency.value=33;const mg=c.createGain();mg.gain.value=38;this.mod.connect(mg);mg.connect(this.rubber.frequency);this.mod.start();
        this.ready=Promise.all(Object.entries(window.BALLOON_AUDIO||{}).map(async([name,base64])=>{try{const bytes=Uint8Array.from(atob(base64),ch=>ch.charCodeAt(0));this.buffers[name]=await c.decodeAudioData(bytes.buffer);}catch(e){this.failed=true;}})).then(()=>{const status=document.getElementById('audio-status');if(status)status.textContent=this.failed?'部分音效無法解碼，使用合成備援':Object.keys(this.buffers).length===6?'音效已就緒 · 可離線播放':'素材未載入，使用合成備援';});
      }catch(e){this.ctx=null;const status=document.getElementById('audio-status');if(status)status.textContent='此瀏覽器無法啟用音效';}
    }
    clip(name,gain=.9,delay=0,rate=1,limit=0){
      if(!this.ctx||this.muted)return;const token=this.epoch;
      const play=()=>{if(token!==this.epoch||this.muted)return;const b=this.buffers[name];if(!b)return;const c=this.ctx,src=c.createBufferSource(),g=c.createGain();src.buffer=b;src.playbackRate.value=rate;src.connect(g);g.connect(this.master);const t=c.currentTime+delay,duration=Math.min(limit||b.duration/rate,b.duration/rate);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(gain,t+.025);g.gain.setValueAtTime(gain,t+Math.max(.03,duration-.18));g.gain.linearRampToValueAtTime(0,t+duration);this.effects.add(src);src.onended=()=>{this.effects.delete(src);src.disconnect();g.disconnect();};src.start(t);src.stop(t+duration+.02);};
      if(this.buffers[name])play();else if(this.ready)this.ready.then(play);
    }
    stopEffects(){this.epoch++;this.previewFlight=0;this.previewInhale=0;for(const node of this.effects){try{node.stop();}catch(e){}}this.effects.clear();}
    stopFlight(){if(this.flight){try{this.flight.src.stop();}catch(e){}this.flight.src.disconnect();this.flight.filter.disconnect();this.flight.gain.disconnect();this.flight=null;}}
    startInhale(remainingSeconds){
      if(this.inhale||!this.buffers.inhale||this.muted)return false;
      const c=this.ctx,src=c.createBufferSource(),gain=c.createGain();src.buffer=this.buffers.inhale;src.playbackRate.value=1;src.connect(gain);gain.connect(this.master);
      // A quiet, un-stretched recorded intake, without accelerating the voice for short refills.
      const t=c.currentTime,duration=Math.min(src.buffer.duration,Math.max(.08,remainingSeconds)),attack=Math.min(.07,duration*.25),release=Math.min(.16,duration*.45);
      gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.42,t+attack);gain.gain.setValueAtTime(.42,t+duration-release);gain.gain.linearRampToValueAtTime(0,t+duration);
      const handle={src,gain};this.inhale=handle;src.onended=()=>{if(this.inhale===handle)this.inhale=null;src.disconnect();gain.disconnect();};src.start(t,0,duration);return true;
    }
    stopInhale(){if(!this.inhale)return;const handle=this.inhale;this.inhale=null;const t=this.ctx.currentTime;handle.gain.gain.cancelScheduledValues(t);handle.gain.gain.setTargetAtTime(0,t,.012);try{handle.src.stop(t+.05);}catch(e){}}
    makeFlightLoop(buffer){
      // Overlap real recording grains instead of reducing rubber flutter to a pure tone.
      // Randomized positions remove the clip's repeated pitch sweep; Hann windows join smoothly.
      const rate=buffer.sampleRate,input=buffer.getChannelData(0),size=Math.round(rate*2),grain=Math.round(rate*.12),hop=Math.round(rate*.03);
      const loop=this.ctx.createBuffer(1,size,rate),output=loop.getChannelData(0),weights=new Float32Array(size);
      let seed=1907;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
      const margin=Math.min(Math.round(rate*.03),Math.floor(input.length*.05)),span=Math.max(0,input.length-grain-margin*2-1);
      for(let position=0;position<size;position+=hop){
        const offset=margin+Math.floor(random()*span);
        for(let i=0;i<grain;i++){const index=(position+i)%size,window=.5-.5*Math.cos(2*Math.PI*i/(grain-1));output[index]+=(input[Math.min(input.length-1,offset+i)]||0)*window;weights[index]+=window;}
      }
      let mean=0,peak=0;
      for(let i=0;i<size;i++){output[i]/=Math.max(.001,weights[i]);mean+=output[i]/size;}
      for(let i=0;i<size;i++){output[i]-=mean;peak=Math.max(peak,Math.abs(output[i]));}
      for(let i=0;i<size;i++)output[i]*=.6/Math.max(.001,peak);
      return loop;
    }
    startFlight(){if(this.flight||!this.buffers.balloon)return;const c=this.ctx,src=c.createBufferSource(),gain=c.createGain(),filter=c.createBiquadFilter();if(!this.flightBuffer)this.flightBuffer=this.makeFlightLoop(this.buffers.balloon);src.buffer=this.flightBuffer;src.loop=true;filter.type='lowpass';filter.frequency.value=2600;filter.Q.value=.45;gain.gain.value=0;src.connect(filter);filter.connect(gain);gain.connect(this.master);src.start();this.flight={src,gain,filter};}
    update(game,clock,paused=false){
      if(!this.ctx)return;const c=this.ctx,t=c.currentTime;let gain=0,freq=700;
      const preview=this.previewFlight>t,playing=!paused&&(game.phase==='flying'&&game.fuel>0||preview),fuel=preview?this.previewVolume:game.fuel;
      const inhaling=!paused&&!preview&&game.phase==='ready'&&!game.held&&game.breath<.995;
      if(inhaling){if(!this.inhaleCycleStarted)this.inhaleCycleStarted=this.startInhale((1-game.breath)*.95);}else{this.inhaleCycleStarted=false;if(!(this.previewInhale>t&&!paused&&!game.held&&game.phase==='ready'))this.stopInhale();}
      if(playing){this.startFlight();const fullness=Math.min(1.5,Math.max(0,fuel));
        // Fullness is the only pitch control; flutter changes loudness, never restarts a glide.
        if(this.flight){const pitch=.86+(1.5-fullness)*.12;if(!this.flight.tuned){this.flight.src.playbackRate.setValueAtTime(pitch,t);this.flight.tuned=true;}else this.flight.src.playbackRate.setTargetAtTime(pitch,t,.12);this.flight.gain.gain.setTargetAtTime(.48+Math.sin(clock*27)*.02,t,.04);}
        this.rubber.frequency.setTargetAtTime(85+(1.5-fullness)*65,t,.12);this.mod.frequency.setTargetAtTime(20+(1.5-fullness)*12,t,.12);this.rubberGain.gain.setTargetAtTime(this.flight ? 0 : .045,t,.03);gain=.025;freq=850+fullness*130;
      }else{
        this.rubberGain.gain.setTargetAtTime(0,t,.035);if(this.flight)this.flight.gain.gain.setTargetAtTime(0,t,.035);
        if(!paused&&game.phase==='ready'){if(game.blowing){gain=.31;freq=1100+game.volume*200;}else if(inhaling&&!this.buffers.inhale){gain=.16;freq=650;}}
      }
      this.air.gain.setTargetAtTime(gain,t,.05);this.filter.frequency.setTargetAtTime(freq,t,.06);
      if(this.flight&&!playing&&game.phase!=='flying'&&!preview)this.stopFlight();
    }
    pop(){if(!this.ctx)return;const c=this.ctx,t=c.currentTime,src=c.createBufferSource(),g=c.createGain(),filter=c.createBiquadFilter();src.buffer=this.noiseBuffer;filter.type='highpass';filter.frequency.value=320;src.connect(filter);filter.connect(g);g.connect(this.master);g.gain.setValueAtTime(.8,t);g.gain.exponentialRampToValueAtTime(.001,t+.14);src.start(t);src.stop(t+.16);this.effects.add(src);src.onended=()=>{this.effects.delete(src);src.disconnect();filter.disconnect();g.disconnect();};}
    launch(){this.stopEffects();this.stopFlight();this.stopInhale();this.inhaleCycleStarted=false;}
    burst(){this.stopEffects();this.stopFlight();this.stopInhale();this.pop();this.clip('laughter',.9,.23,1,3.8);}
    disappointed(){
      if(!this.ctx||this.muted)return;
      // A soft descending "wah wah waah"; generated locally without extra downloads.
      const c=this.ctx,t=c.currentTime;
      for(const [frequency,delay,duration]of [[196,0,.32],[164.81,.3,.34],[130.81,.62,.75]]){
        const src=c.createOscillator(),filter=c.createBiquadFilter(),gain=c.createGain();src.type='triangle';src.frequency.setValueAtTime(frequency,t+delay);src.frequency.linearRampToValueAtTime(frequency*.94,t+delay+duration);filter.type='lowpass';filter.frequency.value=650;filter.Q.value=.5;src.connect(filter);filter.connect(gain);gain.connect(this.master);
        gain.gain.setValueAtTime(0,t+delay);gain.gain.linearRampToValueAtTime(.28,t+delay+.07);gain.gain.setValueAtTime(.24,t+delay+duration*.55);gain.gain.linearRampToValueAtTime(0,t+delay+duration);this.effects.add(src);src.onended=()=>{this.effects.delete(src);src.disconnect();filter.disconnect();gain.disconnect();};src.start(t+delay);src.stop(t+delay+duration+.02);
      }
    }
    finish(reward){this.stopFlight();if(reward==='burst')return;this.stopEffects();if(reward==='disappointed'){this.disappointed();return;}if(reward==='encore'){this.clip('applause',.6,0,1,3.5);this.clip('encore',.95,.3,1,5);}else if(reward==='wow'){this.clip('wow',1);this.clip('applause',.6,.8,1,2.8);}else this.clip('applause',reward==='polite'?.55:.95,0,reward==='polite'?.9:1,reward==='polite'?1.8:3.5);}
    preview(name,volume=1){this.init();this.stopEffects();this.stopFlight();this.stopInhale();if(name==='inhale'){const play=()=>{if(this.startInhale(.6))this.previewInhale=this.ctx.currentTime+Math.min(.6,this.buffers.inhale.duration);};if(this.buffers.inhale)play();else if(this.ready){const token=this.epoch;this.ready.then(()=>{if(token===this.epoch)play();});}}else if(name==='balloon'){this.previewVolume=volume;this.previewFlight=(this.ctx?.currentTime||0)+2.8;}else if(name==='laughter')this.burst();else if(name==='disappointed')this.finish('disappointed');else if(name==='encore')this.finish('encore');else if(name==='wow')this.finish('wow');else this.finish('applause');}
    mute(muted){this.muted=muted;if(muted){this.stopEffects();this.stopFlight();this.stopInhale();this.inhaleCycleStarted=false;}if(this.ctx)this.master.gain.setTargetAtTime(muted?0:.66,this.ctx.currentTime,.03);}
    reset(){this.stopEffects();this.stopFlight();this.stopInhale();this.inhaleCycleStarted=false;}
  }
  window.BalloonAudio={Sound};
})();
