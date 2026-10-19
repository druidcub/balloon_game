'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'build.cjs'),'utf8'),{require,__dirname,console});
  const output=path.join(__dirname,'_site'),manifest=JSON.parse(fs.readFileSync(path.join(output,'manifest.webmanifest'),'utf8'));
  for(const base of ['https://example.test/','https://example.test/balloon_game/']){
    assert.equal(new URL(manifest.start_url,base).href,base);assert.equal(new URL(manifest.scope,base).href,base);
  }
  for(const icon of manifest.icons){const png=fs.readFileSync(path.join(output,icon.src)),size=Number(icon.sizes.split('x')[0]);assert.equal(png.toString('hex',0,8),'89504e470d0a1a0a');assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);}
  assert(manifest.icons.some(icon=>icon.purpose==='maskable'));assert(['standalone','fullscreen','minimal-ui'].includes(manifest.display));
  const scope='https://example.test/balloon_game/',prefix='balloon-game:'+scope+':',listeners={},stores=new Map();let claimed=0,skipped=0;
  const caches={
    async open(name){if(!stores.has(name))stores.set(name,new Map());const data=stores.get(name);return {async addAll(urls){for(const url of urls){assert(url.startsWith(scope),'No root-relative precache URLs');const file=new URL(url).pathname.slice('/balloon_game/'.length)||'index.html';assert(fs.existsSync(path.join(output,file)),file+' must exist in deployment');data.set(url,{url});}},async match(url){return data.get(url);}};},
    async keys(){return [...stores.keys()];},async delete(name){return stores.delete(name);}
  };
  const sw=fs.readFileSync(path.join(output,'sw.js'),'utf8');assert(!sw.includes('__BUILD_VERSION__'));
  const self={registration:{scope},clients:{async claim(){claimed++;}},skipWaiting(){skipped++;},addEventListener(type,callback){listeners[type]=callback;}};
  vm.runInNewContext(sw,{self,caches,URL,fetch:async()=>{throw Error('offline');}});
  let pending;listeners.install({waitUntil(promise){pending=promise;}});await pending;assert.equal(skipped,0,'Never replace a running game automatically');
  stores.set(prefix+'old',new Map());stores.set('other-game-cache',new Map());listeners.activate({waitUntil(promise){pending=promise;}});await pending;assert.equal(claimed,1);assert(!stores.has(prefix+'old'));assert(stores.has('other-game-cache'),'Do not delete another app cache');
  for(const file of ['', 'index.html','game.js','audio-assets.js','manifest.webmanifest','assets/icons/icon-512.png']){
    let response;listeners.fetch({request:{method:'GET',url:scope+file+'?test=1'},respondWith(promise){response=promise;}});assert(response,'Core file must work offline: '+file);assert.equal((await response).url,scope+file);
  }
  for(const request of [{method:'POST',url:scope},{method:'GET',url:'https://external.test/game.js'},{method:'GET',url:'https://example.test/another-game/game.js'}]){let intercepted=false;listeners.fetch({request,respondWith(){intercepted=true;}});assert.equal(intercepted,false);}
  listeners.message({data:{type:'SKIP_WAITING'}});assert.equal(skipped,1);
  const html=fs.readFileSync(path.join(output,'index.html'),'utf8');assert(html.includes('rel="manifest"'));assert(html.includes('src="pwa.js"'));assert(!fs.existsSync(path.join(output,'tests.cjs')),'Do not publish tests as game assets');
  console.log('PASS: Pages build, project-path PWA scope, PNG icons, complete offline cache including audio, scoped cache cleanup and user-controlled update.');
})().catch(error=>{console.error(error);process.exitCode=1;});
