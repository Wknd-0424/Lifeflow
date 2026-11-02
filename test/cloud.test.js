const test=require('node:test');
const assert=require('node:assert/strict');
const {validate}=require('../lib/postgres-store');
test('cloud validation rejects impossible dates and invalid quantities',()=>{
 const body={donor:'Demo',blood_group:'O+',units:2,collected:'2026-02-30',expires:'2099-01-01'};
 assert.throws(()=>validate(body,true),/valid collection/);
 for(const units of [0,-1,1.5,1001,'2'])assert.throws(()=>validate({hospital:'Demo',contact:'Desk',blood_group:'O+',units,priority:'Normal'},false),/whole number/);
});
test('cloud validation accepts and trims complete requests',()=>{
 const body={hospital:' Demo ',contact:' Desk ',blood_group:'AB-',units:3,priority:'Urgent'};
 assert.equal(validate(body,false).hospital,'Demo');
 assert.throws(()=>validate({...body,blood_group:'X+'},false),/blood group/);
 assert.throws(()=>validate({...body,priority:'Invalid'},false),/priority/);
});
test('unconfigured cloud endpoint returns a clear error without credentials',async()=>{
 const old=process.env.DATABASE_URL;delete process.env.DATABASE_URL;
 try{const handler=require('../api');let result;const res={setHeader(){},end(value){result=JSON.parse(value);}};await handler({method:'GET',url:'/api/state'},res);assert.equal(res.statusCode,503);assert.match(result.error,/setup is incomplete/);}finally{if(old!==undefined)process.env.DATABASE_URL=old;}
});
