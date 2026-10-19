const fs=require('node:fs'),path=require('node:path');
const names=['balloon','laughter','applause','wow','encore','inhale'];
const data=Object.fromEntries(names.map(name=>[name,fs.readFileSync(path.join(__dirname,'assets','audio',name+'.mp3')).toString('base64')]));
fs.writeFileSync(path.join(__dirname,'audio-assets.js'),'/* Bundled offline samples. See AUDIO-CREDITS.md for authors and licenses. */\nwindow.BALLOON_AUDIO='+JSON.stringify(data)+';\n');
console.log('Packed 6 local samples into audio-assets.js');
