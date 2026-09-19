import React,{useSyncExternalStore} from 'react';
let listeners=new Set();
const base={ROM:0,TUT:0,Velocity:0,Score:0,reps:0,sets:1,setc:0,exerciseStage:2,'Current Position':0};
let state={connectedDevice:null,secondaryDevice:null,feedback:{...base},secondaryFeedback:{...base},batteryLevels:{primary:92,secondary:87},deviceSettings:{primary:{limb:1,side:0},secondary:{limb:1,side:1}},bleState:'PoweredOn',showDeviceModal:false,scannedDevices:[],connecting:false};
export const commands=[];
function update(patch){state={...state,...patch};listeners.forEach(fn=>fn());}
function device(slot){return {id:slot,name:slot==='primary'?'bplx-DEMO-1':'bplx-DEMO-2',writeCharacteristicWithResponseForService:async(s,c,payload)=>{const bytes=Array.from(atob(payload),x=>x.charCodeAt(0));commands.push({slot,bytes});if(bytes[0]===4)update({[slot==='primary'?'feedback':'secondaryFeedback']:{...base}});},writeCharacteristicWithoutResponseForService:async()=>{}};}
export const connect=slot=>update({[slot==='primary'?'connectedDevice':'secondaryDevice']:device(slot)});
export const disconnect=slot=>update({[slot==='primary'?'connectedDevice':'secondaryDevice']:null});
export const addRep=()=>{const n=state.feedback.reps;const first=[116,126,135][n%3],second=[112,119,128][n%3];update({feedback:{...state.feedback,reps:n+1,ROM:first,TUT:3.2,Velocity:1.1,Score:first>120?100:50},secondaryFeedback:{...state.secondaryFeedback,reps:state.secondaryFeedback.reps+1,ROM:second,TUT:3.1,Velocity:1,Score:second>120?100:50}});};
export const nextSet=()=>update({feedback:{...state.feedback,sets:state.feedback.sets+1,reps:0},secondaryFeedback:{...state.secondaryFeedback,sets:state.secondaryFeedback.sets+1,reps:0}});
export const movement=value=>update({feedback:{...state.feedback,exerciseStage:value?3:2}});
export const useBle=()=>({...useSyncExternalStore(fn=>{listeners.add(fn);return()=>listeners.delete(fn)},()=>state,()=>state),scanAndConnect:connect,connectDevice:connect,disconnect,flashDevice:()=>{},cancelScan:()=>{},handleDeviceSelect:()=>{},readCurrentPosition:()=>{},updateDeviceSetting:(slot,key,value)=>update({deviceSettings:{...state.deviceSettings,[slot]:{...state.deviceSettings[slot],[key]:value}}})});
