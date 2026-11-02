const { Pool } = require('pg');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const groups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const today = () => new Date().toISOString().slice(0, 10);
function fail(message, status=400) { throw Object.assign(new Error(message),{status}); }
function validate(body, batch) {
  const keys=batch?['donor']:['hospital','contact'];
  const result={...body};
  for(const key of keys) { if(typeof body[key]!=='string'||!body[key].trim()||body[key].trim().length>120)fail(`${key} is required (maximum 120 characters).`);result[key]=body[key].trim(); }
  if(!groups.includes(body.blood_group))fail('Select a valid blood group.');
  if(!Number.isInteger(body.units)||body.units<1||body.units>1000)fail('Units must be a whole number from 1 to 1000.');
  if(batch) {
    for(const key of ['collected','expires'])if(typeof body[key]!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(body[key])||!Number.isFinite(Date.parse(body[key]))||new Date(body[key]).toISOString().slice(0,10)!==body[key])fail('Enter valid collection and expiry dates.');
    if(body.collected>today())fail('Collection date cannot be in the future.');
    if(body.expires<=body.collected||body.expires<today())fail('Expiry must follow collection and cannot be in the past.');
  } else if(!['Normal','Urgent'].includes(body.priority))fail('Select a valid priority.');
  return result;
}
function createPostgresStore(connectionString) {
  const url=new URL(connectionString);
  for(const key of ['sslmode','sslcert','sslkey','sslrootcert','uselibpqcompat'])url.searchParams.delete(key);
  const pool=new Pool({connectionString:url.toString(),ssl:{ca:readFileSync(join(__dirname,'supabase-ca.crt'),'utf8'),rejectUnauthorized:true},max:2,idleTimeoutMillis:10000,connectionTimeoutMillis:10000});
  async function transaction(fn) {const c=await pool.connect();try{await c.query('BEGIN');const result=await fn(c);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
  const log=(c,description,kind)=>c.query('INSERT INTO activity(description,kind) VALUES ($1,$2)',[description,kind]);
  async function snapshot() {
    return transaction(async c=>{
      await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const batches=(await c.query("SELECT id,donor,blood_group,units,collected::text,expires::text,created FROM batches ORDER BY expires,id")).rows;
      const requests=(await c.query('SELECT * FROM requests ORDER BY id DESC')).rows;
      const activity=(await c.query("SELECT id,description,kind,to_char(created AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS') AS created FROM activity ORDER BY id DESC LIMIT 12")).rows;
      const now=today(),week=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
      const stock=groups.map(group=>({group,units:batches.filter(b=>b.blood_group===group&&b.expires>=now).reduce((s,b)=>s+b.units,0)}));
      return {today:now,batches,requests,activity,stock,stats:{available:stock.reduce((s,b)=>s+b.units,0),expiring:batches.filter(b=>b.expires>=now&&b.expires<=week).reduce((s,b)=>s+b.units,0),expired:batches.filter(b=>b.expires<now).reduce((s,b)=>s+b.units,0),pending:requests.filter(r=>r.status==='Pending').length,fulfilled:requests.filter(r=>r.status==='Fulfilled').reduce((s,r)=>s+r.units,0)}};
    });
  }
  async function addBatch(input) {const b=validate(input,true);await transaction(async c=>{await c.query('INSERT INTO batches(donor,blood_group,units,collected,expires) VALUES ($1,$2,$3,$4,$5)',[b.donor,b.blood_group,b.units,b.collected,b.expires]);await log(c,`${b.units} units of ${b.blood_group} received from ${b.donor}.`,'donation');});}
  async function addRequest(input) {const r=validate(input,false);await transaction(async c=>{await c.query('INSERT INTO requests(hospital,contact,blood_group,units,priority) VALUES ($1,$2,$3,$4,$5)',[r.hospital,r.contact,r.blood_group,r.units,r.priority]);await log(c,`${r.hospital} requested ${r.units} units of ${r.blood_group}.`,'request');});}
  async function transition(id,action) {
    if(!['fulfill','cancel'].includes(action))fail('Unknown action.');
    await transaction(async c=>{
      // All inventory writers taking this lock serialize allocation across requests.
      await c.query('SELECT pg_advisory_xact_lock(71234001)');
      const r=(await c.query('SELECT * FROM requests WHERE id=$1 FOR UPDATE',[id])).rows[0];
      if(!r)fail('Request not found.',404);if(r.status!=='Pending')fail('This request has already been processed.',409);
      if(action==='fulfill') {
        const batches=(await c.query('SELECT * FROM batches WHERE blood_group=$1 AND expires >= $2::date AND units>0 ORDER BY expires,id FOR UPDATE',[r.blood_group,today()])).rows;
        if(batches.reduce((s,b)=>s+b.units,0)<r.units)fail(`Insufficient ${r.blood_group} stock. Add more unexpired units first.`,409);
        let remaining=r.units;for(const b of batches){if(!remaining)break;const used=Math.min(remaining,b.units);await c.query('UPDATE batches SET units=units-$1 WHERE id=$2',[used,b.id]);await c.query('INSERT INTO allocations(request_id,batch_id,units) VALUES ($1,$2,$3)',[id,b.id,used]);remaining-=used;}
      }
      const status=action==='fulfill'?'Fulfilled':'Cancelled';await c.query('UPDATE requests SET status=$1 WHERE id=$2',[status,id]);await log(c,`${r.hospital}: request #${id} ${status.toLowerCase()} (${r.units} units, ${r.blood_group}).`,action==='fulfill'?'dispatch':'request');
    });
  }
  return {snapshot,addBatch,addRequest,transition,close:()=>pool.end()};
}
module.exports={createPostgresStore,validate};
