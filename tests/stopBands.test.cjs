const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../src/services/ble/stopBands.js'),'utf8');
const mod=import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('secondary receives STOP even if primary fails',async()=>{const {stopBands}=await mod;const calls=[];const failures=await stopBands([[{id:'a'},'primary'],[{id:'b'},'secondary']],async(d,s)=>{calls.push(s);if(s==='primary')throw Error('disconnected');});assert.deepEqual(calls,['primary','secondary']);assert.deepEqual(failures,['primary']);});
test('only the surviving band is addressed after a disconnect',async()=>{const {stopBands}=await mod;const calls=[];assert.deepEqual(await stopBands([[null,'primary'],[{id:'b'},'secondary']],async(d,s)=>calls.push(s)),[]);assert.deepEqual(calls,['secondary']);});
