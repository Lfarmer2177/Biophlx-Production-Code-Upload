const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../src/services/ble/runnerReadiness.js'),'utf8');
const modulePromise=import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('both devices must finish firmware initialization',async()=>{const {areBandsReady}=await modulePromise;assert.equal(areBandsReady(1,2),false);assert.equal(areBandsReady(2,1),false);assert.equal(areBandsReady(2,2),true);});
test('moving bands stay ready without waiting for another stationary interval',async()=>{const {areBandsReady}=await modulePromise;assert.equal(areBandsReady(3,4),true);assert.equal(areBandsReady(4,2),true);});
test('missing, stopped and unknown firmware stages never imply readiness',async()=>{const {areBandsReady}=await modulePromise;for(const stage of [undefined,null,0,255,'2']) assert.equal(areBandsReady(stage,2),false);});
