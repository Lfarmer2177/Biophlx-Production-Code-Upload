export function validScore(value) {
  if (value == null || value === '' || typeof value === 'boolean') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
}
export function scoreTier(value) {
  const n = validScore(value);
  return n == null ? 'unrated' : n >= 85 ? 'green' : n >= 70 ? 'yellow' : n >= 50 ? 'orange' : 'red';
}
export function groupRepSets(reps = [], sets = []) {
  const groups = new Map();
  for (const set of sets) groups.set(Number(set.session_item_set_index), { number:Number(set.session_item_set_index), weight:set.weight_lifted, reps:[] });
  for (const rep of reps) {
    const n = Number(rep.session_item_set_index);
    if (!groups.has(n)) groups.set(n,{number:n,reps:[]});
    groups.get(n).reps.push(rep);
  }
  return [...groups.values()].sort((a,b)=>a.number-b.number).map(set=>{
    const scores=set.reps.map(r=>validScore(r.score)).filter(n=>n!=null);
    return {...set,reps:[...set.reps].sort((a,b)=>a.session_item_rep_index-b.session_item_rep_index),score:scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:null};
  });
}
export function readBandMetrics(raw) {
  try {
    const value=typeof raw==='string'?JSON.parse(raw):raw;
    if(value?.version!==1 || !Array.isArray(value.bands))return [];
    return [1,2].map(number=>value.bands.find(b=>b?.band===number)||{band:number,label:`Band ${number}`,missing:true});
  } catch {return [];}
}
