import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useBIOPHLXTheme } from '../../Theme/BIOPHLXTheme';
import { groupRepSets, readBandMetrics, scoreTier, validScore } from './historyMetrics';

const tones={green:['#DCFCE7','#166534'],yellow:['#FEF3C7','#854D0E'],orange:['#FFEDD5','#9A3412'],red:['#FEE2E2','#991B1B'],unrated:['#E5E7EB','#374151']};
export function ScoreBadge({score,small=false}) {
  const n=validScore(score),[backgroundColor,color]=tones[scoreTier(n==null?null:Math.round(n))];
  return <View accessibilityLabel={n==null?'Not rated':`Score ${Math.round(n)} out of 100`} style={{backgroundColor,borderRadius:14,paddingVertical:small?8:12,paddingHorizontal:14,minWidth:70,alignItems:'center'}}><Text style={{color,fontSize:small?20:28,fontWeight:'800'}}>{n==null?'—':Math.round(n)}</Text><Text style={{color,fontSize:10,fontWeight:'600'}}>{n==null?'Not rated':'/ 100'}</Text></View>;
}
const chipColors=['#E60019','#F59E0B','#8B5CF6','#14B8A6','#EC4899','#3B82F6'];
export function MuscleBreakdown({segments=[]}) {
  const {colors}=useBIOPHLXTheme();
  const clean=segments.map(s=>({name:s.name,percent:Number(s.percent??s.percentage)})).filter(s=>Number.isFinite(s.percent)&&s.percent>0);
  const total=clean.reduce((n,s)=>n+s.percent,0);let angle=-Math.PI/2;
  return <View style={{gap:16,alignItems:'center'}}>
    {!!clean.length&&<Svg width={164} height={164} accessibilityLabel="Muscle workload distribution" accessibilityRole="image">{clean.map((s,i)=>{const next=angle+s.percent/total*Math.PI*2;const d=`M82 82 L${82+76*Math.cos(angle)} ${82+76*Math.sin(angle)} A76 76 0 ${next-angle>Math.PI?1:0} 1 ${82+76*Math.cos(next)} ${82+76*Math.sin(next)} Z`;angle=next;return clean.length===1?<Circle key={s.name} cx={82} cy={82} r={76} fill={chipColors[i%chipColors.length]}/>:<Path key={s.name} d={d} fill={chipColors[i%chipColors.length]}/>})}<Circle cx={82} cy={82} r={49} fill={colors.surface}/></Svg>}
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:9,justifyContent:'center'}}>{clean.map((s,i)=><View key={s.name} style={{flexDirection:'row',alignItems:'center',gap:7,backgroundColor:colors.raised,borderRadius:24,paddingHorizontal:13,paddingVertical:10}}><View style={{width:8,height:8,borderRadius:4,backgroundColor:chipColors[i%chipColors.length]}}/><Text style={{color:colors.text,fontSize:13}}>{s.name}</Text><Text style={{color:colors.text,fontSize:15,fontWeight:'800'}}>{s.percent.toFixed(0)}%</Text></View>)}</View>
    <Text style={{color:colors.muted,fontSize:12}}>{clean.length?'Estimated workload by muscle group':'No muscle distribution recorded'}</Text>
  </View>;
}
function MetricTiles({data}) {
  const {colors}=useBIOPHLXTheme();
  const format=(n,unit)=>n==null||n===''||!Number.isFinite(Number(n))?'—':`${Number(n).toFixed(unit==='°'?0:2)}${unit}`;
  return <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:12}}>{[['Time under tension','tut','s'],['Range of motion','rom','°'],['Velocity','velocity',' m/s'],['Momentum','momentum','']].map(([label,key,unit])=><View key={key} style={{width:'47%',padding:12,borderRadius:12,backgroundColor:colors.surface}}><Text style={{color:colors.muted,fontSize:11}}>{label}</Text><Text style={{color:colors.text,fontSize:18,fontWeight:'700',marginTop:5}}>{format(data?.[key],unit)}</Text></View>)}</View>;
}
function RepCard({rep}) {
  const {colors}=useBIOPHLXTheme();const [open,setOpen]=useState(false);const bands=readBandMetrics(rep.band_metrics);
  return <View style={{backgroundColor:colors.surface,borderRadius:16,borderWidth:1,borderColor:colors.border,overflow:'hidden'}}>
    <Pressable onPress={()=>setOpen(!open)} accessibilityRole="button" accessibilityState={{expanded:open}} accessibilityLabel={`Rep ${rep.session_item_rep_index} details`} style={{padding:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between',minHeight:64}}><View><Text style={{color:colors.text,fontSize:16,fontWeight:'700'}}>Rep {rep.session_item_rep_index}</Text><Text style={{color:colors.muted,fontSize:12,marginTop:4}}>{open?'Hide metrics':'View both bands'} {open?'⌃':'⌄'}</Text></View><ScoreBadge score={rep.score} small/></Pressable>
    {open&&<View style={{padding:12,gap:10}}>{bands.length?bands.map(b=><View key={b.band} style={{padding:14,borderRadius:14,backgroundColor:colors.raised}}><View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><View><Text style={{color:colors.text,fontWeight:'700',fontSize:16}}>{b.label||`Band ${b.band}`}</Text><Text style={{color:colors.muted,fontSize:12}}>Band {b.band}</Text></View><ScoreBadge score={b.score} small/></View>{b.missing?<Text style={{color:colors.muted,marginTop:10}}>Not recorded</Text>:<MetricTiles data={b}/>}</View>):<><Text style={{color:colors.muted,fontSize:13}}>This older rep saved combined metrics only. Individual band measurements were not recorded.</Text><View style={{padding:14,borderRadius:14,backgroundColor:colors.raised}}><Text style={{color:colors.text,fontWeight:'700'}}>Combined metrics</Text><MetricTiles data={rep}/></View><View style={{flexDirection:'row',gap:10}}>{[1,2].map(n=><View key={n} style={{flex:1,padding:12,borderRadius:12,backgroundColor:colors.raised}}><Text style={{color:colors.text}}>Band {n}</Text><Text style={{color:colors.muted,fontSize:12,marginTop:4}}>Not recorded</Text></View>)}</View></>}</View>}
  </View>;
}
export default function ExerciseHistory({name,reps,sets,loading}) {
  const {colors}=useBIOPHLXTheme();const [expanded,setExpanded]=useState({});const groups=groupRepSets(reps,sets);
  return <View style={{marginTop:18,gap:10}}><Text style={{color:colors.text,fontSize:19,fontWeight:'800'}}>{name}</Text>{loading?<ActivityIndicator color={colors.accent}/>:groups.length?groups.map(set=><View key={set.number} style={{borderRadius:18,borderWidth:1,borderColor:colors.border,backgroundColor:colors.raised,overflow:'hidden'}}><Pressable accessibilityRole="button" accessibilityLabel={`Set ${set.number} summary`} accessibilityState={{expanded:!!expanded[set.number]}} onPress={()=>setExpanded(p=>({...p,[set.number]:!p[set.number]}))} style={{padding:16,flexDirection:'row',justifyContent:'space-between',alignItems:'center',minHeight:84}}><View><Text style={{color:colors.text,fontSize:17,fontWeight:'700'}}>Set {set.number} summary {expanded[set.number]?'⌃':'⌄'}</Text><Text style={{color:colors.muted,fontSize:12,marginTop:6}}>{set.reps.length} reps{set.weight!=null?` · ${set.weight} lbs`:''}</Text></View><ScoreBadge score={set.score}/></Pressable>{expanded[set.number]&&<View style={{padding:12,gap:10}}>{set.reps.length?set.reps.map(rep=><RepCard key={rep.session_item_rep_index} rep={rep}/>):<Text style={{color:colors.muted}}>No reps recorded in this set.</Text>}</View>}</View>):<Text style={{color:colors.muted}}>No sets recorded.</Text>}<Text style={{color:colors.muted,fontSize:11}}>Score bands: red 0–49 · orange 50–69 · yellow 70–84 · green 85–100</Text></View>;
}
