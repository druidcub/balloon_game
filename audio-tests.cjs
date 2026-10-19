'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const box={window:{},document:{getElementById:()=>null}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'sound.js'),'utf8'),box);
const param=()=>({value:0,events:[],setTargetAtTime(value){this.events.push(value);},setValueAtTime(value){this.events.push(value);},linearRampToValueAtTime(){},cancelScheduledValues(){}}),sources=[];
const context={currentTime:0,createBiquadFilter:()=>({frequency:param(),Q:param(),connect(){},disconnect(){}}),createGain:()=>({gain:param(),connect(){},disconnect(){}}),createBufferSource:()=>{const source={playbackRate:param(),starts:0,stops:0,connect(){},disconnect(){},start(...args){this.starts++;this.startArgs=args;},stop(){this.stops++;}};sources.push(source);return source;}};
const sound=new box.window.BalloonAudio.Sound();sound.ctx=context;sound.master={gain:param()};sound.buffers.inhale={duration:.94};sound.air={gain:param()};sound.filter={frequency:param()};sound.rubberGain={gain:param()};
const ready={phase:'ready',held:false,breath:.1,blowing:false,fuel:0};sound.update(ready,0);assert.equal(sources.length,1);assert.equal(sources[0].starts,1);assert.equal(sources[0].playbackRate.value,1);assert(sources[0].startArgs[2]<=.95,'Short refill limits duration without speeding up the recording');assert(sound.inhale.gain.gain.events.includes(.42),'Subtle inhale level');
sound.update({...ready,breath:.2},.1);assert.equal(sources.length,1,'One inhale per recovery, no frame-by-frame retrigger');
sound.update({...ready,held:true,blowing:true},.2);assert.equal(sources[0].stops,1,'Blowing must stop the nasal inhale');
sound.update(ready,.3);assert.equal(sources.length,2);sound.update({...ready,breath:1},.4);assert.equal(sources[1].stops,1,'Full lungs must end inhale playback');
sound.update(ready,.5);sound.mute(true);assert.equal(sources[2].stops,1);sound.mute(false);sound.update(ready,.6);sound.reset();assert.equal(sources[3].stops,1);
sound.preview('inhale');assert.equal(sources.at(-1).buffer,sound.buffers.inhale,'Preview must play the inhale sample');
const previewInhale=sources.at(-1);sound.update({...ready,breath:1},.7);assert.equal(previewInhale.stops,0,'Full lungs do not immediately cancel the preview');sound.reset();assert.equal(previewInhale.stops,1,'Reset also stops an inhale preview');
const bundle={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'audio-assets.js'),'utf8'),bundle);assert.equal(Object.keys(bundle.window.BALLOON_AUDIO).length,6);for(const [name,value]of Object.entries(bundle.window.BALLOON_AUDIO))assert(Buffer.from(value,'base64').equals(fs.readFileSync(path.join(__dirname,'assets','audio',name+'.mp3'))));
console.log('PASS: nasal inhale single cue, release/repress transitions, full lungs, mute/reset cancellation, preview routing and 6 embedded offline assets.');

// The recording keeps its changing rubber texture, with smooth overlap and no playback restart.
const rate=44100,data=new Float32Array(rate*3);let phase=0;
for(let i=0;i<data.length;i++){const time=i/rate;phase+=2*Math.PI*(time<.5?550:Math.max(150,550-(time-.5)*220))/rate;data[i]=.5*Math.sin(phase)+.15*Math.sin(phase*2);}
context.createBuffer=(channels,length,sampleRate)=>{const samples=new Float32Array(length);return {sampleRate,duration:length/sampleRate,length,getChannelData:()=>samples};};
sound.buffers.balloon={sampleRate:rate,getChannelData:()=>data};sound.rubber={frequency:param()};sound.mod={frequency:param()};
const sustain=sound.makeFlightLoop(sound.buffers.balloon),wave=sustain.getChannelData(0);
assert.equal(wave.length,rate*2,'Use a textured recording loop rather than a pure oscillator cycle');assert(wave.every(Number.isFinite));
assert(Math.abs(wave.reduce((a,b)=>a+b,0)/wave.length)<1e-6,'No DC offset');
assert(Math.abs(wave[0]-wave.at(-1))<.15,'Loop boundary has no large waveform jump');
assert.deepEqual(wave,sound.makeFlightLoop(sound.buffers.balloon).getChannelData(0),'Loop generation is deterministic');assert(wave.some((value,i)=>i>rate&&Math.abs(value-wave[i-rate])>.03),'Preserve changing texture rather than a one-cycle buzz');
const beforeFlight=sources.length;
for(let frame=0;frame<180;frame++){context.currentTime=frame/30;sound.update({phase:'flying',fuel:1-frame/180},frame/30);}
assert.equal(sources.length,beforeFlight+1,'Entire flight uses one continuous source');
const flight=sources.at(-1);assert.equal(flight.buffer,sound.flightBuffer);assert.equal(flight.loop,true);assert.equal(flight.buffer.duration,2,'Keep a two-second real-recording texture');
const rates=flight.playbackRate.events;assert.equal(rates.length,180);assert(rates.every((value,i)=>i===0||value>=rates[i-1]),'Pitch follows remaining fuel without periodic resets');
assert(rates.every(value=>value>=.86&&value<=1.04),'Keep the reference timbre with a gentle pitch range');assert.equal(sound.flight.filter.type,'lowpass');assert.equal(sound.flight.filter.frequency.value,2600,'Sharp harmonics are filtered out');
sound.update({phase:'flying',fuel:.2},8);sound.update({phase:'flying',fuel:.2},18);assert.equal(rates.at(-1),rates.at(-2),'Same gas gives the same pitch regardless of clock');
sound.update({phase:'done',fuel:0},19);assert.equal(flight.stops,1,'Landing stops sustained jet');assert.equal(sound.flight,null);
console.log('PASS: overlap-added reference texture, seam continuity, one source per flight, continuous fuel-based pitch, clock-independent pitch and landing stop.');

const tones=[];context.createOscillator=()=>{const tone={frequency:param(),connect(){},disconnect(){},start(){},stop(){this.stopped=true;}};tones.push(tone);return tone;};
const audience=[];sound.clip=name=>audience.push(name);sound.finish('disappointed');assert.equal(tones.length,3);assert.equal(audience.length,0,'Wrong-way outcome must not applaud');assert(tones[0].frequency.events[0]>tones[1].frequency.events[0]&&tones[1].frequency.events[0]>tones[2].frequency.events[0]);assert.equal(sound.effects.size,3);sound.reset();assert.equal(sound.effects.size,0);sound.mute(true);sound.finish('disappointed');assert.equal(tones.length,3,'Mute suppresses disappointed sound');sound.mute(false);sound.preview('disappointed');assert.equal(tones.length,6,'Preview uses disappointed cue');
console.log('PASS: soft descending disappointment cue, no applause on failure, reset cancellation, mute and preview routing.');
