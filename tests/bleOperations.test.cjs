const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const mod=name=>import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(path.join(__dirname,'../src/services/ble',name),'utf8')).toString('base64'));
test('maintenance blocks all command/device operations and requires idle bands',async()=>{
 const {createOperationGate}=await mod('operationGate.js');const gate=createOperationGate();
 gate.setWorkout('left',true);assert.throws(()=>gate.beginMaintenance('right'),/End the exercise/);
 gate.setWorkout('left',false);const release=gate.command('left');assert.throws(()=>gate.command('left'),/previous/);assert.throws(()=>gate.beginMaintenance('right'));
 release();const done=gate.beginMaintenance('right');assert.throws(()=>gate.command('left'),/update/);assert.throws(()=>gate.assertAvailable());done();gate.assertAvailable();
});
test('firmware rejection is surfaced despite successful write and monitor is removed',async()=>{
 const {sendAcknowledgedCommand}=await mod('commandResult.js');let callback,removed=0,writes=0;
 const device={monitorCharacteristicForService(s,c,cb){callback=cb;return{remove(){removed++;}}},async writeCharacteristicWithResponseForService(){writes++;queueMicrotask(()=>callback(null,{value:'137'}));}};
 await assert.rejects(sendAcknowledgedCommand({device,decode:x=>[Number(x)],timeoutMs:30}),/137/);assert.equal(writes,1);assert.equal(removed,1);
});
test('final success does not require an observable RUNNING status',async()=>{
 const {sendAcknowledgedCommand}=await mod('commandResult.js');let callback;
 const device={monitorCharacteristicForService(s,c,cb){callback=cb;return{remove(){}}},async writeCharacteristicWithResponseForService(){callback(null,{value:'1'});}};
 assert.equal(await sendAcknowledgedCommand({device,decode:x=>[+x],timeoutMs:30}),1);
});
test('ambiguous writes are never automatically retried',async()=>{
 const {sendAcknowledgedCommand}=await mod('commandResult.js');let writes=0,removed=0;
 const device={monitorCharacteristicForService(){return{remove(){removed++;}}},async writeCharacteristicWithResponseForService(){writes++;throw Error('lost connection');}};
 await assert.rejects(sendAcknowledgedCommand({device,decode:x=>[+x],timeoutMs:30}),/lost connection/);assert.equal(writes,1);assert.equal(removed,1);
});
