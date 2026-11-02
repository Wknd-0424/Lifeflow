const { DatabaseSync } = require('node:sqlite');
const { mkdirSync } = require('node:fs');
const { dirname } = require('node:path');
const GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const today = () => new Date().toISOString().slice(0, 10);
const dateOffset = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
function fail(message, status = 400) { const e = new Error(message); e.status = status; throw e; }
function text(value, label, max = 120) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) fail(`${label} is required (maximum ${max} characters).`);
  return value.trim();
}
function count(value) { if (!Number.isInteger(value) || value < 1 || value > 1000) fail('Units must be a whole number from 1 to 1000.'); return value; }
function group(value) { if (!GROUPS.includes(value)) fail('Select a valid blood group.'); return value; }
function validDate(value) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value; }
function createStore(filename, seed = true) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS batches(id INTEGER PRIMARY KEY, donor TEXT NOT NULL, blood_group TEXT NOT NULL, units INTEGER NOT NULL CHECK(units>=0), collected TEXT NOT NULL, expires TEXT NOT NULL, created TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS requests(id INTEGER PRIMARY KEY, hospital TEXT NOT NULL, contact TEXT NOT NULL, blood_group TEXT NOT NULL, units INTEGER NOT NULL, priority TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Pending', created TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS allocations(id INTEGER PRIMARY KEY, request_id INTEGER REFERENCES requests(id), batch_id INTEGER REFERENCES batches(id), units INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS activity(id INTEGER PRIMARY KEY, description TEXT NOT NULL, kind TEXT NOT NULL, created TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT);`);
  const log = (description, kind) => db.prepare('INSERT INTO activity(description,kind) VALUES (?,?)').run(description, kind);
  if (seed && !db.prepare("SELECT value FROM settings WHERE key='seeded'").get()) {
    const names = ['Arun Kumar', 'Priya Sharma', 'Mohammed Ali', 'Sneha Patel', 'Rahul Singh', 'Ananya Das', 'David Joseph', 'Meera Nair'];
    GROUPS.forEach((g, i) => db.prepare('INSERT INTO batches(donor,blood_group,units,collected,expires) VALUES (?,?,?,?,?)').run(names[i], g, [24, 8, 18, 5, 12, 3, 32, 7][i], dateOffset(-12), dateOffset([18, 4, 22, 3, 14, 6, 25, 2][i])));
    db.prepare('INSERT INTO batches(donor,blood_group,units,collected,expires) VALUES (?,?,?,?,?)').run('Campus donation drive', 'O+', 6, dateOffset(-40), dateOffset(-5));
    [['City General Hospital', 'Emergency desk', 'O+', 6, 'Urgent'], ['St. Mary’s Hospital', 'Blood bank desk', 'A+', 4, 'Normal'], ['Apollo Medical Centre', 'Dr. R. Kumar', 'AB-', 2, 'Urgent']].forEach(r => db.prepare('INSERT INTO requests(hospital,contact,blood_group,units,priority) VALUES (?,?,?,?,?)').run(...r));
    log('Demo inventory loaded. Ready for your first donation.', 'system');
    db.prepare("INSERT INTO settings VALUES ('seeded','true')").run();
  }
  function snapshot() {
    const batches = db.prepare('SELECT * FROM batches ORDER BY expires,id').all();
    const requests = db.prepare('SELECT * FROM requests ORDER BY id DESC').all();
    const stock = GROUPS.map(g => ({ group: g, units: batches.filter(b => b.blood_group === g && b.expires >= today()).reduce((s,b) => s+b.units,0) }));
    return { today: today(), stock, batches, requests, activity: db.prepare('SELECT * FROM activity ORDER BY id DESC LIMIT 12').all(), stats: {
      available: stock.reduce((s,g)=>s+g.units,0), expiring: batches.filter(b=>b.expires>=today() && b.expires<=dateOffset(7)).reduce((s,b)=>s+b.units,0),
      expired: batches.filter(b=>b.expires<today()).reduce((s,b)=>s+b.units,0), pending: requests.filter(r=>r.status==='Pending').length,
      fulfilled: requests.filter(r=>r.status==='Fulfilled').reduce((s,r)=>s+r.units,0)
    }};
  }
  function addBatch(body) {
    const donor = text(body.donor,'Donor / source'); const bloodGroup = group(body.blood_group); const units = count(body.units);
    if (!validDate(body.collected) || !validDate(body.expires)) fail('Enter valid collection and expiry dates.');
    if (body.collected > today()) fail('Collection date cannot be in the future.');
    if (body.expires <= body.collected || body.expires < today()) fail('Expiry must follow collection and cannot be in the past.');
    db.prepare('INSERT INTO batches(donor,blood_group,units,collected,expires) VALUES (?,?,?,?,?)').run(donor,bloodGroup,units,body.collected,body.expires);
    log(`${units} units of ${bloodGroup} received from ${donor}.`, 'donation');
  }
  function addRequest(body) {
    const hospital=text(body.hospital,'Hospital'); const contact=text(body.contact,'Contact'); const bloodGroup=group(body.blood_group); const units=count(body.units);
    if (!['Normal','Urgent'].includes(body.priority)) fail('Select a valid priority.');
    db.prepare('INSERT INTO requests(hospital,contact,blood_group,units,priority) VALUES (?,?,?,?,?)').run(hospital,contact,bloodGroup,units,body.priority);
    log(`${hospital} requested ${units} units of ${bloodGroup}.`, 'request');
  }
  function transition(id, action) {
    if (!['fulfill','cancel'].includes(action)) fail('Unknown action.');
    db.exec('BEGIN IMMEDIATE');
    try {
      const r=db.prepare('SELECT * FROM requests WHERE id=?').get(id);
      if (!r) fail('Request not found.',404);
      if (r.status!=='Pending') fail('This request has already been processed.',409);
      if (action==='fulfill') {
        const batches=db.prepare('SELECT * FROM batches WHERE blood_group=? AND expires>=? AND units>0 ORDER BY expires,id').all(r.blood_group,today());
        if (batches.reduce((s,b)=>s+b.units,0)<r.units) fail(`Insufficient ${r.blood_group} stock. Add more unexpired units first.`,409);
        let remaining=r.units;
        for(const b of batches) { if(!remaining) break; const used=Math.min(remaining,b.units); db.prepare('UPDATE batches SET units=units-? WHERE id=?').run(used,b.id); db.prepare('INSERT INTO allocations(request_id,batch_id,units) VALUES (?,?,?)').run(id,b.id,used); remaining-=used; }
      }
      const status=action==='fulfill'?'Fulfilled':'Cancelled';
      db.prepare('UPDATE requests SET status=? WHERE id=?').run(status,id);
      log(`${r.hospital}: request #${id} ${status.toLowerCase()} (${r.units} units, ${r.blood_group}).`,action==='fulfill'?'dispatch':'request');
      db.exec('COMMIT');
    } catch(e) { db.exec('ROLLBACK'); throw e; }
  }
  return { db, snapshot, addBatch, addRequest, transition, close:()=>db.close() };
}
module.exports = { createStore };
