const {createPostgresStore}=require('../lib/postgres-store');
const { authorize } = require('../lib/admin-auth');
let store;
module.exports=async(req,res)=>{
  const json=(status,value)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(value));};
  try {
    if(!process.env.DATABASE_URL)return json(503,{error:'Database setup is incomplete. Configure DATABASE_URL in Vercel.'});

    const url=new URL(req.url,'https://lifeflow.local');
    const route=req.query?.route||url.searchParams.get('route');
    const path=route?'/api/'+route:url.pathname;
    if(req.method==='GET'&&path==='/api/state') {
      if (!authorize(req,res,path,json,{ secure: true })) return;
      store ||= createPostgresStore(process.env.DATABASE_URL);
      return json(200,await store.snapshot());
    }
    if(req.method!=='POST')return json(404,{error:'Not found.'});
    let body=req.body;
    if(typeof body==='string'){try{body=JSON.parse(body);}catch{return json(400,{error:'Invalid JSON.'});}}
    if(!body||typeof body!=='object'||Array.isArray(body))return json(400,{error:'Invalid request body.'});
    if(Buffer.byteLength(JSON.stringify(body))>16000)return json(413,{error:'Request is too large.'});
    if (!authorize(req,res,path,json,{ body, secure: true })) return;
    store ||= createPostgresStore(process.env.DATABASE_URL);
    if(path==='/api/batches')await store.addBatch(body);
    else if(path==='/api/requests')await store.addRequest(body);
    else {const match=path.match(/^\/api\/requests\/(\d+)\/(fulfill|cancel)$/);if(!match)return json(404,{error:'Not found.'});await store.transition(Number(match[1]),match[2]);}
    return json(200,await store.snapshot());
  } catch(e) {if(!e.status)console.error('Database operation failed:',e.code||'unknown');return json(e.status||500,{error:e.status?e.message:'Database unavailable. Please try again.'});}
};
