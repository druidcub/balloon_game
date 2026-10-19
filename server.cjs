// Local preview server. Run: node server.cjs (http://127.0.0.1:4189)
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=process.env.SITE_DIR?path.resolve(__dirname,process.env.SITE_DIR):__dirname;
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.md':'text/plain; charset=utf-8','.mp3':'audio/mpeg','.png':'image/png','.webmanifest':'application/manifest+json','.json':'application/json'};
const allowed=new Set(['index.html','style.css','game.js','engine.js','sound.js','audio-assets.js','pwa.js','sw.js','manifest.webmanifest','README.md','LICENSE','THIRD_PARTY_NOTICES.md','AUDIO-CREDITS.md','audio-source-notes.json',...['icon-192.png','icon-512.png','icon-maskable-512.png','apple-touch-icon.png'].map(n=>'assets/icons/'+n),...['balloon','laughter','applause','wow','encore','inhale'].map(n=>'assets/audio/'+n+'.mp3')]);
const server=http.createServer((req,res)=>{let name;try{name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'')||'index.html';}catch{res.writeHead(400);res.end();return;}if(!allowed.has(name)){res.writeHead(404);res.end('Not found');return;}fs.readFile(path.join(root,name),(err,data)=>{if(err){res.writeHead(404);res.end('Not found');return;}res.writeHead(200,{'Content-Type':types[path.extname(name)]||'text/plain','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(data);});});
server.on('error',err=>{console.error(err.code==='EADDRINUSE'?'Port is in use. Try setting PORT to another number.':err.message);process.exitCode=1;});
server.listen(Number(process.env.PORT)||4189,'127.0.0.1',()=>console.log(`Balloon Day: http://127.0.0.1:${server.address().port}`));
