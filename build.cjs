'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const files=['index.html','style.css','game.js','engine.js','sound.js','audio-assets.js','pwa.js','manifest.webmanifest','AUDIO-CREDITS.md','THIRD_PARTY_NOTICES.md','LICENSE','audio-source-notes.json',
  ...['icon-192.png','icon-512.png','icon-maskable-512.png','apple-touch-icon.png'].map(name=>'assets/icons/'+name),
  ...['balloon','inhale','laughter','applause','wow','encore'].map(name=>'assets/audio/'+name+'.mp3')];
const output=path.join(__dirname,'_site');fs.mkdirSync(output,{recursive:true});
const hash=crypto.createHash('sha256');
for(const file of files){const data=fs.readFileSync(path.join(__dirname,file));hash.update(file);hash.update(data);const dest=path.join(output,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,data);}
const template=fs.readFileSync(path.join(__dirname,'sw.js'),'utf8');hash.update(template);
const revision=hash.digest('hex').slice(0,16);fs.writeFileSync(path.join(output,'sw.js'),template.replace('__BUILD_VERSION__',revision));
fs.writeFileSync(path.join(output,'.nojekyll'),'');console.log('Built GitHub Pages/PWA in _site; cache revision '+revision);
