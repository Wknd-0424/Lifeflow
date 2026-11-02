const test=require('node:test');
const assert=require('node:assert/strict');
const {createStore}=require('../lib/store');
const day=n=>new Date(Date.now()+n*86400000).toISOString().slice(0,10);
function batch(store,units,expires,group='O+'){store.addBatch({donor:'Lab donor',blood_group:group,units,collected:day(-15),expires:day(expires)});}
function request(store,units,group='O+'){store.addRequest({hospital:'Lab hospital',contact:'Emergency desk',blood_group:group,units,priority:'Urgent'});return store.snapshot().requests[0].id;}
test('fulfillment allocates earliest expiry and prevents duplicate dispatch',()=>{
 const s=createStore(':memory:',false);try{batch(s,5,20);batch(s,3,2);const id=request(s,6);s.transition(id,'fulfill');const data=s.snapshot();assert.equal(data.batches.find(b=>b.id===2).units,0);assert.equal(data.batches.find(b=>b.id===1).units,2);assert.equal(data.stats.fulfilled,6);assert.equal(s.db.prepare('SELECT SUM(units) AS n FROM allocations').get().n,6);assert.throws(()=>s.transition(id,'fulfill'),/already been processed/);assert.equal(s.snapshot().stats.available,2);}finally{s.close();}
});
test('expired and incompatible units cannot fulfill request; failed allocation rolls back',()=>{
 const s=createStore(':memory:',false);try{batch(s,2,10);batch(s,12,10,'A+');s.db.prepare('INSERT INTO batches(donor,blood_group,units,collected,expires) VALUES (?,?,?,?,?)').run('Old bag','O+',40,day(-40),day(-1));const id=request(s,3);assert.throws(()=>s.transition(id,'fulfill'),/Insufficient/);const data=s.snapshot();assert.equal(data.requests[0].status,'Pending');assert.equal(data.stats.available,14);assert.equal(data.stats.expired,40);assert.equal(s.db.prepare('SELECT COUNT(*) AS n FROM allocations').get().n,0);}finally{s.close();}
});
test('cancellation does not consume stock and cannot be fulfilled',()=>{const s=createStore(':memory:',false);try{batch(s,5,10);const id=request(s,3);s.transition(id,'cancel');assert.equal(s.snapshot().stats.available,5);assert.equal(s.snapshot().requests[0].status,'Cancelled');assert.throws(()=>s.transition(id,'fulfill'));}finally{s.close();}});
test('validates group, quantity, chronology and real dates',()=>{const s=createStore(':memory:',false);try{assert.throws(()=>batch(s,-1,10));assert.throws(()=>batch(s,2.5,10));assert.throws(()=>batch(s,2,10,'X+'));assert.throws(()=>batch(s,2,-1));assert.throws(()=>s.addBatch({donor:'x',blood_group:'A+',units:1,collected:'2026-02-30',expires:day(4)}));assert.throws(()=>s.addRequest({hospital:'',contact:'x',blood_group:'A+',units:2,priority:'Normal'}));}finally{s.close();}});
test('expiry today remains available; seven-day alerts exclude expired stock',()=>{const s=createStore(':memory:',false);try{batch(s,2,0);batch(s,3,7);batch(s,4,8);assert.equal(s.snapshot().stats.expiring,5);s.transition(request(s,2),'fulfill');assert.equal(s.snapshot().batches.find(b=>b.id===1).units,0);}finally{s.close();}});
