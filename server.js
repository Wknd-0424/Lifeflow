const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createStore } = require('./lib/store');
const store = createStore(process.env.DB_PATH || path.join(__dirname,'data','bloodbank.sqlite'));
const assets = { '/':'index.html', '/index.html':'index.html', '/liquid-glass.html':'liquid-glass.html', '/liquid-glass-office.webp':'liquid-glass-office.webp', '/vendor/liquid-glass.js':'vendor/liquid-glass.js', '/vendor/dashboard-liquid-glass.js':'vendor/dashboard-liquid-glass.js', '/vendor/liquid-glass-shared.js':'vendor/liquid-glass-shared.js', '/vendor/liquid-glass.css':'vendor/liquid-glass.css', '/lifeflow-mark.svg':'lifeflow-mark.svg', '/app.js':'app.js', '/swarm-cursor.js':'swarm-cursor.js', '/styles.css':'styles.css', '/glass.css':'glass.css', '/hero-particles.js':'hero-particles.js', '/vendor/three.module.js':'vendor/three.module.js', '/vendor/three.core.js':'vendor/three.core.js' };
const mime = { '.webp':'image/webp', '.svg':'image/svg+xml', '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8' };
const server = http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Security-Policy',"default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data: blob:; frame-ancestors 'none'; form-action 'self'");
  const url = new URL(req.url,'http://localhost');
  const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  try {
    if(req.method==='GET' && url.pathname==='/health') return json(200,{status:'ok'});
    if(req.method==='GET' && url.pathname==='/api/state') return json(200,store.snapshot());
    if(req.method==='POST' && url.pathname.startsWith('/api/')) {
      let raw=''; for await (const chunk of req) {raw+=chunk; if(raw.length>16000) { const e=new Error('Request is too large.');e.status=413;throw e; }}
      let body;try{body=JSON.parse(raw||'{}');}catch{const e=new Error('Invalid JSON.');e.status=400;throw e;}
      if (!body || typeof body!=='object' || Array.isArray(body)) return json(400,{error:'Invalid request body.'});
      if(url.pathname==='/api/batches') store.addBatch(body);
      else if(url.pathname==='/api/requests') store.addRequest(body);
      else { const match=url.pathname.match(/^\/api\/requests\/(\d+)\/(fulfill|cancel)$/); if(!match) return json(404,{error:'Not found.'});store.transition(Number(match[1]),match[2]); }
      return json(200,store.snapshot());
    }
    if(req.method==='GET' && assets[url.pathname]) { const file=assets[url.pathname];res.writeHead(200,{'Content-Type':mime[path.extname(file)]});return fs.createReadStream(path.join(__dirname,'public',file)).pipe(res); }
    json(404,{error:'Not found.'});
  } catch(e) { if(!e.status) console.error(e);json(e.status||500,{error:e.status?e.message:'Something went wrong. Please try again.'}); }
});
server.listen(process.env.PORT||3000,process.env.HOST || '127.0.0.1',()=>console.log(`LifeFlow is running at http://localhost:${server.address().port}`));
const shutdown=()=>server.close(()=>{store.close();process.exit();});
process.on('SIGINT',shutdown);
process.on('SIGTERM',shutdown);
